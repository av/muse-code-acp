import type { Logger } from "./logger.js";
interface ForkSessionMetadata {
    sessionId: string;
    workspaceRoot: string | null;
    modelId: string | null;
    activeTurnId: string | null;
    status: string;
    forkedFrom: {
        sessionId: string;
        cutCursor: string;
        cutExplicit: boolean;
    } | null;
}
interface ForkResult {
    session: ForkSessionMetadata;
}
export declare const FORK_METADATA = "muse/fork";
export declare function forkMuseSession(options: {
    sessionId: string;
    cwd: string;
    lastTurnId?: string;
    env: Record<string, string | undefined>;
    museBinary?: string;
    checkHost: boolean;
    logger: Logger;
    signal?: AbortSignal;
}): Promise<ForkResult>;
export {};
//# sourceMappingURL=session-fork.d.ts.map