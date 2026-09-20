import { probeSdkHost } from "../muse-host.js";
import { expect, it } from "vitest";
import { methods, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { connectTestClient, initialized } from "./helpers.js";
import { startLoopbackProvider } from "./loopback-provider.js";
import { OUTPUT_EXTENSION, OUTPUT_METHOD } from "../stored-output.js";
const env = (p) => ({
    PATH: process.env.PATH,
    MUSE_CODE_EXECUTABLE: process.env.MUSE_CODE_EXECUTABLE,
    HOME: p.home,
    XDG_CONFIG_HOME: join(p.root, "config"),
    XDG_DATA_HOME: join(p.root, "data"),
    TBH_CREDENTIAL_BACKEND: "file",
    TBH_DISABLE_TELEMETRY: "1",
});
for (const negotiated of [false, true])
    it(`reads exact stored bytes across restart without provider replay (negotiated=${negotiated})`, async () => {
        const p = await startLoopbackProvider({
            scriptedToolCallWhen: ["stored-output-marker"],
            scriptedToolCallCommand: "",
            scriptedToolCall: {
                name: "bash",
                arguments: {
                    command: "yes output-marker | head -c 300000",
                    description: "Generate stored output",
                    yield_time_ms: 1000,
                },
            },
            holdMs: 20,
        });
        const client = connectTestClient({ backend: "sdk", env: env(p) });
        let restored;
        client.setPermissionResponder((r) => ({
            outcome: {
                outcome: "selected",
                optionId: r.options.find((o) => o.kind === "allow_once").optionId,
            },
        }));
        try {
            const c = await client.connect();
            const init = await c.request(methods.agent.initialize, {
                protocolVersion: PROTOCOL_VERSION,
                clientCapabilities: negotiated ? { _meta: { [OUTPUT_EXTENSION]: 1 } } : {},
            });
            const supported = probeSdkHost(env(p)).version === "1.2.1";
            expect(!!init._meta?.[OUTPUT_EXTENSION]).toBe(negotiated && supported);
            const { sessionId } = await c.request(methods.agent.session.new, {
                cwd: p.root,
                mcpServers: [],
            });
            await c.request(methods.agent.session.prompt, {
                sessionId,
                prompt: [{ type: "text", text: "stored-output-marker" }],
            });
            const refs = () => client.updates.flatMap((n) => n.update._meta?.[OUTPUT_EXTENSION]
                ? [
                    n.update._meta[OUTPUT_EXTENSION],
                ]
                : []);
            const cards = client.updates.filter((n) => ["tool_call", "tool_call_update"].includes(n.update.sessionUpdate));
            expect(JSON.stringify(cards)).toContain("output-marker");
            let before = p.requests().length;
            // Only the verified host supplies a reference. Baseline and 1.1.1 still expose useful text.
            if (negotiated && supported)
                expect(refs().length).toBeGreaterThan(0);
            if (!negotiated || !refs().length) {
                expect(refs()).toHaveLength(0);
                await expect(c.request(OUTPUT_METHOD, { sessionId, itemId: "missing", outputRef: "missing" })).rejects.toMatchObject({ code: -32600 });
                expect(p.requests()).toHaveLength(before);
                return;
            }
            const ref = refs().at(-1);
            expect(ref.byteLen).toBe(300000);
            const params = {
                sessionId,
                itemId: ref.itemId,
                outputRef: ref.outputRef,
                offsetBytes: 77,
                lengthBytes: 100,
            };
            const expected = Buffer.from("output-marker\n".repeat(30000)).subarray(77, 177);
            const page = (await c.request(OUTPUT_METHOD, params));
            expect(page).toMatchObject({
                sessionId,
                itemId: ref.itemId,
                outputRef: ref.outputRef,
                offsetBytes: 77,
                encoding: "base64",
                byteLen: 100,
                eof: false,
                mediaType: "application/octet-stream",
            });
            expect(Buffer.from(page.content, "base64")).toEqual(expected);
            expect(await c.request(OUTPUT_METHOD, params)).toEqual(page);
            const tail = (await c.request(OUTPUT_METHOD, {
                ...params,
                offsetBytes: 299990,
            }));
            expect(tail.byteLen).toBe(10);
            expect(tail.eof).toBe(true);
            expect(Buffer.from(tail.content, "base64")).toEqual(Buffer.from("output-marker\n".repeat(30000)).subarray(299990, 300000));
            for (const wrong of [
                { outputRef: "tool-output://arbitrary" },
                { itemId: "missing" },
                { offsetBytes: -1 },
                { offsetBytes: 300001 },
                { lengthBytes: 1048577 },
            ])
                await expect(c.request(OUTPUT_METHOD, { ...params, ...wrong })).rejects.toMatchObject({
                    code: -32602,
                });
            const other = await c.request(methods.agent.session.new, { cwd: p.root, mcpServers: [] });
            await expect(c.request(OUTPUT_METHOD, { ...params, sessionId: other.sessionId })).rejects.toMatchObject({ code: -32600 });
            expect(p.requests()).toHaveLength(before);
            await c.request(methods.agent.session.prompt, {
                sessionId: other.sessionId,
                prompt: [{ type: "text", text: "independent session" }],
            });
            before = p.requests().length;
            await expect(c.request(OUTPUT_METHOD, { ...params, sessionId: other.sessionId })).rejects.toMatchObject({ code: -32602 });
            expect(p.requests()).toHaveLength(before);
            await client.agent.dispose();
            restored = connectTestClient({ backend: "sdk", env: env(p) });
            const c2 = await initialized(restored, { _meta: { [OUTPUT_EXTENSION]: 1 } });
            await c2.request(methods.agent.session.load, { sessionId, cwd: p.root, mcpServers: [] });
            expect(restored.updates.some((n) => n.update._meta?.[OUTPUT_EXTENSION]?.outputRef ===
                ref.outputRef)).toBe(true);
            expect(await c2.request(OUTPUT_METHOD, params)).toEqual(page);
            await c2.request(methods.agent.session.close, { sessionId });
            await expect(c2.request(OUTPUT_METHOD, params)).rejects.toMatchObject({ code: -32602 });
            expect(p.requests()).toHaveLength(before);
        }
        finally {
            await client.agent.dispose();
            await restored?.agent.dispose();
            await p.close();
            await rm(p.root, { recursive: true, force: true });
        }
    }, 60000);
