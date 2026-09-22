import { withSdkControlHost } from "./sdk-control-host.js";
import { SdkOperation, SdkCancelled, sdkDeadline } from "./sdk-operation.js";
import { OUTPUT_EXTENSION, supportsStoredOutput, readStoredOutput, } from "./stored-output.js";
import { ASYNC_TASKS, readLatestItems, taskItems } from "./async-tasks.js";
import { sdkTerminalResponse } from "./turn-failure.js";
import { readProgress } from "./session-progress.js";
import { RequestError, } from "@agentclientprotocol/sdk";
import { MspError } from "@muse-code/sdk";
import { realpathSync } from "node:fs";
import { sessionInfo, sessionInfoNotification } from "./session-discovery.js";
import { FileChangeEvidence } from "./file-change-evidence.js";
import { isReasoningEffort } from "./config-options.js";
import { assertSdkHostSupport, sdkHostExitMessage } from "./muse-host.js";
import { approvalSignature, approvalStageMetadata, approvalStallDetail, approvalToPermissionRequest, currentApprovalView, PermissionLifecycle, resolvePermissionChoice, } from "./muse-permissions.js";
import { MuseSdkTranslator } from "./muse-sdk-events.js";
import { answerUserInput, isElicitationUnsupported, settleUserInput, UserInputLifecycle, userInputToChatMessage, userInputToElicitation, } from "./muse-user-input.js";
import { MuseSdkHost } from "./muse-sdk-host.js";
export { MuseSdkHost } from "./muse-sdk-host.js";
import { readGoalFromConnection, parseGoalObservation, } from "./goal-state.js";
import { Pushable } from "./utils.js";
import { inputLimitMs, PendingWorkWatchdog, stallLimitMs, toolIdleMs, turnIdleMs, TurnSilenceWatchdog, } from "./pending-watchdog.js";
import { EARLY_CONTINUE_TEXT, MAX_EARLY_CONTINUATIONS, turnStoppedEarly, } from "./turn-continuation.js";
import { askKandevQuestion, } from "./kandev-question.js";
/** Read authoritative saved metadata without acquiring a writer lease. */
export async function readMuseSdkSession(options) {
    if (options.checkHost !== false)
        assertSdkHostSupport(options.env, options.museBinary);
    return withSdkControlHost(options, async (host) => {
        const result = await host.connection.command("session/read", {
            sessionId: options.sessionId,
            excludeItems: true,
        });
        const session = result.session;
        if (!session ||
            session.sessionId !== options.sessionId ||
            (session.modelId !== null && typeof session.modelId !== "string")) {
            throw new Error("Muse returned invalid saved session metadata");
        }
        if (session.workspaceRoot &&
            realpathSync(session.workspaceRoot) !== realpathSync(options.cwd)) {
            throw new Error("Saved Muse session belongs to a different workspace");
        }
        if (!options.allowActive &&
            (session.activeTurnId ||
                (Array.isArray(result.pendingRequests) && result.pendingRequests.length))) {
            throw new Error("Saved Muse session has an unfinished turn or pending input");
        }
        const outputSupported = supportsStoredOutput(host.initializeResult.serverInfo?.version);
        if (options.outputRequest && !outputSupported)
            throw RequestError.invalidRequest(undefined, "Stored output reads are unavailable on this Muse host");
        const items = options.readTasks || (options.readOutputReferences && outputSupported)
            ? await readLatestItems(host.connection, options.sessionId)
            : [];
        return {
            modelId: session.modelId,
            ...(typeof session.providerId === "string" ? { providerId: session.providerId } : {}),
            info: optionalSessionInfo(result.session),
            ...(options.readTasks ? { tasks: taskItems(items) } : {}),
            ...(options.readOutputReferences && outputSupported
                ? { outputItems: items.filter((i) => i.outputRef) }
                : {}),
            ...(options.outputRequest
                ? { output: await readStoredOutput(host.connection, options.outputRequest) }
                : {}),
            ...(options.readProgress
                ? { progress: await readProgress(host.connection, options.sessionId).catch(() => ({})) }
                : {}),
            ...(options.readGoal
                ? { goal: await readGoalFromConnection(host.connection, options.sessionId, result) }
                : {}),
        };
    });
}
/**
 * MSP rejects a decision aimed at a requirement the approval has already moved
 * past (tdd SS5.4). It means "re-read the approval", never "the turn failed".
 */
const STALE_APPROVAL_REQUIREMENT = -32053;
/** Preserve the public MSP effort vocabulary verified against Muse 1.1.1. */
export function sdkReasoningEffort(effort) {
    return isReasoningEffort(effort) ? effort : undefined;
}
/**
 * One durable `muse serve` host per turn. MuseClient/Session own MSP framing,
 * fold routing, and turn waits; this adapter translates folded items into ACP
 * updates and maps terminals/errors to PromptResponse / RequestError.
 */
export function spawnMuseSdkTurn(options) {
    const updates = new Pushable();
    const fileChanges = new FileChangeEvidence(options.cwd);
    const translator = new MuseSdkTranslator(options.sessionId, options.logger, fileChanges);
    const permissions = new PermissionLifecycle();
    const userInputs = new UserInputLifecycle();
    const owner = options.hostOwner ?? new MuseSdkHost(options);
    if (!owner.reusable)
        throw RequestError.invalidRequest(undefined, "Muse SDK host is closed or already serving a turn");
    let successful = false;
    let metadataTimedOut = false;
    let acquired = false;
    let acceptedTurn = false;
    let pendingSteers = 0;
    let connection;
    let turnId;
    let generation = 0;
    let cancelled = false;
    let cancellationWon = false;
    let finished = false;
    let settled = false;
    /** Question was posted to the user and the host turn was stopped on purpose. */
    let questionHandedOff = false;
    let stopInteractions;
    const interactionsStopped = new Promise((resolve) => {
        stopInteractions = () => resolve(null);
    });
    let cancelTimer;
    const startupMs = sdkDeadline(options.env, "STARTUP");
    const submitMs = sdkDeadline(options.env, "SUBMIT");
    const close = async () => {
        permissions.disposeAll();
        userInputs.disposeAll();
        await owner.close();
    };
    const operation = new SdkOperation(() => {
        void close().catch(() => { });
    }, (text) => options.logger.log(text));
    const failTurn = operation.fail;
    operation.enter("initializing", startupMs);
    function kill() {
        if (cancelled || finished) {
            return;
        }
        cancellationWon = !operation.failure;
        cancelled = true;
        if (!connection || !turnId)
            operation.fail(new SdkCancelled("Muse SDK startup cancelled"));
        stopInteractions();
        if (turnId) {
            permissions.disposeTurn(turnId);
            userInputs.disposeTurn(turnId);
        }
        if (connection && turnId) {
            void connection
                .command("turn/cancel", { sessionId: options.sessionId, turnId }, { maxAttempts: 1 })
                .catch(() => close());
            cancelTimer = setTimeout(() => void close(), 5_000);
        }
        else {
            void close();
        }
    }
    const done = (async () => {
        try {
            const lease = await operation.wait(owner.acquire(options, failTurn, () => operation.enter("preparing", startupMs)));
            translator.configureWorkers(owner.generation, owner.workflowCancellationSupported, options.clientCapabilities?._meta?.[ASYNC_TASKS] === 1);
            translator.configureOutput(supportsStoredOutput(lease.host.initializeResult.serverInfo?.version) &&
                options.clientCapabilities?._meta?.[OUTPUT_EXTENSION] === 1);
            acquired = true;
            connection = lease.host.connection;
            const session = lease.session;
            const adoptTurn = (nextTurnId) => {
                if (turnId === nextTurnId && generation > 0) {
                    return;
                }
                turnId = nextTurnId;
                generation = permissions.beginTurn(nextTurnId);
                userInputs.beginTurn(nextTurnId);
            };
            // Gap fill runs automatically on wired Sessions. Only hard fill failures
            // become turn errors; recoverable gaps must not abort the prompt.
            session.onGapError((error) => {
                if (cancelled || options.isCancelled?.()) {
                    return;
                }
                failTurn(new Error(`Muse SDK gap fill failed (${error.reason}); reload the session before continuing`));
            });
            if (cancelled || options.isCancelled?.()) {
                return { stopReason: "cancelled" };
            }
            operation.enter("submitting", submitMs);
            const turn = await operation.wait(session.sendUserTurn({
                input: options.input,
                ...(sdkReasoningEffort(options.reasoningEffort)
                    ? { reasoningEffort: sdkReasoningEffort(options.reasoningEffort) }
                    : {}),
            }));
            adoptTurn(turn.turnId);
            acceptedTurn = true;
            if (options.steering)
                updates.push({
                    sessionId: options.sessionId,
                    update: {
                        sessionUpdate: "session_info_update",
                        _meta: { "muse/activeTurnId": turn.turnId },
                    },
                });
            operation.enter("running");
            // Advisory, emitted once per host: a client that later reports a stall
            // should be able to name the host and schema it was talking to.
            const compatibility = owner.takeCompatibilityAnnouncement();
            if (compatibility)
                updates.push({
                    sessionId: options.sessionId,
                    update: {
                        sessionUpdate: "session_info_update",
                        _meta: { "muse/hostCompatibility": compatibility },
                    },
                });
            const emitItem = (item) => {
                // Hold publication while a gap fill is reconstituting the fold.
                // After a question handoff, drop later model text so a host that
                // keeps generating cannot invent an answer in this turn.
                if (!session.fold.current || questionHandedOff) {
                    return;
                }
                for (const update of translator.fromItem(item)) {
                    updates.push(update);
                }
            };
            const flushFold = () => {
                if (!session.fold.current) {
                    return;
                }
                for (const held of session.fold.items.list()) {
                    if (held.turnId === turn.turnId) {
                        emitItem(held);
                        for (const field of session.fold.items
                            .accumulatedFields(held.itemId)
                            .toSorted((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
                            for (const update of translator.fromAccumulated(held.itemId, field, session.fold.items.accumulated(held.itemId, field) ?? ""))
                                updates.push(update);
                        }
                    }
                }
            };
            const publishedApprovals = new Set();
            const publishApprovalResults = () => {
                if (options.clientCapabilities?._meta?.["muse/approval"] !== 1 ||
                    !session.fold.current ||
                    cancelled ||
                    options.isCancelled?.())
                    return;
                for (const approval of session.fold.resolvedApprovals()) {
                    if (approval.turnId !== turnId || publishedApprovals.has(approval.approvalId))
                        continue;
                    publishedApprovals.add(approval.approvalId);
                    updates.push({
                        sessionId: options.sessionId,
                        update: {
                            sessionUpdate: "session_info_update",
                            _meta: {
                                "muse/approval": {
                                    approvalId: approval.approvalId,
                                    turnId: approval.turnId,
                                    decision: approval.decision,
                                    resolvedBy: approval.resolvedBy,
                                    stages: approval.stageEvidence?.map(approvalStageMetadata),
                                },
                            },
                        },
                    });
                }
            };
            // ---- Approval reconciliation ---------------------------------------
            // Muse 1.2.1 advances a multi-stage approval by REFRESHING it
            // (`approval/updated`) instead of re-issuing `approval/requested`, and the
            // pinned SDK routes only the request to `onApproval` — so a router-driven
            // client answers stage 0 and then waits forever (w2/m1 "Issue cause").
            // Deciding from the fold covers both frames with one path, the way pending
            // user input is already handled, and keeps the SDK's stage latch out of the
            // critical path. The ACP round trip is NOT awaited in the poll loop:
            // independent approvals must stay concurrent for the client.
            const askedRequirements = new Set();
            const decidingApprovals = new Set();
            const turnApprovals = () => {
                if (!session.fold.current || !turnId) {
                    return [];
                }
                return session.fold
                    .pendingApprovals()
                    .map((pending) => pending)
                    .filter((pending) => currentApprovalView(pending).turnId === turnId);
            };
            const decideApproval = async (view) => {
                const approvalGeneration = generation;
                if (!permissions.track(view.approvalId, view.turnId, view.toolCallId, approvalGeneration)) {
                    return;
                }
                let choiceId;
                try {
                    if (options.automaticDecision) {
                        const choice = view.availableChoices.find((c) => options.automaticDecision === "approve"
                            ? c.decision === "approved" && c.scope === "once"
                            : (c.decision === "denied" || c.decision === "abort") && c.scope === "once");
                        if (!choice)
                            throw new Error(`Automatic ${options.automaticDecision} unavailable: Muse offered no eligible once choice; the turn was stopped without granting permission`);
                        choiceId = choice.choiceId;
                    }
                    else {
                        const response = await Promise.race([
                            options.acpClient.requestPermission(approvalToPermissionRequest(options.sessionId, view, options.clientCapabilities?._meta?.["muse/approval"] === 1)),
                            interactionsStopped,
                        ]);
                        if (!response)
                            return;
                        choiceId = resolvePermissionChoice(view, response);
                    }
                    if (cancelled ||
                        options.isCancelled?.() ||
                        !permissions.isLive(view.approvalId, view.turnId, approvalGeneration))
                        return;
                    // Do not decide a stage the fold has already settled while the dialog was open.
                    if (!turnApprovals().some((p) => {
                        const current = currentApprovalView(p);
                        return (current.approvalId === view.approvalId &&
                            current.currentRequirementId.sourceIndex === view.currentRequirementId.sourceIndex);
                    }))
                        return;
                    const choice = view.availableChoices.find((c) => c.choiceId === choiceId);
                    if (choice?.scope === "localPersistent")
                        owner.watchPolicyPersistence(view.approvalId, view.viewCursor);
                    if (choice && ["approved", "approvedForSession"].includes(choice.decision))
                        fileChanges.beforeApproval(view.toolName, view.rawArgs);
                    await connection.command("approval/decide", {
                        sessionId: options.sessionId,
                        approvalId: view.approvalId,
                        choiceId,
                        // Echoed from the view the host last published; a remembered value
                        // is exactly what MSP -32053 exists to reject.
                        requirementId: view.currentRequirementId,
                    }, { maxAttempts: 1 });
                }
                catch (error) {
                    if (error instanceof MspError &&
                        (error.code === STALE_APPROVAL_REQUIREMENT ||
                            error.kind === "approvalRequirementStale" ||
                            error.data?.kind === "approvalRequirementStale" ||
                            error.kind === "approvalAlreadyResolved" ||
                            error.data?.kind === "approvalAlreadyResolved")) {
                        // The host advanced this approval while the client was deciding. The
                        // refreshed requirement lands on the fold and is decided on a later
                        // tick; the pending-work watchdog bounds the wait if it never does.
                        // Kind is matched as well as code: a host may report the same
                        // stale/already-resolved outcome wrapped as MSP -32603 internal.
                        options.logger.log(`muse-sdk: approval ${view.approvalId} requirement ${view.currentRequirementId.sourceIndex} was superseded`);
                        return;
                    }
                    if (error instanceof MspError &&
                        error.code === -32603 &&
                        !cancelled &&
                        !options.isCancelled?.()) {
                        // Internal error on decide: the decision may or may not have
                        // landed. When the fold no longer shows this exact requirement the
                        // approval resolved or advanced; let reconcile/publish handle it
                        // instead of failing the turn. Otherwise retry once with the same
                        // host-offered choice: a retry against a just-settled approval
                        // bounces benign above, while a transient failure gets a second
                        // chance without re-prompting the client.
                        const key = `${view.approvalId}:${view.currentRequirementId.sourceIndex}`;
                        const fresh = turnApprovals()
                            .map((pending) => currentApprovalView(pending))
                            .find((current) => current.approvalId === view.approvalId &&
                            current.currentRequirementId.sourceIndex ===
                                view.currentRequirementId.sourceIndex);
                        if (!fresh) {
                            options.logger.log(`muse-sdk: approval ${view.approvalId} requirement ${view.currentRequirementId.sourceIndex} settled despite internal error; continuing`);
                            return;
                        }
                        if (choiceId === undefined ||
                            !fresh.availableChoices.some((choice) => choice.choiceId === choiceId)) {
                            askedRequirements.delete(key);
                            options.logger.log(`muse-sdk: approval ${view.approvalId} requirement ${view.currentRequirementId.sourceIndex} changed during internal error; re-asking`);
                            return;
                        }
                        try {
                            await connection.command("approval/decide", {
                                sessionId: options.sessionId,
                                approvalId: view.approvalId,
                                choiceId,
                                requirementId: view.currentRequirementId,
                            }, { maxAttempts: 1 });
                            return;
                        }
                        catch (retryError) {
                            if (retryError instanceof MspError &&
                                (retryError.code === STALE_APPROVAL_REQUIREMENT ||
                                    retryError.kind === "approvalRequirementStale" ||
                                    retryError.data?.kind === "approvalRequirementStale" ||
                                    retryError.kind === "approvalAlreadyResolved" ||
                                    retryError.data?.kind === "approvalAlreadyResolved")) {
                                options.logger.log(`muse-sdk: approval ${view.approvalId} requirement ${view.currentRequirementId.sourceIndex} was superseded on retry`);
                                return;
                            }
                            if (cancelled || options.isCancelled?.()) {
                                return;
                            }
                            options.logger.log(`muse-sdk: approval ${view.approvalId} decision retry rejected (MSP ${retryError instanceof MspError ? `${retryError.code} ${retryError.kind}` : String(retryError)})`);
                            failTurn(retryError instanceof MspError
                                ? new Error(`Muse approval decision rejected (MSP ${retryError.code})`)
                                : retryError);
                            return;
                        }
                    }
                    if (cancelled || options.isCancelled?.()) {
                        return;
                    }
                    failTurn(error instanceof MspError
                        ? new Error(`Muse approval decision rejected (MSP ${error.code})`)
                        : error);
                }
                finally {
                    permissions.resolve(view.approvalId);
                }
            };
            const reconcileApprovals = () => {
                if (!connection || !session.fold.current || cancelled || options.isCancelled?.()) {
                    return;
                }
                for (const pending of turnApprovals()) {
                    const view = currentApprovalView(pending);
                    const key = `${view.approvalId}:${view.currentRequirementId.sourceIndex}`;
                    // Keyed by requirement, not approval: a multi-stage approval must be
                    // asked once per stage, and never twice for the same stage.
                    if (askedRequirements.has(key) || decidingApprovals.has(view.approvalId)) {
                        continue;
                    }
                    askedRequirements.add(key);
                    decidingApprovals.add(view.approvalId);
                    void decideApproval(view).finally(() => decidingApprovals.delete(view.approvalId));
                }
            };
            const answeredUserInputs = new Set();
            // The client round trip runs detached from the poll loop: a client that
            // never answers must not block the watchdog that bounds the wait.
            // In-flight inputs stay tracked, so a stalled host request fails the
            // turn instead of hanging it (same shape as decideApproval above).
            const askOneUserInput = async (request) => {
                if (!connection) {
                    // Reject the ACP prompt first so turn/completed from cancel cannot
                    // win Promise.race and report a successful end_turn.
                    failTurn(new Error("Muse requested user input but there is no host connection"));
                    userInputs.resolve(request.userInputId);
                    return;
                }
                if (options.kandevQuestion) {
                    kandevQuestionInFlight = true;
                    try {
                        const answers = await askKandevQuestion(options.kandevQuestion, request);
                        if (!userInputs.isLive(request.userInputId, turnId, generation))
                            return;
                        if (answers === "cancel") {
                            await settleUserInput(connection, options.sessionId, request, { action: "cancel" });
                            return;
                        }
                        if (answers !== "reject") {
                            await answerUserInput(connection, options.sessionId, request, answers);
                            options.logger.log("muse-sdk: answered user input via the kandev question card");
                            return;
                        }
                    }
                    catch (error) {
                        options.logger.log(`muse-sdk: kandev question card failed: ${error instanceof Error ? error.message : error}`);
                    }
                    finally {
                        kandevQuestionInFlight = false;
                    }
                }
                if (options.clientCapabilities?.elicitation?.form == null) {
                    // The client did not advertise form elicitation — attempt the
                    // elicitation anyway and fall back to asking in chat when the
                    // endpoint does not exist (handled below).
                    options.logger.log("muse-sdk: client did not advertise form elicitation; attempting elicitation anyway");
                }
                try {
                    if (cancelled || options.isCancelled?.()) {
                        await settleUserInput(connection, options.sessionId, request, {
                            action: "cancel",
                        });
                        return;
                    }
                    const response = await Promise.race([
                        options.acpClient.createElicitation(userInputToElicitation(options.sessionId, request)),
                        interactionsStopped,
                    ]);
                    if (!response || !userInputs.isLive(request.userInputId, turnId, generation)) {
                        return;
                    }
                    await settleUserInput(connection, options.sessionId, request, response);
                }
                catch (error) {
                    if (isElicitationUnsupported(error)) {
                        // The client has no elicitation endpoint (Kandev answers
                        // elicitation.create with "Method not found", plain or wrapped).
                        // Post the question and stop the host turn. Do not
                        // userInput/answer and do not userInput/cancel: cancel resumes
                        // generation, and request_permission is an approval the client
                        // may auto-grant. Either one lets the model pick for the user.
                        // The next user message is the answer.
                        options.logger.log("muse-sdk: elicitation unsupported; stopping the turn and asking in chat");
                        try {
                            await options.acpClient.sessionUpdate({
                                sessionId: options.sessionId,
                                update: {
                                    sessionUpdate: "agent_message_chunk",
                                    content: {
                                        type: "text",
                                        text: `${userInputToChatMessage(request)}\n\n`,
                                    },
                                },
                            });
                        }
                        catch (postError) {
                            failTurn(postError);
                            return;
                        }
                        if (cancelled || options.isCancelled?.()) {
                            return;
                        }
                        questionHandedOff = true;
                        try {
                            await connection.command("turn/cancel", { sessionId: options.sessionId, turnId: request.turnId }, { maxAttempts: 1 });
                        }
                        catch (cancelError) {
                            if (!cancelled && !options.isCancelled?.()) {
                                failTurn(cancelError);
                            }
                        }
                        return;
                    }
                    // Invalid answers and failed client RPCs must fail the prompt, not
                    // silently terminate a pump while Muse waits forever for input.
                    failTurn(error);
                    await connection
                        .command("userInput/cancel", {
                        sessionId: options.sessionId,
                        userInputId: request.userInputId,
                        reason: "client input failed validation or delivery",
                    }, { maxAttempts: 1 })
                        .catch(() => { });
                    return;
                }
                finally {
                    userInputs.resolve(request.userInputId);
                }
            };
            const handlePendingUserInputs = async () => {
                for (const pendingInput of session.fold.pendingUserInputs()) {
                    const request = pendingInput;
                    if (request.turnId !== turnId) {
                        continue;
                    }
                    // `has` covers the round trip in progress; `answeredUserInputs`
                    // covers the window after it, because the fold keeps the prompt until
                    // `userInput/settled` arrives and a stalled host never sends one.
                    if (userInputs.has(request.userInputId) || answeredUserInputs.has(request.userInputId)) {
                        continue;
                    }
                    if (!userInputs.track(request.userInputId, turnId, generation)) {
                        continue;
                    }
                    answeredUserInputs.add(request.userInputId);
                    void askOneUserInput(request).catch(failTurn);
                }
            };
            const watchdog = new PendingWorkWatchdog(stallLimitMs(options.env), Date.now, inputLimitMs(options.env));
            let kandevQuestionInFlight = false;
            const silence = new TurnSilenceWatchdog(turnIdleMs(options.env));
            const toolSilence = new TurnSilenceWatchdog(toolIdleMs(options.env));
            const toolBusy = () => {
                if (!turnId || !session.fold.current)
                    return false;
                return session.fold.items.list().some((item) => item.turnId === turnId &&
                    item.status === "inProgress" &&
                    (item.kind === "toolCall" ||
                        item.kind === "userShell" ||
                        item.kind === "workflow" ||
                        item.kind === "subagent"));
            };
            const clientDeciding = () => {
                if (decidingApprovals.size > 0)
                    return true;
                if (!session.fold.current || !turnId)
                    return false;
                for (const pendingInput of session.fold.pendingUserInputs()) {
                    const request = pendingInput;
                    if (request.turnId === turnId && userInputs.has(request.userInputId))
                        return true;
                }
                return false;
            };
            const pendingWork = () => {
                const items = [];
                if (!session.fold.current || !turnId) {
                    return items;
                }
                for (const pending of turnApprovals()) {
                    items.push({
                        kind: "approval",
                        id: pending.requested.approvalId,
                        signature: approvalSignature(pending),
                        inFlight: decidingApprovals.has(pending.requested.approvalId),
                        detail: approvalStallDetail(pending),
                    });
                }
                for (const pendingInput of session.fold.pendingUserInputs()) {
                    const request = pendingInput;
                    if (request.turnId !== turnId)
                        continue;
                    items.push({
                        kind: "userInput",
                        id: request.userInputId,
                        signature: request.userInputId,
                        inFlight: userInputs.has(request.userInputId),
                        detail: `Muse user input ${request.userInputId} is still pending; ` +
                            `last host frame userInput/requested`,
                    });
                }
                return items;
            };
            const checkPendingWork = () => {
                if (cancelled || options.isCancelled?.() || settled || finished || questionHandedOff) {
                    return;
                }
                if (kandevQuestionInFlight) {
                    // The question card stays open until the person answers. That wait
                    // is not a stalled host and not a silent turn.
                    silence.activity();
                    toolSilence.activity();
                    return;
                }
                if (clientDeciding()) {
                    // An open permission or elicitation dialog is the user's time, not
                    // host silence. The input bound above still fails a client that
                    // never answers.
                    silence.activity();
                    toolSilence.activity();
                }
                else if (toolBusy()) {
                    // A running tool is progress even when it publishes nothing for a
                    // while. The short silence clock must not cut off a long command.
                    // A tool that never publishes again still fails, on the longer bound.
                    silence.activity();
                    const hungTool = toolSilence.check();
                    if (hungTool) {
                        failTurn(new Error(`${hungTool}. A tool was still running and published nothing further; the turn was stopped instead of hanging.`));
                        if (connection && turnId) {
                            void connection
                                .command("turn/cancel", { sessionId: options.sessionId, turnId }, { maxAttempts: 1 })
                                .catch(() => { });
                        }
                        return;
                    }
                }
                else {
                    toolSilence.activity();
                    const silent = silence.check();
                    if (silent) {
                        failTurn(new Error(`${silent}. The Muse host stopped emitting progress; the turn was stopped instead of hanging.`));
                        if (connection && turnId) {
                            void connection
                                .command("turn/cancel", { sessionId: options.sessionId, turnId }, { maxAttempts: 1 })
                                .catch(() => { });
                        }
                        return;
                    }
                }
                const stalled = watchdog.check(pendingWork());
                if (!stalled) {
                    return;
                }
                // Reject the ACP prompt BEFORE asking the host to unwind, so a
                // turn/completed produced by the cancellation cannot win the race and
                // report a successful end_turn (same ordering as failed user input).
                failTurn(new Error(`${stalled}. The Muse host is waiting for a decision this adapter did not make; ` +
                    "reload the session or report this with the host version."));
                if (connection && turnId) {
                    void connection
                        .command("turn/cancel", { sessionId: options.sessionId, turnId }, { maxAttempts: 1 })
                        .catch(() => { });
                }
            };
            // deltas() is live-only; catch up anything folded before the turn ack.
            flushFold();
            let foldWasCurrent = session.fold.current;
            const watchTurn = (active) => {
                const items = (async () => {
                    for await (const item of active.items()) {
                        silence.activity();
                        toolSilence.activity();
                        await handlePendingUserInputs();
                        // Replay held items only when a gap fill restores currency.
                        if (!foldWasCurrent && session.fold.current) {
                            flushFold();
                        }
                        foldWasCurrent = session.fold.current;
                        emitItem(item);
                    }
                })();
                const deltas = (async () => {
                    for await (const delta of active.deltas()) {
                        silence.activity();
                        toolSilence.activity();
                        if (!session.fold.current || questionHandedOff) {
                            continue;
                        }
                        for (const update of translator.fromDelta(delta)) {
                            updates.push(update);
                        }
                    }
                })();
                void items.catch(failTurn);
                void deltas.catch(failTurn);
                return { items, deltas };
            };
            const watchClient = () => {
                const loop = (async () => {
                    while (!finished && !settled && !cancelled) {
                        reconcileApprovals();
                        await handlePendingUserInputs();
                        publishApprovalResults();
                        checkPendingWork();
                        await new Promise((resolve) => setTimeout(resolve, 25));
                    }
                })();
                void loop.catch(failTurn);
                return loop;
            };
            let activeTurn = turn;
            let streams = watchTurn(activeTurn);
            let clientLoop = watchClient();
            let continuations = 0;
            let response;
            for (;;) {
                const outcome = await operation.wait(activeTurn.completed);
                settled = true;
                watchdog.reset();
                await Promise.all([
                    streams.items.catch(() => { }),
                    streams.deltas.catch(() => { }),
                    clientLoop.catch(() => { }),
                ]);
                flushFold();
                publishApprovalResults();
                response = sdkTerminalResponse(outcome, options.env);
                if (questionHandedOff &&
                    !cancelled &&
                    !options.isCancelled?.() &&
                    (response.stopReason === "cancelled" || response.stopReason === "end_turn")) {
                    // The question is already in the transcript and the model was stopped
                    // before it could choose. The user's next message is the answer.
                    response = { stopReason: "end_turn" };
                }
                const usage = session.fold.sessionState.get("session/tokenUsage");
                const finishReason = usage?.turnId === activeTurn.turnId ? usage.finishReason : undefined;
                const unfinished = response.stopReason === "end_turn" &&
                    !questionHandedOff &&
                    !cancelled &&
                    !options.isCancelled?.() &&
                    turnStoppedEarly(session.fold.items.list(), activeTurn.turnId, finishReason);
                if (!unfinished || continuations >= MAX_EARLY_CONTINUATIONS) {
                    if (unfinished)
                        response = { stopReason: "max_turn_requests" };
                    break;
                }
                continuations++;
                options.logger.log("muse-sdk: model stopped before the reply was finished; continuing");
                settled = false;
                silence.activity();
                toolSilence.activity();
                const next = await operation.wait(session.sendUserTurn({
                    input: [{ type: "text", text: EARLY_CONTINUE_TEXT }],
                }));
                adoptTurn(next.turnId);
                activeTurn = next;
                streams = watchTurn(activeTurn);
                clientLoop = watchClient();
            }
            stopInteractions();
            await owner.observeSessionState();
            successful = response.stopReason === "end_turn";
            if (successful && turnId)
                owner.retainProgress(turnId, translator);
            const goal = parseGoalObservation(session.fold.sessionState.get("session/goalChanged")?.goal);
            if (successful &&
                !owner.hasActiveTurn &&
                !(goal.status === "known" && goal.goal?.status === "active")) {
                let metadataTimer;
                try {
                    const saved = await Promise.race([
                        connection.request("session/read", {
                            sessionId: options.sessionId,
                            excludeItems: true,
                        }),
                        new Promise((resolve) => {
                            metadataTimer = setTimeout(() => {
                                metadataTimedOut = true;
                                resolve(undefined);
                            }, 1000);
                        }),
                    ]);
                    const info = optionalSessionInfo(saved?.session);
                    if (info?.sessionId === options.sessionId && !cancelled && !options.isCancelled?.()) {
                        updates.push(sessionInfoNotification(info, options.clientCapabilities));
                    }
                }
                catch {
                    /* Metadata enrichment must not change a completed turn. */
                }
                finally {
                    clearTimeout(metadataTimer);
                }
            }
            return response;
        }
        catch (error) {
            if ((cancelled || options.isCancelled?.()) &&
                (cancellationWon || !operation.failure || operation.failure instanceof SdkCancelled)) {
                return { stopReason: "cancelled" };
            }
            const diagnostic = sdkHostExitMessage(owner.stderr);
            operation.fail(error);
            throw operation.error(error, options.env, diagnostic);
        }
        finally {
            finished = true;
            stopInteractions();
            operation.dispose();
            clearTimeout(cancelTimer);
            if (turnId) {
                permissions.disposeTurn(turnId);
                userInputs.disposeTurn(turnId);
            }
            permissions.disposeAll();
            userInputs.disposeAll();
            const cleanup = acquired
                ? owner.release(!!options.hostOwner &&
                    successful &&
                    !cancelled &&
                    !metadataTimedOut &&
                    pendingSteers === 0)
                : owner.close();
            await cleanup.catch((cleanupError) => {
                if (!operation.failure && !cancelled)
                    throw cleanupError;
                options.logger.log("Muse SDK cleanup failed after termination; retaining the initiating cause");
            });
            if (options.steering)
                updates.push({
                    sessionId: options.sessionId,
                    update: { sessionUpdate: "session_info_update", _meta: { "muse/activeTurnId": null } },
                });
            if (options.fileReportRequestId)
                updates.push({
                    sessionId: options.sessionId,
                    update: {
                        sessionUpdate: "session_info_update",
                        _meta: fileChanges.report(options.fileReportRequestId, cancelled || options.isCancelled?.()
                            ? "cancelled"
                            : successful
                                ? "completed"
                                : "failed"),
                    },
                });
            updates.end();
        }
    })();
    void done.catch(() => { });
    return {
        updates,
        done,
        kill,
        get activeTurnId() {
            return acceptedTurn && !finished && !settled && !cancelled ? turnId : undefined;
        },
        async steer(input, expectedTurnId) {
            if (!acceptedTurn ||
                !turnId ||
                expectedTurnId !== turnId ||
                !connection ||
                finished ||
                settled ||
                cancelled ||
                owner.closed) {
                throw RequestError.invalidRequest(undefined, "No matching active Muse turn accepts steering");
            }
            let steerTimer;
            pendingSteers++;
            try {
                const deadline = new Promise((_, reject) => {
                    steerTimer = setTimeout(() => {
                        const error = new Error("Muse steering acknowledgement timed out; outcome is unknown");
                        reject(error);
                        failTurn(error);
                        void owner.close();
                    }, 10_000);
                });
                const result = await Promise.race([
                    deadline,
                    connection.command("turn/steer", {
                        sessionId: options.sessionId,
                        expectedTurnId,
                        input,
                        ...(sdkReasoningEffort(options.reasoningEffort)
                            ? { reasoningEffort: sdkReasoningEffort(options.reasoningEffort) }
                            : {}),
                    }, { maxAttempts: 1 }),
                ]);
                if (result.status !== "accepted")
                    throw RequestError.internalError(undefined, "Muse returned malformed steering acknowledgement");
                if (result.turnId !== expectedTurnId)
                    throw RequestError.internalError(undefined, "Muse acknowledged steering for a different turn");
                return { turnId: result.turnId, status: result.status };
            }
            finally {
                pendingSteers--;
                clearTimeout(steerTimer);
            }
        },
    };
}
function optionalSessionInfo(value) {
    try {
        return sessionInfo(value);
    }
    catch {
        return;
    }
}
