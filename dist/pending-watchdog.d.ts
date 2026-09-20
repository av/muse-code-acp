/**
 * Bounded waiting for host requests the adapter has to answer.
 *
 * The w2/m1 defect was not "one frame was missed" but its shape: the fold held
 * a pending fact, no handler fired, nothing polled it, and an unattended client
 * waited forever with no error and no progress. Deciding refreshed approval
 * requirements removes the known instance; this bounds the unknown ones, so the
 * next unrouted view event becomes a diagnosable failure rather than a hang.
 *
 * Progress is defined by the host's own published state, not by elapsed time
 * alone: a long-running tool, a slow model and an open permission dialog must
 * never trip it.
 */
/** Default bound. Long enough that no interactive round trip reaches it. */
export declare const DEFAULT_STALL_LIMIT_MS = 10000;
export interface PendingWorkItem {
    kind: "approval" | "userInput";
    id: string;
    /** Changes whenever the host publishes new state for this item. */
    signature: string;
    /** True while the adapter is waiting on the ACP client for this item. */
    inFlight: boolean;
    /** Diagnostic detail for the stall error; must not leak host internals. */
    detail: string;
}
/** Read the configured bound; invalid and non-positive values keep the default. */
export declare function stallLimitMs(env?: Record<string, string | undefined>): number;
export declare class PendingWorkWatchdog {
    private readonly limitMs;
    private readonly now;
    private readonly seen;
    constructor(limitMs?: number, now?: () => number);
    /**
     * Fold the current pending set. Returns a diagnostic message once an item has
     * gone the whole bound with no host progress and no outstanding client call.
     */
    check(items: readonly PendingWorkItem[]): string | undefined;
    /** Forget every tracked item; used at turn boundaries and host replacement. */
    reset(): void;
}
//# sourceMappingURL=pending-watchdog.d.ts.map