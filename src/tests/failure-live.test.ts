import { expect, it } from "vitest";
import { methods } from "@agentclientprotocol/sdk";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { connectTestClient, initialized } from "./helpers.js";
import { startLoopbackProvider } from "./loopback-provider.js";

for (const statusCode of [401, 503])
  for (const negotiated of [false, true])
    it(`preserves native auth rejection and clears it after success (status=${statusCode}, negotiated=${negotiated})`, async () => {
      const options = {
        scriptedToolCallWhen: ["__no_scripted_tool_for_auth_probe__"],
        scriptedToolCallCommand: "",
        holdMs: 20,
        statusCode,
      };
      const provider = await startLoopbackProvider(options);
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
      });
      try {
        const ctx = await initialized(
          client,
          negotiated ? { _meta: { "muse/authStatus": 1 } } : {},
        );
        const { sessionId } = await ctx.request(methods.agent.session.new, {
          cwd: provider.root,
          mcpServers: [],
        });
        const other = await ctx.request(methods.agent.session.new, {
          cwd: provider.root,
          mcpServers: [],
        });
        const prompt = () =>
          ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "auth recovery marker" }],
          });
        const error = await prompt().catch((e) => e);
        expect(error.code).toBe(statusCode === 401 ? -32000 : -32603);
        expect(error.data.failure).toMatchObject({
          kind: statusCode === 401 ? "authRequired" : "modelError",
          source: "provider",
          retryable: statusCode === 503,
          outcome: "failed",
        });
        const statuses = () =>
          client.updates.flatMap((n) =>
            n.update._meta?.["muse/authStatus"]
              ? [n.update._meta["muse/authStatus"] as Record<string, unknown>]
              : [],
          );
        if (negotiated)
          expect(statuses().at(-1)).toMatchObject({
            verification: statusCode === 401 ? "rejected" : "unknown",
            identity: "unknown",
          });
        else expect(statuses()).toEqual([]);
        const failedCount = provider.requests().length;
        await ctx.request(methods.agent.session.prompt, {
          sessionId: other.sessionId,
          prompt: [{ type: "text", text: "/status" }],
        });
        expect(JSON.stringify(client.updates.at(-1))).toContain("verification: unknown");
        expect(provider.requests().length).toBe(failedCount);
        options.statusCode = 0;
        expect(await prompt()).toMatchObject({ stopReason: "end_turn" });
        if (negotiated)
          expect(statuses().at(-1)).toMatchObject({
            verification: "acceptedForTurn",
            latestFailure: null,
            identity: "unknown",
          });
        await ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text: "/status" }],
        });
        expect(JSON.stringify(client.updates.at(-1))).toContain("Latest failure: none observed");
      } finally {
        await client.agent.dispose();
        await provider.close();
        await rm(provider.root, { recursive: true, force: true });
      }
    }, 60000);
