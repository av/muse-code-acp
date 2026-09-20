import { AvailableCommand } from "@agentclientprotocol/sdk";
import { Logger } from "./logger.js";
/**
 * Muse skills surfaced as ACP slash commands. Invocation is pure prompt
 * passthrough: a prompt beginning with `/<skill-id> …` reaches `muse exec`
 * verbatim, and muse's model loads the skill via its read_skill tool
 * (verified live on muse 0.2.1 — `/plan …` produced a read_skill call).
 */
export interface MuseSkill {
    id: string;
    description: string;
    scope: string;
    activation: string;
}
export declare function listMuseSkills(cwd: string, env?: Record<string, string | undefined>, museBinary?: string, logger?: Logger): Promise<MuseSkill[]>;
export declare function skillsToCommands(skills: MuseSkill[]): AvailableCommand[];
//# sourceMappingURL=skills.d.ts.map