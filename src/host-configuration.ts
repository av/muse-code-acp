import { createHash } from "node:crypto";
import type { McpServer } from "@agentclientprotocol/sdk";
import type { SessionConfig } from "./config-options.js";
import { museHostIdentity } from "./host-identity.js";

/** A digest keeps spawn-time configuration and credentials out of logs and cache keys. */
export function sdkHostConfiguration(
  cwd: string,
  config: SessionConfig,
  mode: string,
  mcpServers: McpServer[],
  env: Record<string, string | undefined>,
  museBinary?: string,
): string {
  const { identity } = museHostIdentity(cwd, env, museBinary);
  return createHash("sha256")
    .update(JSON.stringify([identity, { ...config, reasoningEffort: undefined }, mode, mcpServers]))
    .digest("hex");
}
