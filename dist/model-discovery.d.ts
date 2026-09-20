import { type Connection } from "@muse-code/sdk";
import type { Logger } from "./logger.js";
export interface DiscoveredModel {
    id: string;
    name: string;
    description?: string;
    providerId?: string;
    profileId?: string | null;
    isDefault?: boolean;
}
export type ModelDiscoveryResult = {
    status: "available";
    models: readonly DiscoveredModel[];
    source: string;
} | {
    status: "fallback";
    models: readonly [];
    reason: string;
};
export interface ModelDiscoveryOptions {
    env: Record<string, string | undefined>;
    museBinary?: string;
    logger: Logger;
    timeoutMs?: number;
    ttlMs?: number;
    maxEntries?: number;
}
/** Coalesce on the owned connection; cancelling a waiter never closes that host. */
export declare function readModelCatalog(connection: Connection, signal?: AbortSignal): Promise<ModelDiscoveryResult>;
/** Per-agent bounded discovery cache. Keys contain only hashes, never credentials. */
export declare class MuseModelDiscovery {
    private readonly options;
    private readonly cache;
    private readonly pending;
    private readonly closers;
    private disposed;
    private disposal?;
    private readonly capacity;
    constructor(options: ModelDiscoveryOptions);
    peek(cwd: string, env?: Record<string, string | undefined>): ModelDiscoveryResult;
    remember(cwd: string, env: Record<string, string | undefined>, result: ModelDiscoveryResult): void;
    discover(cwd: string, overrideEnv?: Record<string, string | undefined>): Promise<ModelDiscoveryResult>;
    private store;
    dispose(): Promise<void>;
    private query;
}
//# sourceMappingURL=model-discovery.d.ts.map