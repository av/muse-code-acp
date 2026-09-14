import { methods } from "@agentclientprotocol/sdk";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { expect, it } from "vitest";
import { connectTestClient, initialized } from "./helpers.js";
import { probeSdkHost } from "../muse-host.js";
import { startLoopbackProvider } from "./loopback-provider.js";

it.each([
  {
    mode: "bypassApprovals",
    outside: false,
    policy: "onRequest",
    sandbox: "enabled",
    succeeds: true,
  },
  {
    mode: "rejectApprovals",
    outside: false,
    policy: "onRequest",
    sandbox: "enabled",
    succeeds: false,
  },
  {
    mode: "bypassApprovals",
    outside: true,
    policy: "onRequest",
    sandbox: "enabled",
    succeeds: false,
  },
  {
    mode: "bypassApprovals",
    outside: true,
    policy: "onRequest",
    sandbox: "disabled",
    succeeds: true,
  },
  {
    mode: "bypassApprovals",
    outside: false,
    policy: "denyUnmatched",
    sandbox: "enabled",
    succeeds: false,
  },
  { mode: "default", outside: false, policy: "allowAll", sandbox: "enabled", succeeds: true },
])(
  "real automatic policy and filesystem effects: %j",
  async ({ mode, outside, sandbox, succeeds, policy }) => {
    mkdirSync("artifacts", { recursive: true });
    const external = mkdtempSync(join(process.cwd(), "artifacts", "safety-outside-"));
    let command = "";
    const provider = await startLoopbackProvider({
      scriptedToolCallWhen: ["unused"],
      scriptedToolCallCommand: "unused",
      holdMs: 20,
      scriptedToolCallForRequest: (r) =>
        JSON.stringify(r).includes("call_1")
          ? undefined
          : { name: "bash", arguments: { command, description: "Isolated safety test" } },
    });
    const cwd = join(provider.root, "workspace");
    mkdirSync(cwd);
    const target = outside ? external : cwd;
    command = `printf one > ${target}/a.txt; ls ${cwd}; printf two > ${target}/b.txt`;
    const client = connectTestClient({
      backend: "sdk",
      env: {
        HOME: provider.home,
        PATH: process.env.PATH,
        XDG_CONFIG_HOME: join(provider.root, "config"),
        XDG_DATA_HOME: join(provider.root, "data"),
        TBH_CREDENTIAL_BACKEND: "file",
        TBH_DISABLE_TELEMETRY: "1",
        MUSE_CODE_ACP_ALLOW_YOLO: "1",
      },
    });
    client.setPermissionResponder(() => {
      throw new Error("Automatic policy must not ask ACP");
    });
    try {
      const ctx = await initialized(client);
      const created = await ctx.request(methods.agent.session.new, { cwd, mcpServers: [] });
      const { sessionId } = created;
      const policies = created.configOptions?.find((o) => o.id === "nativeApprovalPolicy");
      if (policies?.type === "select") {
        expect(policies.options.some((o) => "value" in o && o.value === "allowAll")).toBe(
          probeSdkHost().version !== "1.1.1",
        );
      } else throw Error("Missing native policy choices");
      await ctx.request(methods.agent.session.setMode, { sessionId, modeId: mode });
      const selection = ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "nativeApprovalPolicy",
        value: policy,
      });
      if (policy !== "onRequest" && probeSdkHost().version === "1.1.1") {
        await expect(selection).rejects.toMatchObject({ code: -32602 });
        expect(provider.requests()).toHaveLength(0);
        return;
      }
      await selection;
      const selected = await ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "sandbox",
        value: sandbox,
      });
      expect(selected.configOptions.find((c) => c.id === "mode")?.currentValue).toBe(mode);
      expect(
        await ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text: "Run isolated safety probe" }],
        }),
      ).toEqual({ stopReason: "end_turn" });
      expect(client.permissionRequests).toHaveLength(0);
      expect(existsSync(join(target, "a.txt"))).toBe(succeeds);
      expect(existsSync(join(target, "b.txt"))).toBe(succeeds);
      // Changing posture disposes the retained host while preserving session continuity.
      const prior = client.agent.sessions.get(sessionId)?.sdkHost?.owner;
      await ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "shell",
        value: "disabled",
      });
      expect(prior?.closed).toBe(true);
      expect(
        await ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text: "Return OK" }],
        }),
      ).toEqual({ stopReason: "end_turn" });
    } finally {
      await client.agent.dispose();
      await provider.close();
      await rm(provider.root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  },
  60_000,
);

it.each(["proxy-only", "restricted", "enabled"])(
  "records loopback network effects for %s",
  async (network) => {
    let hits = 0;
    const server = createServer((_req, res) => {
      hits++;
      res.end("network-control");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const command = `curl --noproxy '*' --max-time 2 http://127.0.0.1:${address.port}/`;
    const provider = await startLoopbackProvider({
      scriptedToolCallWhen: ["unused"],
      scriptedToolCallCommand: "unused",
      holdMs: 20,
      scriptedToolCallForRequest: (r) =>
        JSON.stringify(r).includes("call_1")
          ? undefined
          : { name: "bash", arguments: { command, description: "Loopback network probe" } },
    });
    const client = connectTestClient({
      backend: "sdk",
      env: {
        HOME: provider.home,
        PATH: process.env.PATH,
        XDG_CONFIG_HOME: join(provider.root, "config"),
        XDG_DATA_HOME: join(provider.root, "data"),
        TBH_CREDENTIAL_BACKEND: "file",
        TBH_DISABLE_TELEMETRY: "1",
      },
    });
    try {
      const ctx = await initialized(client);
      const { sessionId } = await ctx.request(methods.agent.session.new, {
        cwd: provider.root,
        mcpServers: [],
      });
      await ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "mode",
        value: "bypassApprovals",
      });
      await ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "sandboxNetwork",
        value: network,
      });
      await ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "Run isolated network probe" }],
      });
      expect(provider.scriptedToolCalls()).toBeGreaterThan(0);
      expect(hits).toBe(network === "enabled" ? 1 : 0);
      expect(client.permissionRequests).toHaveLength(0);
    } finally {
      await client.agent.dispose();
      await provider.close();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
      await rm(provider.root, { recursive: true, force: true });
    }
  },
  45_000,
);

it.each(["enabled", "disabled"])(
  "non-shell workspace writes are %s",
  async (value) => {
    const provider = await startLoopbackProvider({
      scriptedToolCallWhen: ["unused"],
      scriptedToolCallCommand: "unused",
      holdMs: 20,
      scriptedToolCallForRequest: (r) =>
        JSON.stringify(r).includes("call_1")
          ? undefined
          : { name: "write_file", arguments: { path: "controlled.txt", content: "explicit test" } },
    });
    const client = connectTestClient({
      backend: "sdk",
      env: {
        HOME: provider.home,
        PATH: process.env.PATH,
        XDG_CONFIG_HOME: join(provider.root, "config"),
        XDG_DATA_HOME: join(provider.root, "data"),
        TBH_CREDENTIAL_BACKEND: "file",
        TBH_DISABLE_TELEMETRY: "1",
      },
    });
    try {
      const ctx = await initialized(client);
      const { sessionId } = await ctx.request(methods.agent.session.new, {
        cwd: provider.root,
        mcpServers: [],
      });
      await ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "mode",
        value: "bypassApprovals",
      });
      await ctx.request(methods.agent.session.setConfigOption, {
        sessionId,
        configId: "workspaceWrite",
        value,
      });
      await ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "Run isolated write probe" }],
      });
      expect(existsSync(join(provider.root, "controlled.txt"))).toBe(value === "enabled");
    } finally {
      await client.agent.dispose();
      await provider.close();
      await rm(provider.root, { recursive: true, force: true });
    }
  },
  45_000,
);
