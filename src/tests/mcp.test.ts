import { McpServer, methods } from "@agentclientprotocol/sdk";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMuseMcpOverlay, museMcpServers, readConfiguredMcpServers } from "../mcp-overlay.js";
import { connectTestClient, fakeMuseBinary, initialized } from "./helpers.js";

const stdioServer: McpServer = {
  name: "security-tools",
  command: "/bin/security-mcp",
  args: ["--stdio"],
  env: [{ name: "SCAN_ROOT", value: "/workspace" }],
};

describe("MCP passthrough", () => {
  it("advertises the ACP-required stdio transport without remote transports", async () => {
    const testClient = connectTestClient({ backend: "exec", museBinary: fakeMuseBinary() });
    const ctx = await testClient.connect();
    const response = await ctx.request(methods.agent.initialize, { protocolVersion: 1 });

    expect(response.agentCapabilities?.mcpCapabilities).toEqual({});
  });

  it("merges session MCP with user settings in a private disposable overlay", () => {
    const configHome = mkdtempSync(join(tmpdir(), "muse-mcp-source-"));
    const museDir = join(configHome, "muse");
    mkdirSync(museDir);
    mkdirSync(join(configHome, "other-tool"));
    writeFileSync(join(museDir, "auth.json"), '{"credential":"stored"}\n');
    writeFileSync(
      join(museDir, "settings.json"),
      JSON.stringify({
        schema_version: 1,
        provider: "meta",
        mcp_servers: {
          existing: { transport: "stdio", command: "/bin/existing", args: [], env: {} },
          "security-tools": { transport: "stdio", command: "/bin/old", args: [], env: {} },
        },
      }),
    );
    const original = readFileSync(join(museDir, "settings.json"), "utf8");

    const overlay = createMuseMcpOverlay([stdioServer], { XDG_CONFIG_HOME: configHome });
    const settings = JSON.parse(
      readFileSync(join(overlay.configHome, "muse", "settings.json"), "utf8"),
    );

    expect(settings.provider).toBe("meta");
    expect(settings.mcp_servers.existing.command).toBe("/bin/existing");
    expect(settings.mcp_servers["security-tools"]).toEqual({
      transport: "stdio",
      command: "/bin/security-mcp",
      args: ["--stdio"],
      env: { SCAN_ROOT: "/workspace" },
    });
    expect(lstatSync(join(overlay.configHome, "muse", "auth.json")).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(overlay.configHome, "other-tool")).isSymbolicLink()).toBe(true);
    expect(statSync(join(overlay.configHome, "muse", "settings.json")).mode & 0o777).toBe(0o600);
    expect(readFileSync(join(museDir, "settings.json"), "utf8")).toBe(original);

    const overlayPath = overlay.configHome;
    overlay.cleanup();
    expect(existsSync(overlayPath)).toBe(false);
  });

  it("injects the overlay for a prompt and removes it after Muse exits", async () => {
    const configHome = mkdtempSync(join(tmpdir(), "muse-mcp-prompt-source-"));
    const capturePath = join(mkdtempSync(join(tmpdir(), "muse-mcp-capture-")), "capture.json");
    mkdirSync(join(configHome, "muse"));
    writeFileSync(
      join(configHome, "muse", "settings.json"),
      '{"schema_version":1,"model":"original-model"}\n',
    );
    const testClient = connectTestClient({
      backend: "exec",
      museBinary: fakeMuseBinary(),
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
        FAKE_MUSE_MODE: "exit0",
        FAKE_MUSE_SETTINGS_CAPTURE: capturePath,
      },
    });
    const ctx = await initialized(testClient);
    const { sessionId } = await ctx.request(methods.agent.session.new, {
      cwd: mkdtempSync(join(tmpdir(), "muse-mcp-workspace-")),
      mcpServers: [stdioServer],
    });

    await expect(
      ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: "text", text: "use the security tools" }],
      }),
    ).resolves.toMatchObject({ stopReason: "end_turn" });

    const capture = JSON.parse(readFileSync(capturePath, "utf8"));
    expect(capture.settings.model).toBe("original-model");
    expect(capture.settings.mcp_servers["security-tools"].command).toBe("/bin/security-mcp");
    expect(existsSync(capture.configHome)).toBe(false);
  });

  it("rejects unsupported SSE MCP transports", () => {
    expect(() =>
      createMuseMcpOverlay(
        [
          {
            name: "remote",
            type: "sse",
            url: "https://example.com",
            headers: [],
          } as unknown as McpServer,
        ],
        process.env,
      ),
    ).toThrow(/unsupported MCP transport/);
  });
});

it("merges canonical and legacy global servers with session HTTP precedence in an isolated SDK overlay", () => {
  const root = mkdtempSync(join(tmpdir(), "muse-http-mcp-"));
  mkdirSync(join(root, "muse"));
  const path = join(root, "muse", "settings.json");
  const original = JSON.stringify({
    mcp_servers: {
      legacy: { transport: "stdio", command: "/bin/legacy", args: [], env: {} },
      duplicate: { transport: "stdio", command: "/bin/obsolete" },
    },
    mcpServers: {
      duplicate: { type: "stdio", command: "/bin/canonical", mode: "optional" },
      remote: {
        type: "http",
        url: "https://old.invalid",
        headers: { Authorization: "old-secret" },
      },
    },
  });
  writeFileSync(path, original);
  const overlay = createMuseMcpOverlay(
    [
      stdioServer,
      {
        type: "http",
        name: "remote",
        url: "https://new.invalid/mcp?key=dummy-key",
        headers: [{ name: "Authorization", value: "Bearer dummy-secret" }],
      },
    ],
    { XDG_CONFIG_HOME: root },
    { model: "muse-spark-1.2", reasoningEffort: "high" },
  );
  try {
    const settings = JSON.parse(
      readFileSync(join(overlay.configHome, "muse", "settings.json"), "utf8"),
    );
    expect(settings.mcp_servers).toBeUndefined();
    expect(readConfiguredMcpServers({ XDG_CONFIG_HOME: root })).toEqual({
      legacy: { type: "stdio", command: "/bin/legacy", args: [], env: {} },
      duplicate: { type: "stdio", command: "/bin/canonical", mode: "optional" },
      remote: {
        type: "http",
        url: "https://old.invalid",
        headers: { Authorization: "old-secret" },
      },
    });
    expect(settings.mcpServers.legacy).toEqual({
      type: "stdio",
      command: "/bin/legacy",
      args: [],
      env: {},
    });
    expect(settings.mcpServers.duplicate.command).toBe("/bin/canonical");
    expect(settings.mcpServers.duplicate.mode).toBe("optional");
    expect(settings.mcpServers["security-tools"].type).toBe("stdio");
    expect(settings.mcpServers["security-tools"].mode).toBe("required");
    expect(settings.mcpServers.remote).toEqual({
      type: "http",
      mode: "required",
      url: "https://new.invalid/mcp?key=dummy-key",
      headers: { Authorization: "Bearer dummy-secret" },
    });
    expect(JSON.stringify(settings)).not.toContain("old-secret");
    expect(readFileSync(path, "utf8")).toBe(original);
    expect(statSync(join(overlay.configHome, "muse", "settings.json")).mode & 0o777).toBe(0o600);
  } finally {
    overlay.cleanup();
    rmSync(root, { recursive: true, force: true });
  }
});

it.each([
  { url: "file:///dummy-secret", headers: [] },
  { url: "https://user:dummy-secret@example.com", headers: [] },
  { url: "dummy-secret invalid", headers: [] },
  {
    url: "https://example.com",
    headers: [{ name: "Authorization", value: "dummy-secret\r\nInjected: yes" }],
  },
  { url: "https://example.com", headers: [{ name: "Bad Header", value: "dummy-secret" }] },
])("rejects invalid HTTP MCP settings without exposing credentials (%#)", (value) => {
  let error: unknown;
  try {
    museMcpServers([{ type: "http", name: "private-name", ...value }]);
  } catch (caught) {
    error = caught;
  }
  expect(error).toMatchObject({ code: -32602 });
  expect(String(error)).not.toMatch(/dummy-secret|private-name|Injected/);
});
