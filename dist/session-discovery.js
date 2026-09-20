import { withSdkControlHost } from "./sdk-control-host.js";
import { MspError } from "@muse-code/sdk";
import { RequestError, } from "@agentclientprotocol/sdk";
import { FORK_METADATA } from "./session-fork.js";
import { realpathSync } from "node:fs";
import { assertSdkHostSupport } from "./muse-host.js";
import { listStoredSessions, storedSessionTitle } from "./session-store.js";
const PAGE_SIZE = 50;
function workspace(cwd) {
    if (!cwd)
        return null;
    try {
        return realpathSync(cwd);
    }
    catch {
        throw RequestError.invalidParams(undefined, "Listing workspace is unavailable");
    }
}
function decodeCursor(value, backend, cwd) {
    if (value == null)
        return;
    try {
        if (value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value))
            throw new Error();
        const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
        if (data.v !== 1 || data.backend !== backend || data.cwd !== cwd)
            throw new Error();
        if (backend === "sdk"
            ? typeof data.next !== "string" || !data.next || data.next.length > 2048
            : !Number.isSafeInteger(data.next) || data.next < 0)
            throw new Error();
        return data.next;
    }
    catch {
        throw RequestError.invalidParams(undefined, "Invalid session cursor or changed listing workspace/backend");
    }
}
function encodeCursor(next, backend, cwd) {
    return Buffer.from(JSON.stringify({ v: 1, backend, cwd, next })).toString("base64url");
}
/** Public metadata first; the bounded log-head title is explicitly a compatibility fallback. */
export function sessionInfo(value) {
    const s = value;
    if (!s ||
        typeof s.sessionId !== "string" ||
        typeof s.workspaceRoot !== "string" ||
        !s.workspaceRoot ||
        typeof s.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(s.updatedAt)))
        throw new Error("Muse returned invalid session discovery metadata");
    const fork = s.forkedFrom;
    const title = typeof s.title === "string" && s.title.trim()
        ? s.title.slice(0, 512)
        : typeof s.name === "string" && s.name.trim()
            ? s.name.slice(0, 512)
            : (storedSessionTitle(s.path, s.sessionId) ?? "(no prompt)");
    return {
        sessionId: s.sessionId,
        cwd: s.workspaceRoot,
        updatedAt: s.updatedAt,
        title,
        ...(fork && typeof fork.sessionId === "string" && typeof fork.cutCursor === "string"
            ? {
                _meta: {
                    [FORK_METADATA]: {
                        sourceSessionId: fork.sessionId,
                        cutCursor: fork.cutCursor,
                        explicitBoundary: fork.cutExplicit === true,
                    },
                },
            }
            : {}),
    };
}
export async function discoverSessions(options) {
    if (options.signal?.aborted)
        throw new Error("Session discovery disposed");
    const cwd = workspace(options.cwd);
    const cursor = decodeCursor(options.cursor, options.backend, cwd);
    if (options.backend === "exec") {
        const all = listStoredSessions(cwd, options.env, options.logger);
        const offset = cursor ?? 0;
        return {
            sessions: all
                .slice(offset, offset + PAGE_SIZE)
                .map(({ sessionId, cwd, title, updatedAt }) => ({ sessionId, cwd, title, updatedAt })),
            ...(offset + PAGE_SIZE < all.length
                ? { nextCursor: encodeCursor(offset + PAGE_SIZE, options.backend, cwd) }
                : {}),
        };
    }
    if (options.checkHost)
        assertSdkHostSupport(options.env, options.museBinary);
    return withSdkControlHost({ ...options, cwd: cwd ?? process.cwd() }, async ({ connection }) => {
        try {
            const page = await connection.request("session/list", {
                limit: PAGE_SIZE,
                ...(cwd ? { workspaceRoot: cwd } : {}),
                ...(cursor ? { cursor: cursor } : {}),
            });
            if (!Array.isArray(page.sessions) ||
                page.sessions.length > PAGE_SIZE ||
                (page.nextCursor !== null &&
                    (typeof page.nextCursor !== "string" ||
                        !page.nextCursor ||
                        page.nextCursor.length > 2048 ||
                        page.nextCursor === cursor)))
                throw new Error("Muse returned invalid session page");
            return {
                sessions: page.sessions.map(sessionInfo),
                ...(page.nextCursor
                    ? { nextCursor: encodeCursor(page.nextCursor, options.backend, cwd) }
                    : {}),
            };
        }
        catch (error) {
            if (error instanceof MspError && error.code === -32602)
                throw RequestError.invalidParams(undefined, "Muse rejected the session cursor or listing parameters");
            throw error;
        }
    });
}
export function sessionInfoNotification(info, capabilities = {}) {
    return {
        sessionId: info.sessionId,
        update: {
            sessionUpdate: "session_info_update",
            title: info.title,
            updatedAt: info.updatedAt,
            ...(capabilities._meta?.[FORK_METADATA] === 1 ? { _meta: info._meta } : {}),
        },
    };
}
