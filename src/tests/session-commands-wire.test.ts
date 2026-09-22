import { expect, it } from "vitest";
import { methods } from "@agentclientprotocol/sdk";
import { createWireFixture } from "./acp-wire-helpers.js";
it("runs skills, rename and logout locally without a model turn", async () => {
  const w = await createWireFixture({ env: { META_API_KEY: "fixture-exported-key" } });
  try {
    const { sessionId } = await w.ctx.request(methods.agent.session.new, {
      cwd: w.workspace,
      mcpServers: [],
    });
    const prompt = (text: string) =>
      w.ctx.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: "text", text }] });
    await prompt("/skills");
    await prompt("/rename User title 中文");
    expect(
      w.updates.some(
        (n) =>
          n.update.sessionUpdate === "session_info_update" && n.update.title === "User title 中文",
      ),
    ).toBe(true);
    await prompt("/logout");
    expect(JSON.stringify(w.updates)).toContain("Credentials remain configured");
    expect(
      (w.getTranscript().mspRequests as { method: string }[]).filter(
        (r) => r.method === "turn/start",
      ),
    ).toHaveLength(0);
    await expect(prompt("after logout")).rejects.toMatchObject({ code: -32002 });
  } finally {
    await w.dispose();
  }
});
it("compatible steering snapshots the active turn and never falls back to a new turn", async () => {
  const w = await createWireFixture({
    fakeMspMode: "block",
    clientCapabilities: { _meta: { steering: { supported: true } } },
  });
  try {
    const { sessionId } = await w.ctx.request(methods.agent.session.new, {
      cwd: w.workspace,
      mcpServers: [],
    });
    const steer = (extra = {}) =>
      w.ctx.request("_session/steering", {
        sessionId,
        prompt: [{ type: "text", text: "correction" }],
        ...extra,
      });
    await expect(steer()).rejects.toMatchObject({ code: -32600 });
    const running = w.ctx.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: "text", text: "first" }],
    });
    await expect
      .poll(() => w.updates.some((n) => typeof n.update._meta?.["muse/activeTurnId"] === "string"))
      .toBe(true);
    await expect(steer()).resolves.toEqual({ outcome: "injected" });
    await expect(steer({ expectedTurnId: "stale" })).rejects.toMatchObject({ code: -32600 });
    await w.ctx.notify(methods.agent.session.cancel, { sessionId });
    await running;
    await expect(steer()).rejects.toMatchObject({ code: -32600 });
    expect(
      (w.getTranscript().mspRequests as { method: string }[]).filter(
        (r) => r.method === "turn/start",
      ),
    ).toHaveLength(1);
  } finally {
    await w.dispose();
  }
});
