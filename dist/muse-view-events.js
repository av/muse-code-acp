/**
 * What this adapter does with every view event the pinned SDK folds.
 *
 * The w2/m1 defect was invisible because `approval/updated` was folded, never
 * routed, and never polled: there was no place where "nobody consumes this"
 * could be noticed. These tables are that place. Every method the SDK can fold
 * is classified exactly once, with the consumer or the reason it is dropped, and
 * a test fails when the installed SDK folds a method neither table names.
 *
 * Being listed as ignored is a recorded decision, not an accident — each entry
 * says which milestone owns it.
 */
/** Methods the adapter consumes, mapped to the code that consumes them. */
export const HANDLED_VIEW_EVENTS = {
    "item/started": "muse-sdk.ts pumpItems → MuseSdkTranslator.fromItem",
    "item/updated": "muse-sdk.ts pumpItems → MuseSdkTranslator.fromItem",
    "item/completed": "muse-sdk.ts pumpItems → MuseSdkTranslator.fromItem",
    "item/delta": "muse-sdk.ts pumpDeltas → MuseSdkTranslator.fromDelta",
    "turn/started": "muse-sdk.ts adoptTurn; SDK turn handle",
    "turn/completed": "muse-sdk.ts terminalResponse",
    "turn/unqueued": "muse-sdk.ts terminalResponse (reclaimed submission)",
    "approval/requested": "muse-sdk.ts reconcileApprovals via fold.pendingApprovals()",
    "approval/updated": "muse-sdk.ts reconcileApprovals via pendingApprovals().latestUpdate",
    "approval/resolved": "muse-sdk.ts publishApprovalResults",
    "userInput/requested": "muse-sdk.ts handlePendingUserInputs",
    "userInput/settled": "muse-sdk.ts handlePendingUserInputs (clears the pending prompt)",
    "view/gap": "SDK gap fill; muse-sdk.ts onGapError fails unrecoverable holes",
    "session/goalChanged": "muse-sdk-host.ts observeGoal → goal extension",
    "session/modelChanged": "session-state-observer.ts → negotiated observed model",
    "session/approvalModeChanged": "session-state-observer.ts → negotiated observed approval mode",
    "session/todoListChanged": "session-progress.ts → latest ACP plan snapshot",
    "session/tokenUsage": "session-progress.ts → authoritative root totals and /status",
    "session/contextUsage": "session-progress.ts → known context counters or explicit unknown",
};
/** Methods the adapter deliberately drops, with the owner of that decision. */
export const IGNORED_VIEW_EVENTS = {
    "turn/retracted": "Non-terminal by contract; the turn still reaches its own terminal.",
    "turn/retryScheduled": "Native scheduling unobserved on 1.1.1/1.2.1; future w1/006. Error rendering: w2/m8.",
    "session/branchChanged": "No ACP field carries the workspace branch; not scheduled.",
};
/** Every classified method. A method may appear in exactly one table. */
export function classifiedViewEvents() {
    return [...Object.keys(HANDLED_VIEW_EVENTS), ...Object.keys(IGNORED_VIEW_EVENTS)];
}
/**
 * Methods the installed SDK folds that this adapter has never classified.
 * A non-empty result means the SDK moved and the tables need a decision.
 */
export function unclassifiedViewEvents(folded) {
    const known = new Set(classifiedViewEvents());
    return folded.filter((method) => !known.has(method));
}
/** Item families are classified independently of the envelope events above. */
export const ITEM_KIND_CONSUMERS = {
    userMessage: "Client already owns the submitted prompt; load uses public history replay.",
    agentMessage: "muse-sdk-events.ts streams public assistant text.",
    toolCall: "muse-sdk-events.ts renders public tool state/output; richer visible content: w2/m7.",
    reasoning: "muse-sdk-events.ts streams public summary parts; private reasoning is never requested.",
    userShell: "muse-sdk-events.ts renders generic shell output; background lifecycle/control: w2/m9.",
    subagent: "Handled by retained MuseSdkTranslator worker cards; native child controls: w1/005.",
    workflow: "Handled by retained worker cards; negotiated 1.2.1 workflow cancellation; 1.1.1 workflow lifecycle/control unverified.",
    reminderChild: "Handled child attribution cards; child history remains w1/005.",
    compaction: "Native durable compaction rejects on 1.1.1/1.2.1; future w1/004.",
};
