import { SessionNotification } from "@agentclientprotocol/sdk";
import { MuseEnvelope, RunTerminalPayload } from "./muse-events.js";
/**
 * Translates one prompt turn's muse JSONL envelopes into ACP session updates.
 * Stateful per turn: tool intents and results are correlated by call id.
 *
 * Unknown payload types translate to nothing — muse emits far more event
 * types than ACP clients care about (task lifecycle, reconciliation,
 * observer noise), and new muse versions must degrade gracefully.
 */
export declare class TurnTranslator {
    private readonly sessionId;
    private readonly tools;
    /** The last `run.terminal.*` payload seen — the run's own account of how it
     *  ended, used to enrich stop reasons and error messages. */
    lastTerminal: RunTerminalPayload | null;
    /** Muse 0.2.1 cannot route this wait through ACP. The caller must stop the
     * child and fail the turn instead of leaving a headless prompt blocked. */
    approvalWait: {
        toolName: string;
        toolCallId: string;
    } | null;
    constructor(sessionId: string);
    toUpdates(envelope: MuseEnvelope): SessionNotification[];
}
//# sourceMappingURL=translate.d.ts.map