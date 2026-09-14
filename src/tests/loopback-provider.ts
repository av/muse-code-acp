/**
 * Loopback fake Meta endpoint for real `muse serve` tests.
 * Pattern matches Muse sdk-quickstart: content-routed once-only bash tool call.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FAKE_MODEL_ID = "fake-model";
export const ALTERNATE_MODEL_ID = "fake-model-alternate";
const DUMMY_API_KEY = "test-dummy-key";

export interface LoopbackProviderOptions {
  statusCode?: number;
  /** Substrings that must all appear in the request body to script a bash tool call. */
  scriptedToolCallWhen: readonly string[];
  scriptedToolCallCommand: string;
  /** Override the default bash call when exercising another host-provided tool. */
  scriptedToolCall?: { name: string; arguments: Record<string, unknown> };
  scriptedToolCallForRequest?: (
    request: Record<string, unknown>,
  ) =>
    | { name: string; arguments: Record<string, unknown> }
    | undefined
    | Promise<{ name: string; arguments: Record<string, unknown> } | undefined>;
  replyText?: string;
  /** Hold SSE open so cancel races stay deterministic. */
  holdMs?: number;
}

export interface LoopbackProvider {
  home: string;
  root: string;
  baseUrl: string;
  catalogGets(): number;
  authorizations(): (string | undefined)[];
  scriptedToolCalls(): number;
  requests(): Record<string, unknown>[];
  close(): Promise<void>;
}

function sse(value: unknown): string {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function catalogBody(): string {
  return JSON.stringify({
    object: "list",
    data: [FAKE_MODEL_ID, ALTERNATE_MODEL_ID].map((id) => ({
      id,
      object: "model",
      metadata: {
        "muse-code": {
          release_date: "2026-01-01",
          is_hidden: false,
          limit: { context: 1_000_000, output: 1024 },
        },
      },
    })),
  });
}

function responseFrame(id: string, status: string, extra: Record<string, unknown> = {}) {
  return { id, object: "response", model: FAKE_MODEL_ID, status, output: [], ...extra };
}

function textHead(text: string): string {
  return (
    sse({
      type: "response.created",
      sequence_number: 1,
      response: responseFrame("resp_text", "in_progress"),
    }) +
    sse({
      type: "response.output_text.delta",
      sequence_number: 2,
      output_index: 0,
      item_id: "msg_text",
      content_index: 0,
      delta: text,
    })
  );
}

function toolCallHead(
  callId: string,
  tool: NonNullable<LoopbackProviderOptions["scriptedToolCall"]>,
): string {
  return (
    sse({
      type: "response.created",
      sequence_number: 1,
      response: responseFrame("resp_tool", "in_progress"),
    }) +
    sse({
      type: "response.function_call_arguments.done",
      sequence_number: 2,
      output_index: 0,
      item_id: `fc_${callId}`,
      name: tool.name,
      call_id: callId,
      arguments: JSON.stringify(tool.arguments),
    })
  );
}

function completionTail(id: string): string {
  return sse({
    type: "response.completed",
    sequence_number: 3,
    response: responseFrame(id, "completed", {
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
    }),
  });
}

export async function startLoopbackProvider(
  options: LoopbackProviderOptions,
): Promise<LoopbackProvider> {
  const replyText = options.replyText ?? "ok";
  const scriptedTool = options.scriptedToolCall ?? {
    name: "bash",
    arguments: {
      command: options.scriptedToolCallCommand,
      description: "Write the approval artifact",
    },
  };
  const holdMs = options.holdMs ?? 2_000;
  const authorizationHeaders: (string | undefined)[] = [];
  let catalogGets = 0;
  let scriptedToolCalls = 0;
  const requests: Record<string, unknown>[] = [];
  const holds = new Set<ReturnType<typeof setTimeout>>();
  const catalog = catalogBody();

  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (request.method === "GET" && (request.url ?? "").endsWith("/muse-code/models")) {
        catalogGets += 1;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(catalog);
        return;
      }
      if (request.method !== "POST" || !(request.url ?? "").endsWith("/responses")) {
        response.writeHead(404).end();
        return;
      }
      authorizationHeaders.push(request.headers.authorization);
      const parsed = JSON.parse(body);
      requests.push(parsed);
      if (options.statusCode) {
        response.writeHead(options.statusCode, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: { type: "authentication_error", message: "isolated gateway rejection" },
          }),
        );
        return;
      }
      const requestedTool = options.scriptedToolCallForRequest
        ? await options.scriptedToolCallForRequest(parsed)
        : scriptedTool;
      const offersScriptedTool = (parsed.tools ?? []).some(
        (namespace: { name: string; tools?: { name: string }[] }) =>
          namespace.tools
            ? namespace.tools.some(
                (tool) =>
                  tool.name === requestedTool?.name ||
                  `${namespace.name}__${tool.name}` === requestedTool?.name,
              )
            : namespace.name === requestedTool?.name,
      );

      const isScripted =
        !!requestedTool &&
        (!!options.scriptedToolCallForRequest || scriptedToolCalls === 0) &&
        offersScriptedTool &&
        options.scriptedToolCallWhen.every((needle) => body.includes(needle));

      let head: string;
      let responseId: string;
      if (isScripted) {
        scriptedToolCalls += 1;
        responseId = "resp_tool";
        head = toolCallHead(`call_${scriptedToolCalls}`, requestedTool);
      } else {
        responseId = "resp_text";
        head = textHead(replyText);
      }

      response.writeHead(200, { "content-type": "text/event-stream" });
      response.write(head);
      const hold = setTimeout(() => {
        holds.delete(hold);
        if (!response.writableEnded) {
          response.end(completionTail(responseId));
        }
      }, holdMs);
      holds.add(hold);
    });
    request.on("error", () => {});
    response.on("error", () => {});
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("loopback provider did not bind");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const root = mkdtempSync(join(tmpdir(), "muse-acp-live-"));
  const config = join(root, "config", "muse");
  mkdirSync(config, { recursive: true });
  writeFileSync(
    join(config, "settings.json"),
    JSON.stringify({
      schema_version: 1,
      model: FAKE_MODEL_ID,
      reasoning_effort: "none",
      endpoint_transport: { base_url: baseUrl, auth: "bearer" },
    }),
  );
  writeFileSync(
    join(config, "auth.json"),
    JSON.stringify({
      schema_version: 1,
      providers: { meta: { api_key: DUMMY_API_KEY } },
    }),
  );

  return {
    home: root,
    root,
    baseUrl,
    catalogGets: () => catalogGets,
    authorizations: () => authorizationHeaders,
    scriptedToolCalls: () => scriptedToolCalls,
    requests: () => requests,
    close: async () => {
      for (const hold of holds) {
        clearTimeout(hold);
      }
      holds.clear();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export { FAKE_MODEL_ID };
