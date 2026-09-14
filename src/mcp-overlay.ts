import { RequestError, McpServer } from "@agentclientprotocol/sdk";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { validateHeaderName, validateHeaderValue } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionConfig } from "./config-options.js";
import { museSettingsPath } from "./muse-settings.js";

export interface MuseMcpOverlay {
  env: Record<string, string | undefined>;
  configHome: string;
  cleanup(): void;
}

/** Translate verified stdio and HTTP settings without logging endpoint credentials. */
export function museMcpServers(mcpServers: McpServer[]): Record<string, unknown> {
  return Object.fromEntries(
    mcpServers.map((server) => {
      if ("command" in server) {
        return [
          server.name,
          {
            type: "stdio",
            command: server.command,
            args: server.args,
            env: Object.fromEntries(server.env.map(({ name, value }) => [name, value])),
          },
        ];
      }
      if (server.type !== "http") {
        throw RequestError.invalidParams(undefined, "unsupported MCP transport; use stdio or HTTP");
      }
      try {
        const url = new URL(server.url);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
          throw new Error();
        for (const { name, value } of server.headers) {
          validateHeaderName(name);
          validateHeaderValue(name, value);
        }
      } catch {
        throw RequestError.invalidParams(
          undefined,
          "invalid HTTP MCP URL or headers; use http/https without URL credentials and valid header fields",
        );
      }
      return [
        server.name,
        {
          type: "http",
          url: server.url,
          headers: Object.fromEntries(server.headers.map(({ name, value }) => [name, value])),
        },
      ];
    }),
  );
}

function existingMcpServers(settings: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["mcp_servers", "mcpServers"]) {
    if (settings[key] !== undefined && !isRecord(settings[key])) {
      throw new Error(`muse settings ${key} is not an object`);
    }
  }
  const combined = {
    ...(settings.mcp_servers as Record<string, unknown> | undefined),
    ...(settings.mcpServers as Record<string, unknown> | undefined),
  };
  return Object.fromEntries(
    Object.entries(combined).map(([name, value]) => {
      if (!isRecord(value) || value.transport === undefined) return [name, value];
      const { transport, ...fields } = value;
      return [name, { ...fields, type: fields.type ?? transport }];
    }),
  );
}

/** Configured inventory uses the same alias precedence as the SDK overlay. */
export function readConfiguredMcpServers(
  baseEnv: Record<string, string | undefined> = process.env,
): Record<string, unknown> {
  return existingMcpServers(readSettingsDocument(museSettingsPath(baseEnv)));
}

/**
 * Muse 0.2.1 only reads MCP servers from $XDG_CONFIG_HOME/muse/settings.json.
 * Create a private overlay owned by the execution host so ACP-provided servers can be injected
 * without changing the user's settings or leaking across concurrent sessions.
 * Existing XDG entries are symlinked into the overlay; only settings.json is a
 * temporary merged copy.
 */
export function createMuseMcpOverlay(
  mcpServers: McpServer[],
  baseEnv: Record<string, string | undefined> = process.env,
  executionConfig?: SessionConfig,
): MuseMcpOverlay {
  const sourceConfigHome = baseEnv.XDG_CONFIG_HOME || join(baseEnv.HOME ?? homedir(), ".config");
  const configHome = mkdtempSync(join(tmpdir(), "muse-code-acp-"));
  chmodSync(configHome, 0o700);

  try {
    mirrorDirectory(sourceConfigHome, configHome, "muse");

    const sourceMuseDir = join(sourceConfigHome, "muse");
    const overlayMuseDir = join(configHome, "muse");
    mkdirSync(overlayMuseDir, { mode: 0o700 });
    mirrorDirectory(sourceMuseDir, overlayMuseDir, "settings.json");

    const sourceSettingsPath = join(sourceMuseDir, "settings.json");
    const settings = readSettingsDocument(sourceSettingsPath);
    const existingMcp = executionConfig ? existingMcpServers(settings) : settings.mcp_servers;
    if (existingMcp !== undefined && !isRecord(existingMcp))
      throw new Error("muse settings mcp_servers is not an object");
    const injected = museMcpServers(mcpServers);
    if (executionConfig) {
      delete settings.mcp_servers;
      // ACP supplied these tools for the session. Muse 1.2.1 silently tolerates
      // startup failures when mode is omitted; require them explicitly, while
      // preserving the user's posture for servers inherited from settings.
      for (const [name, server] of Object.entries(injected)) {
        injected[name] = { ...(server as Record<string, unknown>), mode: "required" };
      }
    } else {
      for (const [name, value] of Object.entries(injected)) {
        const { type, ...fields } = value as Record<string, unknown>;
        if (type !== "stdio")
          throw RequestError.invalidParams(
            undefined,
            "legacy exec supports only stdio MCP servers",
          );
        injected[name] = { transport: type, ...fields };
      }
    }

    const merged = {
      schema_version: 1,
      ...settings,
      // Muse 1.1.1 initializes its execution provider from settings even when
      // MSP selects another session model. Keep both views in agreement.
      ...(executionConfig
        ? { model: executionConfig.model, reasoning_effort: executionConfig.reasoningEffort }
        : {}),
      [executionConfig ? "mcpServers" : "mcp_servers"]: {
        ...(existingMcp ?? {}),
        ...injected,
      },
    };
    const overlaySettingsPath = join(overlayMuseDir, "settings.json");
    writeFileSync(overlaySettingsPath, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
    chmodSync(overlaySettingsPath, 0o600);

    return {
      env: { ...baseEnv, XDG_CONFIG_HOME: configHome },
      configHome,
      cleanup: () => rmSync(configHome, { recursive: true, force: true }),
    };
  } catch (err) {
    rmSync(configHome, { recursive: true, force: true });
    throw err;
  }
}

function readSettingsDocument(path: string): Record<string, unknown> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return {};
    }
    throw err;
  }

  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error(`muse settings at ${path} is not an object`);
  }
  return parsed;
}

function mirrorDirectory(source: string, destination: string, excludedName: string): void {
  let names: string[];
  try {
    names = readdirSync(source);
  } catch (err) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return;
    }
    throw err;
  }

  for (const name of names) {
    if (name === excludedName) {
      continue;
    }
    const target = join(source, name);
    const type = lstatSync(target).isDirectory() ? "junction" : "file";
    symlinkSync(target, join(destination, name), type);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && "code" in err;
}
