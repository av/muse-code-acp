import { client, methods, PROTOCOL_VERSION, } from "@agentclientprotocol/sdk";
import { afterEach } from "vitest";
import { chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentConnection } from "../acp-agent.js";
import { museCliPath } from "../muse-cli.js";
const agents = new Set();
afterEach(async () => {
    const owned = [...agents];
    agents.clear();
    await Promise.all(owned.map((agent) => agent.dispose()));
});
export const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
export function silentLogger() {
    return { log: () => { }, error: () => { } };
}
/** Logger that records log lines (e.g. to assert spawned argv). */
export function capturingLogger(lines) {
    return { log: (...args) => lines.push(args.join(" ")), error: () => { } };
}
/** True when the real muse CLI is installed (live echo-provider tests). */
export function museAvailable() {
    try {
        museCliPath();
        return true;
    }
    catch {
        return false;
    }
}
/** The blocking fake `muse exec` used by deterministic cancellation tests. */
export function fakeMuseBinary() {
    const fakeMuse = join(fixturesDir, "fake-muse.cjs");
    chmodSync(fakeMuse, 0o755);
    return fakeMuse;
}
/**
 * Connects an in-process ACP client to a fresh agent instance. Drives the
 * real SDK connection layer (schema validation included) without a transport.
 */
export function connectTestClient(options = {}, logger = silentLogger()) {
    const updates = [];
    const permissionRequests = [];
    const elicitationRequests = [];
    let permissionResponder = () => ({
        outcome: { outcome: "cancelled" },
    });
    let elicitationResponder = () => ({ action: "cancel" });
    let resolveCtx;
    const ctxPromise = new Promise((resolve) => {
        resolveCtx = resolve;
    });
    const clientApp = client({ name: "test-client" })
        .onNotification(methods.client.session.update, (ctx) => {
        updates.push(ctx.params);
    })
        .onRequest(methods.client.session.requestPermission, async (ctx) => {
        permissionRequests.push(ctx.params);
        return permissionResponder(ctx.params);
    })
        .onRequest(methods.client.elicitation.create, async (ctx) => {
        elicitationRequests.push(ctx.params);
        return elicitationResponder(ctx.params);
    })
        .onConnect((conn) => resolveCtx(conn.agent));
    const { agent } = createAgentConnection(clientApp, logger, options);
    agents.add(agent);
    return {
        updates,
        permissionRequests,
        elicitationRequests,
        agent,
        setPermissionResponder(responder) {
            permissionResponder = responder;
        },
        setElicitationResponder(responder) {
            elicitationResponder = responder;
        },
        connect: () => ctxPromise,
    };
}
export async function initialized(testClient, clientCapabilities = { auth: { terminal: true } }) {
    const ctx = await testClient.connect();
    await ctx.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities,
    });
    return ctx;
}
/** initialize + session/new in a fresh temp cwd — the common test opening. */
export async function newTestSession(testClient, clientCapabilities) {
    const ctx = await initialized(testClient, clientCapabilities);
    const cwd = mkdtempSync(join(tmpdir(), "muse-acp-test-"));
    const { sessionId, modes, configOptions } = await ctx.request(methods.agent.session.new, {
        cwd,
        mcpServers: [],
    });
    return { ctx, sessionId, cwd, modes, configOptions };
}
