import { methods } from "@agentclientprotocol/sdk";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { MuseModelDiscovery, type ModelDiscoveryResult } from "../model-discovery.js";
import { createWireFixture } from "./acp-wire-helpers.js";
import { connectTestClient, fixturesDir } from "./helpers.js";

it("advertises changed host rows over ACP while retaining selected models and effort", async () => {
  const root = mkdtempSync(join(tmpdir(), "muse-model-menu-"));
  const catalog = join(root, "catalog.json");
  const writeCatalog = (id: string) =>
    writeFileSync(
      catalog,
      JSON.stringify({
        source: "fakeCatalog",
        models: [{ modelId: id, displayLabel: `Host ${id}` }],
      }),
    );
  writeCatalog("first");
  const wire = await createWireFixture({ env: { FAKE_MSP_MODELS: catalog } });
  try {
    const first = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [],
    });
    expect(first.configOptions?.find((o) => o.id === "model")).toMatchObject({
      options: expect.arrayContaining([{ value: "first", name: "Host first" }]),
    });
    await wire.ctx.request(methods.agent.session.setConfigOption, {
      sessionId: first.sessionId,
      configId: "model",
      value: "first",
    });
    await wire.ctx.request(methods.agent.session.setConfigOption, {
      sessionId: first.sessionId,
      configId: "reasoningEffort",
      value: "minimal",
    });
    const resumed = await wire.ctx.request(methods.agent.session.resume, {
      sessionId: first.sessionId,
      cwd: wire.workspace,
      mcpServers: [],
    });
    expect(resumed.configOptions?.find((o) => o.id === "reasoningEffort")?.currentValue).toBe(
      "minimal",
    );
    writeCatalog("next");
    mkdirSync(join(wire.workspace, "config", "muse"), { recursive: true });
    writeFileSync(
      join(wire.workspace, "config", "muse", "settings.json"),
      JSON.stringify({ model: "configured-next" }),
    );
    const second = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [],
    });
    expect(second.configOptions?.find((o) => o.id === "model")).toMatchObject({
      currentValue: "configured-next",
      options: [
        { value: "configured-next", name: "configured-next" },
        { value: "next", name: "Host next" },
      ],
    });
    const selected = await wire.ctx.request(methods.agent.session.setConfigOption, {
      sessionId: first.sessionId,
      configId: "model",
      value: "custom-model",
    });
    expect(selected.configOptions.find((o) => o.id === "reasoningEffort")?.currentValue).toBe(
      "minimal",
    );
    expect(selected.configOptions.find((o) => o.id === "model")?.currentValue).toBe("custom-model");
    await expect(
      wire.ctx.request(methods.agent.session.setConfigOption, {
        sessionId: first.sessionId,
        configId: "reasoningEffort",
        value: "invented",
      }),
    ).rejects.toMatchObject({ code: -32602 });
    await wire.ctx.request(methods.agent.session.prompt, {
      sessionId: first.sessionId,
      prompt: [{ type: "text", text: "discovered config" }],
    });
    expect(wire.getTranscript().mspRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "turn/start",
          params: expect.objectContaining({ reasoningEffort: "minimal" }),
        }),
      ]),
    );
  } finally {
    await wire.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

it("labels unsupported discovery and retains only the current SDK model", async () => {
  const wire = await createWireFixture();
  try {
    const created = await wire.ctx.request(methods.agent.session.new, {
      cwd: wire.workspace,
      mcpServers: [],
    });
    const model = created.configOptions?.find((o) => o.id === "model");
    expect(model).toMatchObject({
      description: expect.stringContaining("discovery unavailable"),
      options: [{ value: model?.currentValue, name: model?.currentValue }],
    });
    expect(wire.getTranscript().mspRequests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "turn/start" })]),
    );
  } finally {
    await wire.dispose();
  }
});

it("shutdown drains a pending new-session discovery without publishing state", async () => {
  const root = mkdtempSync(join(tmpdir(), "muse-discovery-race-"));
  const gate = Promise.withResolvers<ModelDiscoveryResult>();
  const entered = Promise.withResolvers<void>();
  const probe = vi.spyOn(MuseModelDiscovery.prototype, "discover").mockImplementation(() => {
    entered.resolve();
    return gate.promise;
  });
  const client = connectTestClient({
    backend: "sdk",
    museBinary: join(fixturesDir, "fake-msp.cjs"),
    skipSdkHostCheck: true,
  });
  try {
    const creating = client.agent.newSession({ cwd: root, mcpServers: [] }).then(
      () => "created",
      () => "rejected",
    );
    await entered.promise;
    let disposed = false;
    const disposal = client.agent.dispose().then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);
    gate.resolve({ status: "available", source: "fakeCatalog", models: [] });
    await disposal;
    expect(await creating).toBe("rejected");
    expect(client.agent.sessions.size).toBe(0);
  } finally {
    gate.resolve({ status: "fallback", models: [], reason: "cleanup" });
    probe.mockRestore();
    await client.agent.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
