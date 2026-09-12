import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { museAuthJsonPath } from "./auth.js";
import { museCliPath } from "./muse-cli.js";
import { museSettingsPath } from "./muse-settings.js";

/** Shared spawn identity; credentials enter only an opaque digest, never its result. */
export function museHostIdentity(
  cwd: string,
  env: Record<string, string | undefined>,
  museBinary?: string,
  tolerateUnreadableConfig = false,
): { binary: string; cwd: string; identity: string } {
  const binary = realpathSync(museBinary ?? museCliPath(env));
  const workspace = realpathSync(cwd);
  const stat = statSync(binary);
  const files = [museSettingsPath(env), museAuthJsonPath(env)].map((path) => {
    try {
      return [path, createHash("sha256").update(readFileSync(path)).digest("hex")];
    } catch (error) {
      if (!tolerateUnreadableConfig && (error as { code?: string }).code !== "ENOENT") throw error;
      return [path, null];
    }
  });
  const identity = createHash("sha256")
    .update(
      JSON.stringify([
        binary,
        stat.size,
        stat.mtimeMs,
        stat.ctimeMs,
        workspace,
        Object.entries(env).sort(([a], [b]) => a.localeCompare(b)),
        files,
      ]),
    )
    .digest("hex");
  return { binary, cwd: workspace, identity };
}
