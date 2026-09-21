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
/**
 * True when an elicitation RPC failed because the client has no elicitation
 * endpoint at all (e.g. Kandev answers `elicitation.create` with JSON-RPC
 * -32601 "Method not found"). The error may arrive wrapped (e.g. code -32603
 * with "Method not found" in `data.details`), so the phrase is matched
 * anywhere in the message or data payload. Validation failures and declined
 * answers never contain that phrase — they must keep failing the prompt.
 */
export declare function isElicitationUnsupported(error: unknown): boolean;
/**
 * Render an MSP user-input request as a chat message, for clients without an
 * elicitation endpoint. The user reads the question here and replies in chat;
 * the answer arrives on the next turn.
 */
export declare function userInputToChatMessage(request: MuseUserInputRequest): string;
/** Answer or cancel a pending MSP user-input request over the public Connection API. */
export declare function settleUserInput(connection: Connection, sessionId: string, request: MuseUserInputRequest, response: CreateElicitationResponse): Promise<void>;
//# sourceMappingURL=muse-user-input.d.ts.map