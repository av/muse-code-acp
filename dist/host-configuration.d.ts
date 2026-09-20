import type { McpServer } from "@agentclientprotocol/sdk";
import type { SessionConfig } from "./config-options.js";
/** A digest keeps spawn-time configuration and credentials out of logs and cache keys. */
export declare function sdkHostConfiguration(cwd: string, config: SessionConfig, mode: string, mcpServers: McpServer[], env: Record<string, string | undefined>, museBinary?: string): string;
//# sourceMappingURL=host-configuration.d.ts.map