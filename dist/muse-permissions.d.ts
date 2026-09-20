import { PermissionOption, RequestPermissionRequest, RequestPermissionResponse } from "@agentclientprotocol/sdk";
/** Minimal MSP approval choice fields used by the ACP bridge. */
export interface MuseApprovalChoice {
    choiceId: string;
    label: string;
    decision: string;
    scope: string;
    acceptsFeedback?: boolean;
}
interface ApprovalStage {
    argv?: readonly string[];
    position: number;
    totalStages: number;
    requirementId: {
        approvalId: string;
        sourceIndex: number;
    };
    resolution: {
        kind: string;
    };
}
export declare function approvalStageMetadata(stage: ApprovalStage): {
    position: number;
    totalStages: number;
    requirementId: {
        approvalId: string;
        sourceIndex: number;
    };
    resolutionKind: string;
};
export interface MuseApprovalRequest {
    viewCursor?: string;
    approvalId: string;
    availableChoices: MuseApprovalChoice[];
    currentRequirementId: {
        approvalId: string;
        sourceIndex: number;
    };
    itemId: string;
    rawArgs: string;
    toolCallId: string;
    toolName: string;
    turnId: string;
    taskId?: string;
    judgeEscalated?: boolean;
    protectedWrite?: boolean;
    subject?: {
        kind: string;
        stages?: ApprovalStage[];
    };
}
/** The `approval/updated` fields the ACP bridge re-reads (MSP SS5.6). */
export interface MuseApprovalUpdate {
    approvalId: string;
    currentRequirementId: {
        approvalId: string;
        sourceIndex: number;
    };
    availableChoices: MuseApprovalChoice[];
    change?: {
        kind: string;
    };
    subject?: {
        kind: string;
        stages?: ApprovalStage[];
    };
}
/** A fold entry for an approval awaiting its durable terminal. */
export interface MusePendingApproval {
    requested: MuseApprovalRequest;
    latestUpdate?: MuseApprovalUpdate;
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
export declare function currentApprovalView(pending: MusePendingApproval): MuseApprovalRequest;
/** Human-readable state of an approval that is not progressing, for diagnostics. */
export declare function approvalStallDetail(pending: MusePendingApproval): string;
/** Changes whenever the host publishes new state for an approval. */
export declare function approvalSignature(pending: MusePendingApproval): string;
/**
 * Map host-offered MSP approval choices onto ACP permission options.
 * optionId is the host choiceId so the selected value round-trips exactly.
 * Session/local-persistent allow scopes are only offered when the host
 * actually lists them; we never invent allow-always.
 */
export declare function choicesToPermissionOptions(choices: MuseApprovalChoice[]): PermissionOption[];
export declare function approvalToPermissionRequest(sessionId: string, request: MuseApprovalRequest, extended?: boolean): RequestPermissionRequest;
/**
 * Resolve an ACP permission response to a host choiceId.
 * Cancellation and unknown options never grant — prefer an explicit deny/abort
 * choice when the host offered one; otherwise throw for the SDK error path.
 */
export declare function resolvePermissionChoice(request: MuseApprovalRequest, response: RequestPermissionResponse): string;
/** Tracks in-flight permission request IDs so stale replies cannot grant. */
export declare class PermissionLifecycle {
    private readonly life;
    beginTurn(turnId: string): number;
    track(approvalId: string, turnId: string, _toolCallId: string, generation: number): boolean;
    isLive(approvalId: string, turnId: string, generation: number): boolean;
    resolve(approvalId: string): void;
    disposeTurn(turnId: string): void;
    disposeAll(): void;
}
export {};
//# sourceMappingURL=muse-permissions.d.ts.map