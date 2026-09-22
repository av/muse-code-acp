/** Kandev's own question card. ACP elicitation is not what renders it. */
export const KANDEV_QUESTION_TOOL = "ask_user_question_kandev";
/**
 * The HTTP MCP server Kandev injects into the ACP session under the name
 * `kandev`. That server's ask_user_question tool is the question card Claude,
 * Codex, and Grok use.
 */
export function kandevQuestionEndpoint(servers) {
    for (const server of servers) {
        if (server.name !== "kandev")
            continue;
        if (!("type" in server) || (server.type !== "http" && server.type !== "sse"))
            continue;
        if (!server.url)
            continue;
        const headers = {};
        for (const header of server.headers)
            headers[header.name] = header.value;
        return { url: server.url, headers };
    }
}
/** Kandev keys answers by question id and invents q1 when the id is blank. */
function wireQuestionId(id, index) {
    const trimmed = id.trim();
    return trimmed || `q${index + 1}`;
}
/** Map a Muse question onto Kandev's card. Free text and more than six choices cannot. */
export function toKandevQuestions(request) {
    if (request.questions.length < 1 || request.questions.length > 4)
        return;
    const questions = [];
    for (const question of request.questions) {
        if (question.selection.mode === "multiple")
            return;
        if (question.options.length < 2 || question.options.length > 6)
            return;
        const title = (question.header || "").slice(0, 12);
        questions.push({
            id: wireQuestionId(question.id, questions.length),
            prompt: question.question,
            ...(title ? { title } : {}),
            options: question.options.map((option) => {
                const description = option.description?.trim() || option.label;
                return {
                    label: option.label,
                    description,
                    option_id: option.label,
                };
            }),
        });
    }
    return questions;
}
export function kandevResultToAnswers(request, result) {
    const body = toolResultObject(result);
    if (!body)
        return "reject";
    if (body.rejected === true)
        return "cancel";
    const answers = [];
    for (const [index, question] of request.questions.entries()) {
        const wireId = wireQuestionId(question.id, index);
        const entry = body[wireId];
        if (!entry || typeof entry !== "object")
            return "reject";
        const record = entry;
        const selected = typeof record.selected_option === "string" ? record.selected_option : "";
        const custom = typeof record.custom_text === "string" ? record.custom_text.trim() : "";
        const label = question.options.find((option) => option.label === selected)?.label;
        if (label) {
            const answerId = question.id.trim() || wireId;
            answers.push({ questionId: answerId, selectedLabel: label });
            continue;
        }
        if (custom) {
            const answerId = question.id.trim() || wireId;
            answers.push(question.options.length > 0
                ? { questionId: answerId, selectedLabel: custom }
                : { questionId: answerId, freeText: custom });
            continue;
        }
        if (record.answered === false)
            return "cancel";
        return "reject";
    }
    return answers;
}
function toolResultObject(result) {
    if (!result || typeof result !== "object")
        return;
    const record = result;
    if (record.structuredContent && typeof record.structuredContent === "object") {
        return record.structuredContent;
    }
    const text = record.content?.find((block) => block.type === "text")?.text;
    if (!text)
        return;
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed : undefined;
    }
    catch {
        return;
    }
}
/**
 * Ask through Kandev's MCP question tool and wait until the person answers.
 * One MCP session per question; the call stays open for as long as the card does.
 */
export async function askKandevQuestion(endpoint, request, fetchImpl = fetch) {
    const questions = toKandevQuestions(request);
    if (!questions)
        return "reject";
    const session = await openMcpSession(endpoint, fetchImpl);
    try {
        const result = await mcpRequest(endpoint, fetchImpl, session, "tools/call", {
            name: KANDEV_QUESTION_TOOL,
            arguments: { questions },
        });
        return kandevResultToAnswers(request, result);
    }
    finally {
        await fetchImpl(endpoint.url, {
            method: "DELETE",
            headers: { ...endpoint.headers, "mcp-session-id": session },
        }).catch(() => { });
    }
}
async function openMcpSession(endpoint, fetchImpl) {
    const response = await fetchImpl(endpoint.url, {
        method: "POST",
        headers: {
            ...endpoint.headers,
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                clientInfo: { name: "muse-code-acp", version: "0" },
            },
        }),
    });
    if (!response.ok)
        throw new Error(`Kandev MCP initialize failed (${response.status})`);
    const session = response.headers.get("mcp-session-id");
    if (!session)
        throw new Error("Kandev MCP initialize returned no session");
    await fetchImpl(endpoint.url, {
        method: "POST",
        headers: {
            ...endpoint.headers,
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-session-id": session,
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }).catch(() => { });
    return session;
}
async function mcpRequest(endpoint, fetchImpl, session, method, params) {
    const response = await fetchImpl(endpoint.url, {
        method: "POST",
        headers: {
            ...endpoint.headers,
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-session-id": session,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }),
    });
    if (!response.ok)
        throw new Error(`Kandev MCP ${method} failed (${response.status})`);
    const payload = await readRpc(response);
    if (payload.error) {
        const message = payload.error && typeof payload.error === "object" && "message" in payload.error
            ? String(payload.error.message)
            : method;
        throw new Error(message);
    }
    return payload.result;
}
async function readRpc(response) {
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/event-stream")) {
        return (await response.json());
    }
    const text = await response.text();
    for (const line of text.split("\n")) {
        if (!line.startsWith("data:"))
            continue;
        const data = line.slice(5).trim();
        if (!data)
            continue;
        const parsed = JSON.parse(data);
        if (parsed.result !== undefined || parsed.error !== undefined)
            return parsed;
    }
    throw new Error("Kandev MCP event stream had no result");
}
