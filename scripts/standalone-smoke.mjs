#!/usr/bin/env node
import {
  copyFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { smokeAgent } from "./stdio-smoke.mjs";
import { startLoopbackProvider } from "../dist/tests/loopback-provider.js";
import { museCliPath } from "../dist/muse-cli.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? "");
if (process.argv.length !== 3)
  throw new Error("Usage: standalone-smoke.mjs /path/to/muse-code-acp");
const actualMuse = museCliPath();
const work = mkdtempSync(join(tmpdir(), "muse standalone smoke "));
let provider;
try {
  for (const line of readFileSync(join(dirname(source), "SHA256SUMS"), "utf8")
    .trim()
    .split("\n")) {
    const [sha, file] = line.split("  ");
    assert.equal(file, basename(file));
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(dirname(source), file)))
        .digest("hex"),
      sha,
    );
  }
  const binary = join(work, "adapter with spaces");
  copyFileSync(source, binary);
  chmodSync(binary, 0o755);
  const env = {
    PATH: "/usr/bin:/bin",
    HOME: work,
    XDG_CONFIG_HOME: join(work, "config"),
    XDG_DATA_HOME: join(work, "data"),
    TBH_DISABLE_TELEMETRY: "1",
    TBH_CREDENTIAL_BACKEND: "file",
  };
  assert.notEqual(
    spawnSync("node", ["--version"], { env }).status,
    0,
    "Smoke PATH must not contain Node",
  );
  assert.notEqual(
    spawnSync("bun", ["--version"], { env }).status,
    0,
    "Smoke PATH must not contain Bun",
  );
  const version = spawnSync(binary, ["--version"], { env, encoding: "utf8", timeout: 5000 });
  assert.equal(version.status, 0);
  assert.equal(
    version.stdout.trim(),
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version,
  );
  const runtimeFlags = spawnSync(binary, ["--version"], {
    env: { ...env, NODE_OPTIONS: "--require=/must-not-load.cjs" },
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(runtimeFlags.status, 0, "Standalone must use its configured runtime flags");
  const missing = spawnSync(binary, [], { env, encoding: "utf8", timeout: 5000 });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Install Muse Code/);
  // Dotenv must not introduce configuration that the npm entrypoint would ignore.
  writeFileSync(join(work, ".env"), "MUSE_CODE_EXECUTABLE=/must-not-be-loaded\n");
  const dotenv = spawnSync(binary, [], { cwd: work, env, encoding: "utf8", timeout: 5000 });
  assert.match(dotenv.stderr, /Could not find the `muse` CLI/);
  const oldMuse = join(work, "incompatible muse");
  writeFileSync(
    oldMuse,
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo muse 0.1.0; exit 0; fi\nexit 2\n',
  );
  chmodSync(oldMuse, 0o755);
  await smokeAgent({
    command: binary,
    cwd: work,
    env: { ...env, MUSE_CODE_EXECUTABLE: oldMuse },
    expectedError: /does not support.*muse serve/,
  });
  const copiedMuse = join(work, "real muse with spaces");
  copyFileSync(actualMuse, copiedMuse);
  chmodSync(copiedMuse, 0o755);
  const delegated = spawnSync(binary, ["--cli", "--version"], {
    env: { ...env, MUSE_CODE_EXECUTABLE: copiedMuse },
    encoding: "utf8",
    timeout: 20000,
  });
  assert.equal(
    delegated.status,
    0,
    JSON.stringify({
      error: delegated.error?.message,
      stderr: delegated.stderr,
      signal: delegated.signal,
    }),
  );
  assert.match(delegated.stdout, /1\.1\.1/);
  provider = await startLoopbackProvider({
    holdMs: 20,
    scriptedToolCallWhen: ["never-script"],
    scriptedToolCallCommand: "",
    replyText: "standalone reply",
  });
  const cwd = join(work, "empty workspace");
  mkdirSync(cwd);
  await smokeAgent({
    command: binary,
    cwd,
    env: {
      ...env,
      HOME: provider.home,
      XDG_CONFIG_HOME: join(provider.root, "config"),
      XDG_DATA_HOME: join(provider.root, "data"),
      MUSE_CODE_EXECUTABLE: copiedMuse,
    },
    expectedText: "standalone reply",
  });
  assert.ok(provider.requests().length > 0);
  console.log(
    "standalone-smoke ok: checksums, no Node/Bun on PATH, missing/incompatible Muse, override with spaces, CLI delegation, real-host initialize/new/prompt/stream/close",
  );
} finally {
  await provider?.close();
  if (provider) rmSync(provider.root, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}
