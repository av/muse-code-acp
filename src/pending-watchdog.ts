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

/**
 * Default bound for a client round trip (permission dialog, elicitation
 * answer). Generous on purpose: a slow human deciding must never trip it.
 * But an unanswered client call is not progress forever — without this bound
 * a crashed or deaf client hangs the turn with no error and no recovery.
 */
export const DEFAULT_INPUT_LIMIT_MS = 300_000;

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

/** Read the configured client-answer bound; invalid values keep the default. */
export function inputLimitMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.MUSE_CODE_ACP_INPUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INPUT_LIMIT_MS;
}

/**
 * Bound for a turn that emits nothing and is not waiting on the ACP client.
 * A slow tool or a thinking model resets it by publishing host state. A host
 * that goes silent (hung tool, dropped stream) must fail the prompt instead
 * of leaving the client waiting with no error. Five minutes is long enough
 * that an ordinary command still running is not cut off, and short enough
 * that a dead turn cannot sit for an hour.
 */
export const DEFAULT_TURN_IDLE_MS = 300_000;

/** Read the configured turn-silence bound; invalid values keep the default. */
export function turnIdleMs(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.MUSE_CODE_ACP_TURN_IDLE_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TURN_IDLE_MS;
}

/**
 * Clock for host silence. `activity()` marks a host event or an open client
 * dialog. `check()` reports once the bound elapses with neither.
 */
export class TurnSilenceWatchdog {
  private since: number;

  constructor(
    private readonly limitMs: number = DEFAULT_TURN_IDLE_MS,
    private readonly now: () => number = Date.now,
  ) {
    this.since = this.now();
  }

  activity(): void {
    this.since = this.now();
  }

  check(): string | undefined {
    const waited = this.now() - this.since;
    if (waited >= this.limitMs) {
      return `Muse turn produced no host progress for ${Math.round(waited / 1000)}s`;
    }
  }
}

export class PendingWorkWatchdog {
  private readonly seen = new Map<
    string,
    { signature: string; since: number; inFlightSince: number | undefined }
  >();

  constructor(
    private readonly limitMs: number = DEFAULT_STALL_LIMIT_MS,
    private readonly now: () => number = Date.now,
    private readonly inputLimitMs: number = DEFAULT_INPUT_LIMIT_MS,
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
      if (!previous || previous.signature !== item.signature) {
        this.seen.set(key, {
          signature: item.signature,
          since: timestamp,
          inFlightSince: item.inFlight ? timestamp : undefined,
        });
        continue;
      }
      if (item.inFlight) {
        // An in-flight client call is progress — the wait belongs to the user —
        // but only up to the client-answer bound. A client that never answers
        // (crashed, deaf, dropped) must fail the turn, not hang it.
        // The host-stall clock keeps refreshing underneath, so it still runs
        // from the last in-flight tick once the dialog closes.
        const start = previous.inFlightSince ?? timestamp;
        const waited = timestamp - start;
        if (waited >= this.inputLimitMs && stalled === undefined) {
          stalled = `${item.detail}; no client answer for ${Math.round(waited / 1000)}s`;
        } else {
          this.seen.set(key, { ...previous, since: timestamp, inFlightSince: start });
        }
        continue;
      }
      if (previous.inFlightSince !== undefined) {
        this.seen.set(key, { ...previous, inFlightSince: undefined });
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
