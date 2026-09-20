import type { McpServer } from "@agentclientprotocol/sdk";
/** Only retain recognized categories from host startup errors, never raw diagnostic text. */
export declare function mcpStartupFailure(error: unknown): string | undefined;
/** Inventory only: the public MSP has no connection-status observation method. */
export declare function mcpStatus(servers: McpServer[], env: Record<string, string | undefined>, lastFailure?: string): string;
//# sourceMappingURL=mcp-status.d.ts.map