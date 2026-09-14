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
export const DEFAULT_STALL_LIMIT_MS = 10_000;

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
export function stallLimitMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.MUSE_CODE_ACP_STALL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALL_LIMIT_MS;
}

export class PendingWorkWatchdog {
  private readonly seen = new Map<string, { signature: string; since: number }>();

  constructor(
    private readonly limitMs: number = DEFAULT_STALL_LIMIT_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * Fold the current pending set. Returns a diagnostic message once an item has
   * gone the whole bound with no host progress and no outstanding client call.
   */
  check(items: readonly PendingWorkItem[]): string | undefined {
    const timestamp = this.now();
    const live = new Set<string>();
    let stalled: string | undefined;
    for (const item of items) {
      const key = `${item.kind}:${item.id}`;
      live.add(key);
      const previous = this.seen.get(key);
      // An in-flight client call IS progress: the wait belongs to the user.
      if (!previous || previous.signature !== item.signature || item.inFlight) {
        this.seen.set(key, { signature: item.signature, since: timestamp });
        continue;
      }
      const waited = timestamp - previous.since;
      if (waited >= this.limitMs && stalled === undefined) {
        stalled = `${item.detail}; no host progress for ${Math.round(waited / 1000)}s`;
      }
    }
    for (const key of [...this.seen.keys()]) {
      if (!live.has(key)) this.seen.delete(key);
    }
    return stalled;
  }

  /** Forget every tracked item; used at turn boundaries and host replacement. */
  reset(): void {
    this.seen.clear();
  }
}
