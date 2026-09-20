import type { SessionNotification } from "@agentclientprotocol/sdk";
import type { Connection, Session } from "@muse-code/sdk";
export declare const USAGE_EXTENSION = "muse/usage";
declare const families: readonly ["session/tokenUsage", "session/contextUsage", "session/todoListChanged", "session/modelChanged", "session/approvalModeChanged"];
export type ProgressFacts = Partial<Record<(typeof families)[number], unknown>>;
export declare function foldedProgress(fold: Session["fold"]): ProgressFacts;
/** Restore latest facts via public pages; root identity and observed cursors only. */
export declare function readProgress(connection: Connection, sessionId: string): Promise<ProgressFacts>;
/** Latest authoritative facts replace, never add to, earlier observations. */
export declare class SessionProgress {
    private readonly sessionId;
    private readonly negotiated;
    private readonly publish;
    private signatures;
    private facts;
    constructor(sessionId: string, negotiated: boolean, publish: (n: SessionNotification) => Promise<void>);
    observe(values: ProgressFacts, reset?: boolean): Promise<void>;
    status(): string;
}
export {};
//# sourceMappingURL=session-progress.d.ts.map