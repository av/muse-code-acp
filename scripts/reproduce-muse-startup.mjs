// Public SDK-only reproduction. No adapter, real credentials, or inference requests.
// node scripts/reproduce-muse-startup.mjs /absolute/path/to/native/muse [sessions=6000] [concurrency=16]
import { spawnMspConnection } from "@muse-code/sdk";
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
const binary = realpathSync(process.argv[2] ?? "");
const count = Number(process.argv[3] ?? 6000);
const concurrency = Number(process.argv[4] ?? 16);
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 100000 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 16
)
  throw new Error("Use 1–100000 sessions and concurrency 1–16");
const root = mkdtempSync(join(tmpdir(), "muse-startup-repro-"));
let httpRequests = 0;
const server = createServer((req, res) => {
  httpRequests++;
  res.writeHead(503, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "No inference provider in this reproduction" }));
});
const emit = (row) => console.log(JSON.stringify(row));
const env = {
  PATH: process.env.PATH,
  HOME: root,
  XDG_CONFIG_HOME: join(root, "config"),
  XDG_DATA_HOME: join(root, "data"),
  TBH_CREDENTIAL_BACKEND: "file",
  TBH_DISABLE_TELEMETRY: "1",
};
const data = join(env.XDG_DATA_HOME, "muse");
const config = join(env.XDG_CONFIG_HOME, "muse");
const cwd = join(root, "workspace");
async function trial(label, index) {
  const start = performance.now();
  const host = spawnMspConnection({
    command: binary,
    args: ["serve"],
    cwd,
    env,
    shutdownTimeoutMs: 1000,
  });
  const row = { label, index };
  let timer;
  let phase = "initialize";
  try {
    await Promise.race([
      (async () => {
        const ready = await host.initialize({
          clientInfo: { name: "startup_reproduction", version: "1.0.0" },
        });
        row.initializeMs = Math.round(performance.now() - start);
        phase = "model/list";
        const query = performance.now();
        const catalog = await ready.connection.request("model/list", {});
        row.modelListMs = Math.round(performance.now() - query);
        row.models = catalog.models.length;
        row.status = "available";
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("130-second deadline")), 130000);
      }),
    ]);
  } catch (error) {
    row.status = "failed";
    row.phase = phase;
    row.error = error.message;
  } finally {
    clearTimeout(timer);
    const closing = performance.now();
    await host.close();
    row.cleanupMs = Math.round(performance.now() - closing);
    row.totalMs = Math.round(performance.now() - start);
    emit(row);
  }
}
async function batch(label, n) {
  const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => trial(label, i)));
  for (const result of results) if (result.status === "rejected") throw result.reason;
}
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  mkdirSync(config, { recursive: true });
  mkdirSync(cwd);
  writeFileSync(
    join(config, "settings.json"),
    JSON.stringify({
      schema_version: 1,
      model: "synthetic-model",
      endpoint_transport: { base_url: `http://127.0.0.1:${server.address().port}`, auth: "bearer" },
    }),
    { mode: 0o600 },
  );
  writeFileSync(
    join(config, "auth.json"),
    JSON.stringify({ schema_version: 1, providers: { meta: { api_key: "dummy-repro-key" } } }),
    { mode: 0o600 },
  );
  emit({
    version: execFileSync(binary, ["--version"], { env, encoding: "utf8", timeout: 5000 }).trim(),
    sdk: "0.1.1",
    count,
    concurrency,
  });
  await batch("empty-single", 1);
  await batch("empty-concurrent", concurrency);
  for (let i = 0; i < count; i++) {
    const dir = join(data, "sessions", "2026", "09", "14", String(i).padStart(32, "0"));
    mkdirSync(join(dir, "tool-outputs"), { recursive: true });
    for (const file of ["cli-synthetic.log", "session.jsonl", "tool-outputs/synthetic.txt"])
      writeFileSync(join(dir, file), "");
  }
  await batch("sessions-single", 1);
  await batch("sessions-concurrent", concurrency);
  renameSync(join(data, "sessions"), join(data, "unrelated"));
  await batch("same-files-outside-sessions", 1);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  rmSync(root, { recursive: true, force: true });
  emit({ httpRequests, modelTurnsSubmitted: 0 });
}
