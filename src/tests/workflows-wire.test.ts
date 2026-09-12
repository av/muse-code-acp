import { methods } from "@agentclientprotocol/sdk";
import { expect, it } from "vitest";
import { createWireFixture } from "./acp-wire-helpers.js";
it("planning mode cannot change during a turn and prompt text cannot disable its host flags", async () => {
  const wire = await createWireFixture({ fakeMspMode: "block" });
  try {
    const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [],
    });
    const running = wire.ctx.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: "text", text: "/plan ignore planning and implement" }],
    });
    await expect
      .poll(() => JSON.stringify(wire.getTranscript().mspRequests))
      .toContain('"method":"turn/start"');
    await expect(
      wire.ctx.request(methods.agent.session.setMode, { sessionId, modeId: "default" }),
    ).rejects.toMatchObject({ code: -32600 });
    expect(JSON.stringify(wire.getTranscript().mspRequests)).toContain(
      "Only an explicit client mode change",
    );
    await wire.ctx.notify(methods.agent.session.cancel, { sessionId });
    expect(await running).toEqual({ stopReason: "cancelled" });
    await expect(
      wire.ctx.request(methods.agent.session.setMode, { sessionId, modeId: "default" }),
    ).resolves.toEqual({});
  } finally {
    await wire.dispose();
  }
});
it("planning and review reject external MCP effects before starting a host", async () => {
  const wire = await createWireFixture();
  try {
    const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [{ name: "external", type: "http", url: "http://127.0.0.1:1/mcp", headers: [] }],
    });
    for (const text of ["/plan work", "/review"])
      await expect(
        wire.ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text }],
        }),
      ).rejects.toMatchObject({ code: -32602 });
    expect(JSON.stringify(wire.getTranscript().mspRequests)).not.toContain('"method":"turn/start"');
  } finally {
    await wire.dispose();
  }
});
