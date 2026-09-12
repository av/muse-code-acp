import { describe, it, expect, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as store from "../session-store.js";
import * as history from "../session-export.js";
import { connectTestClient, fakeMuseBinary, newTestSession } from "./helpers.js";

describe.each(["new", "load", "resume"] as const)("%s workspace validation", (method) => {
  it("validates directories, pins symlinks and leaves state unchanged after rejection", async () => {
    const root = mkdtempSync(join(tmpdir(), "muse-workspace-"));
    const actual = join(root, "actual");
    const other = join(root, "other");
    const link = join(root, "link");
    mkdirSync(actual);
    mkdirSync(other);
    symlinkSync(actual, link, "junction");
    const file = join(root, "file");
    writeFileSync(file, "data");
    const capture = join(root, "capture.json");
    const client = connectTestClient({
      backend: "exec",
      museBinary: fakeMuseBinary(),
      env: { ...process.env, FAKE_MUSE_MODE: "exit0", FAKE_MUSE_ARGV_CAPTURE: capture },
    });
    const originalServers = [{ name: "original", command: "unused", args: [], env: [] }];
    const created = await client.agent.newSession({ cwd: actual, mcpServers: originalServers });
    const sessionId = created.sessionId;
    const list = vi
      .spyOn(store, "listStoredSessions")
      .mockReturnValue([{ sessionId, cwd: actual, title: "", updatedAt: "", logPath: "unused" }]);
    const read = vi
      .spyOn(history, "runMuseExport")
      .mockResolvedValue({ export_schema_version: 1, events: [] });
    const bind = (cwd: string) =>
      method === "new"
        ? client.agent.newSession({ cwd, mcpServers: [] })
        : method === "load"
          ? client.agent.loadSession({ sessionId, cwd, mcpServers: [] })
          : client.agent.resumeSession({ sessionId, cwd, mcpServers: [] });
    try {
      const previous = client.agent.sessions.get(sessionId);
      for (const invalid of [
        "relative",
        file,
        join(root, "missing"),
        ...(method === "new" ? [] : [other]),
      ]) {
        await expect(bind(invalid)).rejects.toMatchObject({ code: -32602 });
        expect(client.agent.sessions.size).toBe(1);
        expect(client.agent.sessions.get(sessionId)).toBe(previous);
        expect(previous?.mcpServers).toEqual(originalServers);
      }
      const result = await bind(link);
      const boundId =
        "sessionId" in result && typeof result.sessionId === "string"
          ? result.sessionId
          : sessionId;
      expect(client.agent.sessions.get(boundId)?.cwd).toBe(realpathSync(actual));
      unlinkSync(link);
      symlinkSync(other, link, "junction");
      await client.agent.prompt({
        sessionId: boundId,
        prompt: [{ type: "text", text: "stay in original workspace" }],
      });
      expect(JSON.parse(readFileSync(capture, "utf8")).cwd).toBe(realpathSync(actual));
    } finally {
      await client.agent.dispose();
      list.mockRestore();
      read.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

it("pins load's workspace before the asynchronous export", async () => {
  const client = connectTestClient({ backend: "exec", museBinary: fakeMuseBinary() });
  const { sessionId, cwd } = await newTestSession(client);
  const root = mkdtempSync(join(tmpdir(), "muse-load-link-"));
  const link = join(root, "link");
  symlinkSync(cwd, link, "junction");
  const list = vi
    .spyOn(store, "listStoredSessions")
    .mockReturnValue([{ sessionId, cwd, title: "", updatedAt: "", logPath: "unused" }]);
  const gate = Promise.withResolvers<Awaited<ReturnType<typeof history.runMuseExport>>>();
  const read = vi.spyOn(history, "runMuseExport").mockReturnValue(gate.promise);
  try {
    const loading = client.agent.loadSession({ sessionId, cwd: link, mcpServers: [] });
    unlinkSync(link);
    symlinkSync(root, link, "junction");
    gate.resolve({ export_schema_version: 1, events: [] });
    await loading;
    expect(client.agent.sessions.get(sessionId)?.cwd).toBe(realpathSync(cwd));
  } finally {
    read.mockRestore();
    list.mockRestore();
    await client.agent.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
