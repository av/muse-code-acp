import { expect, it } from "vitest";
import { methods } from "@agentclientprotocol/sdk";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import { connectTestClient, initialized } from "./helpers.js";
import { startLoopbackProvider } from "./loopback-provider.js";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=";
const env = (p) => ({
    PATH: process.env.PATH,
    MUSE_CODE_EXECUTABLE: process.env.MUSE_CODE_EXECUTABLE,
    HOME: p.home,
    XDG_CONFIG_HOME: join(p.root, "config"),
    XDG_DATA_HOME: join(p.root, "data"),
    META_API_KEY: "exported-fixture-key",
    TBH_CREDENTIAL_BACKEND: "file",
    TBH_DISABLE_TELEMETRY: "1",
});
it("delivers attributed embedded bytes, preserves user titles across restart, and dispatches local commands", async () => {
    const p = await startLoopbackProvider({
        scriptedToolCallWhen: ["search-presentation-marker"],
        scriptedToolCallCommand: "",
        scriptedToolCall: {
            name: "search",
            arguments: { pattern: "needle-marker", paths: ["sample.txt"], mode: "literal" },
        },
        holdMs: 20,
    });
    await writeFile(join(p.root, "sample.txt"), "needle-marker\n");
    const first = connectTestClient({ backend: "sdk", env: env(p) });
    let second;
    try {
        const c = await initialized(first);
        const { sessionId } = await c.request(methods.agent.session.new, {
            cwd: p.root,
            mcpServers: [],
        });
        const local = (text) => c.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: "text", text }] });
        await local("/rename User title 中文");
        await local("/skills");
        expect(p.requests()).toHaveLength(0);
        await expect(c.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [
                {
                    type: "resource",
                    resource: { uri: "file:///bad", mimeType: "image/png", blob: "!bad!" },
                },
            ],
        })).rejects.toMatchObject({ code: -32602 });
        expect(p.requests()).toHaveLength(0);
        await c.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [
                { type: "text", text: "embedded-start-marker" },
                {
                    type: "resource",
                    resource: { uri: "file:///tiny.png", mimeType: "image/png", blob: png },
                },
                {
                    type: "resource",
                    resource: { uri: "file:///raw.bin", mimeType: "application/octet-stream", blob: "AP8B" },
                },
                { type: "text", text: "embedded-end-marker" },
            ],
        });
        const requests = JSON.stringify(p.requests());
        expect(requests).toContain(png);
        expect(requests).toContain("input_image");
        expect(requests).toContain(`data:image/png;base64,${png}`);
        expect(requests).toContain("tiny.png");
        expect(requests).toContain("raw.bin");
        expect(requests).toContain("AP8B");
        expect(requests.indexOf("embedded-start-marker")).toBeLessThan(requests.indexOf("tiny.png"));
        expect(requests.indexOf("tiny.png")).toBeLessThan(requests.indexOf("raw.bin"));
        await first.agent.dispose();
        second = connectTestClient({ backend: "sdk", env: env(p) });
        const d = await initialized(second);
        await d.request(methods.agent.session.load, { sessionId, cwd: p.root, mcpServers: [] });
        const list = await d.request(methods.agent.session.list, { cwd: p.root });
        expect(list.sessions.find((s) => s.sessionId === sessionId)?.title).toBe("User title 中文");
        await d.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "search-presentation-marker" }],
        });
        expect(second.updates.some((n) => (n.update.sessionUpdate === "tool_call" ||
            n.update.sessionUpdate === "tool_call_update") &&
            n.update.kind === "search" &&
            n.update.title === "search: needle-marker")).toBe(true);
        expect(second.updates
            .filter((n) => n.update.sessionUpdate === "session_info_update" && n.update.title)
            .every((n) => n.update.sessionUpdate === "session_info_update" &&
            n.update.title === "User title 中文")).toBe(true);
        const before = p.requests().length;
        await d.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "/logout" }],
        });
        expect(p.requests()).toHaveLength(before);
        expect(second.agent.sessions.has(sessionId)).toBe(false);
        expect(JSON.stringify(second.updates.at(-1))).toContain("Credentials remain configured");
    }
    finally {
        await first.agent.dispose();
        await second?.agent.dispose();
        await p.close();
        await rm(p.root, { recursive: true, force: true });
    }
}, 60000);
it("injects compatible steering into a real active turn and rejects idle fallback", async () => {
    const p = await startLoopbackProvider({
        scriptedToolCallWhen: ["compat-steer-start"],
        scriptedToolCallCommand: "printf compat-steer-probe",
        holdMs: 800,
    });
    const client = connectTestClient({ backend: "sdk", env: env(p) });
    try {
        client.setPermissionResponder((request) => ({
            outcome: {
                outcome: "selected",
                optionId: request.options.find((o) => o.kind === "allow_once").optionId,
            },
        }));
        const c = await initialized(client, { _meta: { steering: { supported: true } } });
        const { sessionId } = await c.request(methods.agent.session.new, {
            cwd: p.root,
            mcpServers: [],
        });
        const prompt = c.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "compat-steer-start" }],
        });
        await expect
            .poll(() => p.requests().some((r) => JSON.stringify(r.input).includes("compat-steer-start")), { timeout: 10000 })
            .toBe(true);
        await expect
            .poll(() => client.updates.some((n) => typeof n.update._meta?.["muse/activeTurnId"] === "string"), { timeout: 10000 })
            .toBe(true);
        expect(await c.request("_session/steering", {
            sessionId,
            prompt: [{ type: "text", text: "compat-correction-marker" }],
        })).toEqual({ outcome: "injected" });
        await prompt;
        expect(JSON.stringify(p.requests())).toContain("compat-correction-marker");
        const before = p.requests().length;
        await expect(c.request("_session/steering", { sessionId, prompt: [{ type: "text", text: "idle" }] })).rejects.toMatchObject({ code: -32600 });
        expect(p.requests()).toHaveLength(before);
    }
    finally {
        await client.agent.dispose();
        await p.close();
        await rm(p.root, { recursive: true, force: true });
    }
}, 30000);
