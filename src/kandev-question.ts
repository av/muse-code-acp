import type { McpServer } from "@agentclientprotocol/sdk";
import type { MuseUserInputAnswer, MuseUserInputRequest } from "./muse-user-input.js";

/** Kandev's own question card. ACP elicitation is not what renders it. */
export const KANDEV_QUESTION_TOOL = "ask_user_question_kandev";

export interface KandevQuestionEndpoint {
  url: string;
  headers: Record<string, string>;
}

/**
 * The HTTP MCP server Kandev injects into the ACP session under the name
 * `kandev`. That server's ask_user_question tool is the question card Claude,
 * Codex, and Grok use.
 */
export function kandevQuestionEndpoint(servers: readonly McpServer[]): KandevQuestionEndpoint | undefined {
  for (const server of servers) {
    if (server.name !== "kandev") continue;
    if (!("type" in server) || (server.type !== "http" && server.type !== "sse")) continue;
    if (!server.url) continue;
    const headers: Record<string, string> = {};
    for (const header of server.headers) headers[header.name] = header.value;
    return { url: server.url, headers };
  }
}

interface KandevQuestion {
  id: string;
  prompt: string;
  title?: string;
  options: Array<{ label: string; description: string; option_id: string }>;
}

/** Map a Muse question onto Kandev's card. Free text and more than six choices cannot. */
export function toKandevQuestions(request: MuseUserInputRequest): KandevQuestion[] | undefined {
  if (request.questions.length < 1 || request.questions.length > 4) return;
  const questions: KandevQuestion[] = [];
  for (const question of request.questions) {
    if (question.selection.mode === "multiple") return;
    if (question.options.length < 2 || question.options.length > 6) return;
    const title = (question.header || "").slice(0, 12);
    questions.push({
      id: question.id,
      prompt: question.question,
      ...(title ? { title } : {}),
      options: question.options.map((option) => ({
        label: option.label,
        description: option.label,
        option_id: option.label,
      })),
    });
  }
  return questions;
}

export function kandevResultToAnswers(
  request: MuseUserInputRequest,
  result: unknown,
): MuseUserInputAnswer[] | "cancel" | "reject" {
  const body = toolResultObject(result);
  if (!body) return "reject";
  if (body.rejected === true) return "cancel";
  const answers: MuseUserInputAnswer[] = [];
  for (const question of request.questions) {
    const entry = body[question.id];
    if (!entry || typeof entry !== "object") return "reject";
    const record = entry as { selected_option?: unknown; custom_text?: unknown; answered?: unknown };
    const selected = typeof record.selected_option === "string" ? record.selected_option : "";
    const custom = typeof record.custom_text === "string" ? record.custom_text.trim() : "";
    const label = question.options.find((option) => option.label === selected)?.label;
    if (label) {
      answers.push({ questionId: question.id, selectedLabel: label });
      continue;
    }
    if (custom) {
      answers.push(
        question.options.length > 0
          ? { questionId: question.id, selectedLabel: custom }
          : { questionId: question.id, freeText: custom },
      );
      continue;
    }
    if (record.answered === false) return "cancel";
    return "reject";
  }
  return answers;
}

function toolResultObject(result: unknown): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object") return;
  const record = result as {
    structuredContent?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (record.structuredContent && typeof record.structuredContent === "object") {
    return record.structuredContent as Record<string, unknown>;
  }
  const text = record.content?.find((block) => block.type === "text")?.text;
  if (!text) return;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return;
  }
}

/**
 * Ask through Kandev's MCP question tool and wait until the person answers.
 * One MCP session per question; the call stays open for as long as the card does.
 */
export async function askKandevQuestion(
  endpoint: KandevQuestionEndpoint,
  request: MuseUserInputRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<MuseUserInputAnswer[] | "cancel" | "reject"> {
  const questions = toKandevQuestions(request);
  if (!questions) return "reject";
  const session = await openMcpSession(endpoint, fetchImpl);
  try {
    const result = await mcpRequest(endpoint, fetchImpl, session, "tools/call", {
      name: KANDEV_QUESTION_TOOL,
      arguments: { questions },
    });
    return kandevResultToAnswers(request, result);
  } finally {
    await fetchImpl(endpoint.url, {
      method: "DELETE",
      headers: { ...endpoint.headers, "mcp-session-id": session },
    }).catch(() => {});
  }
}

async function openMcpSession(
  endpoint: KandevQuestionEndpoint,
  fetchImpl: typeof fetch,
): Promise<string> {
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
  if (!response.ok) throw new Error(`Kandev MCP initialize failed (${response.status})`);
  const session = response.headers.get("mcp-session-id");
  if (!session) throw new Error("Kandev MCP initialize returned no session");
  await fetchImpl(endpoint.url, {
    method: "POST",
    headers: {
      ...endpoint.headers,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-session-id": session,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => {});
  return session;
}

async function mcpRequest(
  endpoint: KandevQuestionEndpoint,
  fetchImpl: typeof fetch,
  session: string,
  method: string,
  params: unknown,
): Promise<unknown> {
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
  if (!response.ok) throw new Error(`Kandev MCP ${method} failed (${response.status})`);
  const payload = await readRpc(response);
  if (payload.error) {
    const message =
      payload.error && typeof payload.error === "object" && "message" in payload.error
        ? String((payload.error as { message: unknown }).message)
        : method;
    throw new Error(message);
  }
  return payload.result;
}

async function readRpc(response: Response): Promise<{ result?: unknown; error?: unknown }> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/event-stream")) {
    return (await response.json()) as { result?: unknown; error?: unknown };
  }
  const text = await response.text();
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    const parsed = JSON.parse(data) as { result?: unknown; error?: unknown };
    if (parsed.result !== undefined || parsed.error !== undefined) return parsed;
  }
  throw new Error("Kandev MCP event stream had no result");
}
