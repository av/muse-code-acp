import { methods } from "@agentclientprotocol/sdk";
import { chmodSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { elicitationToAnswers, userInputToElicitation } from "../muse-user-input.js";
import { connectTestClient, fixturesDir, newTestSession } from "./helpers.js";

function sdkClient(mode = "userInput") {
  const binary = join(fixturesDir, "fake-msp.cjs");
  chmodSync(binary, 0o755);
  const capture = join(mkdtempSync(join(tmpdir(), "muse-ui-")), "requests.jsonl");
  const testClient = connectTestClient({
    backend: "sdk",
    museBinary: binary,
    skipSdkHostCheck: true,
    env: { ...process.env, FAKE_MSP_MODE: mode, FAKE_MSP_CAPTURE: capture },
  });
  return {
    ...testClient,
    requests: () =>
      readFileSync(capture, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
  };
}

describe("user-input elicitation mapping", () => {
  const request = {
    userInputId: "ui1",
    turnId: "t1",
    itemId: "i1",
    toolCallId: "c1",
    toolName: "ask_user",
    questions: [
      {
        id: "q1",
        header: "Color",
        question: "Pick a color",
        options: [{ label: "red" }, { label: "blue" }],
        selection: { mode: "single" as const },
      },
    ],
  };

  it("builds a form schema from MSP questions", () => {
    const elicitation = userInputToElicitation("s1", request);
    expect(elicitation.mode).toBe("form");
    expect(elicitation).toMatchObject({
      sessionId: "s1",
      requestedSchema: { required: ["q1"] },
    });
  });

  it("validates answers and treats decline as cancel", () => {
    expect(elicitationToAnswers(request, { action: "decline" })).toBe("cancel");
    expect(elicitationToAnswers(request, { action: "accept", content: { q1: "red" } })).toEqual([
      { questionId: "q1", selectedLabel: "red" },
    ]);
    expect(() =>
      elicitationToAnswers(request, { action: "accept", content: { q1: "green" } }),
    ).toThrow(/unknown option/);
  });
});

describe("SDK user input over ACP elicitation", () => {
  it("answers a structured request when the client advertises form support", async () => {
    const client = sdkClient();
    client.setElicitationResponder(() => ({
      action: "accept",
      content: { q1: "blue" },
    }));
    const { ctx, sessionId } = await newTestSession(client, {
      auth: { terminal: true },
      elicitation: { form: {} },
    });
    await expect(
      ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "ask" }],
      }),
    ).resolves.toEqual({ stopReason: "end_turn" });
    expect(client.elicitationRequests).toHaveLength(1);
    const answer = client.requests().find((r) => r.method === "userInput/answer");
    expect(answer.params.answers).toEqual([{ questionId: "q1", selectedLabel: "blue" }]);
  });

  it("cancels when the client has no form elicitation capability", async () => {
    const client = sdkClient();
    const { ctx, sessionId } = await newTestSession(client, { auth: { terminal: true } });
    await expect(
      ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "ask" }],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/form elicitation/i) });
    expect(client.elicitationRequests).toHaveLength(0);
    expect(client.requests().some((r) => r.method === "userInput/cancel")).toBe(true);
  });
});
