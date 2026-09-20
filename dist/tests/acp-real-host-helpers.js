/**
 * Spawn the built ACP entrypoint against a real Muse binary (no fake MSP).
 */
import { client, methods, ndJsonStream, PROTOCOL_VERSION, } from "@agentclientprotocol/sdk";
import { spawn, spawnSync } from "node:child_process";
import { expect } from "vitest";
import { museCliPath } from "../muse-cli.js";
import { Readable, Writable } from "node:stream";
import { agentEntrypoint } from "./acp-wire-helpers.js";
/**
 * w2/m2: these exact hosts cannot compose legacy :auto-review profiles in serve.
 * Builds stay enumerated so an unlisted host is expected to succeed — that is how
 * 1.3.0-R3057.1 was caught still reproducing the limitation rather than fixing it.
 */
const LEGACY_PROFILE_LIMITED = ["(1.2.1-R2847.1)", "(1.3.0-R3057.1)"];
export async function expectLegacyContinuation(prompt) {
    const version = spawnSync(museCliPath(), ["--version"], { encoding: "utf8" }).stdout ?? "";
    if (LEGACY_PROFILE_LIMITED.some((build) => version.includes(build))) {
        await expect(prompt).rejects.toMatchObject({
            code: -32603,
            message: expect.stringContaining("This Muse host cannot resume a saved session using the :auto-review permission profile"),
        });
    }
    else {
        await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
    }
}
export async function spawnAcpAgent(options) {
    const updates = [];
    let stderr = "";
    const child = spawn(process.execPath, [agentEntrypoint], {
        cwd: options.cwd,
        env: {
            ...process.env,
            ...options.env,
            MUSE_CODE_ACP_BACKEND: "sdk",
        },
        stdio: ["pipe", "pipe", "pipe"],
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
        stderr += chunk;
    });
    let resolveCtx;
    const ctxPromise = new Promise((resolve) => {
        resolveCtx = resolve;
    });
    const connection = client({ name: "real-host-test-client" })
        .onNotification(methods.client.session.update, (handlerCtx) => {
        updates.push(handlerCtx.params);
    })
        .onConnect((conn) => resolveCtx(conn.agent))
        .connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout)));
    const ctx = await Promise.race([
        ctxPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`real-host connect timeout\nstderr:\n${stderr}`)), 20_000)),
    ]);
    await ctx.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { auth: { terminal: true } },
    });
    let disposed = false;
    return {
        ctx,
        updates,
        async dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            try {
                connection.close();
            }
            catch {
                // ignore
            }
            child.kill("SIGTERM");
            await new Promise((resolve) => {
                const t = setTimeout(() => {
                    child.kill("SIGKILL");
                    resolve();
                }, 3_000);
                child.on("exit", () => {
                    clearTimeout(t);
                    resolve();
                });
            });
        },
    };
}
