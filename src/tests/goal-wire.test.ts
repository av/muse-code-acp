import { methods } from "@agentclientprotocol/sdk";
import { expect, it } from "vitest";
import { createWireFixture } from "./acp-wire-helpers.js";

it.each([true, false])(
  "goal metadata negotiation=%s preserves baseline inspection, clear and deduplication",
  async (negotiated) => {
    const wire = await createWireFixture({
      env: { FAKE_MSP_GOAL: "lifecycle" },
      clientCapabilities: negotiated ? { _meta: { "muse/goal": 1 } } : {},
    });
    try {
      const { sessionId } = await wire.ctx.request(methods.agent.session.new, {
        cwd: wire.workspace,
        mcpServers: [],
      });
      const prompt = (text: string) =>
        wire.ctx.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: "text", text }],
        });
      await prompt("start");
      const goals = () =>
        wire.updates.flatMap((n) =>
          n.update.sessionUpdate === "session_info_update" && n.update._meta?.["muse/goal"]
            ? [n.update._meta["muse/goal"]]
            : [],
        );
      if (negotiated)
        await expect.poll(() => JSON.stringify(goals())).toContain('"percentComplete":140');
      else await new Promise((resolve) => setTimeout(resolve, 120));
      await prompt("/goal");
      expect(JSON.stringify(wire.updates)).toContain("wire-goal");
      await expect(prompt("/goal clear")).resolves.toEqual({ stopReason: "end_turn" });
      expect(JSON.stringify(wire.updates)).toContain("No goal was changed");
      await new Promise((resolve) => setTimeout(resolve, 650));
      await prompt("/goal status");
      expect(JSON.stringify(wire.updates.at(-1))).toContain("No recorded goal");
      if (negotiated) {
        expect(goals()).toHaveLength(3); // initial none, active, explicit clear
        expect(goals().at(-1)).toEqual({ status: "known", goal: null });
      } else expect(goals()).toEqual([]);
      expect(
        wire
          .getTranscript()
          .mspRequests.filter((r) => (r as { method: string }).method === "turn/start"),
      ).toHaveLength(1);
      await prompt("ordinary work after clear");
      await wire.ctx.request(methods.agent.session.close, { sessionId });
      const count = wire.updates.length;
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(wire.updates).toHaveLength(count);
    } finally {
      await wire.dispose();
    }
  },
);
