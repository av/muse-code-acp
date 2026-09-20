import { ContentBlock, PromptRequest, RequestError } from "@agentclientprotocol/sdk";
/** Muse turn input text part. */
export type MuseTextInputPart = {
    type: "text";
    text: string;
};
export type MuseInputPart = MuseTextInputPart | {
    type: "image";
    base64Data: string;
    mediaType: string;
};
/**
 * Lossless text encoding for ACP `resource_link` blocks. Muse's turn input
 * only declares `text` | `image`, so resource links travel as ordered text
 * parts that preserve name/uri/description/title/mimeType without fetching.
 */
export declare function formatResourceLink(block: Extract<ContentBlock, {
    type: "resource_link";
}>): string;
/** Bound the total serialized embedded context, including metadata, per prompt. */
export declare const MAX_EMBEDDED_CONTEXT_BYTES: number;
export declare const MAX_IMAGE_INPUT_BYTES: number;
/** JSON framing prevents resource text or URI newlines from spoofing boundaries. */
export declare function formatEmbeddedTextResource(block: Extract<ContentBlock, {
    type: "resource";
}>): string;
export type PromptConversion = {
    ok: true;
    parts: MuseInputPart[];
    text: string;
} | {
    ok: false;
    error: RequestError;
};
/**
 * Convert ACP prompt content into Muse turn input and a legacy exec string.
 * Baseline ACP requires text + resource_link; images use inline MSP parts; embedded text uses attributed JSON; embedded blobs use attributed image parts or explicitly encoded bytes; audio and semantic document decoding are unavailable.
 */
export declare function convertPromptContent(blocks: PromptRequest["prompt"], { allowEmptyText }?: {
    allowEmptyText?: boolean;
}): PromptConversion;
//# sourceMappingURL=prompt-content.d.ts.map