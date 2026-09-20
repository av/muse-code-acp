import { type OutputRequest, type OutputPage } from "./stored-output.js";
import { type ProgressFacts } from "./session-progress.js";
import { ClientCapabilities, PromptResponse, SessionNotification } from "@agentclientprotocol/sdk";
import { type FoldedItem } from "@muse-code/sdk";
import type { AcpClient } from "./acp-agent.js";
import type { SessionInfo } from "@agentclientprotocol/sdk";
import { Logger } from "./logger.js";
import { type MuseReasoningEffort } from "./config-options.js";
import type { MuseInputPart } from "./prompt-content.js";
import { MuseSdkHost } from "./muse-sdk-host.js";
export { MuseSdkHost } from "./muse-sdk-host.js";
import { type GoalObservation } from "./goal-state.js";
export interface MuseSdkOptions {
    sessionId: string;
    cwd: string;
    /** Ordered Muse turn input parts (text encodings of ACP content). */
    input: MuseInputPart[];
    model: string;
    providerId?: string;
    profileId?: string | null;
    reasoningEffort: string;
    readOnly: boolean;
    safety?: import("./safety-settings.js").SafetySettings;
    automaticDecision?: "approve" | "reject";
    museBinary?: string;
    env: Record<string, string | undefined>;
    logger: Logger;
    /** When false, skip the serve --help probe (tests with fake-msp). */
    checkHost?: boolean;
    acpClient: AcpClient;
    clientCapabilities?: ClientCapabilities;
    fileReportRequestId?: string;
    /** Read cancelRequested from the ACP session while the turn runs. */
    isCancelled?: () => boolean;
    hostOwner?: MuseSdkHost;
    /** Negotiated active-turn metadata for the namespaced steering request. */
    steering?: boolean;
}
export interface MuseSdkHandle {
    updates: AsyncIterable<SessionNotification>;
    done: Promise<PromptResponse>;
    kill(): void;
    readonly activeTurnId: string | undefined;
    steer(input: MuseInputPart[], expectedTurnId: string): Promise<{
        turnId: string;
        status: string;
    }>;
}
/** Read authoritative saved metadata without acquiring a writer lease. */
export declare function readMuseSdkSession(options: Pick<MuseSdkOptions, "sessionId" | "cwd" | "env" | "museBinary" | "logger" | "checkHost"> & {
    readGoal?: boolean;
    readProgress?: boolean;
    readTasks?: boolean;
    readOutputReferences?: boolean;
    outputRequest?: OutputRequest;
    allowActive?: boolean;
    signal?: AbortSignal;
}): Promise<{
    modelId: string | null;
    progress?: ProgressFacts;
    tasks?: FoldedItem[];
    outputItems?: FoldedItem[];
    output?: OutputPage;
    providerId?: string;
    goal?: GoalObservation;
    info?: SessionInfo;
}>;
/** Preserve the public MSP effort vocabulary verified against Muse 1.1.1. */
export declare function sdkReasoningEffort(effort: string | undefined): MuseReasoningEffort | undefined;
/**
 * One durable `muse serve` host per turn. MuseClient/Session own MSP framing,
 * fold routing, and turn waits; this adapter translates folded items into ACP
 * updates and maps terminals/errors to PromptResponse / RequestError.
 */
export declare function spawnMuseSdkTurn(options: MuseSdkOptions): MuseSdkHandle;
//# sourceMappingURL=muse-sdk.d.ts.map