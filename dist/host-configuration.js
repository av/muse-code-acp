import { createHash } from "node:crypto";
import { museHostIdentity } from "./host-identity.js";
/** A digest keeps spawn-time configuration and credentials out of logs and cache keys. */
export function sdkHostConfiguration(cwd, config, mode, mcpServers, env, museBinary) {
    const { identity } = museHostIdentity(cwd, env, museBinary);
    return createHash("sha256")
        .update(JSON.stringify([identity, { ...config, reasoningEffort: undefined }, mode, mcpServers]))
        .digest("hex");
}
