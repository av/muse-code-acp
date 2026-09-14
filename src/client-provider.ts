import { createHash } from "node:crypto";
import { RequestError } from "@agentclientprotocol/sdk";

export const PROVIDER_EXTENSION = "muse/provider";
export const RECOMMENDATION_EXTENSION = "muse/configRecommendations";
export interface ClientProvider {
  providerId: "meta";
  baseUrl: string;
  apiKey: string;
}
/** An explicit endpoint is never reconstructed from a model name or credential. */
export function parseClientProvider(value: unknown): ClientProvider {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw RequestError.invalidParams(
      undefined,
      "muse/provider expects providerId, baseUrl and apiKey",
    );
  const v = value as Record<string, unknown>;
  if (
    v.providerId !== "meta" ||
    typeof v.baseUrl !== "string" ||
    v.baseUrl.length > 4096 ||
    typeof v.apiKey !== "string" ||
    !v.apiKey.trim() ||
    v.apiKey.length > 16384 ||
    /[\r\n\0]/.test(v.apiKey)
  )
    throw RequestError.invalidParams(
      undefined,
      "Unsupported provider configuration; use providerId meta with an explicit endpoint and nonempty API key",
    );
  let url: URL;
  try {
    url = new URL(v.baseUrl);
  } catch {
    throw RequestError.invalidParams(undefined, "Invalid provider endpoint URL");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw RequestError.invalidParams(
      undefined,
      "Use an HTTP(S) provider URL without embedded credentials, query or fragment",
    );
  return { providerId: "meta", baseUrl: url.toString().replace(/\/$/, ""), apiKey: v.apiKey };
}
export function providerBinding(provider: ClientProvider): string {
  return createHash("sha256")
    .update(JSON.stringify([provider.providerId, provider.baseUrl]))
    .digest("hex");
}
