import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ command: vi.fn(), close: vi.fn() }));
vi.mock("@muse-code/sdk", async (original) => ({
  ...(await original<typeof import("@muse-code/sdk")>()),
  spawnMspConnection: () => ({
    initialize: async () => ({ connection: { command: mocks.command } }),
    close: mocks.close,
  }),
}));
import { forkMuseSession } from "../session-fork.js";
const cwd = mkdtempSync(join(tmpdir(), "fork-host-"));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));
const options = {
  sessionId: "source",
  cwd,
  env: {},
  museBinary: "/unused",
  checkHost: false,
  logger: { log() {}, error() {} },
};
let source: Record<string, unknown>;
let fork: Record<string, unknown>;
beforeEach(() => {
  source = {
    sessionId: "source",
    workspaceRoot: cwd,
    modelId: "selected",
    activeTurnId: null,
    status: "idle",
  };
  fork = {
    ...source,
    sessionId: "branch",
    forkedFrom: { sessionId: "source", cutCursor: "observed", cutExplicit: false },
  };
  mocks.command.mockReset().mockImplementation(async (method) => ({
    session: method === "session/read" ? source : fork,
    pendingRequests: [],
  }));
  mocks.close.mockReset().mockResolvedValue(undefined);
});
it("uses only public read/fork methods and releases the control host", async () => {
  await expect(forkMuseSession(options)).resolves.toMatchObject({
    session: { sessionId: "branch" },
  });
  expect(mocks.command.mock.calls.map(([method]) => method)).toEqual([
    "session/read",
    "session/fork",
  ]);
  expect(mocks.close).toHaveBeenCalledOnce();
});
it.each(["active", "unknown-active", "workspace"])(
  "rejects %s source before a native fork",
  async (kind) => {
    if (kind === "active") source.activeTurnId = "live-turn";
    if (kind === "unknown-active") delete source.activeTurnId;
    if (kind === "workspace") source.workspaceRoot = tmpdir();
    await expect(forkMuseSession(options)).rejects.toThrow();
    expect(mocks.command).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledOnce();
  },
);
it.each(["identity", "model", "provenance", "boundary"])(
  "rejects inconsistent fork %s",
  async (kind) => {
    if (kind === "identity") fork.sessionId = "source";
    if (kind === "model") fork.modelId = "different";
    if (kind === "provenance") fork.forkedFrom = null;
    if (kind === "boundary")
      fork.forkedFrom = { sessionId: "source", cutCursor: "observed", cutExplicit: true };
    await expect(forkMuseSession(options)).rejects.toThrow();
    expect(mocks.close).toHaveBeenCalledOnce();
  },
);
