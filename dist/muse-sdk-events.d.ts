import { SessionNotification } from "@agentclientprotocol/sdk";
import type { FoldedItem } from "@muse-code/sdk";
import type { FileChangeEvidence } from "./file-change-evidence.js";
import { Logger } from "./logger.js";
export interface ItemDeltaParams {
    itemId: string;
    delta: string;
    field?: string;
}
/** Correlated public text/summary/tool surfaces; never inspect private reasoning. */
export declare class MuseSdkTranslator {
    private readonly sessionId;
    private readonly logger;
    private readonly fileChanges?;
    private readonly items;
    private readonly emittedText;
    private readonly output;
    private readonly notices;
    private outputNegotiated;
    configureOutput(enabled: boolean): void;
    private workerContext?;
    configureWorkers(generation: string, cancel: boolean, negotiated: boolean): void;
    lostWork(): SessionNotification[];
    constructor(sessionId: string, logger: Logger, fileChanges?: FileChangeEvidence | undefined);
    fromDelta({ itemId, delta, field }: ItemDeltaParams): SessionNotification[];
    /** A fold catch-up is an absolute accumulated value, never another delta. */
    fromAccumulated(itemId: string, field: string, text: string): SessionNotification[];
    fromItem(item: FoldedItem): SessionNotification[];
    private append;
    private snapshot;
    private truncated;
    private tool;
    private textUpdate;
}
//# sourceMappingURL=muse-sdk-events.d.ts.map