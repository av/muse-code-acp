import { describe, expect, it } from "vitest";
import { TurnScopedLifecycle } from "../turn-lifecycle.js";
function tracked(lifecycle, id, turnId) {
    const generation = lifecycle.beginTurn(turnId);
    expect(lifecycle.track(id, turnId, generation)).toBe(true);
    return generation;
}
describe("TurnScopedLifecycle", () => {
    it("tracks and resolves ids within a generation", () => {
        const lifecycle = new TurnScopedLifecycle();
        const generation = tracked(lifecycle, "approval-1", "turn-a");
        expect(lifecycle.isLive("approval-1", "turn-a", generation)).toBe(true);
        expect(lifecycle.has("approval-1")).toBe(true);
        lifecycle.resolve("approval-1");
        expect(lifecycle.isLive("approval-1", "turn-a", generation)).toBe(false);
        expect(lifecycle.has("approval-1")).toBe(false);
    });
    it("rejects tracks from a stale generation", () => {
        const lifecycle = new TurnScopedLifecycle();
        const stale = tracked(lifecycle, "approval-1", "turn-a");
        const current = lifecycle.beginTurn("turn-b");
        expect(current).toBeGreaterThan(stale);
        expect(lifecycle.track("approval-2", "turn-b", stale)).toBe(false);
        expect(lifecycle.isLive("approval-1", "turn-a", stale)).toBe(false);
        expect(lifecycle.has("approval-2")).toBe(false);
    });
    it("drops other-turn pendings when a new turn begins", () => {
        const lifecycle = new TurnScopedLifecycle();
        const generation = tracked(lifecycle, "approval-1", "turn-a");
        lifecycle.beginTurn("turn-b");
        expect(lifecycle.has("approval-1")).toBe(false);
        expect(lifecycle.isLive("approval-1", "turn-a", generation)).toBe(false);
    });
    it("keeps same-turn pendings live across a repeated beginTurn", () => {
        const lifecycle = new TurnScopedLifecycle();
        tracked(lifecycle, "approval-1", "turn-a");
        const generation = lifecycle.beginTurn("turn-a");
        expect(lifecycle.has("approval-1")).toBe(true);
        expect(lifecycle.isLive("approval-1", "turn-a", generation)).toBe(true);
        expect(lifecycle.isLive("approval-1", "turn-b", generation)).toBe(false);
    });
    it("disposeTurn removes only that turn's ids", () => {
        const lifecycle = new TurnScopedLifecycle();
        const generation = lifecycle.beginTurn("turn-a");
        expect(lifecycle.track("approval-1", "turn-a", generation)).toBe(true);
        expect(lifecycle.track("approval-2", "turn-b", generation)).toBe(true);
        lifecycle.disposeTurn("turn-a");
        expect(lifecycle.has("approval-1")).toBe(false);
        expect(lifecycle.has("approval-2")).toBe(true);
    });
    it("disposeAll clears everything and invalidates the generation", () => {
        const lifecycle = new TurnScopedLifecycle();
        const stale = tracked(lifecycle, "approval-1", "turn-a");
        lifecycle.disposeAll();
        expect(lifecycle.has("approval-1")).toBe(false);
        expect(lifecycle.isLive("approval-1", "turn-a", stale)).toBe(false);
        expect(lifecycle.track("approval-2", "turn-a", stale)).toBe(false);
    });
});
