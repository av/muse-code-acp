import { RequestError } from "@agentclientprotocol/sdk";
import {
  sdkThrownError,
  safeDiagnostic,
  failureError,
  type FailureObservation,
} from "./turn-failure.js";

export type SdkPhase =
  "initializing" | "preparing" | "submitting" | "running" | "reading" | "forking";
export class SdkCancelled extends Error {}
export class SdkDeadline extends Error {}
const MAX_TIMER = 2_147_483_647;
export function sdkDeadline(env: Record<string, string | undefined>, name: "STARTUP" | "SUBMIT") {
  const key = `MUSE_CODE_ACP_${name}_TIMEOUT_MS`;
  const value = env[key];
  if (value === undefined) return name === "STARTUP" ? 120_000 : 30_000;
  const parsed = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_TIMER)
    throw RequestError.invalidParams(undefined, `${key} must be an integer in 1..${MAX_TIMER}`);
  return parsed;
}

/** One initiating cause wins; closing the transport is a consequence, never its replacement. */
export class SdkOperation {
  phase: SdkPhase = "initializing";
  failure?: unknown;
  private failed = false;
  private failurePhase?: SdkPhase;
  private disposed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private reject!: (error: unknown) => void;
  private readonly stopped = new Promise<never>((_, reject) => {
    this.reject = reject;
  });
  private since = Date.now();
  constructor(
    private readonly stop: () => void,
    private readonly log: (text: string) => void = () => {},
  ) {
    void this.stopped.catch(() => {});
  }
  enter(phase: SdkPhase, timeoutMs?: number) {
    this.check();
    this.log(`muse-sdk phase ${this.phase}: ${Date.now() - this.since}ms; entering ${phase}`);
    this.since = Date.now();
    this.phase = phase;
    clearTimeout(this.timer);
    if (timeoutMs !== undefined)
      this.timer = setTimeout(
        () => this.fail(new SdkDeadline(`Muse SDK ${phase} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
  }
  fail = (error: unknown) => {
    if (this.failed || this.disposed) return;
    this.failed = true;
    this.failure = error;
    this.failurePhase = this.phase;
    clearTimeout(this.timer);
    this.reject(error);
    this.stop();
  };
  check() {
    if (this.failed) throw this.failure;
  }
  async wait<T>(work: Promise<T>): Promise<T> {
    // Attach before checking: a late rejected SDK promise must remain observed.
    const waiting = Promise.race([work, this.stopped]);
    try {
      const value = await waiting;
      this.check();
      return value;
    } catch (error) {
      this.fail(error);
      throw this.failure ?? error;
    }
  }
  error(
    error: unknown,
    env: Record<string, string | undefined>,
    diagnostic?: string,
  ): RequestError {
    const cause = this.failed ? this.failure : error;
    const phase = this.failurePhase ?? this.phase;
    const enrichment =
      diagnostic && !(cause instanceof SdkDeadline) && !(cause instanceof SdkCancelled);
    const base = enrichment
      ? failureError("environmentError", diagnostic, false, env)
      : sdkThrownError(cause, env);
    const failure = (base.data as { failure?: FailureObservation } | undefined)?.failure;
    const notSubmitted = ["initializing", "preparing", "reading", "forking"].includes(phase);
    const recovery =
      phase === "forking"
        ? "No model turn was submitted. A session fork may have been created; inspect session/list before explicitly trying again."
        : notSubmitted
          ? "No model turn was submitted by this operation. Check host availability and the configured deadline before explicitly trying again."
          : failure?.recovery;
    const detail = safeDiagnostic(
      enrichment ? base.message : cause instanceof Error ? cause.message : base.message,
      env,
    );
    return new RequestError(base.code, notSubmitted ? `${detail}. ${recovery}` : base.message, {
      ...((base.data as object) ?? {}),
      failure: {
        ...(failure ?? {
          kind: "requestError",
          source: "adapter",
          outcome: "failed",
          recovery: "Check the request parameters.",
        }),
        ...(cause instanceof SdkCancelled ? { kind: "cancelled", source: "adapter" } : {}),
        ...(cause instanceof SdkDeadline ? { kind: "deadlineExceeded", source: "adapter" } : {}),
        phase,
        execution: notSubmitted ? "notSubmitted" : "possiblySubmitted",
        ...(notSubmitted ? { outcome: "failed", recovery } : {}),
        ...(phase === "forking" ? { outcome: "unknown", mutation: "possiblyApplied" } : {}),
      },
    });
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}
