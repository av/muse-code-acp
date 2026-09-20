import { SessionNotification } from "@agentclientprotocol/sdk";
import { Logger } from "./logger.js";
/**
 * Runs `muse export --session <id>` and parses the self-contained document
 * (export_schema_version 1). Export is preferred over raw log parsing: the
 * on-disk log uses an internal runtime.* vocabulary, while the export wraps
 * each record with derived metadata and stable event kinds.
 */
export declare function runMuseExport(sessionId: string, env?: Record<string, string | undefined>, museBinary?: string): Promise<MuseExportDocument>;
export interface MuseExportDocument {
    export_schema_version: number;
    events?: Array<{
        envelope?: {
            payload?: Record<string, any>;
        };
    }>;
}
/**
 * Replays an export document as ACP session updates, in original order:
 * user prompts (`run.started`), agent replies (`assistant_message_committed`),
 * and tool calls (task `side_effect_intent` → `completed`/`failed`).
 * Encrypted reasoning has no plaintext in exports and is skipped silently.
 */
export declare function exportToUpdates(sessionId: string, doc: MuseExportDocument, _logger?: Logger): SessionNotification[];
//# sourceMappingURL=session-export.d.ts.map