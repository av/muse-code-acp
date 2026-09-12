import { spawn } from "node:child_process";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import assert from "node:assert/strict";
import { client, methods, ndJsonStream } from "@agentclientprotocol/sdk";

/** Exercise a delivered executable over ACP, with bounded startup/cleanup. */
export async function smokeAgent({
  command,
  args = [],
  cwd,
  env,
  prompt = "packaged prompt",
  expectedText,
  expectedError,
}) {
  const child = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
  const exited = once(child, "exit");
  void exited.catch(() => {});
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-16384);
  });
  let text = "";
  let rejectOutput;
  let outputRejected = false;
  const outputFailure = new Promise((_, reject) => {
    rejectOutput = reject;
  });
  let resolveContext;
  const context = new Promise((resolve) => {
    resolveContext = resolve;
  });
  const connection = client({ name: "artifact-smoke" })
    .onNotification(methods.client.session.update, (ctx) => {
      const update = ctx.params.update;
      if (
        outputRejected ||
        update.sessionUpdate !== "agent_message_chunk" ||
        update.content.type !== "text"
      )
        return;
      const chunk = update.content.text;
      if (text.length + chunk.length > (expectedText?.length ?? 65536)) {
        outputRejected = true;
        rejectOutput(new Error("Artifact output exceeded the smoke response bound"));
      } else text += chunk;
    })
    .onConnect((conn) => resolveContext(conn.agent))
    .connect(ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout)));
  let timer;
  try {
    await Promise.race([
      outputFailure,
      (async () => {
        const ctx = await context;
        const init = await ctx.request(methods.agent.initialize, {
          protocolVersion: 1,
          clientCapabilities: {},
        });
        assert.equal(init.protocolVersion, 1);
        const { sessionId } = await ctx.request(methods.agent.session.new, { cwd, mcpServers: [] });
        const result = ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text: prompt }],
        });
        if (expectedError) await assert.rejects(result, expectedError);
        else {
          assert.deepEqual(await result, { stopReason: "end_turn" });
          assert.equal(text, expectedText);
        }
        await ctx.request(methods.agent.session.close, { sessionId });
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Artifact smoke timed out: ${stderr}`)), 30000);
      }),
      exited.then(() => {
        throw new Error(`Artifact exited prematurely: ${stderr}`);
      }),
    ]);
    return text;
  } finally {
    clearTimeout(timer);
    connection.close();
    if (child.exitCode === null && child.signalCode === null) {
      const kill = setTimeout(() => child.kill("SIGKILL"), 2000);
      child.kill("SIGTERM");
      await exited.catch(() => {});
      clearTimeout(kill);
    }
  }
}
