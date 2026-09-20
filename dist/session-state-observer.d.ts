import type { Connection, Session } from "@muse-code/sdk";
export declare const SESSION_STATE_EXTENSION = "muse/sessionState";
export interface SessionStateObservation {
    model?: {
        modelId: string;
        providerId?: string;
        source?: string;
    } | null;
    approvalMode?: {
        mode: string;
        source?: string;
    } | null;
    policyPersistence?: {
        approvalId: string;
        status: "unverified" | "succeeded" | "failed";
    };
}
/** Reporting only: latest folded state plus durable persistence facts the SDK drops. */
export declare class SessionStateObserver {
    private readonly sessionId;
    private readonly publish;
    private readonly log;
    private readonly last;
    private readonly policies;
    private cursor?;
    private stopped;
    private polling;
    private pagingUnavailable;
    private nextPageAt;
    constructor(sessionId: string, publish: (value: SessionStateObservation) => Promise<void>, log: (message: string) => void);
    watchPolicy(approvalId: string, cursor?: string): void;
    stop(): void;
    poll(fold: Session["fold"], connection: Connection): Promise<void>;
}
//# sourceMappingURL=session-state-observer.d.ts.map