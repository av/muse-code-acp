import { spawnMspConnection } from "@muse-code/sdk";
import packageJson from "../package.json" with { type: "json" };
import { museHostIdentity } from "./host-identity.js";
const fallback = (reason) => ({
    status: "fallback",
    models: [],
    reason,
});
function parseCatalog(value) {
    if (!value || typeof value !== "object")
        throw new Error("malformed model/list response");
    const { models, source } = value;
    if (!Array.isArray(models) ||
        models.length > 1000 ||
        typeof source !== "string" ||
        !source.trim()) {
        throw new Error("malformed model/list catalog");
    }
    const ids = new Set();
    const result = models.map((row) => {
        if (!row || typeof row !== "object")
            throw new Error("malformed model/list row");
        const { modelId, displayLabel, description, providerId, profileId, isDefault } = row;
        if (typeof modelId !== "string" ||
            !modelId.trim() ||
            typeof displayLabel !== "string" ||
            !displayLabel.trim() ||
            (description != null && typeof description !== "string") ||
            (providerId != null && (typeof providerId !== "string" || !providerId.trim())) ||
            (profileId != null && typeof profileId !== "string") ||
            ids.has(JSON.stringify([providerId ?? null, profileId ?? null, modelId]))) {
            throw new Error("malformed or duplicate model/list row");
        }
        ids.add(JSON.stringify([providerId ?? null, profileId ?? null, modelId]));
        return Object.freeze({
            id: modelId,
            name: displayLabel,
            ...(typeof providerId === "string" ? { providerId } : {}),
            ...(profileId !== undefined ? { profileId: profileId } : {}),
            ...(typeof isDefault === "boolean" ? { isDefault } : {}),
            ...(typeof description === "string" ? { description } : {}),
        });
    });
    return Object.freeze({ status: "available", models: Object.freeze(result), source });
}
const pendingCatalogs = new WeakMap();
/** Coalesce on the owned connection; cancelling a waiter never closes that host. */
export async function readModelCatalog(connection, signal) {
    if (signal?.aborted)
        return fallback("Model discovery cancelled");
    let pending = pendingCatalogs.get(connection);
    if (!pending) {
        pending = queryModelCatalog(connection).finally(() => pendingCatalogs.delete(connection));
        pendingCatalogs.set(connection, pending);
    }
    if (!signal)
        return pending;
    let abort;
    try {
        return await Promise.race([
            pending,
            new Promise((resolve) => {
                abort = () => resolve(fallback("Model discovery cancelled"));
                signal.addEventListener("abort", abort, { once: true });
            }),
        ]);
    }
    finally {
        if (abort)
            signal.removeEventListener("abort", abort);
    }
}
async function queryModelCatalog(connection) {
    let timer;
    try {
        return parseCatalog(await Promise.race([
            connection.request("model/list", {}),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error("catalog deadline")), 5000);
            }),
        ]));
    }
    catch {
        return fallback("Muse model discovery unavailable or malformed");
    }
    finally {
        clearTimeout(timer);
    }
}
/** Per-agent bounded discovery cache. Keys contain only hashes, never credentials. */
export class MuseModelDiscovery {
    options;
    cache = new Map();
    pending = new Map();
    closers = new Set();
    disposed = false;
    disposal;
    capacity;
    constructor(options) {
        this.options = options;
        this.capacity = Math.max(1, Math.min(32, options.maxEntries ?? 4));
    }
    peek(cwd, env = this.options.env) {
        try {
            const key = museHostIdentity(cwd, env, this.options.museBinary, true).identity;
            const entry = this.cache.get(key);
            if (!this.disposed && entry && entry.until > Date.now())
                return entry.result;
        }
        catch {
            /* An unresolved context has no usable catalog. */
        }
        return fallback("Model catalog not loaded; use /models to refresh before a turn");
    }
    remember(cwd, env, result) {
        if (this.disposed)
            return;
        try {
            const key = museHostIdentity(cwd, env, this.options.museBinary, true).identity;
            this.store(key, result);
        }
        catch {
            /* Do not reuse a catalog with an unresolved context. */
        }
    }
    async discover(cwd, overrideEnv) {
        if (this.disposed)
            return fallback("Model discovery is disposed");
        try {
            const env = { ...(overrideEnv ?? this.options.env) };
            const { binary, cwd: workspace, identity: key, } = museHostIdentity(cwd, env, this.options.museBinary, true);
            const cached = this.cache.get(key);
            if (cached && cached.until > Date.now()) {
                this.cache.delete(key);
                this.cache.set(key, cached);
                return cached.result;
            }
            this.cache.delete(key);
            const inFlight = this.pending.get(key);
            if (inFlight)
                return inFlight;
            if (this.pending.size >= this.capacity)
                return fallback("Model discovery concurrency limit reached");
            const work = this.query(binary, workspace, env)
                .then((result) => {
                this.store(key, result);
                return result;
            })
                .finally(() => this.pending.delete(key));
            this.pending.set(key, work);
            return work;
        }
        catch {
            return fallback("Model discovery could not resolve the Muse host or workspace");
        }
    }
    store(key, result) {
        if (this.disposed)
            return;
        this.cache.delete(key);
        while (this.cache.size >= this.capacity)
            this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { until: Date.now() + (this.options.ttlMs ?? 30_000), result });
    }
    dispose() {
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
    async query(binary, cwd, env) {
        try {
            const handshake = spawnMspConnection({
                command: binary,
                args: ["serve"],
                cwd,
                env: env,
                shutdownTimeoutMs: 1000,
            });
            const close = async () => {
                await handshake.close().catch(() => { });
            };
            this.closers.add(close);
            let timer;
            try {
                const timeout = new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error("model discovery timed out")), this.options.timeoutMs ?? 5000);
                });
                const query = (async () => {
                    const host = await handshake.initialize({
                        clientInfo: { name: "muse_code_acp", version: packageJson.version },
                    });
                    return parseCatalog(await host.connection.request("model/list", {}));
                })();
                return await Promise.race([query, timeout]);
            }
            finally {
                clearTimeout(timer);
                await close();
                this.closers.delete(close);
            }
        }
        catch (error) {
            // Avoid exposing host errors, which may contain provider credentials.
            const reason = error instanceof Error && error.message === "model discovery timed out"
                ? "Muse model discovery timed out"
                : "Muse model discovery unavailable or malformed";
            this.options.logger.log(reason);
            return fallback(reason);
        }
    }
}
