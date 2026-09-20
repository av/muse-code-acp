import { RequestError } from "@agentclientprotocol/sdk";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMuseCapture } from "./muse-run.js";
/**
 * Runs `muse export --session <id>` and parses the self-contained document
 * (export_schema_version 1). Export is preferred over raw log parsing: the
 * on-disk log uses an internal runtime.* vocabulary, while the export wraps
 * each record with derived metadata and stable event kinds.
 */
export async function runMuseExport(sessionId, env = process.env, museBinary) {
    const outDir = mkdtempSync(join(tmpdir(), "muse-export-"));
    const outFile = join(outDir, "export.json");
    try {
        await runMuseCapture(["export", "--session", sessionId, "--out", outFile], env, museBinary);
        return JSON.parse(readFileSync(outFile, "utf8"));
    }
    finally {
        rmSync(outDir, { recursive: true, force: true });
    }
}
/**
 * Replays an export document as ACP session updates, in original order:
 * user prompts (`run.started`), agent replies (`assistant_message_committed`),
 * and tool calls (task `side_effect_intent` → `completed`/`failed`).
 * Encrypted reasoning has no plaintext in exports and is skipped silently.
 */
export function exportToUpdates(sessionId, doc, _logger = console) {
    if (doc.export_schema_version !== 1) {
        throw RequestError.internalError(undefined, `unsupported muse export schema ${doc.export_schema_version}; expected 1`);
    }
    const updates = [];
    /** task_id → call info for tool tasks seen in this replay. */
    const toolTasks = new Map();
    const push = (update) => updates.push({ sessionId, update });
    for (const wrapped of doc.events ?? []) {
        const payload = wrapped.envelope?.payload;
        const event = payload?.event;
        if (!payload || !event) {
            continue;
        }
        if (payload.kind === "run") {
            if (event.kind === "started" && typeof event.prompt === "string" && event.prompt) {
                push({
                    sessionUpdate: "user_message_chunk",
                    content: { type: "text", text: event.prompt },
                });
            }
            else if (event.kind === "assistant_message_committed" && typeof event.text === "string") {
                push({
                    sessionUpdate: "agent_message_chunk",
                    content: { type: "text", text: event.text },
                });
            }
        }
        else if (payload.kind === "task") {
            const taskId = typeof payload.task_id === "string" ? payload.task_id : "";
            if (event.kind === "side_effect_intent" &&
                typeof event.operation === "string" &&
                event.operation.startsWith("tool:")) {
                const toolName = event.operation.slice("tool:".length);
                const key = typeof event.idempotency_key === "string" ? event.idempotency_key : taskId;
                const callId = key.startsWith("tool:") ? key.slice("tool:".length) : key;
                toolTasks.set(taskId, { callId, toolName });
                push({
                    sessionUpdate: "tool_call",
                    toolCallId: callId,
                    title: toolName,
                    name: toolName,
                    status: "pending",
                });
            }
            else if ((event.kind === "completed" || event.kind === "failed") &&
                !toolTasks.has(taskId) &&
                typeof event.operation === "string" &&
                event.operation.startsWith("tool:")) {
                // Completion-only tool items (intent lost) still surface once.
                const toolName = event.operation.slice("tool:".length);
                const callId = typeof event.idempotency_key === "string" && event.idempotency_key.startsWith("tool:")
                    ? event.idempotency_key.slice("tool:".length)
                    : taskId || toolName;
                push({
                    sessionUpdate: "tool_call",
                    toolCallId: callId,
                    title: toolName,
                    name: toolName,
                    status: event.kind === "completed" ? "completed" : "failed",
                });
            }
            else if (event.kind === "completed" || event.kind === "failed") {
                const call = toolTasks.get(taskId);
                if (call) {
                    push({
                        sessionUpdate: "tool_call_update",
                        toolCallId: call.callId,
                        status: event.kind === "completed" ? "completed" : "failed",
                    });
                    toolTasks.delete(taskId);
                }
            }
        }
    }
    return updates;
}
