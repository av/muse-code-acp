import { RequestError } from "@agentclientprotocol/sdk";
export type SdkPhase = "initializing" | "preparing" | "submitting" | "running" | "reading" | "forking";
export declare class SdkCancelled extends Error {
}
export declare class SdkDeadline extends Error {
}
export declare function sdkDeadline(env: Record<string, string | undefined>, name: "STARTUP" | "SUBMIT"): number;
/** One initiating cause wins; closing the transport is a consequence, never its replacement. */
export declare class SdkOperation {
    private readonly stop;
    private readonly log;
    phase: SdkPhase;
    failure?: unknown;
    private failed;
    private failurePhase?;
    private disposed;
    private timer?;
    private reject;
    private readonly stopped;
    private since;
    constructor(stop: () => void, log?: (text: string) => void);
    enter(phase: SdkPhase, timeoutMs?: number): void;
    fail: (error: unknown) => void;
    check(): void;
    wait<T>(work: Promise<T>): Promise<T>;
    error(error: unknown, env: Record<string, string | undefined>, diagnostic?: string): RequestError;
    dispose(): void;
}
//# sourceMappingURL=sdk-operation.d.ts.map