import { Logger } from "./logger.js";
/**
 * The subset of `~/.config/muse/settings.json` the adapter reads for
 * defaults. Read-only: this file belongs to the user/muse, never write it.
 */
export interface MuseSettings {
    provider?: string;
    model?: string;
    reasoningEffort?: string;
}
export declare function museSettingsPath(env?: Record<string, string | undefined>): string;
/** Absent or malformed settings never crash the adapter — defaults apply. */
export declare function readMuseSettings(env?: Record<string, string | undefined>, logger?: Logger): MuseSettings;
//# sourceMappingURL=muse-settings.d.ts.map