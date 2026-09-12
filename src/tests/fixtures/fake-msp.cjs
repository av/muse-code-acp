#!/usr/bin/env node
// Deterministic MSP peer. Exercises the real SDK's stdio and RPC handling.
const { createInterface } = require("node:readline");
const { appendFileSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

if (process.argv.includes("skills")) {
  console.log(JSON.stringify({ skills: [] }));
  process.exit(0);
}
if (!process.argv.includes("serve")) {
  process.exit(2);
}
const mode = process.env.FAKE_MSP_MODE ?? "complete";
if (process.env.FAKE_MSP_SETTINGS_CAPTURE) {
  const configHome = process.env.XDG_CONFIG_HOME;
  writeFileSync(process.env.FAKE_MSP_SETTINGS_CAPTURE, JSON.stringify({
    configHome, args: process.argv.slice(2),
    settings: JSON.parse(readFileSync(join(configHome, "muse", "settings.json"), "utf8")),
  }));
}
if (mode === "disabled") {
  process.stderr.write("the experimental SDK tier is disabled\n");
  process.exit(5);
}
let sessionId;
let turnId;
let cursor = 0;
const write = (message) => console.log(JSON.stringify({ jsonrpc: "2.0", ...message }));
const notify = (method, params) =>
  write({ method, params: { sessionId, viewCursor: `v:${++cursor}`, ...params } });
const terminal = (terminal, extra = {}) => notify("turn/completed", { turnId, terminal, ...extra });
const rl = createInterface({ input: process.stdin });
rl.on("close", () => process.exit(0));
rl.on("line", (line) => {
  const request = JSON.parse(line);
  if (process.env.FAKE_MSP_CAPTURE) {
    appendFileSync(process.env.FAKE_MSP_CAPTURE, JSON.stringify(request) + "\n");
  }
  const { id, method, params = {} } = request;
  const reply = (result) => write({ id, result });
  switch (method) {
    case "initialize":
      reply({ schema: { fingerprint: "fake-schema" }, sessionDurability: "durable" });
      break;
    case "initialized":
      break;
    case "session/resume":
      if (mode === "busy" || mode === "wrongWorkspace") {
        reply({ session: {
          sessionId: params.sessionId, modelId: "muse-spark-1.2",
          ...(mode === "busy" ? { activeTurnId: "earlier-turn" } : { workspaceRoot: require("node:path").dirname(process.cwd()) }),
        } });
        break;
      }
      write({
        id,
        error: {
          code: mode === "inUse" ? -32021 : -32020,
          message: mode === "inUse" ? "session is in use" : "session not found",
          data: { kind: mode === "inUse" ? "sessionInUse" : "sessionNotFound" },
        },
      });
      break;
    case "session/start":
      sessionId = params.sessionId;
      reply({ session: { sessionId, modelId: params.modelId }, viewCursor: "" });
      break;
    case "turn/start": {
      turnId = params.commandId;
      const item = { itemId: "message", turnId, kind: "agentMessage", revision: 1, status: "inProgress", text: "" };
      notify("turn/started", { turnId });
      notify("item/started", { item });
      notify("item/delta", { itemId: item.itemId, delta: "hello" });
      if (mode === "exit") {
        process.exit(1);
      }
      if (mode === "approval") {
        notify("approval/requested", {
          turnId,
          approvalId: "apr1",
          itemId: "tool-item",
          toolCallId: "call1",
          toolName: "bash",
          taskId: "task1",
          rawArgs: "{}",
          judgeEscalated: false,
          protectedWrite: false,
          currentRequirementId: { approvalId: "apr1", sourceIndex: 0 },
          availableChoices: [{ choiceId: "allow", label: "Allow" }],
          subject: { kind: "toolCall", toolName: "bash" },
          sourceRange: { start: 0, end: 0 },
        });
      } else if (mode === "gap") {
        notify("view/gap", { next: "v:99" });
      } else if (mode === "autherr") {
        terminal("failed", { error: { kind: "authRequired", message: "not logged in", retryable: false } });
      } else if (mode === "stepLimit") {
        terminal("failed", { error: { kind: "stepLimit", message: "step limit", retryable: false } });
      } else if (mode !== "block") {
        notify("item/completed", { item: { ...item, revision: 2, status: "completed", text: "hello world" } });
        terminal("completed");
      }
      // Deliberately acknowledge AFTER the notifications, in the same read.
      reply({
        status: "accepted",
        turnId,
        commandId: params.commandId,
        disposition: "started",
        startedNewTurn: true,
      });
      break;
    }
    case "turn/cancel":
      reply({ status: "accepted", turnId });
      terminal("cancelled");
      break;
    default:
      write({ id, error: { code: -32601, message: `unexpected method: ${method}` } });
  }
});
