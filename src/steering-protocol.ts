import { z } from "zod";
import {
  RequestError,
  type ClientCapabilities,
  type PromptRequest,
} from "@agentclientprotocol/sdk";
import { convertPromptContent } from "./prompt-content.js";

export const STEER_METHOD = "_muse/steer";
export const STEERING_CAPABILITY = "muse/steering";
export function supportsSteering(capabilities: ClientCapabilities): boolean {
  return capabilities._meta?.[STEERING_CAPABILITY] === 1;
}

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }).passthrough(),
  z.object({ type: z.literal("image"), mimeType: z.string(), data: z.string() }).passthrough(),
  z.object({ type: z.literal("resource_link"), name: z.string(), uri: z.string() }).passthrough(),
  z
    .object({
      type: z.literal("resource"),
      resource: z.object({ uri: z.string(), text: z.string() }).passthrough(),
    })
    .passthrough(),
]);
const request = z.object({
  sessionId: z.string().min(1),
  expectedTurnId: z.string().min(1),
  prompt: z.array(block).min(1),
});
export function parseSteeringRequest(raw: unknown) {
  const parsed = request.safeParse(raw);
  if (!parsed.success)
    throw RequestError.invalidParams(
      undefined,
      "steering requires sessionId, expectedTurnId and supported prompt content",
    );
  const { sessionId, expectedTurnId, prompt } = parsed.data;
  const converted = convertPromptContent(prompt as PromptRequest["prompt"]);
  if (!converted.ok) throw converted.error;
  return { sessionId, expectedTurnId, input: converted.parts };
}
