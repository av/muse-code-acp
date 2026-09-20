import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export function museSettingsPath(env = process.env) {
    const configHome = env.XDG_CONFIG_HOME || join(env.HOME ?? homedir(), ".config");
    return join(configHome, "muse", "settings.json");
}
/** Absent or malformed settings never crash the adapter — defaults apply. */
export function readMuseSettings(env = process.env, logger = console) {
    const path = museSettingsPath(env);
    let raw;
    try {
        raw = JSON.parse(readFileSync(path, "utf8"));
    }
    catch (err) {
        logger.log(`muse settings unavailable at ${path}: ${err}`);
        return {};
    }
    if (typeof raw !== "object" || raw === null) {
        logger.log(`muse settings at ${path} is not an object; ignoring`);
        return {};
    }
    const settings = raw;
    return {
        provider: typeof settings.provider === "string" ? settings.provider : undefined,
        model: typeof settings.model === "string" ? settings.model : undefined,
        reasoningEffort: typeof settings.reasoning_effort === "string" ? settings.reasoning_effort : undefined,
    };
}
