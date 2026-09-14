import { readProgress, type ProgressFacts } from "./session-progress.js";
import {
  ClientCapabilities,
  PromptResponse,
  RequestError,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import {
  Connection,
  MspError,
  spawnMspConnection,
  isLaunchFailure,
  type TurnOutcome,
  type FoldedItem,
} from "@muse-code/sdk";
import packageJson from "../package.json" with { type: "json" };
import { realpathSync } from "node:fs";
import type { AcpClient } from "./acp-agent.js";
import { sessionInfo, sessionInfoNotification } from "./session-discovery.js";
import type { SessionInfo } from "@agentclientprotocol/sdk";
import { FileChangeEvidence } from "./file-change-evidence.js";
import { Logger } from "./logger.js";
import { isReasoningEffort, type MuseReasoningEffort } from "./config-options.js";
import { museCliPath } from "./muse-cli.js";
import { assertSdkHostSupport, sdkHostExitMessage } from "./muse-host.js";
import {
  approvalSignature,
  approvalStageMetadata,
  approvalStallDetail,
  approvalToPermissionRequest,
  currentApprovalView,
  MuseApprovalRequest,
  MusePendingApproval,
  PermissionLifecycle,
  resolvePermissionChoice,
} from "./muse-permissions.js";
import { MuseSdkTranslator } from "./muse-sdk-events.js";
import type { MuseInputPart } from "./prompt-content.js";
import {
  MuseUserInputRequest,
  settleUserInput,
  UserInputLifecycle,
  userInputToElicitation,
} from "./muse-user-input.js";
import { MuseSdkHost } from "./muse-sdk-host.js";
export { MuseSdkHost } from "./muse-sdk-host.js";
import {
  readGoalFromConnection,
  parseGoalObservation,
  type GoalObservation,
} from "./goal-state.js";
import { Pushable } from "./utils.js";
import { PendingWorkWatchdog, stallLimitMs, type PendingWorkItem } from "./pending-watchdog.js";

export interface MuseSdkOptions {
  sessionId: string;
  cwd: string;
  /** Ordered Muse turn input parts (text encodings of ACP content). */
  input: MuseInputPart[];
  model: string;
  providerId?: string;
  profileId?: string | null;
  reasoningEffort: string;
  readOnly: boolean;
  safety?: import("./safety-settings.js").SafetySettings;
  automaticDecision?: "approve" | "reject";
  museBinary?: string;
  env: Record<string, string | undefined>;
  logger: Logger;
  /** When false, skip the serve --help probe (tests with fake-msp). */
  checkHost?: boolean;
  acpClient: AcpClient;
  clientCapabilities?: ClientCapabilities;
  fileReportRequestId?: string;
  /** Read cancelRequested from the ACP session while the turn runs. */
  isCancelled?: () => boolean;
  hostOwner?: MuseSdkHost;
  /** Negotiated active-turn metadata for the namespaced steering request. */
  steering?: boolean;
}

export interface MuseSdkHandle {
  updates: AsyncIterable<SessionNotification>;
  done: Promise<PromptResponse>;
  kill(): void;
  readonly activeTurnId: string | undefined;
  steer(
    input: MuseInputPart[],
    expectedTurnId: string,
  ): Promise<{ turnId: string; status: string }>;
}

/** Read authoritative saved metadata without acquiring a writer lease. */
export async function readMuseSdkSession(
  options: Pick<
    MuseSdkOptions,
    "sessionId" | "cwd" | "env" | "museBinary" | "logger" | "checkHost"
  > & { readGoal?: boolean; readProgress?: boolean; allowActive?: boolean },
): Promise<{
  modelId: string | null;
  progress?: ProgressFacts;
  providerId?: string;
  goal?: GoalObservation;
  info?: SessionInfo;
}> {
  if (options.checkHost !== false) assertSdkHostSupport(options.env, options.museBinary);
  const handshake = spawnMspConnection({
    command: options.museBinary ?? museCliPath(options.env),
    args: ["serve"],
    cwd: options.cwd,
    env: options.env as Record<string, string>,
    shutdownTimeoutMs: 1000,
    onStderr: (chunk) => options.logger.log(`muse-sdk read: ${chunk.trimEnd()}`),
  });
  const timer = setTimeout(() => {
    void handshake.close().catch(() => {});
  }, 20_000);
  try {
    const host = await handshake.initialize({
      clientInfo: { name: "muse_code_acp", version: packageJson.version },
    });
    const result = await host.connection.command("session/read", {
      sessionId: options.sessionId,
      excludeItems: true,
    });
    const session = result.session as
      | {
          sessionId: string;
          workspaceRoot: string | null;
          modelId: string | null;
          providerId?: string | null;
          activeTurnId: string | null;
        }
      | undefined;
    if (
      !session ||
      session.sessionId !== options.sessionId ||
      (session.modelId !== null && typeof session.modelId !== "string")
    ) {
      throw new Error("Muse returned invalid saved session metadata");
    }
    if (
      session.workspaceRoot &&
      realpathSync(session.workspaceRoot) !== realpathSync(options.cwd)
    ) {
      throw new Error("Saved Muse session belongs to a different workspace");
    }
    if (
      !options.allowActive &&
      (session.activeTurnId ||
        (Array.isArray(result.pendingRequests) && result.pendingRequests.length))
    ) {
      throw new Error("Saved Muse session has an unfinished turn or pending input");
    }
    return {
      modelId: session.modelId,
      ...(typeof session.providerId === "string" ? { providerId: session.providerId } : {}),
      info: optionalSessionInfo(result.session),
      ...(options.readProgress
        ? { progress: await readProgress(host.connection, options.sessionId).catch(() => ({})) }
        : {}),
      ...(options.readGoal
        ? { goal: await readGoalFromConnection(host.connection, options.sessionId, result) }
        : {}),
    };
  } finally {
    clearTimeout(timer);
    await handshake.close();
  }
}

/**
 * MSP rejects a decision aimed at a requirement the approval has already moved
 * past (tdd SS5.4). It means "re-read the approval", never "the turn failed".
 */
const STALE_APPROVAL_REQUIREMENT = -32053;

/** Preserve the public MSP effort vocabulary verified against Muse 1.1.1. */
export function sdkReasoningEffort(effort: string | undefined): MuseReasoningEffort | undefined {
  return isReasoningEffort(effort) ? effort : undefined;
}

/**
 * One durable `muse serve` host per turn. MuseClient/Session own MSP framing,
 * fold routing, and turn waits; this adapter translates folded items into ACP
 * updates and maps terminals/errors to PromptResponse / RequestError.
 */
export function spawnMuseSdkTurn(options: MuseSdkOptions): MuseSdkHandle {
  const updates = new Pushable<SessionNotification>();
  const fileChanges = new FileChangeEvidence(options.cwd);
  const translator = new MuseSdkTranslator(options.sessionId, options.logger, fileChanges);
  const permissions = new PermissionLifecycle();
  const userInputs = new UserInputLifecycle();
  const owner = options.hostOwner ?? new MuseSdkHost(options);
  if (!owner.reusable)
    throw RequestError.invalidRequest(
      undefined,
      "Muse SDK host is closed or already serving a turn",
    );
  let successful = false;
  let metadataTimedOut = false;
  let acquired = false;
  let acceptedTurn = false;
  let pendingSteers = 0;
  let connection: Connection | undefined;
  let turnId: string | undefined;
  let generation = 0;
  let cancelled = false;
  let finished = false;
  let settled = false;
  let stopInteractions!: () => void;
  const interactionsStopped = new Promise<null>((resolve) => {
    stopInteractions = () => resolve(null);
  });
  let cancelTimer: ReturnType<typeof setTimeout> | undefined;
  let failTurn!: (error: unknown) => void;
  const turnFailure = new Promise<never>((_, reject) => {
    failTurn = reject;
  });
  void turnFailure.catch(() => {});

  const close = async () => {
    permissions.disposeAll();
    userInputs.disposeAll();
    await owner.close();
  };

  const startupTimer = setTimeout(() => {
    failTurn(new Error("Muse SDK startup timed out"));
    void close();
  }, 20_000);

  function kill(): void {
    if (cancelled || finished) {
      return;
    }
    cancelled = true;
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
    } else {
      void close();
    }
  }

  const done = (async (): Promise<PromptResponse> => {
    try {
      const lease = await owner.acquire(options, failTurn);
      acquired = true;
      connection = lease.host.connection;
      const session = lease.session;

      const adoptTurn = (nextTurnId: string) => {
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
        failTurn(
          new Error(
            `Muse SDK gap fill failed (${error.reason}); reload the session before continuing`,
          ),
        );
      });

      if (cancelled || options.isCancelled?.()) {
        return { stopReason: "cancelled" };
      }

      const turn = await session.sendUserTurn({
        input: options.input,
        ...(sdkReasoningEffort(options.reasoningEffort)
          ? { reasoningEffort: sdkReasoningEffort(options.reasoningEffort)! }
          : {}),
      });
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
      clearTimeout(startupTimer);
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

      const emitItem = (item: FoldedItem) => {
        // Hold publication while a gap fill is reconstituting the fold.
        if (!session.fold.current) {
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
              for (const update of translator.fromAccumulated(
                held.itemId,
                field,
                session.fold.items.accumulated(held.itemId, field) ?? "",
              ))
                updates.push(update);
            }
          }
        }
      };

      const publishedApprovals = new Set<string>();
      const publishApprovalResults = () => {
        if (
          options.clientCapabilities?._meta?.["muse/approval"] !== 1 ||
          !session.fold.current ||
          cancelled ||
          options.isCancelled?.()
        )
          return;
        for (const approval of session.fold.resolvedApprovals()) {
          if (approval.turnId !== turnId || publishedApprovals.has(approval.approvalId)) continue;
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
      const askedRequirements = new Set<string>();
      const decidingApprovals = new Set<string>();

      const turnApprovals = (): MusePendingApproval[] => {
        if (!session.fold.current || !turnId) {
          return [];
        }
        return session.fold
          .pendingApprovals()
          .map((pending) => pending as unknown as MusePendingApproval)
          .filter((pending) => currentApprovalView(pending).turnId === turnId);
      };

      const decideApproval = async (view: MuseApprovalRequest): Promise<void> => {
        const approvalGeneration = generation;
        if (!permissions.track(view.approvalId, view.turnId, view.toolCallId, approvalGeneration)) {
          return;
        }
        try {
          let choiceId: string;
          if (options.automaticDecision) {
            const choice = view.availableChoices.find((c) =>
              options.automaticDecision === "approve"
                ? c.decision === "approved" && c.scope === "once"
                : (c.decision === "denied" || c.decision === "abort") && c.scope === "once",
            );
            if (!choice)
              throw new Error(
                `Automatic ${options.automaticDecision} unavailable: Muse offered no eligible once choice; the turn was stopped without granting permission`,
              );
            choiceId = choice.choiceId;
          } else {
            const response = await Promise.race([
              options.acpClient.requestPermission(
                approvalToPermissionRequest(
                  options.sessionId,
                  view,
                  options.clientCapabilities?._meta?.["muse/approval"] === 1,
                ),
              ),
              interactionsStopped,
            ]);
            if (!response) return;
            choiceId = resolvePermissionChoice(view, response);
          }
          if (
            cancelled ||
            options.isCancelled?.() ||
            !permissions.isLive(view.approvalId, view.turnId, approvalGeneration)
          )
            return;
          // Do not decide a stage the fold has already settled while the dialog was open.
          if (
            !turnApprovals().some((p) => {
              const current = currentApprovalView(p);
              return (
                current.approvalId === view.approvalId &&
                current.currentRequirementId.sourceIndex === view.currentRequirementId.sourceIndex
              );
            })
          )
            return;
          const choice = view.availableChoices.find((c) => c.choiceId === choiceId);
          if (choice?.scope === "localPersistent")
            owner.watchPolicyPersistence(view.approvalId, view.viewCursor);
          if (choice && ["approved", "approvedForSession"].includes(choice.decision))
            fileChanges.beforeApproval(view.toolName, view.rawArgs);
          await connection!.command(
            "approval/decide",
            {
              sessionId: options.sessionId,
              approvalId: view.approvalId,
              choiceId,
              // Echoed from the view the host last published; a remembered value
              // is exactly what MSP -32053 exists to reject.
              requirementId: view.currentRequirementId,
            },
            { maxAttempts: 1 },
          );
        } catch (error) {
          if (
            error instanceof MspError &&
            (error.code === STALE_APPROVAL_REQUIREMENT ||
              (error.code === -32051 && error.data?.kind === "approvalAlreadyResolved"))
          ) {
            // The host advanced this approval while the client was deciding. The
            // refreshed requirement lands on the fold and is decided on a later
            // tick; the pending-work watchdog bounds the wait if it never does.
            options.logger.log(
              `muse-sdk: approval ${view.approvalId} requirement ${view.currentRequirementId.sourceIndex} was superseded`,
            );
            return;
          }
          if (cancelled || options.isCancelled?.()) {
            return;
          }
          failTurn(
            error instanceof MspError
              ? new Error(`Muse approval decision rejected (MSP ${error.code})`)
              : error,
          );
        } finally {
          permissions.resolve(view.approvalId);
        }
      };

      const reconcileApprovals = (): void => {
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

      const answeredUserInputs = new Set<string>();
      const handlePendingUserInputs = async () => {
        for (const pendingInput of session.fold.pendingUserInputs()) {
          const request = pendingInput as unknown as MuseUserInputRequest & {
            userInputId: string;
            turnId: string;
          };
          if (request.turnId !== turnId) {
            continue;
          }
          // `has` covers the round trip in progress; `answeredUserInputs`
          // covers the window after it, because the fold keeps the prompt until
          // `userInput/settled` arrives and a stalled host never sends one.
          if (userInputs.has(request.userInputId) || answeredUserInputs.has(request.userInputId)) {
            continue;
          }
          if (!userInputs.track(request.userInputId, turnId!, generation)) {
            continue;
          }
          answeredUserInputs.add(request.userInputId);
          const support = options.clientCapabilities?.elicitation;
          const formOk = support?.form != null;
          if (!formOk || !connection) {
            // Reject the ACP prompt first so turn/completed from cancel cannot
            // win Promise.race and report a successful end_turn.
            failTurn(
              new Error(
                "Muse requested user input but the ACP client did not advertise form elicitation",
              ),
            );
            await connection
              ?.command(
                "userInput/cancel",
                {
                  sessionId: options.sessionId,
                  userInputId: request.userInputId,
                  reason: "client has no form elicitation support",
                },
                { maxAttempts: 1 },
              )
              .catch(() => {});
            userInputs.resolve(request.userInputId);
            return;
          }
          try {
            if (cancelled || options.isCancelled?.()) {
              await settleUserInput(connection, options.sessionId, request, {
                action: "cancel",
              });
              return;
            }
            const response = await Promise.race([
              options.acpClient.createElicitation(
                userInputToElicitation(options.sessionId, request),
              ),
              interactionsStopped,
            ]);
            if (!response || !userInputs.isLive(request.userInputId, turnId!, generation)) {
              return;
            }
            await settleUserInput(connection, options.sessionId, request, response);
          } catch (error) {
            // Invalid answers and failed client RPCs must fail the prompt, not
            // silently terminate a pump while Muse waits forever for input.
            failTurn(error);
            await connection
              .command(
                "userInput/cancel",
                {
                  sessionId: options.sessionId,
                  userInputId: request.userInputId,
                  reason: "client input failed validation or delivery",
                },
                { maxAttempts: 1 },
              )
              .catch(() => {});
            return;
          } finally {
            userInputs.resolve(request.userInputId);
          }
        }
      };

      const watchdog = new PendingWorkWatchdog(stallLimitMs(options.env));
      const pendingWork = (): PendingWorkItem[] => {
        const items: PendingWorkItem[] = [];
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
          const request = pendingInput as unknown as { userInputId: string; turnId: string };
          if (request.turnId !== turnId) continue;
          items.push({
            kind: "userInput",
            id: request.userInputId,
            signature: request.userInputId,
            inFlight: userInputs.has(request.userInputId),
            detail:
              `Muse user input ${request.userInputId} is still pending; ` +
              `last host frame userInput/requested`,
          });
        }
        return items;
      };
      const checkPendingWork = (): void => {
        if (cancelled || options.isCancelled?.() || settled || finished) {
          return;
        }
        const stalled = watchdog.check(pendingWork());
        if (!stalled) {
          return;
        }
        // Reject the ACP prompt BEFORE asking the host to unwind, so a
        // turn/completed produced by the cancellation cannot win the race and
        // report a successful end_turn (same ordering as failed user input).
        failTurn(
          new Error(
            `${stalled}. The Muse host is waiting for a decision this adapter did not make; ` +
              "reload the session or report this with the host version.",
          ),
        );
        if (connection && turnId) {
          void connection
            .command("turn/cancel", { sessionId: options.sessionId, turnId }, { maxAttempts: 1 })
            .catch(() => {});
        }
      };

      // deltas() is live-only; catch up anything folded before the turn ack.
      flushFold();

      let foldWasCurrent = session.fold.current;
      const pumpItems = (async () => {
        for await (const item of turn.items()) {
          await handlePendingUserInputs();
          // Replay held items only when a gap fill restores currency.
          if (!foldWasCurrent && session.fold.current) {
            flushFold();
          }
          foldWasCurrent = session.fold.current;
          emitItem(item);
        }
      })();
      const pumpDeltas = (async () => {
        for await (const delta of turn.deltas()) {
          if (!session.fold.current) {
            continue;
          }
          for (const update of translator.fromDelta(delta)) {
            updates.push(update);
          }
        }
      })();
      const pumpUserInput = (async () => {
        while (!finished && !settled && !cancelled) {
          reconcileApprovals();
          await handlePendingUserInputs();
          publishApprovalResults();
          checkPendingWork();
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      })();
      // Observe pump failures immediately, before waiting for turn completion.
      void pumpItems.catch(failTurn);
      void pumpDeltas.catch(failTurn);
      void pumpUserInput.catch(failTurn);

      const outcome = await Promise.race([turn.completed, turnFailure]);
      settled = true;
      watchdog.reset();
      stopInteractions();
      await Promise.all([
        pumpItems.catch(() => {}),
        pumpDeltas.catch(() => {}),
        pumpUserInput.catch(() => {}),
      ]);
      // Flush any items that arrived only through gap fill after the last yield.
      flushFold();
      publishApprovalResults();
      await owner.observeSessionState();
      const response = terminalResponse(outcome);
      successful = response.stopReason === "end_turn";
      const goal = parseGoalObservation(session.fold.sessionState.get("session/goalChanged")?.goal);
      if (
        successful &&
        !owner.hasActiveTurn &&
        !(goal.status === "known" && goal.goal?.status === "active")
      ) {
        let metadataTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          const saved = await Promise.race([
            connection.request("session/read", {
              sessionId: options.sessionId,
              excludeItems: true,
            }),
            new Promise<undefined>((resolve) => {
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
        } catch {
          /* Metadata enrichment must not change a completed turn. */
        } finally {
          clearTimeout(metadataTimer);
        }
      }
      return response;
    } catch (error) {
      if (cancelled || options.isCancelled?.()) {
        return { stopReason: "cancelled" };
      }
      if (error instanceof RequestError) {
        throw error;
      }
      const stderr = owner.stderr;
      const mapped = sdkHostExitMessage(stderr);
      throw RequestError.internalError(
        undefined,
        `Muse SDK turn failed: ${mapped ?? (error instanceof Error ? error.message : String(error))}` +
          (stderr && !mapped ? `\n${stderr}` : ""),
      );
    } finally {
      finished = true;
      stopInteractions();
      clearTimeout(startupTimer);
      clearTimeout(cancelTimer);
      if (turnId) {
        permissions.disposeTurn(turnId);
        userInputs.disposeTurn(turnId);
      }
      permissions.disposeAll();
      userInputs.disposeAll();
      if (acquired)
        await owner.release(
          !!options.hostOwner &&
            successful &&
            !cancelled &&
            !metadataTimedOut &&
            pendingSteers === 0,
        );
      else await owner.close();
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
            _meta: fileChanges.report(
              options.fileReportRequestId,
              cancelled || options.isCancelled?.()
                ? "cancelled"
                : successful
                  ? "completed"
                  : "failed",
            ),
          },
        });
      updates.end();
    }
  })();
  void done.catch(() => {});
  return {
    updates,
    done,
    kill,
    get activeTurnId() {
      return acceptedTurn && !finished && !settled && !cancelled ? turnId : undefined;
    },
    async steer(input, expectedTurnId) {
      if (
        !acceptedTurn ||
        !turnId ||
        expectedTurnId !== turnId ||
        !connection ||
        finished ||
        settled ||
        cancelled ||
        owner.closed
      ) {
        throw RequestError.invalidRequest(
          undefined,
          "No matching active Muse turn accepts steering",
        );
      }
      let steerTimer: ReturnType<typeof setTimeout> | undefined;
      pendingSteers++;
      try {
        const deadline = new Promise<never>((_, reject) => {
          steerTimer = setTimeout(() => {
            const error = new Error("Muse steering acknowledgement timed out; outcome is unknown");
            reject(error);
            failTurn(error);
            void owner.close();
          }, 10_000);
        });
        const result = await Promise.race([
          deadline,
          connection.command(
            "turn/steer",
            {
              sessionId: options.sessionId,
              expectedTurnId,
              input,
              ...(sdkReasoningEffort(options.reasoningEffort)
                ? { reasoningEffort: sdkReasoningEffort(options.reasoningEffort)! }
                : {}),
            },
            { maxAttempts: 1 },
          ),
        ]);
        if (result.status !== "accepted")
          throw RequestError.internalError(
            undefined,
            "Muse returned malformed steering acknowledgement",
          );
        if (result.turnId !== expectedTurnId)
          throw RequestError.internalError(
            undefined,
            "Muse acknowledged steering for a different turn",
          );
        return { turnId: result.turnId, status: result.status };
      } finally {
        pendingSteers--;
        clearTimeout(steerTimer);
      }
    },
  };
}

function terminalResponse(outcome: TurnOutcome): PromptResponse {
  if (outcome.kind === "terminalUnknown") {
    throw RequestError.internalError(
      undefined,
      "Muse SDK host died before the turn completed; reload the session",
    );
  }
  if (outcome.kind === "unqueued") {
    throw RequestError.internalError(undefined, "Muse SDK turn was unqueued before launch");
  }
  if (isLaunchFailure(outcome)) {
    throw RequestError.internalError(undefined, "Muse SDK failed to launch the turn");
  }
  const params = outcome.params;
  if (params.terminal === "completed") {
    return { stopReason: "end_turn" };
  }
  if (params.terminal === "cancelled") {
    return { stopReason: "cancelled" };
  }
  if (params.error?.kind === "stepLimit") {
    return { stopReason: "max_turn_requests" };
  }
  const detail = params.error?.message ?? params.reason ?? params.terminal;
  if (params.error?.kind === "authRequired") {
    throw RequestError.authRequired(undefined, `${detail}. Run muse login or set META_API_KEY.`);
  }
  throw RequestError.internalError(undefined, `Muse SDK turn ${params.terminal}: ${detail}`);
}

function optionalSessionInfo(value: unknown): SessionInfo | undefined {
  try {
    return sessionInfo(value);
  } catch {
    return;
  }
}
