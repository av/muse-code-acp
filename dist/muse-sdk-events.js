import { OUTPUT_EXTENSION, outputMetadata } from "./stored-output.js";
import { ASYNC_TASKS, workerKinds, workerText } from "./async-tasks.js";
import { presentResult, TOOL_KINDS } from "./tool-calls.js";
const LIMIT = 64 * 1024;
const bounded = (text) => text.length > LIMIT
    ? `${text.slice(0, LIMIT)}\n[Output truncated by adapter; full output is not included in this card.]`
    : text;
/** Correlated public text/summary/tool surfaces; never inspect private reasoning. */
export class MuseSdkTranslator {
    sessionId;
    logger;
    fileChanges;
    items = new Map();
    emittedText = new Map();
    output = new Map();
    notices = new Set();
    outputNegotiated = false;
    configureOutput(enabled) {
        this.outputNegotiated = enabled;
    }
    workerContext;
    configureWorkers(generation, cancel, negotiated) {
        this.workerContext = { generation, cancel, negotiated };
    }
    lostWork() {
        return [...this.items.values()]
            .filter((i) => i.status === "inProgress" &&
            (workerKinds.has(String(i.kind)) || i.kind === "toolCall" || i.kind === "userShell"))
            .map((i) => ({
            sessionId: this.sessionId,
            update: {
                sessionUpdate: "tool_call_update",
                toolCallId: i.callId ?? i.itemId,
                status: "failed",
                content: [
                    {
                        type: "content",
                        content: {
                            type: "text",
                            text: "Observation ended with the host; this task outcome is unknown. Reload to inspect saved state.",
                        },
                    },
                ],
                ...(this.workerContext?.negotiated
                    ? { _meta: { [ASYNC_TASKS]: { outcome: "unknown", actions: [] } } }
                    : {}),
            },
        }));
    }
    constructor(sessionId, logger, fileChanges) {
        this.sessionId = sessionId;
        this.logger = logger;
        this.fileChanges = fileChanges;
    }
    fromDelta({ itemId, delta, field }) {
        const item = this.items.get(itemId);
        if (!item || item.status !== "inProgress")
            return [];
        if (item.kind === "agentMessage" && (!field || field === "text"))
            return this.append(itemId, delta, false);
        const summary = field?.match(/^summary\.(\d+)$/);
        if (item.kind === "reasoning" && summary && Number(summary[1]) < 500)
            return this.append(`${itemId}:summary.${summary[1]}`, delta, true, Number(summary[1]) > 0);
        if ((item.kind === "toolCall" || item.kind === "userShell") && field === "output") {
            const text = (this.output.get(itemId) ?? item.visibleOutput ?? "") + delta;
            this.output.set(itemId, text.slice(0, LIMIT + 1));
            return this.tool(item, true, bounded(text));
        }
        return [];
    }
    /** A fold catch-up is an absolute accumulated value, never another delta. */
    fromAccumulated(itemId, field, text) {
        const item = this.items.get(itemId);
        if (!item || item.status !== "inProgress")
            return [];
        if (item.kind === "agentMessage" && field === "text")
            return this.snapshot(itemId, text, false);
        const summary = field.match(/^summary\.(\d+)$/);
        if (item.kind === "reasoning" && summary && Number(summary[1]) < 500)
            return this.snapshot(`${itemId}:${field}`, text, true, Number(summary[1]) > 0);
        if ((item.kind === "toolCall" || item.kind === "userShell") && field === "output") {
            const previous = this.output.get(itemId) ?? "";
            if (!text.startsWith(previous) || text === previous)
                return [];
            this.output.set(itemId, text.slice(0, LIMIT + 1));
            return this.tool(item, true, bounded(text));
        }
        return [];
    }
    fromItem(item) {
        const previous = this.items.get(item.itemId);
        if (previous && previous.revision >= item.revision)
            return [];
        this.items.set(item.itemId, item);
        if (item.kind === "userMessage")
            return [];
        if (item.kind === "agentMessage")
            return [
                ...this.snapshot(item.itemId, item.text ?? "", false),
                ...this.truncated(item, false),
            ];
        if (item.kind === "reasoning") {
            const updates = (item.summary ?? [])
                .slice(0, 500)
                .flatMap((part, index) => this.snapshot(`${item.itemId}:summary.${index}`, part, true, index > 0));
            return [...updates, ...this.truncated(item, true)];
        }
        const text = (workerKinds.has(String(item.kind)) ? workerText(item) : undefined) ??
            item.visibleOutput ??
            this.output.get(item.itemId) ??
            item.failureReason ??
            item.fallbackText ??
            (item.kind === "toolCall" ? item.text : undefined) ??
            "";
        this.output.set(item.itemId, text.slice(0, LIMIT + 1));
        return this.tool(item, !!previous, bounded(text));
    }
    append(key, delta, thought, newPart = false) {
        const prior = this.emittedText.get(key) ?? "";
        const text = (prior + delta).slice(0, LIMIT);
        this.emittedText.set(key, text);
        const suffix = text.slice(prior.length);
        const updates = this.textUpdate((!prior && newPart && suffix ? "\n" : "") + suffix, thought);
        if (prior.length + delta.length > LIMIT && !this.notices.has(key)) {
            this.notices.add(key);
            updates.push(...this.textUpdate("\n[Public text truncated by adapter.]", thought));
        }
        return updates;
    }
    snapshot(key, text, thought, newPart = false) {
        const emitted = this.emittedText.get(key) ?? "";
        if (!text.startsWith(emitted)) {
            this.logger.log(`muse-sdk: final text changed for ${key}`);
            return [];
        }
        return this.append(key, text.slice(emitted.length), thought, newPart);
    }
    truncated(item, thought) {
        const key = `${item.itemId}:host-truncated`;
        if (!item.truncated || this.notices.has(key))
            return [];
        this.notices.add(key);
        return this.textUpdate("\n[Public output truncated by Muse; full output is not included in this card.]", thought);
    }
    tool(item, previous, output) {
        const regular = item.kind === "toolCall";
        const tool = regular ? (item.tool ?? "tool") : String(item.kind);
        const args = regular ? parseArgs(item.args) : undefined;
        const notices = [];
        if (item.failureReason && !output.includes(item.failureReason))
            notices.push(`[Failure: ${bounded(item.failureReason)}]`);
        if (item.truncated)
            notices.push("[Public output truncated by Muse; full output is not included in this card.]");
        if (item.outputRef)
            notices.push(`[Stored output ${item.outputRef.availability}; ${this.outputNegotiated ? "use the negotiated output-read reference" : "byte retrieval is not enabled for this client/host"}.]`);
        for (const content of (item.modelVisibleContent ?? []).slice(0, 32))
            notices.push(`[${String(content.type).slice(0, 80)} content (${String(content.mediaType).slice(0, 120)}): binary data unavailable inline in this public item.]`);
        const display = bounded([output, ...notices].filter(Boolean).join("\n"));
        const fileContent = regular ? this.fileChanges?.present(item) : undefined;
        const candidateQuery = tool === "search" ? args?.pattern : tool === "web_search" ? args?.query : undefined;
        const searchQuery = typeof candidateQuery === "string" ? candidateQuery : undefined;
        const title = searchQuery
            ? `${tool}: ${searchQuery}`
            : (args?.description ?? args?.command ?? args?.path ?? item.commandText);
        const call = {
            toolCallId: item.callId ?? item.itemId,
            name: tool,
            ...(this.workerContext?.negotiated &&
                (workerKinds.has(String(item.kind)) || item.kind === "toolCall" || item.kind === "userShell")
                ? {
                    _meta: {
                        [ASYNC_TASKS]: {
                            kind: item.kind,
                            target: `${this.workerContext.generation}:${item.itemId}`,
                            actions: item.kind === "workflow" &&
                                item.status === "inProgress" &&
                                item.workflowRunId &&
                                this.workerContext.cancel
                                ? ["cancel"]
                                : [],
                            observedStatus: item.status,
                            ...(item.childSessionId
                                ? { childSessionId: item.childSessionId, childHistory: "unavailable" }
                                : {}),
                        },
                    },
                }
                : {}),
            title: typeof title === "string"
                ? title.slice(0, 1024)
                : regular
                    ? tool
                    : `${item.kind}: ${item.status}`,
            kind: TOOL_KINDS[tool] ?? (item.kind === "userShell" ? "execute" : "other"),
            status: item.status === "inProgress"
                ? "in_progress"
                : item.status === "completed"
                    ? "completed"
                    : "failed",
            ...presentResult(tool, display ||
                (!regular
                    ? (item.fallbackText ??
                        `Public ${item.kind} item (${item.status}); no further detail supplied.`)
                    : "")),
            ...(fileContent
                ? {
                    content: [
                        ...fileContent,
                        ...(notices.length
                            ? [
                                {
                                    type: "content",
                                    content: { type: "text", text: notices.join("\n") },
                                },
                            ]
                            : []),
                    ],
                }
                : {}),
            ...(args ? { rawInput: args } : {}),
        };
        if (this.outputNegotiated) {
            const metadata = outputMetadata(this.sessionId, item);
            if (metadata)
                call._meta = { ...call._meta, [OUTPUT_EXTENSION]: metadata };
        }
        return [
            {
                sessionId: this.sessionId,
                update: previous
                    ? { ...call, sessionUpdate: "tool_call_update" }
                    : { ...call, sessionUpdate: "tool_call" },
            },
        ];
    }
    textUpdate(text, thought = false) {
        return text
            ? [
                {
                    sessionId: this.sessionId,
                    update: {
                        sessionUpdate: thought ? "agent_thought_chunk" : "agent_message_chunk",
                        content: { type: "text", text },
                    },
                },
            ]
            : [];
    }
}
function parseArgs(text) {
    if (!text)
        return;
    if (text.length > LIMIT)
        return { arguments: bounded(text) };
    try {
        const value = JSON.parse(text);
        if (value !== null && typeof value === "object" && !Array.isArray(value))
            return value;
    }
    catch {
        // Preserve public non-JSON arguments as bounded text.
    }
    return { arguments: text };
}
