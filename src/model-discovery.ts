import { spawnMspConnection } from "@muse-code/sdk";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import packageJson from "../package.json" with { type: "json" };
import type { Logger } from "./logger.js";
import { museAuthJsonPath } from "./auth.js";
import { museCliPath } from "./muse-cli.js";
import { museSettingsPath } from "./muse-settings.js";

export interface DiscoveredModel {
  id: string;
  name: string;
  description?: string;
}
export type ModelDiscoveryResult =
  | { status: "available"; models: readonly DiscoveredModel[]; source: string }
  | { status: "fallback"; models: readonly []; reason: string };

export interface ModelDiscoveryOptions {
  env: Record<string, string | undefined>;
  museBinary?: string;
  logger: Logger;
  timeoutMs?: number;
  ttlMs?: number;
  maxEntries?: number;
}

const fallback = (reason: string): ModelDiscoveryResult => ({
  status: "fallback",
  models: [],
  reason,
});

function parseCatalog(value: unknown): ModelDiscoveryResult {
  if (!value || typeof value !== "object") throw new Error("malformed model/list response");
  const { models, source } = value as Record<string, unknown>;
  if (
    !Array.isArray(models) ||
    models.length > 1000 ||
    typeof source !== "string" ||
    !source.trim()
  ) {
    throw new Error("malformed model/list catalog");
  }
  const ids = new Set<string>();
  const result = models.map((row: unknown): DiscoveredModel => {
    if (!row || typeof row !== "object") throw new Error("malformed model/list row");
    const { modelId, displayLabel, description } = row as Record<string, unknown>;
    if (
      typeof modelId !== "string" ||
      !modelId.trim() ||
      typeof displayLabel !== "string" ||
      !displayLabel.trim() ||
      (description != null && typeof description !== "string") ||
      ids.has(modelId)
    ) {
      throw new Error("malformed or duplicate model/list row");
    }
    ids.add(modelId);
    return Object.freeze({
      id: modelId,
      name: displayLabel,
      ...(typeof description === "string" ? { description } : {}),
    });
  });
  return Object.freeze({ status: "available", models: Object.freeze(result), source });
}

/** Per-agent bounded discovery cache. Keys contain only hashes, never credentials. */
export class MuseModelDiscovery {
  private readonly cache = new Map<string, { until: number; result: ModelDiscoveryResult }>();
  private readonly pending = new Map<string, Promise<ModelDiscoveryResult>>();
  private readonly closers = new Set<() => Promise<void>>();
  private disposed = false;
  private disposal?: Promise<void>;
  private readonly capacity: number;

  constructor(private readonly options: ModelDiscoveryOptions) {
    this.capacity = Math.max(1, Math.min(32, options.maxEntries ?? 4));
  }

  async discover(cwd: string): Promise<ModelDiscoveryResult> {
    if (this.disposed) return fallback("Model discovery is disposed");
    try {
      const env = { ...this.options.env };
      const binary = realpathSync(this.options.museBinary ?? museCliPath(env));
      const workspace = realpathSync(cwd);
      const info = statSync(binary);
      const hash = createHash("sha256");
      hash.update(
        JSON.stringify([
          binary,
          info.size,
          info.mtimeMs,
          info.ctimeMs,
          workspace,
          Object.entries(env).sort(([a], [b]) => a.localeCompare(b)),
        ]),
      );
      for (const path of [museSettingsPath(env), museAuthJsonPath(env)]) {
        hash.update(path);
        try {
          const content = readFileSync(path);
          hash.update(String(content.length));
          hash.update(content);
        } catch {
          hash.update("unavailable");
        }
      }
      const key = hash.digest("hex");
      const cached = this.cache.get(key);
      if (cached && cached.until > Date.now()) {
        this.cache.delete(key);
        this.cache.set(key, cached);
        return cached.result;
      }
      this.cache.delete(key);
      const inFlight = this.pending.get(key);
      if (inFlight) return inFlight;
      if (this.pending.size >= this.capacity)
        return fallback("Model discovery concurrency limit reached");
      const work = this.query(binary, workspace, env)
        .then((result) => {
          if (!this.disposed) {
            while (this.cache.size >= this.capacity)
              this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(key, { until: Date.now() + (this.options.ttlMs ?? 30_000), result });
          }
          return result;
        })
        .finally(() => this.pending.delete(key));
      this.pending.set(key, work);
      return work;
    } catch {
      return fallback("Model discovery could not resolve the Muse host or workspace");
    }
  }

  dispose(): Promise<void> {
    if (!this.disposal) {
      this.disposed = true;
      this.cache.clear();
      this.disposal = (async () => {
        await Promise.allSettled([...this.closers].map((close) => close()));
        await Promise.allSettled([...this.pending.values()]);
      })();
    }
    return this.disposal;
  }

  private async query(
    binary: string,
    cwd: string,
    env: Record<string, string | undefined>,
  ): Promise<ModelDiscoveryResult> {
    try {
      const handshake = spawnMspConnection({
        command: binary,
        args: ["serve"],
        cwd,
        env: env as Record<string, string>,
        shutdownTimeoutMs: 1000,
      });
      const close = async () => {
        await handshake.close().catch(() => {});
      };
      this.closers.add(close);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("model discovery timed out")),
            this.options.timeoutMs ?? 5000,
          );
        });
        const query = (async () => {
          const host = await handshake.initialize({
            clientInfo: { name: "muse_code_acp", version: packageJson.version },
          });
          return parseCatalog(await host.connection.request("model/list", {}));
        })();
        return await Promise.race([query, timeout]);
      } finally {
        clearTimeout(timer);
        await close();
        this.closers.delete(close);
      }
    } catch (error) {
      // Avoid exposing host errors, which may contain provider credentials.
      const reason =
        error instanceof Error && error.message === "model discovery timed out"
          ? "Muse model discovery timed out"
          : "Muse model discovery unavailable or malformed";
      this.options.logger.log(reason);
      return fallback(reason);
    }
  }
}
