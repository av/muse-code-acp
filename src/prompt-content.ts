import { decodeImage, IMAGE_EXTENSIONS } from "./prompt-images.js";
import { ContentBlock, PromptRequest, RequestError } from "@agentclientprotocol/sdk";

/** Muse turn input text part. */
export type MuseTextInputPart = { type: "text"; text: string };
export type MuseInputPart =
  MuseTextInputPart | { type: "image"; base64Data: string; mediaType: string };

/**
 * Lossless text encoding for ACP `resource_link` blocks. Muse's turn input
 * only declares `text` | `image`, so resource links travel as ordered text
 * parts that preserve name/uri/description/title/mimeType without fetching.
 */
export function formatResourceLink(
  block: Extract<ContentBlock, { type: "resource_link" }>,
): string {
  return `Resource link: ${JSON.stringify({
    name: block.name,
    uri: block.uri,
    title: block.title,
    description: block.description,
    mimeType: block.mimeType,
    size: block.size,
    annotations: block.annotations,
    _meta: block._meta,
  })}`;
}

/** Bound the total serialized embedded context, including metadata, per prompt. */
export const MAX_EMBEDDED_CONTEXT_BYTES = 64 * 1024;

/** JSON framing prevents resource text or URI newlines from spoofing boundaries. */
export function formatEmbeddedTextResource(
  block: Extract<ContentBlock, { type: "resource" }>,
): string {
  const resource = block.resource;
  if (
    !resource ||
    typeof resource !== "object" ||
    "blob" in resource ||
    !("text" in resource) ||
    typeof resource.text !== "string" ||
    typeof resource.uri !== "string" ||
    !resource.uri.trim() ||
    (resource.mimeType !== undefined &&
      resource.mimeType !== null &&
      typeof resource.mimeType !== "string")
  ) {
    throw RequestError.invalidParams(
      undefined,
      "embedded resources require a nonempty URI and text; binary/blob resources are unsupported",
    );
  }
  return `Embedded text resource: ${JSON.stringify({
    resource: {
      uri: resource.uri,
      mimeType: resource.mimeType,
      text: resource.text,
      _meta: resource._meta,
    },
    annotations: block.annotations,
    _meta: block._meta,
  })}`;
}

export type PromptConversion =
  { ok: true; parts: MuseInputPart[]; text: string } | { ok: false; error: RequestError };

/**
 * Convert ACP prompt content into Muse turn input and a legacy exec string.
 * Baseline ACP requires text + resource_link; images use inline MSP parts; embedded text uses attributed JSON; audio and binary resources are rejected.
 */
export function convertPromptContent(
  blocks: PromptRequest["prompt"],
  { allowEmptyText = false }: { allowEmptyText?: boolean } = {},
): PromptConversion {
  if (blocks.length === 0) {
    return {
      ok: false,
      error: RequestError.invalidParams(undefined, "prompt contains no content"),
    };
  }

  const parts: MuseInputPart[] = [];
  let embeddedBytes = 0;
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        parts.push({ type: "text", text: block.text });
        break;
      case "resource_link":
        parts.push({ type: "text", text: formatResourceLink(block) });
        break;
      case "image": {
        const mediaType = block.mimeType.trim().toLowerCase();
        if (!IMAGE_EXTENSIONS.has(mediaType))
          return {
            ok: false,
            error: RequestError.invalidParams(
              undefined,
              "supported MIME types: image/png, image/jpeg, image/gif, image/webp",
            ),
          };
        try {
          parts.push({
            type: "image",
            mediaType,
            base64Data: decodeImage(block.data).toString("base64"),
          });
        } catch (error) {
          return { ok: false, error: error as RequestError };
        }
        break;
      }
      case "resource": {
        try {
          const text = formatEmbeddedTextResource(block);
          embeddedBytes += Buffer.byteLength(text, "utf8");
          if (embeddedBytes > MAX_EMBEDDED_CONTEXT_BYTES) {
            throw RequestError.invalidParams(
              undefined,
              `embedded context exceeds ${MAX_EMBEDDED_CONTEXT_BYTES} serialized UTF-8 bytes per prompt`,
            );
          }
          parts.push({ type: "text", text });
        } catch (error) {
          return { ok: false, error: error as RequestError };
        }
        break;
      }
      case "audio":
        return {
          ok: false,
          error: RequestError.invalidParams(
            undefined,
            `unsupported prompt content type: ${block.type}; this agent accepts text, resource_link, embedded text resources and image`,
          ),
        };
      default:
        return {
          ok: false,
          error: RequestError.invalidParams(
            undefined,
            `unsupported prompt content type: ${(block as { type: string }).type}`,
          ),
        };
    }
  }

  const text = parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n")
    .trim();
  if (!allowEmptyText && text.length === 0 && !parts.some((part) => part.type === "image")) {
    return {
      ok: false,
      error: RequestError.invalidParams(
        undefined,
        "prompt contains no text, resource_link or embedded text content",
      ),
    };
  }
  return { ok: true, parts, text };
}
