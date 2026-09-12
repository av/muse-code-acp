import { methods } from "@agentclientprotocol/sdk";
import { expect, it } from "vitest";
import { createWireFixture } from "./acp-wire-helpers.js";
import { FILE_REPORT_CAPABILITIES } from "../file-change-evidence.js";
const requestMeta = (requestId: string) => ({
  jetbrains: { air: { agentFileChangeReportRequest: { version: 1, requestId } } },
});
function reports(wire: Awaited<ReturnType<typeof createWireFixture>>) {
  return wire.updates.flatMap((n) => {
    const meta = n.update._meta as
      { jetbrains?: { air?: { agentFileChangeReport?: Record<string, unknown> } } } | undefined;
    return meta?.jetbrains?.air?.agentFileChangeReport
      ? [meta.jetbrains.air.agentFileChangeReport]
      : [];
  });
}
it("negotiates reports, emits one before the prompt response, and never starts an audit turn", async () => {
  const wire = await createWireFixture({
    clientCapabilities: { _meta: FILE_REPORT_CAPABILITIES },
    env: { GIT_CONFIG_COUNT: "invalid" },
  });
  try {
    const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [],
    });
    await expect(
      wire.ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "one" }],
        _meta: requestMeta("report-one"),
      }),
    ).resolves.toEqual({ stopReason: "end_turn" });
    expect(reports(wire)).toEqual([
      expect.objectContaining({
        requestId: "report-one",
        status: "reported",
        paths: [],
        declaredComplete: false,
      }),
    ]);
    await expect
      .poll(() => wire.getTranscript().acpInbound.some((line) => line.includes('"stopReason"')))
      .toBe(true);
    const frames = wire.getTranscript().acpInbound.map((line) => JSON.parse(line));
    const reportIndex = frames.findIndex(
      (f) => f.params?.update?._meta?.jetbrains?.air?.agentFileChangeReport,
    );
    expect(reportIndex).toBeGreaterThan(-1);
    expect(reportIndex).toBeLessThan(frames.findIndex((f) => f.result?.stopReason));
    expect(
      frames.find((f) => f.result?.protocolVersion)?.result._meta.jetbrains.air.capabilities,
    ).toContain("agentFileChangeReport");
    expect(
      wire
        .getTranscript()
        .mspRequests.filter((r) => (r as { method: string }).method === "turn/start"),
    ).toHaveLength(1);
    await wire.ctx.request(methods.agent.session.prompt, {
      sessionId,
      prompt: [{ type: "text", text: "no report requested" }],
    });
    expect(reports(wire)).toHaveLength(1);
  } finally {
    await wire.dispose();
  }
});
it.each(["cancel", "close"] as const)(
  "settles a requested report as unavailable on %s without replay",
  async (method) => {
    const wire = await createWireFixture({
      fakeMspMode: "block",
      clientCapabilities: { _meta: FILE_REPORT_CAPABILITIES },
    });
    try {
      const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
        cwd: wire.workspace,
        mcpServers: [],
      });
      const prompt = wire.ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "cancel" }],
        _meta: requestMeta("cancelled"),
      });
      await expect
        .poll(() => wire.updates.some((n) => n.update.sessionUpdate === "agent_message_chunk"))
        .toBe(true);
      const stopping =
        method === "cancel"
          ? wire.ctx.notify(methods.agent.session.cancel, { sessionId })
          : wire.ctx.request(methods.agent.session.close, { sessionId });
      await expect(prompt).resolves.toEqual({ stopReason: "cancelled" });
      await stopping;
      expect(reports(wire)).toEqual([
        { version: 1, requestId: "cancelled", status: "unavailable", reason: "cancelled" },
      ]);
      expect(
        wire
          .getTranscript()
          .mspRequests.filter((r) => (r as { method: string }).method === "turn/start"),
      ).toHaveLength(1);
    } finally {
      await wire.dispose();
    }
  },
);
it.each([false, true])(
  "ignores unnegotiated or malformed requests (negotiated: %s)",
  async (negotiated) => {
    const wire = await createWireFixture({
      clientCapabilities: negotiated ? { _meta: FILE_REPORT_CAPABILITIES } : {},
    });
    try {
      const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
        cwd: wire.workspace,
        mcpServers: [],
      });
      await wire.ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "baseline" }],
        _meta: requestMeta(negotiated ? "invalid id" : "valid"),
      });
      expect(reports(wire)).toEqual([]);
    } finally {
      await wire.dispose();
    }
  },
);
it("retains the original failed prompt while reporting only partial observations", async () => {
  const wire = await createWireFixture({
    fakeMspMode: "exit",
    clientCapabilities: { _meta: FILE_REPORT_CAPABILITIES },
  });
  try {
    const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [],
    });
    await expect(
      wire.ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "fail" }],
        _meta: requestMeta("failure"),
      }),
    ).rejects.toThrow(/Muse SDK/);
    expect(reports(wire)).toEqual([
      expect.objectContaining({
        requestId: "failure",
        declaredComplete: false,
        uncertainty: expect.stringContaining("The turn failed"),
      }),
    ]);
  } finally {
    await wire.dispose();
  }
});
