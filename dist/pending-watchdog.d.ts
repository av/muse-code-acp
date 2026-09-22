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
/**
 * Default bound for a client round trip (permission dialog, elicitation
 * answer). Generous on purpose: a slow human deciding must never trip it.
 * But an unanswered client call is not progress forever — without this bound
 * a crashed or deaf client hangs the turn with no error and no recovery.
 */
export declare const DEFAULT_INPUT_LIMIT_MS = 300000;
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
/** Read the configured client-answer bound; invalid values keep the default. */
export declare function inputLimitMs(env?: Record<string, string | undefined>): number;
/**
 * Bound for a turn that emits nothing and is not waiting on the ACP client.
 * A slow tool or a thinking model resets it by publishing host state. A host
 * that goes silent (hung tool, dropped stream) must fail the prompt instead
 * of leaving the client waiting with no error. Five minutes is long enough
 * that an ordinary command still running is not cut off, and short enough
 * that a dead turn cannot sit for an hour.
 */
export declare const DEFAULT_TURN_IDLE_MS = 300000;
/** Read the configured turn-silence bound; invalid values keep the default. */
export declare function turnIdleMs(env?: Record<string, string | undefined>): number;
/**
 * Bound for one in-progress tool that publishes nothing new. A running tool
 * is not the short turn-silence clock: builds and test suites sit quiet for
 * minutes. Fifteen minutes without a new host frame is a hung tool.
 */
export declare const DEFAULT_TOOL_IDLE_MS = 900000;
/** Read the configured in-progress-tool bound; invalid values keep the default. */
export declare function toolIdleMs(env?: Record<string, string | undefined>): number;
/**
 * Clock for host silence. `activity()` marks a host event or an open client
 * dialog. `check()` reports once the bound elapses with neither.
 */
export declare class TurnSilenceWatchdog {
    private readonly limitMs;
    private readonly now;
    private since;
    constructor(limitMs?: number, now?: () => number);
    activity(): void;
    check(): string | undefined;
}
export declare class PendingWorkWatchdog {
    private readonly limitMs;
    private readonly now;
    private readonly inputLimitMs;
    private readonly seen;
    constructor(limitMs?: number, now?: () => number, inputLimitMs?: number);
    /**
     * Fold the current pending set. Returns a diagnostic message once an item has
     * gone the whole bound with no host progress and no outstanding client call.
     */
    check(items: readonly PendingWorkItem[]): string | undefined;
    /** Forget every tracked item; used at turn boundaries and host replacement. */
    reset(): void;
}
//# sourceMappingURL=pending-watchdog.d.ts.map