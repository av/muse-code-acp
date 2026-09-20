import { afterEach, describe, expect, it } from "vitest";
import { methods } from "@agentclientprotocol/sdk";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { availableModes } from "../modes.js";
import { readSessionPreferences } from "../session-preferences.js";
import { connectTestClient, fakeMuseBinary, initialized } from "./helpers.js";
const roots = [];
afterEach(() => {
    for (const root of roots.splice(0))
        rmSync(root, { recursive: true, force: true });
});
async function setup(backend = "sdk") {
    const root = mkdtempSync(join(tmpdir(), "muse-mode-config-"));
    roots.push(root);
    const env = {
        ...process.env,
        XDG_CONFIG_HOME: join(root, "config"),
        XDG_DATA_HOME: join(root, "data"),
    };
    const client = connectTestClient({ backend, museBinary: fakeMuseBinary(), env });
    const ctx = await initialized(client);
    const session = await ctx.request(methods.agent.session.new, { cwd: root, mcpServers: [] });
    return { client, ctx, session, env };
}
describe("mode selection through ACP config options", () => {
    it.each(["sdk", "exec"])("%s advertises the same modes through both interfaces", async (backend) => {
        const { session } = await setup(backend);
        expect(session.configOptions?.find((o) => o.id === "mode")).toEqual({
            id: "mode",
            name: "Mode",
            category: "mode",
            type: "select",
            currentValue: "default",
            options: session.modes.availableModes.map(({ id, name, description }) => ({
                value: id,
                name,
                description,
            })),
        });
    });
    it("uses the existing persistent mode selection and keeps both client surfaces synchronized", async () => {
        const { client, ctx, session: { sessionId }, env, } = await setup();
        const response = await ctx.request(methods.agent.session.setConfigOption, {
            sessionId,
            configId: "mode",
            value: "readOnly",
        });
        expect(response.configOptions.find((o) => o.id === "mode")?.currentValue).toBe("readOnly");
        expect(readSessionPreferences(sessionId, env).modeId).toBe("readOnly");
        expect(client.updates.some((n) => n.update.sessionUpdate === "current_mode_update" && n.update.currentModeId === "readOnly")).toBe(true);
        await ctx.request(methods.agent.session.setMode, { sessionId, modeId: "default" });
        const updates = client.updates.flatMap((n) => n.update.sessionUpdate === "config_option_update" ? [n.update.configOptions] : []);
        expect(updates.map((options) => options.find((o) => o.id === "mode")?.currentValue)).toEqual([
            "readOnly",
            "default",
        ]);
        const model = await ctx.request(methods.agent.session.setConfigOption, {
            sessionId,
            configId: "model",
            value: "test-model",
        });
        expect(model.configOptions.find((o) => o.id === "mode")?.currentValue).toBe("default");
    });
    it("publishes slash-command mode changes to config-only clients", async () => {
        const { client, ctx, session: { sessionId }, } = await setup();
        await ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "/plan" }],
        });
        expect(client.updates.some((n) => n.update.sessionUpdate === "config_option_update" &&
            n.update.configOptions.some((o) => o.id === "mode" && o.currentValue === "plan"))).toBe(true);
        expect(client.permissionRequests).toHaveLength(0);
    });
    it("accepts adapter automatic policies while rejecting unavailable SDK modes", async () => {
        expect(availableModes({ env: { MUSE_CODE_ACP_ALLOW_YOLO: "1" }, isRoot: false }, "sdk").map((m) => m.id)).toEqual(["default", "readOnly", "plan", "bypassApprovals", "rejectApprovals"]);
        const { ctx, session: { sessionId }, } = await setup();
        await ctx.request(methods.agent.session.setConfigOption, {
            sessionId,
            configId: "mode",
            value: "bypassApprovals",
        });
        for (const value of ["yolo", "agent", "agent-full-access", "missing"]) {
            await expect(ctx.request(methods.agent.session.setConfigOption, { sessionId, configId: "mode", value })).rejects.toMatchObject({ code: -32602 });
        }
    });
    it("retains planning busy and MCP checks through the config interface", async () => {
        const { client, ctx, session: { sessionId }, } = await setup();
        const state = client.agent.sessions.get(sessionId);
        state.turnFinished = Promise.resolve();
        await expect(ctx.request(methods.agent.session.setConfigOption, {
            sessionId,
            configId: "mode",
            value: "plan",
        })).rejects.toMatchObject({ code: -32600 });
        state.turnFinished = null;
        state.mcpServers = [{ name: "external", command: "unused", args: [], env: [] }];
        await expect(ctx.request(methods.agent.session.setConfigOption, {
            sessionId,
            configId: "mode",
            value: "plan",
        })).rejects.toMatchObject({ code: -32602 });
        expect(state.modeId).toBe("default");
    });
});
