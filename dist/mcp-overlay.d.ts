import { McpServer } from "@agentclientprotocol/sdk";
import type { ClientProvider } from "./client-provider.js";
import type { SessionConfig } from "./config-options.js";
export interface MuseMcpOverlay {
    env: Record<string, string | undefined>;
    configHome: string;
    cleanup(): void;
}
/** Translate verified stdio and HTTP settings without logging endpoint credentials. */
export declare function museMcpServers(mcpServers: McpServer[]): Record<string, unknown>;
/** Configured inventory uses the same alias precedence as the SDK overlay. */
export declare function readConfiguredMcpServers(baseEnv?: Record<string, string | undefined>): Record<string, unknown>;
/**
 * Muse 0.2.1 only reads MCP servers from $XDG_CONFIG_HOME/muse/settings.json.
 * Create a private overlay owned by the execution host so ACP-provided servers can be injected
 * without changing the user's settings or leaking across concurrent sessions.
 * Existing XDG entries are symlinked into the overlay; only settings.json is a
 * temporary merged copy.
 */
export declare function createMuseMcpOverlay(mcpServers: McpServer[], baseEnv?: Record<string, string | undefined>, executionConfig?: SessionConfig, provider?: ClientProvider): MuseMcpOverlay;
//# sourceMappingURL=mcp-overlay.d.ts.map