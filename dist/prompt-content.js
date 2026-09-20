import { decodeImage, IMAGE_EXTENSIONS } from "./prompt-images.js";
import { RequestError } from "@agentclientprotocol/sdk";
/**
 * Lossless text encoding for ACP `resource_link` blocks. Muse's turn input
 * only declares `text` | `image`, so resource links travel as ordered text
 * parts that preserve name/uri/description/title/mimeType without fetching.
 */
export function formatResourceLink(block) {
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
export const MAX_IMAGE_INPUT_BYTES = 6 * 1024 * 1024;
/** JSON framing prevents resource text or URI newlines from spoofing boundaries. */
export function formatEmbeddedTextResource(block) {
    const resource = block.resource;
    if (!resource ||
        typeof resource !== "object" ||
        "blob" in resource ||
        !("text" in resource) ||
        typeof resource.text !== "string" ||
        typeof resource.uri !== "string" ||
        !resource.uri.trim() ||
        (resource.mimeType !== undefined &&
            resource.mimeType !== null &&
            typeof resource.mimeType !== "string")) {
        throw RequestError.invalidParams(undefined, "embedded resources require a nonempty URI and text; binary/blob resources are unsupported");
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
/**
 * Convert ACP prompt content into Muse turn input and a legacy exec string.
 * Baseline ACP requires text + resource_link; images use inline MSP parts; embedded text uses attributed JSON; embedded blobs use attributed image parts or explicitly encoded bytes; audio and semantic document decoding are unavailable.
 */
export function convertPromptContent(blocks, { allowEmptyText = false } = {}) {
    if (blocks.length === 0) {
        return {
            ok: false,
            error: RequestError.invalidParams(undefined, "prompt contains no content"),
        };
    }
    const parts = [];
    let embeddedBytes = 0;
    let imageBytes = 0;
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
                        error: RequestError.invalidParams(undefined, "supported MIME types: image/png, image/jpeg, image/gif, image/webp"),
                    };
                try {
                    if (block.data.length > MAX_IMAGE_INPUT_BYTES * 2)
                        throw RequestError.invalidParams(undefined, "Image input exceeds the 6 MiB prompt limit");
                    const bytes = decodeImage(block.data);
                    imageBytes += bytes.length;
                    if (imageBytes > MAX_IMAGE_INPUT_BYTES)
                        throw RequestError.invalidParams(undefined, "Image input exceeds the 6 MiB prompt limit");
                    parts.push({ type: "image", mediaType, base64Data: bytes.toString("base64") });
                }
                catch (error) {
                    return { ok: false, error: error };
                }
                break;
            }
            case "resource": {
                try {
                    const resource = block.resource;
                    if (!resource || typeof resource !== "object")
                        throw RequestError.invalidParams(undefined, "Embedded resource must be an object");
                    let text;
                    let image;
                    if ("blob" in resource) {
                        if ("text" in resource ||
                            typeof resource.uri !== "string" ||
                            !resource.uri.trim() ||
                            typeof resource.blob !== "string" ||
                            typeof resource.mimeType !== "string")
                            throw RequestError.invalidParams(undefined, "Binary resources require a URI, MIME type and base64 blob only");
                        const mimeType = resource.mimeType.trim().toLowerCase();
                        const isImage = IMAGE_EXTENSIONS.has(mimeType);
                        if (!isImage && !["application/octet-stream", "text/plain"].includes(mimeType))
                            throw RequestError.invalidParams(undefined, "Binary resources support images, text/plain and application/octet-stream; document decoding is unavailable");
                        if (resource.blob.length >
                            (isImage ? MAX_IMAGE_INPUT_BYTES * 2 : MAX_EMBEDDED_CONTEXT_BYTES))
                            throw RequestError.invalidParams(undefined, "Embedded binary resource exceeds its input limit");
                        const bytes = decodeImage(resource.blob);
                        text = `Embedded ${isImage ? "image" : "binary"} resource: ${JSON.stringify({ uri: resource.uri, mimeType, encoding: isImage ? "following image part" : "base64", ...(isImage ? {} : { blob: bytes.toString("base64"), semantics: "Encoded bytes only; not decoded document content" }), annotations: block.annotations, _meta: block._meta, resourceMeta: resource._meta })}`;
                        if (isImage) {
                            imageBytes += bytes.length;
                            if (imageBytes > MAX_IMAGE_INPUT_BYTES)
                                throw RequestError.invalidParams(undefined, "Image input exceeds the 6 MiB prompt limit");
                            image = { type: "image", mediaType: mimeType, base64Data: bytes.toString("base64") };
                        }
                    }
                    else
                        text = formatEmbeddedTextResource(block);
                    embeddedBytes += Buffer.byteLength(text, "utf8");
                    if (embeddedBytes > MAX_EMBEDDED_CONTEXT_BYTES) {
                        throw RequestError.invalidParams(undefined, `embedded context exceeds ${MAX_EMBEDDED_CONTEXT_BYTES} serialized UTF-8 bytes per prompt`);
                    }
                    parts.push({ type: "text", text });
                    if (image)
                        parts.push(image);
                }
                catch (error) {
                    return { ok: false, error: error };
                }
                break;
            }
            case "audio":
                return {
                    ok: false,
                    error: RequestError.invalidParams(undefined, `unsupported prompt content type: ${block.type}; this agent accepts text, resource_link, embedded text resources and image`),
                };
            default:
                return {
                    ok: false,
                    error: RequestError.invalidParams(undefined, `unsupported prompt content type: ${block.type}`),
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
            error: RequestError.invalidParams(undefined, "prompt contains no text, resource_link or embedded text content"),
        };
    }
    return { ok: true, parts, text };
}
