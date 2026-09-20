import { RequestError, type PromptResponse } from "@agentclientprotocol/sdk";
import { type TurnOutcome } from "@muse-code/sdk";
export interface FailureObservation {
    source: "host" | "provider" | "transport" | "adapter";
    phase?: string;
    mutation?: "possiblyApplied";
    execution?: "notSubmitted" | "possiblySubmitted";
    kind: string;
    retryable?: boolean;
    recovery: string;
    outcome: "failed" | "unknown";
}
/** Diagnostics are bounded and never copy arbitrary protocol data or host stderr. */
export declare function safeDiagnostic(text: string, env?: Record<string, string | undefined>): string;
export declare function failureError(kind: string, message: string, retryable?: boolean, env?: Record<string, string | undefined>): RequestError;
export declare function sdkTerminalResponse(outcome: TurnOutcome, env: Record<string, string | undefined>): PromptResponse;
export declare function sdkThrownError(error: unknown, env: Record<string, string | undefined>): RequestError;
export declare function observedFailure(error: unknown): FailureObservation | undefined;
//# sourceMappingURL=turn-failure.d.ts.map