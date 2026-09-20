import { AuthMethod } from "@agentclientprotocol/sdk";
import { Logger } from "./logger.js";
export declare const MUSE_LOGIN_METHOD_ID = "muse-login";
export declare const META_API_KEY_METHOD_ID = "meta-api-key";
export declare function museAuthJsonPath(env?: Record<string, string | undefined>): string;
/**
 * Existence/size check only — secret material is never read into adapter
 * memory. Precedence mirrors muse: env var > stored credentials.
 */
export declare function credentialsConfigured(env?: Record<string, string | undefined>): boolean;
/**
 * Browser login runs through the `--cli` passthrough (`muse-code-acp --cli
 * login` execs `muse login` with inherited stdio); the `terminal-auth` _meta
 * mirrors claude-agent-acp's convention for clients that spawn terminal
 * commands themselves. Terminal methods are only advertised when the client
 * reports `clientCapabilities.auth.terminal`.
 */
export declare function museAuthMethods(options?: {
    includeTerminal?: boolean;
}): AuthMethod[];
/**
 * Runs `muse logout` (non-interactive). Note muse cannot unset an exported
 * META_API_KEY — an environment key remains configured, with verification unknown.
 */
export declare function runMuseLogout(env?: Record<string, string | undefined>, museBinary?: string, logger?: Logger): Promise<void>;
export declare const AUTH_EXTENSION = "muse/authStatus";
export declare function credentialStatus(env: Record<string, string | undefined>, sessionKey?: boolean): {
    configured: boolean;
    source: string;
    verification: string;
    identity: string;
};
//# sourceMappingURL=auth.d.ts.map