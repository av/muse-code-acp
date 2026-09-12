import { describe, it, expect, vi } from "vitest";
import * as store from "../session-store.js";
import * as sdk from "../muse-sdk.js";
import * as history from "../session-export.js";
import { connectTestClient, fakeMuseBinary, newTestSession } from "./helpers.js";

describe("session binding races", () => {
  it("rejects close, prompt and duplicate load while history is being read", async () => {
    const client = connectTestClient({
      backend: "exec",
      museBinary: fakeMuseBinary(),
      env: { ...process.env, FAKE_MUSE_MODE: "exit0" },
    });
    const { sessionId, cwd } = await newTestSession(client);
    const gate = Promise.withResolvers<Awaited<ReturnType<typeof history.runMuseExport>>>();
    const list = vi.spyOn(store, "listStoredSessions").mockReturnValue([
      {
        sessionId,
        cwd,
        logPath: "/unused/session.jsonl",
        title: "test",
        updatedAt: "2026-09-12T00:00:00Z",
      },
    ]);
    const read = vi.spyOn(history, "runMuseExport").mockReturnValue(gate.promise);
    try {
      const load = client.agent.loadSession({ sessionId, cwd, mcpServers: [] });
      await expect(client.agent.closeSession({ sessionId })).rejects.toMatchObject({
        code: -32600,
      });
      await expect(
        client.agent.prompt({ sessionId, prompt: [{ type: "text", text: "race" }] }),
      ).rejects.toMatchObject({ code: -32600 });
      await expect(
        client.agent.loadSession({ sessionId, cwd, mcpServers: [] }),
      ).rejects.toMatchObject({ code: -32600 });
      gate.resolve({ export_schema_version: 1, events: [] });
      await load;
      await expect(client.agent.closeSession({ sessionId })).resolves.toEqual({});
      expect(client.agent.sessions.has(sessionId)).toBe(false);
    } finally {
      read.mockRestore();
      list.mockRestore();
      await client.agent.dispose();
    }
  });
});

describe("disposal during binding", () => {
  it.each(["load", "resume"] as const)(
    "does not restore state after a delayed %s",
    async (method) => {
      const client = connectTestClient({
        backend: method === "load" ? "exec" : "sdk",
        museBinary: fakeMuseBinary(),
        skipSdkHostCheck: true,
      });
      const { sessionId, cwd } = await newTestSession(client);
      client.agent.sessions.delete(sessionId);
      const list = vi
        .spyOn(store, "listStoredSessions")
        .mockReturnValue([
          { sessionId, cwd, logPath: "unused", title: "test", updatedAt: "2026-09-12" },
        ]);
      const exportGate = Promise.withResolvers<Awaited<ReturnType<typeof history.runMuseExport>>>();
      const metadataGate =
        Promise.withResolvers<Awaited<ReturnType<typeof sdk.readMuseSdkSession>>>();
      const read = vi.spyOn(history, "runMuseExport").mockReturnValue(exportGate.promise);
      const metadata = vi.spyOn(sdk, "readMuseSdkSession").mockReturnValue(metadataGate.promise);
      try {
        const binding = (
          method === "load"
            ? client.agent.loadSession({ sessionId, cwd, mcpServers: [] })
            : client.agent.resumeSession({ sessionId, cwd, mcpServers: [] })
        ).then(
          () => "restored",
          () => "rejected",
        );
        const disposed = client.agent.dispose();
        exportGate.resolve({ export_schema_version: 1, events: [] });
        metadataGate.resolve({ modelId: "saved" });
        await disposed;
        expect(await binding).toBe("rejected");
        expect(client.agent.sessions.size).toBe(0);
        await expect(client.agent.newSession({ cwd, mcpServers: [] })).rejects.toMatchObject({
          code: -32600,
        });
        await expect(
          client.agent.prompt({ sessionId, prompt: [{ type: "text", text: "late" }] }),
        ).rejects.toMatchObject({ code: -32600 });
        await expect(
          client.agent.loadSession({ sessionId, cwd, mcpServers: [] }),
        ).rejects.toMatchObject({ code: -32600 });
        await expect(
          client.agent.resumeSession({ sessionId, cwd, mcpServers: [] }),
        ).rejects.toMatchObject({ code: -32600 });
        await client.agent.dispose();
      } finally {
        read.mockRestore();
        metadata.mockRestore();
        list.mockRestore();
      }
    },
  );
});

it("waits for an in-flight replay update and stops the rest on disposal", async () => {
  const client = connectTestClient({ backend: "exec", museBinary: fakeMuseBinary() });
  const { sessionId, cwd } = await newTestSession(client);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const list = vi
    .spyOn(store, "listStoredSessions")
    .mockReturnValue([{ sessionId, cwd, logPath: "unused", title: "", updatedAt: "" }]);
  const read = vi.spyOn(history, "runMuseExport").mockResolvedValue({
    export_schema_version: 1,
    events: ["first", "second"].map((text) => ({
      envelope: {
        payload: { kind: "run", event: { kind: "assistant_message_committed", text } },
      },
    })),
  });
  const messages: string[] = [];
  const update = vi.spyOn(client.agent.client, "sessionUpdate").mockImplementation(async (n) => {
    if (n.update.sessionUpdate !== "agent_message_chunk") return;
    messages.push(n.update.content.type === "text" ? n.update.content.text : "");
    entered.resolve();
    await release.promise;
  });
  try {
    const binding = client.agent.loadSession({ sessionId, cwd, mcpServers: [] }).then(
      () => "loaded",
      () => "rejected",
    );
    await entered.promise;
    let settled = false;
    const disposal = client.agent.dispose().then(() => {
      settled = true;
    });
    const secondDisposal = client.agent.dispose();
    await Promise.resolve();
    expect(settled).toBe(false);
    release.resolve();
    await Promise.all([disposal, secondDisposal]);
    expect(await binding).toBe("rejected");
    expect(messages).toEqual(["first"]);
    expect(client.agent.sessions.size).toBe(0);
  } finally {
    release.resolve();
    read.mockRestore();
    list.mockRestore();
    update.mockRestore();
    await client.agent.dispose();
  }
});
