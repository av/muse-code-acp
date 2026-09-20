import { Logger } from "./logger.js";
import { MuseEnvelope } from "./muse-events.js";
export interface MuseExecOptions {
    prompt: string;
    /** Muse `--session-id`; identical to the ACP session id. */
    sessionId: string;
    /** Working directory of the run (muse's workspace root defaults to cwd). */
    cwd: string;
    /** Path to the muse binary; resolved via {@link museCliPath} when omitted. */
    museBinary?: string;
    /** `--provider echo` is the deterministic offline provider used in tests. */
    provider?: "meta" | "echo";
    model?: string;
    reasoningEffort?: string;
    /** Turn-scoped images forwarded through Muse's repeatable `--image` flag. */
    imagePaths?: string[];
    /** Extra CLI flags appended verbatim (e.g. `--echo-delay-ms` in tests). */
    extraArgs?: string[];
    env?: Record<string, string | undefined>;
    logger?: Logger;
}
export type MuseExitOutcome = {
    kind: "completed";
    code: 0;
} | {
    kind: "failed";
    code: number;
} | {
    kind: "usage-error";
    code: number;
} | {
    kind: "cancelled";
    code: number | null;
    signal: string | null;
};
export interface MuseExecHandle {
    /** Parsed JSONL envelopes off the child's stdout, in order. */
    events: AsyncIterable<MuseEnvelope>;
    /** Cooperative cancel: SIGINT by default (muse exits 130 and journals safely). */
    kill(signal?: "SIGINT" | "SIGTERM"): void;
    /** Settles when the child exits; never rejects. */
    done: Promise<MuseExitOutcome>;
    pid: number | undefined;
    /** The exact command line spawned — for usage-error diagnostics. */
    argv: string[];
}
/**
 * Spawns one headless muse turn: `muse exec --json --session-id <id> <prompt>`.
 * stdout carries the JSONL event stream (verified: the `muse:` startup
 * preamble goes to stderr, which is logged, never parsed).
 */
export declare function spawnMuseExec(options: MuseExecOptions): MuseExecHandle;
//# sourceMappingURL=muse-exec.d.ts.map