/**
 * Turn-scoped pending-id tracking shared by approvals and user-input.
 * Bumping generation invalidates every outstanding track for that surface.
 */
export declare class TurnScopedLifecycle {
    private readonly pending;
    private generation;
    beginTurn(turnId: string): number;
    track(id: string, turnId: string, generation: number): boolean;
    isLive(id: string, turnId: string, generation: number): boolean;
    resolve(id: string): void;
    has(id: string): boolean;
    disposeTurn(turnId: string): void;
    disposeAll(): void;
}
//# sourceMappingURL=turn-lifecycle.d.ts.map