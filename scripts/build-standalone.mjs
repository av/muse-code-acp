#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeVersion = "v26.8.2";
const bunVersion = "1.3.3";
const node = process.env.MUSE_CODE_ACP_BUILD_NODE ?? process.execPath;
const bun = process.env.BUN_EXECUTABLE ?? "bun";
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 120000 });
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}
if (process.argv.length > 3) throw new Error("Usage: build-standalone.mjs [output-directory]");
if (run(node, ["--version"]) !== nodeVersion)
  throw new Error(
    `Standalone builds require Node ${nodeVersion}; set MUSE_CODE_ACP_BUILD_NODE to that binary`,
  );
if (run(bun, ["--version"]) !== bunVersion)
  throw new Error(`Standalone builds require Bun ${bunVersion} as the bundler`);
const platform = JSON.parse(
  run(node, [
    "-p",
    "JSON.stringify({platform:process.platform,arch:process.arch,execPath:process.execPath})",
  ]),
);
if (platform.platform !== "darwin" || platform.arch !== "arm64")
  throw new Error("Only native darwin-arm64 standalone builds are verified");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const target = "darwin-arm64";
const parent = resolve(process.argv[2] ?? join(root, "artifacts", "standalone"));
mkdirSync(parent, { recursive: true });
const work = mkdtempSync(join(parent, ".build-"));
const output = join(parent, `muse-code-acp-v${pkg.version}-${target}`);
const hash = (data) => createHash("sha256").update(data).digest("hex");
try {
  run(bun, [
    "build",
    "src/index.ts",
    "--target=node",
    "--format=esm",
    "--env=disable",
    "--outfile",
    join(work, "adapter.mjs"),
  ]);
  const binary = join(work, "muse-code-acp");
  const config = join(work, "sea.json");
  writeFileSync(
    config,
    JSON.stringify({
      main: join(work, "adapter.mjs"),
      mainFormat: "module",
      output: binary,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
      execArgvExtension: "none",
    }),
  );
  run(node, ["--build-sea", config]);
  run("codesign", ["--sign", "-", binary]);
  if (run(binary, ["--version"]) !== pkg.version)
    throw new Error("Standalone version differs from package");
  rmSync(config);
  for (const file of ["LICENSE", "NOTICE"]) copyFileSync(join(root, file), join(work, file));
  copyFileSync(
    join(dirname(dirname(realpathSync(platform.execPath))), "LICENSE"),
    join(work, "NODE-LICENSE"),
  );
  for (const [name, filename] of [
    ["@agentclientprotocol/sdk", "ACP-SDK-LICENSE"],
    ["@muse-code/sdk", "MUSE-SDK-LICENSE"],
    ["zod", "ZOD-LICENSE"],
  ]) {
    copyFileSync(join(root, "node_modules", name, "LICENSE"), join(work, filename));
  }
  copyFileSync(join(root, "docs", "standalone.md"), join(work, "README.md"));
  writeFileSync(
    join(work, "build.json"),
    JSON.stringify(
      {
        package: pkg.name,
        version: pkg.version,
        target,
        node: nodeVersion,
        bundler: `bun ${bunVersion}`,
        commit: run("git", ["rev-parse", "HEAD"]),
        dirty: !!run("git", ["status", "--porcelain"]),
        lockfileSha256: hash(readFileSync(join(root, "package-lock.json"))),
        bundleSha256: hash(readFileSync(join(work, "adapter.mjs"))),
      },
      null,
      2,
    ) + "\n",
  );
  const files = readdirSync(work).sort();
  writeFileSync(
    join(work, "SHA256SUMS"),
    files.map((file) => `${hash(readFileSync(join(work, file)))}  ${file}`).join("\n") + "\n",
  );
  // Refuse replacing an existing release directory; callers can choose another parent.
  renameSync(work, output);
  console.log(output);
} finally {
  rmSync(work, { recursive: true, force: true });
}
