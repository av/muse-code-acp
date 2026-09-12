import { RequestError, SessionConfigOption } from "@agentclientprotocol/sdk";
import type { ModelDiscoveryResult } from "./model-discovery.js";
import { MuseSettings } from "./muse-settings.js";

export const MODEL_CONFIG_ID = "model";
export const EFFORT_CONFIG_ID = "reasoningEffort";

/**
 * Legacy exec compatibility list. SDK choices come from public model/list;
 * the current configured or restored model remains selectable in either case.
 */
export const KNOWN_MODELS = ["muse-spark-1.2", "muse-spark-1.2-contributor"];
export const EFFORT_LEVELS = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "ultra",
] as const;
export type MuseReasoningEffort = (typeof EFFORT_LEVELS)[number];
export function isReasoningEffort(value: unknown): value is MuseReasoningEffort {
  return typeof value === "string" && (EFFORT_LEVELS as readonly string[]).includes(value);
}

const DEFAULT_MODEL = "muse-spark-1.2";
const DEFAULT_EFFORT = "high";

export interface SessionConfig {
  model: string;
  reasoningEffort: string;
}

/** Resolution order: user muse settings > built-in defaults. */
export function defaultSessionConfig(settings: MuseSettings): SessionConfig {
  return {
    model: settings.model ?? DEFAULT_MODEL,
    reasoningEffort: isReasoningEffort(settings.reasoningEffort)
      ? settings.reasoningEffort
      : DEFAULT_EFFORT,
  };
}

export function buildConfigOptions(
  config: SessionConfig,
  backend: "sdk" | "exec" = "exec",
  discovery?: ModelDiscoveryResult,
): SessionConfigOption[] {
  const discovered =
    backend === "sdk"
      ? discovery?.status === "available"
        ? discovery.models
        : []
      : KNOWN_MODELS.map((id) => ({ id, name: id }));
  const models = discovered.some((model) => model.id === config.model)
    ? discovered
    : [{ id: config.model, name: config.model }, ...discovered];
  return [
    {
      id: MODEL_CONFIG_ID,
      name: "Model",
      category: "model",
      type: "select",
      currentValue: config.model,
      description:
        backend === "sdk"
          ? discovery?.status === "available"
            ? `Muse model catalog (${discovery.source}); current selection is retained.`
            : "Model discovery unavailable; showing the current configured or restored model."
          : "Legacy exec model choices.",
      options: models.map((model) => ({ value: model.id, name: model.name })),
    },
    {
      id: EFFORT_CONFIG_ID,
      name: "Reasoning effort",
      category: "thought_level",
      type: "select",
      currentValue: config.reasoningEffort,
      options: EFFORT_LEVELS.map((effort) => ({
        value: effort,
        name: effort,
      })),
    },
  ];
}

/** Validates and applies one set_config_option selection. */
export function applyConfigSelection(
  config: SessionConfig,
  configId: string,
  value: unknown,
): SessionConfig {
  if (typeof value !== "string") {
    throw RequestError.invalidParams(undefined, `config ${configId} expects a select value`);
  }
  switch (configId) {
    case MODEL_CONFIG_ID:
      return { ...config, model: value };
    case EFFORT_CONFIG_ID:
      if (!isReasoningEffort(value)) {
        throw RequestError.invalidParams(undefined, `unknown reasoning effort: ${value}`);
      }
      return { ...config, reasoningEffort: value };
    default:
      throw RequestError.invalidParams(undefined, `unknown config option: ${configId}`);
  }
}
