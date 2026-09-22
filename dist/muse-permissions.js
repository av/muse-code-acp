import { kandevWireArgs, TOOL_KINDS } from "./tool-calls.js";
import { TurnScopedLifecycle } from "./turn-lifecycle.js";
export function approvalStageMetadata(stage) {
    return {
        position: stage.position,
        totalStages: stage.totalStages,
        requirementId: stage.requirementId,
        resolutionKind: stage.resolution.kind,
    };
}
/**
 * The approval as the host most recently published it.
 *
 * `approval/requested` carries the identity (`turnId`, `toolCallId`, `rawArgs`);
 * `approval/updated` carries the CURRENT requirement, the choices offered for it
 * and refreshed stage resolutions. Muse 1.2.1 advances a multi-stage approval
 * with an update and never re-issues the request, so a decision built from
 * `requested` alone aims at a requirement the host already satisfied and is
 * rejected as stale. Overlay rather than replace: an update carries none of the
 * identity fields.
 */
export function currentApprovalView(pending) {
    const update = pending.latestUpdate;
    if (!update) {
        return pending.requested;
    }
    return {
        ...pending.requested,
        currentRequirementId: update.currentRequirementId,
        availableChoices: update.availableChoices,
        ...(update.subject ? { subject: update.subject } : {}),
    };
}
/** Match the host's requirement identity; position is presentation, never a key. */
function currentApprovalStage(request) {
    return request.subject?.stages?.find((stage) => stage.requirementId.approvalId === request.currentRequirementId.approvalId &&
        stage.requirementId.sourceIndex === request.currentRequirementId.sourceIndex);
}
function stagedApprovalTitle(request) {
    const stages = request.subject?.stages ?? [];
    // Already decided stages still count after a refresh. Only exclude stages
    // explicitly published as known-safe; preserve unknown resolution kinds.
    if (stages.filter((stage) => !["knownSafe", "known_safe"].includes(stage.resolution.kind)).length <=
        1)
        return;
    const stage = currentApprovalStage(request);
    if (!stage ||
        !Number.isInteger(stage.position) ||
        !Number.isInteger(stage.totalStages) ||
        stage.totalStages <= 1 ||
        stage.position < 1 ||
        stage.position > stage.totalStages ||
        !Array.isArray(stage.argv) ||
        !stage.argv.length ||
        !stage.argv.every((arg) => typeof arg === "string"))
        return;
    // Render host-parsed arguments, quoting ambiguous tokens as display text.
    // argv can omit redirections; rawInput still contains the complete command.
    const command = stage.argv
        .map((arg) => (/^[\w./:@%+=,-]+$/.test(arg) ? arg : JSON.stringify(arg)))
        .join(" ");
    return `Stage ${stage.position} of ${stage.totalStages}: ${command}`;
}
/** Human-readable state of an approval that is not progressing, for diagnostics. */
export function approvalStallDetail(pending) {
    const view = currentApprovalView(pending);
    const stages = view.subject?.stages ?? [];
    const position = currentApprovalStage(view);
    const resolutions = stages.map((stage) => stage.resolution.kind).join(", ");
    return (`Muse approval ${view.approvalId} is still pending at requirement ` +
        `${view.currentRequirementId.sourceIndex}` +
        (position ? ` (stage ${position.position} of ${position.totalStages})` : "") +
        `; stages ${resolutions || "unreported"}` +
        `; last host frame ${pending.latestUpdate ? "approval/updated" : "approval/requested"}`);
}
/** Changes whenever the host publishes new state for an approval. */
export function approvalSignature(pending) {
    const view = currentApprovalView(pending);
    return [
        view.currentRequirementId.sourceIndex,
        view.availableChoices.map((choice) => choice.choiceId).join(","),
        (view.subject?.stages ?? []).map((stage) => stage.resolution.kind).join(","),
    ].join("|");
}
/**
 * Map host-offered MSP approval choices onto ACP permission options.
 * optionId is the host choiceId so the selected value round-trips exactly.
 * Session/local-persistent allow scopes are only offered when the host
 * actually lists them; we never invent allow-always.
 */
export function choicesToPermissionOptions(choices) {
    return choices.map((choice) => ({
        optionId: choice.choiceId,
        name: choice.label,
        kind: permissionKindFor(choice),
        _meta: {
            museDecision: choice.decision,
            museScope: choice.scope,
        },
    }));
}
function permissionKindFor(choice) {
    if (choice.decision === "approved" || choice.decision === "approvedForSession") {
        if (choice.scope === "session" || choice.scope === "localPersistent") {
            return "allow_always";
        }
        return "allow_once";
    }
    if (choice.scope === "localPersistent" || choice.decision === "deniedPolicyAmendment") {
        return "reject_always";
    }
    return "reject_once";
}
export function approvalToPermissionRequest(sessionId, request, extended = false) {
    let rawInput;
    try {
        const parsed = JSON.parse(request.rawArgs || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            rawInput = parsed;
        }
    }
    catch {
        rawInput = { arguments: request.rawArgs };
    }
    rawInput = kandevWireArgs(request.toolName, rawInput);
    const title = stagedApprovalTitle(request) ||
        (typeof rawInput?.description === "string" && rawInput.description) ||
        (typeof rawInput?.command === "string" && rawInput.command) ||
        (typeof rawInput?.path === "string" && rawInput.path) ||
        request.toolName;
    return {
        sessionId,
        toolCall: {
            toolCallId: request.toolCallId,
            title,
            kind: (TOOL_KINDS[request.toolName] ?? "other"),
            status: "pending",
            rawInput,
        },
        options: choicesToPermissionOptions(request.availableChoices),
        _meta: {
            museApprovalId: request.approvalId,
            museTurnId: request.turnId,
            museItemId: request.itemId,
            museRequirementId: request.currentRequirementId,
            museTaskId: request.taskId,
            ...(extended
                ? {
                    "muse/approval": {
                        ...(typeof request.judgeEscalated === "boolean"
                            ? { judgeEscalated: request.judgeEscalated }
                            : {}),
                        ...(typeof request.protectedWrite === "boolean"
                            ? { protectedWrite: request.protectedWrite }
                            : {}),
                        ...(request.subject
                            ? {
                                subjectKind: request.subject.kind,
                                stages: request.subject.stages?.map(approvalStageMetadata),
                            }
                            : {}),
                    },
                }
                : {}),
        },
    };
}
/**
 * Resolve an ACP permission response to a host choiceId.
 * Cancellation and unknown options never grant — prefer an explicit deny/abort
 * choice when the host offered one; otherwise throw for the SDK error path.
 */
export function resolvePermissionChoice(request, response) {
    if (response.outcome.outcome === "cancelled") {
        const deny = request.availableChoices.find((choice) => choice.decision === "denied" ||
            choice.decision === "abort" ||
            choice.decision === "deniedPolicyAmendment");
        if (deny) {
            return deny.choiceId;
        }
        throw new Error("permission request cancelled without a host deny choice");
    }
    const optionId = response.outcome.optionId;
    if (!request.availableChoices.some((choice) => choice.choiceId === optionId)) {
        throw new Error(`permission response selected unknown option: ${optionId}`);
    }
    return optionId;
}
/** Tracks in-flight permission request IDs so stale replies cannot grant. */
export class PermissionLifecycle {
    life = new TurnScopedLifecycle();
    beginTurn(turnId) {
        return this.life.beginTurn(turnId);
    }
    track(approvalId, turnId, _toolCallId, generation) {
        return this.life.track(approvalId, turnId, generation);
    }
    isLive(approvalId, turnId, generation) {
        return this.life.isLive(approvalId, turnId, generation);
    }
    resolve(approvalId) {
        this.life.resolve(approvalId);
    }
    disposeTurn(turnId) {
        this.life.disposeTurn(turnId);
    }
    disposeAll() {
        this.life.disposeAll();
    }
}
