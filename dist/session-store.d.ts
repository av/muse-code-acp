import { Logger } from "./logger.js";
/**
 * Read-only view over muse's on-disk session store:
 * `$XDG_DATA_HOME/muse/sessions/YYYY/MM/DD/<session-id>/session.jsonl`
 * (verified layout, muse 0.2.1). Never mutates the store.
 */
export interface StoredSession {
    sessionId: string;
    /** Workspace root recorded by muse (realpath'd). */
    cwd: string;
    /** First user prompt, truncated — the human-recognizable handle. */
    title: string;
    /** Log file mtime (ISO) — cheap, honest recency for sorting. */
    updatedAt: string;
    logPath: string;
}
export declare function museDataDir(env?: Record<string, string | undefined>): string;
export declare function listStoredSessions(cwd: string | null, env?: Record<string, string | undefined>, logger?: Logger): StoredSession[];
/** Bounded compatibility title read from a public session path; no store enumeration. */
export declare function storedSessionTitle(path: unknown, sessionId: string): string | undefined;
//# sourceMappingURL=session-store.d.ts.map