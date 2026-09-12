import { ContentBlock, PromptRequest, RequestError } from "@agentclientprotocol/sdk";

/** Muse turn input text part (MSP declares only text | image; we use text). */
export type MuseTextInputPart = { type: "text"; text: string };

/**
 * Lossless text encoding for ACP `resource_link` blocks. Muse's turn input
 * only declares `text` | `image`, so resource links travel as ordered text
 * parts that preserve name/uri/description/title/mimeType without fetching.
 */
export function formatResourceLink(
  block: Extract<ContentBlock, { type: "resource_link" }>,
): string {
  const lines = [`Resource: ${block.name}`, `URI: ${block.uri}`];
  if (block.title) {
    lines.push(`Title: ${block.title}`);
  }
  if (block.description) {
    lines.push(`Description: ${block.description}`);
  }
  if (block.mimeType) {
    lines.push(`MIME: ${block.mimeType}`);
  }
  return lines.join("\n");
}

export type PromptConversion =
  { ok: true; parts: MuseTextInputPart[]; text: string } | { ok: false; error: RequestError };

/**
 * Convert ACP prompt content into Muse turn input and a legacy exec string.
 * Baseline ACP requires text + resource_link; optional image/audio/resource
 * are rejected when present because this adapter does not advertise them.
 */
export function convertPromptContent(blocks: PromptRequest["prompt"]): PromptConversion {
  if (blocks.length === 0) {
    return {
      ok: false,
      error: RequestError.invalidParams(undefined, "prompt contains no content"),
    };
  }

  const parts: MuseTextInputPart[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        parts.push({ type: "text", text: block.text });
        break;
      case "resource_link":
        parts.push({ type: "text", text: formatResourceLink(block) });
        break;
      case "image":
      case "audio":
      case "resource":
        return {
          ok: false,
          error: RequestError.invalidParams(
            undefined,
            `unsupported prompt content type: ${block.type}; this agent advertises only text and resource_link`,
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
    .map((part) => part.text)
    .join("\n\n")
    .trim();
  if (text.length === 0) {
    return {
      ok: false,
      error: RequestError.invalidParams(
        undefined,
        "prompt contains no text or resource_link content",
      ),
    };
  }
  return { ok: true, parts, text };
}
