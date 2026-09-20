import { CreateElicitationRequest, CreateElicitationResponse } from "@agentclientprotocol/sdk";
import type { Connection } from "@muse-code/sdk";
import { TurnScopedLifecycle } from "./turn-lifecycle.js";
export interface MuseUserInputQuestion {
    id: string;
    header: string;
    question: string;
    options: Array<{
        label: string;
    }>;
    selection: {
        mode: "single" | "multiple";
        minSelections?: number;
        maxSelections?: number;
    };
}
export interface MuseUserInputRequest {
    userInputId: string;
    turnId: string;
    itemId: string;
    toolCallId: string;
    toolName: string;
    questions: MuseUserInputQuestion[];
}
export interface MuseUserInputAnswer {
    questionId: string;
    selectedLabel?: string;
    selectedLabels?: string[];
    freeText?: string;
}
/** Tracks pending user-input IDs so late answers cannot settle a later turn. */
export declare class UserInputLifecycle extends TurnScopedLifecycle {
}
/**
 * Build an ACP form elicitation from an MSP user-input request.
 * Multi-question prompts become a single object schema keyed by question id.
 */
export declare function userInputToElicitation(sessionId: string, request: MuseUserInputRequest): CreateElicitationRequest;
export declare function elicitationToAnswers(request: MuseUserInputRequest, response: CreateElicitationResponse): MuseUserInputAnswer[] | "cancel";
/** Answer or cancel a pending MSP user-input request over the public Connection API. */
export declare function settleUserInput(connection: Connection, sessionId: string, request: MuseUserInputRequest, response: CreateElicitationResponse): Promise<void>;
//# sourceMappingURL=muse-user-input.d.ts.map