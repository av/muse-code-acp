import { sideEffectIntentPayloadSchema, toolResultPayloadSchema, } from "./muse-events.js";
/**
 * Copy Muse tool arguments onto the field names Kandev already renders.
 * Edit cards read `old_str_1`/`new_str_1`, creates read `file_content`,
 * search cards read `path`, and a subagent card is a task whose raw input
 * sets `_toolName` to `task`. Muse's own fields stay on the call.
 */
export function kandevWireArgs(tool, args) {
    if (!args)
        return args;
    if (tool === "subagent_spawn") {
        const task = typeof args.task_name === "string" ? args.task_name : "";
        const role = typeof args.role === "string" ? args.role : "";
        const objective = typeof args.objective === "string" ? args.objective : "";
        return {
            ...args,
            _toolName: "task",
            description: task || role || "subagent",
            prompt: objective,
            subagent_type: role,
        };
    }
    if (tool === "edit_file") {
        return {
            ...args,
            ...(typeof args.find === "string" && args.old_str_1 == null ? { old_str_1: args.find } : {}),
            ...(typeof args.replace === "string" && args.new_str_1 == null
                ? { new_str_1: args.replace }
                : {}),
        };
    }
    if (tool === "write_file" && typeof args.content === "string" && args.file_content == null) {
        return { ...args, file_content: args.content };
    }
    if (tool === "search" && typeof args.path !== "string") {
        const paths = args.paths;
        const first = Array.isArray(paths)
            ? paths.find((entry) => typeof entry === "string" && entry)
            : typeof paths === "string"
                ? paths
                : "";
        if (typeof first === "string" && first)
            return { ...args, path: first };
    }
    return args;
}
/** Muse tool name → ACP tool kind (icons/UI treatment in clients). */
export const TOOL_KINDS = {
    bash: "execute",
    write_file: "edit",
    edit_file: "edit",
    read_file: "read",
    web_search: "search",
    search: "search",
    web_fetch: "fetch",
};
/**
 * Correlates muse's tool events into ACP tool_call / tool_call_update pairs
 * for one prompt turn.
 *
 * Muse 0.2.1 keeps tool *arguments* inside the encrypted model response, so a
 * pending call initially carries just the tool name; the human-usable title
 * (command, path) is upgraded when `tool.result` arrives — bash results embed
 * `command`/`description`/`output`, write_file results name the path.
 */
export class ToolCallTracker {
    sessionId;
    byTask = new Map();
    byCall = new Map();
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    /** `task.lifecycle.side_effect_intent` → pending tool_call (tool ops only). */
    intentToUpdates(envelope) {
        const parsed = sideEffectIntentPayloadSchema.safeParse(envelope.payload);
        if (!parsed.success) {
            return [];
        }
        const { event } = parsed.data;
        if (!event.operation.startsWith("tool:")) {
            return [];
        }
        const toolName = event.operation.slice("tool:".length);
        const callId = event.idempotency_key.startsWith("tool:")
            ? event.idempotency_key.slice("tool:".length)
            : event.idempotency_key;
        const call = { callId, toolName };
        this.byTask.set(event.task_id, call);
        this.byCall.set(callId, call);
        return [
            {
                sessionId: this.sessionId,
                update: {
                    sessionUpdate: "tool_call",
                    toolCallId: callId,
                    title: toolName,
                    name: toolName,
                    kind: TOOL_KINDS[toolName] ?? "other",
                    status: "pending",
                    _meta: event.policy_decision ? { musePolicyDecision: event.policy_decision } : undefined,
                },
            },
        ];
    }
    /** `tool.result` → completed/failed tool_call_update (or a one-shot failed
     *  tool_call for results whose intent never appeared, e.g. argument
     *  validation failures). */
    resultToUpdates(envelope) {
        const parsed = toolResultPayloadSchema.safeParse(envelope.payload);
        if (!parsed.success) {
            return [];
        }
        const { call_id: callId, correlation_facts: facts } = parsed.data;
        const text = parsed.data.text ?? "";
        const known = this.byCall.get(callId);
        const toolName = facts?.tool_name ?? known?.toolName;
        const failed = facts ? facts.outcome !== "success" : true;
        const status = failed ? "failed" : "completed";
        const presentation = presentResult(toolName, text);
        if (known) {
            return [
                {
                    sessionId: this.sessionId,
                    update: {
                        sessionUpdate: "tool_call_update",
                        toolCallId: callId,
                        status,
                        ...presentation,
                    },
                },
            ];
        }
        // No prior intent: muse rejected the call before it became a side effect
        // (argument validation). Surface it as a single already-failed tool_call.
        return [
            {
                sessionId: this.sessionId,
                update: {
                    sessionUpdate: "tool_call",
                    toolCallId: callId,
                    title: toolName ?? "tool call rejected",
                    kind: toolName ? (TOOL_KINDS[toolName] ?? "other") : "other",
                    status,
                    content: text ? [textContent(text)] : [],
                },
            },
        ];
    }
}
export function presentResult(toolName, text) {
    if (toolName === "bash") {
        const parsed = parseBashResult(text);
        if (parsed) {
            return {
                title: parsed.description || parsed.command,
                content: parsed.output ? [textContent(parsed.output)] : [],
                rawInput: { command: parsed.command },
                rawOutput: {
                    ...parsed.raw,
                    formatted_output: parsed.output,
                },
            };
        }
    }
    if (toolName === "read_file") {
        const path = text.match(/^Read text file `([^`\r\n]+)`\./u)?.[1];
        if (path) {
            return {
                title: `read_file: ${path}`,
                content: [textContent(text)],
                locations: [{ path }],
                rawInput: { path },
                rawOutput: { formatted_output: text },
            };
        }
    }
    if (toolName === "write_file" || toolName === "edit_file") {
        const path = writtenFilePath(text);
        if (path) {
            return {
                title: `${toolName}: ${path}`,
                content: [textContent(text)],
                locations: [{ path }],
            };
        }
    }
    return { content: text ? [textContent(text)] : [] };
}
function parseBashResult(text) {
    try {
        const raw = JSON.parse(text);
        if (typeof raw !== "object" || raw === null || typeof raw.command !== "string") {
            return null;
        }
        return {
            command: raw.command,
            description: typeof raw.description === "string" ? raw.description : "",
            output: typeof raw.output === "string" ? raw.output : "",
            raw,
        };
    }
    catch {
        return null;
    }
}
export function textContent(text) {
    return { type: "content", content: { type: "text", text } };
}
export function writtenFilePath(text) {
    return text.match(/^wrote \d+ bytes to (.+)$/s)?.[1]?.trim();
}
