import { modelChoice } from "./config-options.js";
import { RECOMMENDATION_EXTENSION } from "./client-provider.js";
/** Recommendations refer to the displayed catalog snapshot and never apply a change. */
export function configRecommendations(options, discovery, hostVersion) {
    const preferred = discovery?.status === "available"
        ? discovery.models.find((model) => model.isDefault)
        : undefined;
    return options.map((option) => {
        if (option.type !== "select" || (option.id !== "model" && option.id !== "reasoningEffort"))
            return option;
        const availablePreferred = preferred &&
            option.options.some((choice) => "value" in choice && choice.value === modelChoice(preferred))
            ? preferred
            : undefined;
        const recommendation = option.id === "model"
            ? {
                value: availablePreferred ? modelChoice(availablePreferred) : option.currentValue,
                source: availablePreferred
                    ? discovery?.status === "available"
                        ? discovery.source
                        : "unknown"
                    : "retainedSelection",
                applied: false,
            }
            : hostVersion === "1.1.1"
                ? {
                    status: "unavailable",
                    reason: "Main provider effort is omitted by this host",
                    applied: false,
                }
                : {
                    value: option.currentValue,
                    source: "retainedRequestedEffort",
                    applied: false,
                    effectiveMapping: hostVersion === "1.2.1" ? { none: "minimal", ultra: "max" } : "unverified",
                    modelRestrictions: "unknown",
                };
        return { ...option, _meta: { [RECOMMENDATION_EXTENSION]: recommendation } };
    });
}
