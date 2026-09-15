import { expect, it } from "vitest";
import { methods } from "@agentclientprotocol/sdk";
import { join } from "node:path";
import {
  appendFileSync,
  chmodSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { connectTestClient, initialized, silentLogger } from "./helpers.js";
import { startLoopbackProvider } from "./loopback-provider.js";
import { museCliPath } from "../muse-cli.js";
import { probeSdkHost } from "../muse-host.js";
import { spawnMuseSdkTurn } from "../muse-sdk.js";
const record = (value: unknown) => {
  if (process.env.MUSE_CODE_ACP_STARTUP_EVIDENCE)
    appendFileSync(process.env.MUSE_CODE_ACP_STARTUP_EVIDENCE, JSON.stringify(value) + "\n");
};
const shellQuote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
const alive = (pid: number) => {
  for (const target of process.platform === "win32" ? [pid] : [pid, -pid]) {
    try {
      process.kill(target, 0);
      return true;
    } catch {
      /* No process with this owned PID/group remains. */
    }
  }
  return false;
};
async function fixture(delay: number) {
  const p = await startLoopbackProvider({
    scriptedToolCallWhen: ["__never__"],
    scriptedToolCallCommand: "",
    holdMs: 10,
  });
  const binary = museCliPath();
  const wrapper = join(p.root, "muse-wrapper");
  const pids = join(p.root, "pids");
  writeFileSync(
    wrapper,
    `#!/bin/sh\nif [ "$#" -eq 1 ] && [ "$1" = serve ]; then\n  printf '%s\\n' "$$" >> ${shellQuote(pids)}\n  sleep ${delay}\nfi\nexec ${shellQuote(binary)} "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  const env = {
    PATH: process.env.PATH,
    MUSE_CODE_EXECUTABLE: wrapper,
    HOME: p.home,
    XDG_CONFIG_HOME: join(p.root, "config"),
    XDG_DATA_HOME: join(p.root, "data"),
    TBH_CREDENTIAL_BACKEND: "file",
    TBH_DISABLE_TELEMETRY: "1",
  };
  return {
    p,
    wrapper,
    env,
    pids: () => (existsSync(pids) ? readFileSync(pids, "utf8").trim().split("\n").map(Number) : []),
    cleanup: async () => {
      await expect
        .poll(
          () =>
            existsSync(pids)
              ? readFileSync(pids, "utf8").trim().split("\n").map(Number).some(alive)
              : false,
          { timeout: 10000 },
        )
        .toBe(false);
      await p.close();
      rmSync(p.root, { recursive: true, force: true });
    },
    version: probeSdkHost(process.env, binary).version,
  };
}
it("allows a real delayed host beyond 20 seconds to complete an ACP turn", async () => {
  const f = await fixture(21);
  const logs: string[] = [];
  const client = connectTestClient(
    { backend: "sdk", env: f.env },
    { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)) },
  );
  try {
    const c = await initialized(client);
    const { sessionId } = await c.request(methods.agent.session.new, {
      cwd: f.p.root,
      mcpServers: [],
    });
    const start = Date.now();
    expect(
      await c.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "slow startup control" }],
      }),
    ).toMatchObject({ stopReason: "end_turn" });
    expect(Date.now() - start).toBeGreaterThan(20000);
    expect(f.p.requests().length).toBeGreaterThan(0);
    record({
      probe: "delayed-start",
      version: f.version,
      elapsedMs: Date.now() - start,
      phases: logs.filter((s) => s.includes("muse-sdk phase")),
    });
  } finally {
    await client.agent.dispose();
    await f.cleanup();
  }
}, 90000);
it("reaps real delayed hosts after timeout or caller cancellation without a provider turn", async () => {
  for (const cancel of [false, true]) {
    const f = await fixture(3);
    const handle = spawnMuseSdkTurn({
      sessionId: randomUUID(),
      cwd: f.p.root,
      env: { ...f.env, MUSE_CODE_ACP_STARTUP_TIMEOUT_MS: cancel ? "120000" : "500" },
      museBinary: f.wrapper,
      checkHost: false,
      logger: silentLogger(),
      input: [{ type: "text", text: "must never submit" }],
      model: "fake-model",
      reasoningEffort: "medium",
      readOnly: false,
      acpClient: {
        sessionUpdate: async () => {},
        requestPermission: async () => {
          throw new Error("unexpected");
        },
        createElicitation: async () => {
          throw new Error("unexpected");
        },
      },
    });
    try {
      if (cancel) {
        await expect.poll(() => f.pids().length).toBeGreaterThan(0);
        handle.kill();
        await expect(handle.done).resolves.toEqual({ stopReason: "cancelled" });
      } else
        await expect(handle.done).rejects.toMatchObject({
          data: { failure: { kind: "deadlineExceeded", execution: "notSubmitted" } },
        });
      expect(f.p.requests()).toHaveLength(0);
    } finally {
      handle.kill();
      await handle.done.catch(() => {});
      await f.cleanup();
    }
  }
}, 30000);
it("completes 16 concurrent independent ACP clients with isolated owned hosts", async () => {
  const f = await fixture(0);
  const logs: string[][] = Array.from({ length: 16 }, () => []);
  const clients = logs.map((log) =>
    connectTestClient(
      { backend: "sdk", env: f.env },
      { log: (s) => log.push(String(s)), error: (s) => log.push(String(s)) },
    ),
  );
  const start = Date.now();
  try {
    const outcomes = await Promise.allSettled(
      clients.map(async (client, i) => {
        const c = await initialized(client);
        const cwd = join(f.p.root, `workspace-${i}`);
        mkdirSync(cwd);
        const { sessionId } = await c.request(methods.agent.session.new, { cwd, mcpServers: [] });
        const began = Date.now();
        const result = await c.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text: `concurrent-client-${i}` }],
        });
        return { sessionId, result, elapsedMs: Date.now() - began };
      }),
    );
    record({
      probe: "concurrent-start",
      version: f.version,
      concurrency: 16,
      elapsedMs: Date.now() - start,
      outcomes,
      phases: logs.map((log) => log.filter((s) => s.includes("muse-sdk phase"))),
    });
    expect(
      outcomes.every((o) => o.status === "fulfilled" && o.value.result.stopReason === "end_turn"),
    ).toBe(true);
    const ids = outcomes.flatMap((o) => (o.status === "fulfilled" ? [o.value.sessionId] : []));
    expect(new Set(ids).size).toBe(16);
    for (let i = 0; i < 16; i++)
      expect(
        f.p.requests().some((r) => JSON.stringify(r.input).includes(`concurrent-client-${i}`)),
      ).toBe(true);
  } finally {
    await Promise.allSettled(clients.map((c) => c.agent.dispose()));
    await f.cleanup();
  }
}, 180000);
