import { describe, expect, it } from "vitest";
import { spawnMspConnection } from "@muse-code/sdk";
import { methods } from "@agentclientprotocol/sdk";
import { realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { museCliPath } from "../muse-cli.js";
import { startLoopbackProvider } from "./loopback-provider.js";
import { connectTestClient, initialized, museAvailable, silentLogger } from "./helpers.js";
const available = museAvailable();
if (process.env.MUSE_CODE_ACP_REQUIRE_MUSE === "1" && !available)
    throw new Error("Muse required for session discovery acceptance");
describe.skipIf(!available)("real Muse public session discovery", () => {
    it("paginates source/fork sessions without leases and preserves full load history", async () => {
        const provider = await startLoopbackProvider({
            scriptedToolCallWhen: ["never-script"],
            scriptedToolCallCommand: "",
            holdMs: 10,
        });
        const cwd = realpathSync(provider.root);
        const env = {
            PATH: process.env.PATH,
            HOME: provider.home,
            XDG_CONFIG_HOME: join(provider.root, "config"),
            XDG_DATA_HOME: join(provider.root, "data"),
            TBH_CREDENTIAL_BACKEND: "file",
            TBH_DISABLE_TELEMETRY: "1",
        };
        const host = spawnMspConnection({
            command: museCliPath(),
            args: ["serve"],
            cwd,
            env: env,
            shutdownTimeoutMs: 1000,
        });
        let extraHost;
        const client = connectTestClient({ backend: "sdk", env }, silentLogger());
        try {
            const { connection } = await host.initialize({
                clientInfo: { name: "discovery_test", version: "1" },
            });
            const started = await connection.command("session/start", {
                workspaceRoot: cwd,
                modelId: "fake-model",
            });
            const source = started.session.sessionId;
            const finished = Promise.withResolvers();
            connection.onNotification((n) => {
                if (n.method === "turn/completed")
                    finished.resolve();
            });
            await connection.command("turn/start", {
                sessionId: source,
                input: [{ type: "text", text: "discovery original marker" }],
            });
            await finished.promise;
            const fork = await connection.command("session/fork", { sessionId: source });
            const forkId = fork.session.sessionId;
            for (let i = 0; i < 25; i++)
                await connection.command("session/start", { workspaceRoot: cwd, modelId: "fake-model" });
            extraHost = spawnMspConnection({
                command: museCliPath(),
                args: ["serve"],
                cwd,
                env: env,
                shutdownTimeoutMs: 1000,
            });
            const extra = await extraHost.initialize({
                clientInfo: { name: "discovery_fixture", version: "1" },
            });
            for (let i = 0; i < 25; i++)
                await extra.connection.command("session/start", {
                    workspaceRoot: cwd,
                    modelId: "fake-model",
                });
            await expect
                .poll(async () => {
                const r = await connection.request("session/list", { workspaceRoot: cwd, limit: 200 });
                return r.sessions.length;
            }, { timeout: 10_000 })
                .toBe(52);
            const ctx = await initialized(client, { _meta: { "muse/fork": 1 } });
            const first = await ctx.request(methods.agent.session.list, { cwd });
            expect(first.sessions).toHaveLength(50);
            expect(first.nextCursor).toBeTruthy();
            const second = await ctx.request(methods.agent.session.list, {
                cwd,
                cursor: first.nextCursor,
            });
            expect(second.sessions).toHaveLength(2);
            expect(second.nextCursor).toBeUndefined();
            const all = [...first.sessions, ...second.sessions];
            expect(new Set(all.map((s) => s.sessionId)).size).toBe(52);
            expect(all.find((s) => s.sessionId === source)?.title).toBe("discovery original marker");
            expect(all.find((s) => s.sessionId === forkId)?._meta).toMatchObject({
                "muse/fork": { sourceSessionId: source },
            });
            const before = provider.requests().length;
            await host.close();
            await ctx.request(methods.agent.session.load, { sessionId: source, cwd, mcpServers: [] });
            expect(client.updates.filter((n) => n.update.sessionUpdate === "user_message_chunk")).toHaveLength(1);
            expect(client.updates.some((n) => n.update.sessionUpdate === "session_info_update" &&
                n.update.title === "discovery original marker")).toBe(true);
            expect(provider.requests()).toHaveLength(before);
        }
        finally {
            await client.agent.dispose();
            await host.close();
            await extraHost?.close();
            await provider.close();
            rmSync(provider.root, { recursive: true, force: true });
        }
    }, 60_000);
});
