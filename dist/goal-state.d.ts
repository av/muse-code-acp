import type { Connection } from "@muse-code/sdk";
/** Public MSP goal fields, kept verbatim rather than normalized to an ACP status. */
export interface ObservedGoal {
    objective: string;
    status: string;
    percentComplete: number;
    currentWork?: string;
    nextWork?: string;
}
export type GoalObservation = {
    status: "known";
    goal: ObservedGoal | null;
} | {
    status: "unknown";
    reason: string;
};
export declare function parseGoalObservation(raw: unknown): GoalObservation;
/** Read-only recovery: at most 20 pages / 2000 events. Caller owns transport deadline. */
export declare function readGoalFromConnection(connection: Pick<Connection, "command">, sessionId: string, initialRead?: unknown): Promise<GoalObservation>;
//# sourceMappingURL=goal-state.d.ts.map