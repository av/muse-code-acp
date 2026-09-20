import { constants, fstatSync, closeSync, openSync, readdirSync, readSync, realpathSync, statSync, } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const TITLE_MAX = 80;
/** Only the log head is read when listing — big sessions stay cheap. */
const HEAD_BYTES = 64 * 1024;
export function museDataDir(env = process.env) {
    const dataHome = env.XDG_DATA_HOME || join(env.HOME ?? homedir(), ".local", "share");
    return join(dataHome, "muse");
}
export function listStoredSessions(cwd, env = process.env, logger = console) {
    const sessionsRoot = join(museDataDir(env), "sessions");
    const wanted = cwd ? tryRealpath(cwd) : null;
    const sessions = [];
    for (const logPath of sessionLogPaths(sessionsRoot)) {
        try {
            const head = readHead(logPath);
            const meta = parseHead(head);
            if (!meta) {
                logger.log(`session store: no metadata in ${logPath}; skipping`);
                continue;
            }
            if (wanted && tryRealpath(meta.workspaceRoot) !== wanted) {
                continue;
            }
            sessions.push({
                sessionId: meta.sessionId,
                cwd: meta.workspaceRoot,
                title: meta.title ?? "(no prompt)",
                updatedAt: statSync(logPath).mtime.toISOString(),
                logPath,
            });
        }
        catch (err) {
            logger.log(`session store: skipping unreadable ${logPath}: ${err}`);
        }
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
/** `sessions/YYYY/MM/DD/<id>/session.jsonl`, tolerant of stray entries. */
function sessionLogPaths(root) {
    const paths = [];
    const walk = (dir, depth) => {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            const path = join(dir, entry.name);
            if (depth === 4) {
                paths.push(join(path, "session.jsonl"));
            }
            else {
                walk(path, depth + 1);
            }
        }
    };
    walk(root, 1);
    return paths;
}
function readHead(path) {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
    try {
        if (!fstatSync(fd).isFile())
            throw new Error("Session log is not a regular file");
        const buffer = Buffer.alloc(HEAD_BYTES);
        const bytes = readSync(fd, buffer, 0, HEAD_BYTES, 0);
        return buffer.subarray(0, bytes).toString("utf8");
    }
    finally {
        closeSync(fd);
    }
}
/**
 * Line 1 is `runtime.session.metadata` (workspace root); the first
 * `runtime.user_intent.accepted` carries the prompt text in `refill_blocks`.
 */
function parseHead(head) {
    let sessionId = null;
    let workspaceRoot = null;
    let title = null;
    for (const line of head.split("\n")) {
        if (!line.trim()) {
            continue;
        }
        let record;
        try {
            record = JSON.parse(line);
        }
        catch {
            continue; // possibly a truncated tail of the head window
        }
        sessionId ??= record?.stream?.id ?? null;
        if (record?.payload_type === "runtime.session.metadata") {
            const root = record?.payload?.record?.workspace_root;
            if (typeof root === "string") {
                workspaceRoot = root;
            }
        }
        if (title === null && record?.payload_type === "runtime.user_intent.accepted") {
            const blocks = record?.payload?.refill_blocks;
            if (Array.isArray(blocks)) {
                const text = blocks
                    .map((block) => (typeof block?.text === "string" ? block.text : ""))
                    .join(" ")
                    .trim();
                if (text) {
                    title = text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;
                }
            }
        }
        if (sessionId && workspaceRoot && title) {
            break;
        }
    }
    return sessionId && workspaceRoot ? { sessionId, workspaceRoot, title } : null;
}
function tryRealpath(path) {
    try {
        return realpathSync(path);
    }
    catch {
        return path;
    }
}
/** Bounded compatibility title read from a public session path; no store enumeration. */
export function storedSessionTitle(path, sessionId) {
    if (typeof path !== "string" || !path)
        return;
    try {
        const head = parseHead(readHead(path));
        return head?.sessionId === sessionId ? (head.title ?? undefined) : undefined;
    }
    catch {
        return;
    }
}
