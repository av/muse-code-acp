import { z } from "zod";
import { RequestError, } from "@agentclientprotocol/sdk";
import { convertPromptContent } from "./prompt-content.js";
export const COMPAT_STEER_METHOD = "_session/steering";
export function supportsCompatibleSteering(capabilities) {
    const value = capabilities._meta?.steering;
    return (value === true ||
        (!!value && typeof value === "object" && value.supported === true));
}
export const STEER_METHOD = "_muse/steer";
export const STEERING_CAPABILITY = "muse/steering";
export function supportsSteering(capabilities) {
    return (capabilities._meta?.[STEERING_CAPABILITY] === 1 || supportsCompatibleSteering(capabilities));
}
const block = z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string() }).passthrough(),
    z.object({ type: z.literal("image"), mimeType: z.string(), data: z.string() }).passthrough(),
    z.object({ type: z.literal("resource_link"), name: z.string(), uri: z.string() }).passthrough(),
    z
        .object({
        type: z.literal("resource"),
        resource: z.union([
            z.object({ uri: z.string(), text: z.string() }).passthrough(),
            z.object({ uri: z.string(), blob: z.string(), mimeType: z.string() }).passthrough(),
        ]),
    })
        .passthrough(),
]);
const request = z.object({
    sessionId: z.string().min(1),
    expectedTurnId: z.string().min(1),
    prompt: z.array(block).min(1),
});
export function parseSteeringRequest(raw) {
    const parsed = request.safeParse(raw);
    if (!parsed.success)
        throw RequestError.invalidParams(undefined, "steering requires sessionId, expectedTurnId and supported prompt content");
    const { sessionId, expectedTurnId, prompt } = parsed.data;
    const converted = convertPromptContent(prompt);
    if (!converted.ok)
        throw converted.error;
    return { sessionId, expectedTurnId, input: converted.parts };
}
export function parseCompatibleSteering(raw) {
    const parsed = request
        .omit({ expectedTurnId: true })
        .extend({ expectedTurnId: z.string().min(1).optional() })
        .safeParse(raw);
    if (!parsed.success)
        throw RequestError.invalidParams(undefined, "steering requires sessionId and supported prompt content");
    const converted = convertPromptContent(parsed.data.prompt);
    if (!converted.ok)
        throw converted.error;
    return {
        sessionId: parsed.data.sessionId,
        expectedTurnId: parsed.data.expectedTurnId,
        input: converted.parts,
    };
}
