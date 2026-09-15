import { MspError, spawnMspConnection } from "@muse-code/sdk";
import {
  RequestError,
  type ListSessionsResponse,
  type SessionInfo,
  type SessionNotification,
  type ClientCapabilities,
} from "@agentclientprotocol/sdk";
import { FORK_METADATA } from "./session-fork.js";
import { realpathSync } from "node:fs";
import { museCliPath } from "./muse-cli.js";
import { assertSdkHostSupport } from "./muse-host.js";
import { listStoredSessions, storedSessionTitle } from "./session-store.js";
import type { Logger } from "./logger.js";
import packageJson from "../package.json" with { type: "json" };

const PAGE_SIZE = 50;
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
function workspace(cwd: string | null | undefined): string | null {
  if (!cwd) return null;
  try {
    return realpathSync(cwd);
  } catch {
    throw RequestError.invalidParams(undefined, "Listing workspace is unavailable");
  }
}
function decodeCursor(
  value: string | null | undefined,
  backend: string,
  cwd: string | null,
): string | number | undefined {
  if (value == null) return;
  try {
    if (value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (data.v !== 1 || data.backend !== backend || data.cwd !== cwd) throw new Error();
    if (
      backend === "sdk"
        ? typeof data.next !== "string" || !data.next || data.next.length > 2048
        : !Number.isSafeInteger(data.next) || data.next < 0
    )
      throw new Error();
    return data.next;
  } catch {
    throw RequestError.invalidParams(
      undefined,
      "Invalid session cursor or changed listing workspace/backend",
    );
  }
}
function encodeCursor(next: string | number, backend: string, cwd: string | null): string {
  return Buffer.from(JSON.stringify({ v: 1, backend, cwd, next })).toString("base64url");
}
/** Public metadata first; the bounded log-head title is explicitly a compatibility fallback. */
export function sessionInfo(value: unknown): SessionInfo {
  const s = value as Record<string, unknown>;
  if (
    !s ||
    typeof s.sessionId !== "string" ||
    typeof s.workspaceRoot !== "string" ||
    !s.workspaceRoot ||
    typeof s.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(s.updatedAt))
  )
    throw new Error("Muse returned invalid session discovery metadata");
  const fork = s.forkedFrom as Record<string, unknown> | null | undefined;
  const title =
    typeof s.title === "string" && s.title.trim()
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
export async function discoverSessions(options: Options): Promise<ListSessionsResponse> {
  if (options.signal?.aborted) throw new Error("Session discovery disposed");
  const cwd = workspace(options.cwd);
  const cursor = decodeCursor(options.cursor, options.backend, cwd);
  if (options.backend === "exec") {
    const all = listStoredSessions(cwd, options.env, options.logger);
    const offset = (cursor as number | undefined) ?? 0;
    return {
      sessions: all
        .slice(offset, offset + PAGE_SIZE)
        .map(({ sessionId, cwd, title, updatedAt }) => ({ sessionId, cwd, title, updatedAt })),
      ...(offset + PAGE_SIZE < all.length
        ? { nextCursor: encodeCursor(offset + PAGE_SIZE, options.backend, cwd) }
        : {}),
    };
  }
  if (options.checkHost) assertSdkHostSupport(options.env, options.museBinary);
  const host = spawnMspConnection({
    command: options.museBinary ?? museCliPath(options.env),
    args: ["serve"],
    cwd: cwd ?? process.cwd(),
    env: options.env as Record<string, string>,
    shutdownTimeoutMs: 1000,
  });
  const abort = () => {
    void host.close().catch(() => {});
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => void host.close().catch(() => {}), 20_000);
  try {
    const { connection } = await host.initialize({
      clientInfo: { name: "muse_code_acp", version: packageJson.version },
    });
    const page = await connection.request("session/list", {
      limit: PAGE_SIZE,
      ...(cwd ? { workspaceRoot: cwd } : {}),
      ...(cursor ? { cursor: cursor as string } : {}),
    });
    if (
      !Array.isArray(page.sessions) ||
      page.sessions.length > PAGE_SIZE ||
      (page.nextCursor !== null &&
        (typeof page.nextCursor !== "string" ||
          !page.nextCursor ||
          page.nextCursor.length > 2048 ||
          page.nextCursor === cursor))
    )
      throw new Error("Muse returned invalid session page");
    return {
      sessions: page.sessions.map(sessionInfo),
      ...(page.nextCursor
        ? { nextCursor: encodeCursor(page.nextCursor, options.backend, cwd) }
        : {}),
    };
  } catch (error) {
    if (error instanceof MspError && error.code === -32602)
      throw RequestError.invalidParams(
        undefined,
        "Muse rejected the session cursor or listing parameters",
      );
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    clearTimeout(timer);
    await host.close();
  }
}

export function sessionInfoNotification(
  info: SessionInfo,
  capabilities: ClientCapabilities = {},
): SessionNotification {
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
