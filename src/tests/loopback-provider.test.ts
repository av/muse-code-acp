import { rmSync } from "node:fs";
import { expect, it } from "vitest";
import { startLoopbackProvider } from "./loopback-provider.js";

it("does not spend a scripted tool call on a reminder that lacks the tool", async () => {
  const provider = await startLoopbackProvider({
    scriptedToolCallWhen: ["marker"],
    scriptedToolCallCommand: "printf marker",
    holdMs: 1,
  });
  try {
    const post = async (name: string) =>
      (
        await fetch(`${provider.baseUrl}/responses`, {
          method: "POST",
          body: JSON.stringify({
            input: "marker",
            tools: [{ type: "namespace", name: "muse", tools: [{ type: "function", name }] }],
          }),
        })
      ).text();
    expect(await post("submit_reminder_decision")).not.toContain("function_call_arguments.done");
    expect(provider.scriptedToolCalls()).toBe(0);
    expect(await post("bash")).toContain("function_call_arguments.done");
    expect(provider.scriptedToolCalls()).toBe(1);
  } finally {
    await provider.close();
    rmSync(provider.root, { recursive: true, force: true });
  }
});
