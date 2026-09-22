import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { askKandevQuestion, kandevQuestionEndpoint, toKandevQuestions } from "../kandev-question.js";
import type { MuseUserInputRequest } from "../muse-user-input.js";

const request: MuseUserInputRequest = {
  userInputId: "ui1",
  turnId: "t1",
  itemId: "i1",
  toolCallId: "c1",
  toolName: "request_user_input",
  questions: [
    {
      id: "q1",
      header: "Next",
      question: "What should I do next?",
      options: [{ label: "Sync" }, { label: "Commit" }],
      selection: { mode: "single" },
    },
  ],
};

describe("kandev question card", () => {
  it("finds the injected kandev MCP server and ignores other servers", () => {
    expect(
      kandevQuestionEndpoint([
        { name: "other", type: "http", url: "http://127.0.0.1:1/mcp", headers: [] },
        {
          name: "kandev",
          type: "http",
          url: "http://127.0.0.1:9/mcp",
          headers: [{ name: "authorization", value: "Bearer t" }],
        },
      ]),
    ).toEqual({
      url: "http://127.0.0.1:9/mcp",
      headers: { authorization: "Bearer t" },
    });
  });

  it("refuses a question the card cannot show", () => {
    expect(toKandevQuestions(request)?.[0].options.map((option) => option.option_id)).toEqual([
      "Sync",
      "Commit",
    ]);
    expect(
      toKandevQuestions({
        ...request,
        questions: [{ ...request.questions[0], options: [{ label: "Only" }] }],
      }),
    ).toBeUndefined();
  });

  it("asks the kandev tool and returns the chosen label", async () => {
    const seen: unknown[] = [];
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as {
          method?: string;
          params?: unknown;
        };
        if (body.method === "initialize") {
          res.setHeader("mcp-session-id", "sess");
          res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } }));
          return;
        }
        if (body.method === "notifications/initialized") {
          res.writeHead(202);
          res.end();
          return;
        }
        seen.push(body.params);
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              structuredContent: { q1: { selected_option: "Commit" } },
            },
          }),
        );
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    try {
      const answers = await askKandevQuestion(
        { url: `http://127.0.0.1:${port}/mcp`, headers: {} },
        request,
      );
      expect(answers).toEqual([{ questionId: "q1", selectedLabel: "Commit" }]);
      expect(seen[0]).toMatchObject({
        name: "ask_user_question_kandev",
        arguments: { questions: [{ id: "q1", prompt: "What should I do next?" }] },
      });
    } finally {
      server.close();
    }
  });
});
