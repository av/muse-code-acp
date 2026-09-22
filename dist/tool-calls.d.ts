import { SessionNotification, ToolCallContent, ToolKind } from "@agentclientprotocol/sdk";
import { MuseEnvelope } from "./muse-events.js";
/**
 * Copy Muse tool arguments onto the field names Kandev already renders.
 * Edit cards read `old_str_1`/`new_str_1`, creates read `file_content`,
 * search cards read `path`, and a subagent card is a task whose raw input
 * sets `_toolName` to `task`. Muse's own fields stay on the call.
 */
export declare function kandevWireArgs(tool: string, args: Record<string, unknown> | undefined): Record<string, unknown> | undefined;
/** Muse tool name → ACP tool kind (icons/UI treatment in clients). */
export declare const TOOL_KINDS: Record<string, ToolKind>;
/**
 * Correlates muse's tool events into ACP tool_call / tool_call_update pairs
 * for one prompt turn.
 *
 * Muse 0.2.1 keeps tool *arguments* inside the encrypted model response, so a
 * pending call initially carries just the tool name; the human-usable title
 * (command, path) is upgraded when `tool.result` arrives — bash results embed
 * `command`/`description`/`output`, write_file results name the path.
 */
export declare class ToolCallTracker {
    private readonly sessionId;
    private readonly byTask;
    private readonly byCall;
    constructor(sessionId: string);
    /** `task.lifecycle.side_effect_intent` → pending tool_call (tool ops only). */
    intentToUpdates(envelope: MuseEnvelope): SessionNotification[];
    /** `tool.result` → completed/failed tool_call_update (or a one-shot failed
     *  tool_call for results whose intent never appeared, e.g. argument
     *  validation failures). */
    resultToUpdates(envelope: MuseEnvelope): SessionNotification[];
}
interface ResultPresentation {
    title?: string;
    content?: ToolCallContent[];
    locations?: {
        path: string;
    }[];
    rawInput?: Record<string, unknown>;
    rawOutput?: Record<string, unknown>;
}
export declare function presentResult(toolName: string | undefined | null, text: string): ResultPresentation;
export declare function textContent(text: string): ToolCallContent;
export declare function writtenFilePath(text: string): string | undefined;
export {};
//# sourceMappingURL=tool-calls.d.ts.map