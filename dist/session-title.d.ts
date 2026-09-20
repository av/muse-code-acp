import { type SessionInfo, type SessionNotification } from "@agentclientprotocol/sdk";
export declare function renameSession(sessionId: string, title: string, env: Record<string, string | undefined>): {
    text: string;
    updatedAt: string;
};
export declare function applySessionTitle(info: SessionInfo, env: Record<string, string | undefined>): SessionInfo;
export declare function applyTitleUpdate(notification: SessionNotification, env: Record<string, string | undefined>): SessionNotification;
//# sourceMappingURL=session-title.d.ts.map