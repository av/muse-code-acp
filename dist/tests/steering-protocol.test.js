import { describe, expect, it } from "vitest";
import { supportsSteering, parseSteeringRequest } from "../steering-protocol.js";
describe("supportsSteering", () => {
    it("is true when the client advertises the steering capability", () => {
        expect(supportsSteering({ _meta: { "muse/steering": 1 } })).toBe(true);
    });
    it("is false without the capability", () => {
        expect(supportsSteering({})).toBe(false);
        expect(supportsSteering({ _meta: {} })).toBe(false);
        expect(supportsSteering({ _meta: { "muse/steering": 2 } })).toBe(false);
    });
});
describe("parseSteeringRequest", () => {
    it("parses a text steering prompt", () => {
        const parsed = parseSteeringRequest({
            sessionId: "session-1",
            expectedTurnId: "turn-1",
            prompt: [{ type: "text", text: "prefer the simpler fix" }],
        });
        expect(parsed.sessionId).toBe("session-1");
        expect(parsed.expectedTurnId).toBe("turn-1");
        expect(parsed.input).toEqual([{ type: "text", text: "prefer the simpler fix" }]);
    });
    it("rejects requests missing session or turn ids", () => {
        expect(() => parseSteeringRequest({ expectedTurnId: "turn-1", prompt: [{ type: "text", text: "x" }] })).toThrow(/steering requires/);
        expect(() => parseSteeringRequest({ sessionId: "s", prompt: [{ type: "text", text: "x" }] })).toThrow(/steering requires/);
    });
    it("rejects an empty prompt", () => {
        expect(() => parseSteeringRequest({ sessionId: "s", expectedTurnId: "t", prompt: [] })).toThrow(/steering requires/);
    });
    it("rejects unsupported prompt content", () => {
        expect(() => parseSteeringRequest({
            sessionId: "s",
            expectedTurnId: "t",
            prompt: [{ type: "audio", data: "x" }],
        })).toThrow(/steering requires/);
    });
});
