import type { MuseInputPart } from "./prompt-content.js";
/** Serializes corrections against their captured turn, never a replacement turn. */
export declare class SteeringQueue<Target, Result> {
    private readonly options;
    private readonly pending;
    private running;
    private closed;
    constructor(options: {
        isCurrent(target: Target, expectedTurnId: string): boolean;
        dispatch(target: Target, expectedTurnId: string, input: MuseInputPart[]): Promise<Result>;
    });
    enqueue(target: Target, expectedTurnId: string, input: readonly MuseInputPart[]): Promise<Result>;
    /** Undispatched work fails immediately; the active host request owns its cancellation. */
    close(): void;
    private closedError;
    private drain;
}
//# sourceMappingURL=steering-queue.d.ts.map