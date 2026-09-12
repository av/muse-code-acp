#!/usr/bin/env node
/**
 * Pack the adapter, install into a clean temp directory, and initialize over stdio.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "muse-acp-pack-"));
const installDir = join(work, "install");
mkdirSync(installDir);

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd: opts.cwd ?? repoRoot,
    env: { ...process.env, ...(opts.env ?? {}) },
    input: opts.input,
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
  return result;
}

try {
  run("npm", ["run", "build"]);
  const pack = run("npm", ["pack", "--pack-destination", work]);
  const tarballName = pack.stdout.trim().split("\n").filter(Boolean).at(-1);
  const tarball = join(work, tarballName);
  run("npm", ["install", tarball], { cwd: installDir });

  const pkg = JSON.parse(
    readFileSync(join(installDir, "node_modules/@bex-co/muse-code-acp/package.json"), "utf8"),
  );
  if (!pkg.dependencies?.["@muse-code/sdk"]) {
    throw new Error("packed package is missing @muse-code/sdk dependency");
  }
  const bin = join(installDir, "node_modules/@bex-co/muse-code-acp/dist/index.js");
  const fakeMsp = join(repoRoot, "src/tests/fixtures/fake-msp.cjs");
  chmodSync(fakeMsp, 0o755);

  const initRequest =
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: "pack-smoke", version: "0" },
      },
    }) + "\n";

  const child = spawnSync(process.execPath, [bin], {
    encoding: "utf8",
    cwd: installDir,
    env: {
      ...process.env,
      MUSE_CODE_ACP_BACKEND: "sdk",
      MUSE_CODE_EXECUTABLE: fakeMsp,
      FAKE_MSP_MODE: "complete",
      HOME: work,
      XDG_CONFIG_HOME: join(work, "config"),
      XDG_DATA_HOME: join(work, "data"),
    },
    input: initRequest,
    timeout: 15_000,
  });
  if (child.error) {
    throw child.error;
  }
  const lines = (child.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const response = lines.map((line) => JSON.parse(line)).find((msg) => msg.id === 1);
  if (!response?.result?.protocolVersion) {
    console.error(child.stdout);
    console.error(child.stderr);
    throw new Error("packed entrypoint did not answer initialize");
  }
  console.log(`pack-smoke ok: ${tarballName} protocolVersion=${response.result.protocolVersion}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
