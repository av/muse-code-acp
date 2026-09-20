import { SessionConfigOption } from "@agentclientprotocol/sdk";
import type { DiscoveredModel, ModelDiscoveryResult } from "./model-discovery.js";
import { MuseSettings } from "./muse-settings.js";
export declare const MODEL_CONFIG_ID = "model";
export declare const EFFORT_CONFIG_ID = "reasoningEffort";
/**
 * Legacy exec compatibility list. SDK choices come from public model/list;
 * the current configured or restored model remains selectable in either case.
 */
export declare const KNOWN_MODELS: string[];
export declare const EFFORT_LEVELS: readonly ["none", "minimal", "low", "medium", "high", "xhigh", "ultra"];
export type MuseReasoningEffort = (typeof EFFORT_LEVELS)[number];
export declare function isReasoningEffort(value: unknown): value is MuseReasoningEffort;
export interface SessionConfig {
    safety?: import("./safety-settings.js").SafetySettings;
    model: string;
    providerId?: string;
    profileId?: string | null;
    reasoningEffort: string;
}
/** Resolution order: user muse settings > built-in defaults. */
export declare function defaultSessionConfig(settings: MuseSettings): SessionConfig;
export declare function buildConfigOptions(config: SessionConfig, backend?: "sdk" | "exec", discovery?: ModelDiscoveryResult, hostVersion?: string | null): SessionConfigOption[];
/** Validates and applies one set_config_option selection. */
export declare function applyConfigSelection(config: SessionConfig, configId: string, value: unknown, discovery?: ModelDiscoveryResult): SessionConfig;
/** Provider/profile-qualified values are opaque ACP choices, never model IDs on MSP. */
export declare function modelChoice(model: DiscoveredModel): string;
export declare function selectModel(config: SessionConfig, value: string, discovery?: ModelDiscoveryResult): SessionConfig;
export declare function effortDescription(backend: "sdk" | "exec", hostVersion?: string | null): string;
export declare function resolvedModel(config: SessionConfig, discovery: ModelDiscoveryResult | undefined, defaultProvider?: string): {
    model: string;
    providerId: string;
    profileId?: string | null;
};
//# sourceMappingURL=config-options.d.ts.map