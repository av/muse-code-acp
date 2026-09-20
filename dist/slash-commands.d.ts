import type { AvailableCommand, PromptRequest } from "@agentclientprotocol/sdk";
import type { WorkflowCommand } from "./review-prompt.js";
export declare const BUILTIN_COMMANDS: AvailableCommand[];
type Blocks = PromptRequest["prompt"];
export interface SlashCommand {
    local?: {
        kind: "models" | "skills" | "logout" | "rename";
        argument: string;
    };
    blocks: Blocks;
    index: number;
    workflow?: WorkflowCommand;
    status?: "goal" | "mcp" | "status";
    notice?: string;
    stop?: boolean;
    barePlan?: boolean;
}
/** Only explicit command-leading top-level text is executable; attachments are data. */
export declare function parseSlashCommand(prompt: Blocks): SlashCommand | undefined;
export {};
//# sourceMappingURL=slash-commands.d.ts.map