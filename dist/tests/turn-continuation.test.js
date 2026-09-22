import { describe, expect, it } from "vitest";
import { turnStoppedEarly } from "../turn-continuation.js";
const turn = "t1";
describe("early model stops", () => {
    it("treats a reply after the last tool as finished", () => {
        expect(turnStoppedEarly([
            { turnId: turn, kind: "toolCall", text: "pwd" },
            { turnId: turn, kind: "agentMessage", text: "The directory is /tmp." },
        ], turn)).toBe(false);
    });
    it("treats a stop on a tool and a length cutoff as unfinished", () => {
        expect(turnStoppedEarly([{ turnId: turn, kind: "toolCall", text: "pwd" }], turn)).toBe(true);
        expect(turnStoppedEarly([{ turnId: turn, kind: "agentMessage", text: "   " }], turn)).toBe(false);
        expect(turnStoppedEarly([{ turnId: turn, kind: "agentMessage", text: "The directory is" }], turn, "length")).toBe(true);
    });
    it("ignores items from another turn", () => {
        expect(turnStoppedEarly([
            { turnId: "other", kind: "toolCall", text: "pwd" },
            { turnId: turn, kind: "agentMessage", text: "done" },
        ], turn)).toBe(false);
    });
});
