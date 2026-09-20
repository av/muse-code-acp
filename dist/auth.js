import { statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { runMuseCapture } from "./muse-run.js";
export const MUSE_LOGIN_METHOD_ID = "muse-login";
export const META_API_KEY_METHOD_ID = "meta-api-key";
export function museAuthJsonPath(env = process.env) {
    const configHome = env.XDG_CONFIG_HOME || join(env.HOME ?? homedir(), ".config");
    return join(configHome, "muse", "auth.json");
}
/**
 * Existence/size check only — secret material is never read into adapter
 * memory. Precedence mirrors muse: env var > stored credentials.
 */
export function credentialsConfigured(env = process.env) {
    if (env.META_API_KEY) {
        return true;
    }
    try {
        return statSync(museAuthJsonPath(env)).size > 2;
    }
    catch {
        return false;
    }
}
/**
 * Browser login runs through the `--cli` passthrough (`muse-code-acp --cli
 * login` execs `muse login` with inherited stdio); the `terminal-auth` _meta
 * mirrors claude-agent-acp's convention for clients that spawn terminal
 * commands themselves. Terminal methods are only advertised when the client
 * reports `clientCapabilities.auth.terminal`.
 */
export function museAuthMethods(options = {}) {
    const includeTerminal = options.includeTerminal ?? true;
    const baseArgs = process.argv.slice(1).filter((arg) => arg !== "--cli");
    const methods = [];
    if (includeTerminal) {
        methods.push({
            type: "terminal",
            id: MUSE_LOGIN_METHOD_ID,
            name: "Meta account (browser)",
            description: "Opens Meta's browser OAuth flow via `muse login`.",
            args: ["--cli", "login"],
            _meta: {
                "terminal-auth": {
                    command: process.execPath,
                    args: [...baseArgs, "--cli", "login"],
                    label: "Muse Login",
                },
            },
        });
    }
    methods.push({
        type: "env_var",
        id: META_API_KEY_METHOD_ID,
        name: "Meta API key",
        description: "Set META_API_KEY for headless/CI use (muse env precedence applies).",
        vars: [{ name: "META_API_KEY", label: "Meta API key", secret: true }],
    });
    return methods;
}
/**
 * Runs `muse logout` (non-interactive). Note muse cannot unset an exported
 * META_API_KEY — an environment key remains configured, with verification unknown.
 */
export async function runMuseLogout(env = process.env, museBinary, logger = console) {
    await runMuseCapture(["logout"], env, museBinary);
    if (env.META_API_KEY) {
        logger.log("logout note: META_API_KEY is still exported in the environment");
    }
}
export const AUTH_EXTENSION = "muse/authStatus";
export function credentialStatus(env, sessionKey = false) {
    return {
        configured: sessionKey || credentialsConfigured(env),
        source: sessionKey
            ? "clientProvider"
            : env.META_API_KEY
                ? "environment"
                : credentialsConfigured(env)
                    ? "stored"
                    : "none",
        verification: "unknown",
        identity: "unknown",
    };
}
