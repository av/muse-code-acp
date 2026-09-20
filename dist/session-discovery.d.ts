import { type ListSessionsResponse, type SessionInfo, type SessionNotification, type ClientCapabilities } from "@agentclientprotocol/sdk";
import type { Logger } from "./logger.js";
type Options = {
    backend: "sdk" | "exec";
    cwd?: string | null;
    cursor?: string | null;
    env: Record<string, string | undefined>;
    museBinary?: string;
    checkHost: boolean;
    logger: Logger;
    signal?: AbortSignal;
};
/** Public metadata first; the bounded log-head title is explicitly a compatibility fallback. */
export declare function sessionInfo(value: unknown): SessionInfo;
export declare function discoverSessions(options: Options): Promise<ListSessionsResponse>;
export declare function sessionInfoNotification(info: SessionInfo, capabilities?: ClientCapabilities): SessionNotification;
export {};
//# sourceMappingURL=session-discovery.d.ts.map