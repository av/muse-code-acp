import { createServer } from "node:http";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { methods } from "@agentclientprotocol/sdk";
import { startLoopbackProvider } from "./loopback-provider.js";
import { connectTestClient, initialized, museAvailable, capturingLogger } from "./helpers.js";
const available = museAvailable();
if (process.env.MUSE_CODE_ACP_REQUIRE_MUSE === "1" && !available)
    throw new Error("Real Muse required for HTTP MCP acceptance");
async function mcpFixture(mode = "ok") {
    const calls = [];
    const server = createServer((req, res) => {
        let text = "";
        req.on("data", (chunk) => (text += chunk));
        req.on("end", () => {
            if (req.method !== "POST") {
                res.writeHead(405).end();
                return;
            }
            const message = JSON.parse(text);
            calls.push({ method: message.method, authorization: req.headers.authorization });
            if (mode === "unauthorized") {
                res.writeHead(401).end();
                return;
            }
            if (mode === "malformed") {
                res.writeHead(200, { "content-type": "application/json" }).end("invalid-json");
                return;
            }
            if (message.id === undefined) {
                res.writeHead(202).end();
                return;
            }
            const result = message.method === "initialize"
                ? {
                    protocolVersion: "2025-03-26",
                    capabilities: { tools: {} },
                    serverInfo: { name: "probe", version: "1" },
                }
                : message.method === "tools/list"
                    ? {
                        tools: [
                            {
                                name: "ping",
                                description: "Return a local marker",
                                inputSchema: { type: "object", properties: {} },
                                annotations: { readOnlyHint: true },
                            },
                        ],
                    }
                    : { content: [{ type: "text", text: "m16-pong" }] };
            res
                .writeHead(200, { "content-type": "application/json" })
                .end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
        });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string")
        throw new Error("MCP fixture did not bind");
    return {
        url: `http://127.0.0.1:${address.port}/mcp`,
        calls,
        async close() {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(() => resolve()));
        },
    };
}
describe.skipIf(!available)("real Muse HTTP MCP", () => {
    it.each(["ok", "unauthorized", "malformed", "unreachable"])("preserves truthful diagnostics for %s endpoints", async (mode) => {
        const endpoint = await mcpFixture(mode === "unreachable" ? "ok" : mode);
        if (mode === "unreachable")
            await endpoint.close();
        try {
            const provider = await startLoopbackProvider({
                scriptedToolCallWhen: mode === "ok" ? ['"name":"ping"', "m16-user-request"] : ["never-script"],
                scriptedToolCallCommand: "",
                scriptedToolCall: { name: "mcp__remote__ping", arguments: {} },
                holdMs: 30,
            });
            const lines = [];
            const client = connectTestClient({
                backend: "sdk",
                env: {
                    PATH: process.env.PATH,
                    HOME: provider.home,
                    XDG_CONFIG_HOME: join(provider.root, "config"),
                    XDG_DATA_HOME: join(provider.root, "data"),
                    TBH_CREDENTIAL_BACKEND: "file",
                    TBH_DISABLE_TELEMETRY: "1",
                },
            }, capturingLogger(lines));
            client.setPermissionResponder((params) => {
                const allow = params.options.find((option) => option.kind === "allow_once");
                return allow
                    ? { outcome: { outcome: "selected", optionId: allow.optionId } }
                    : { outcome: { outcome: "cancelled" } };
            });
            try {
                const ctx = await initialized(client);
                const { sessionId } = await ctx.request(methods.agent.session.new, {
                    cwd: provider.root,
                    mcpServers: [
                        {
                            type: "http",
                            name: "remote",
                            url: endpoint.url,
                            headers: [{ name: "Authorization", value: "Bearer private-m16-header" }],
                        },
                    ],
                });
                const prompt = ctx.request(methods.agent.session.prompt, {
                    sessionId,
                    prompt: [{ type: "text", text: "m16-user-request" }],
                });
                if (mode === "ok")
                    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
                else
                    await expect(prompt).rejects.toMatchObject({ code: -32603 });
                if (mode === "ok") {
                    expect(endpoint.calls.some((call) => call.method === "tools/call")).toBe(true);
                    expect(provider
                        .requests()
                        .some((request) => JSON.stringify(request.input).includes("m16-pong"))).toBe(true);
                }
                else
                    expect(endpoint.calls.some((call) => call.method === "tools/call")).toBe(false);
                if (mode !== "unreachable") {
                    expect(endpoint.calls.length).toBeGreaterThan(0);
                    expect(endpoint.calls.every((call) => call.authorization === "Bearer private-m16-header")).toBe(true);
                }
                if (mode === "ok") {
                    const firstOwner = client.agent.sessions.get(sessionId).sdkHost;
                    const peer = await ctx.request(methods.agent.session.new, {
                        cwd: provider.root,
                        mcpServers: [
                            {
                                type: "http",
                                name: "remote",
                                url: endpoint.url,
                                headers: [{ name: "Authorization", value: "Bearer private-m16-header-peer" }],
                            },
                        ],
                    });
                    const beforePeer = endpoint.calls.length;
                    await ctx.request(methods.agent.session.prompt, {
                        sessionId: peer.sessionId,
                        prompt: [{ type: "text", text: "peer request" }],
                    });
                    expect(endpoint.calls.slice(beforePeer).length).toBeGreaterThan(0);
                    expect(endpoint.calls
                        .slice(beforePeer)
                        .every((call) => call.authorization === "Bearer private-m16-header-peer")).toBe(true);
                    expect(firstOwner.owner.closed).toBe(false);
                    await ctx.request(methods.agent.session.resume, {
                        sessionId,
                        cwd: provider.root,
                        mcpServers: [
                            {
                                type: "http",
                                name: "remote",
                                url: endpoint.url,
                                headers: [{ name: "Authorization", value: "Bearer private-m16-header-new" }],
                            },
                        ],
                    });
                    const beforeReplacement = endpoint.calls.length;
                    await ctx.request(methods.agent.session.prompt, {
                        sessionId,
                        prompt: [{ type: "text", text: "replacement request" }],
                    });
                    expect(endpoint.calls.slice(beforeReplacement).length).toBeGreaterThan(0);
                    expect(endpoint.calls
                        .slice(beforeReplacement)
                        .every((call) => call.authorization === "Bearer private-m16-header-new")).toBe(true);
                    expect(firstOwner.owner.closed).toBe(true);
                    expect(existsSync(firstOwner.overlay.configHome)).toBe(false);
                    expect(lines.filter((line) => line.startsWith("muse-sdk spawn:")).length).toBe(3);
                }
                const before = provider.requests().length;
                await ctx.request(methods.agent.session.prompt, {
                    sessionId,
                    prompt: [{ type: "text", text: "/mcp" }],
                });
                expect(provider.requests()).toHaveLength(before);
                const status = JSON.stringify(client.updates.at(-1));
                expect(status).toContain("connection unknown");
                const failure = {
                    unauthorized: "authentication rejected",
                    malformed: "invalid MCP response",
                    unreachable: "server unreachable or process unavailable",
                };
                if (mode !== "ok")
                    expect(status).toContain(failure[mode]);
                else
                    expect(status).not.toContain("Last execution observed");
                expect(status).not.toContain("private-m16-header");
                expect(status).not.toContain(endpoint.url);
                expect(lines.join("\n")).not.toContain("private-m16-header");
            }
            finally {
                await client.agent.dispose();
                await provider.close();
                rmSync(provider.root, { recursive: true, force: true });
            }
        }
        finally {
            if (mode !== "unreachable")
                await endpoint.close();
        }
    }, 30_000);
});
