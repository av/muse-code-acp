import { RequestError } from "@agentclientprotocol/sdk";
export const IMAGE_EXTENSIONS = new Map([
    ["image/gif", "gif"],
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
]);
function unsupportedContent(type, detail) {
    const suffix = detail ? ` (${detail})` : "";
    return RequestError.invalidParams(undefined, `unsupported ACP prompt content: ${type}${suffix}. ` +
        "Muse Code accepts text, embedded text resources, resource links, and PNG/JPEG/GIF/WebP images.");
}
export function decodeImage(data) {
    const normalized = data.replace(/\s/gu, "");
    if (!normalized || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
        throw unsupportedContent("image", "invalid base64 data");
    }
    const decoded = Buffer.from(normalized, "base64");
    const canonical = normalized.replace(/=+$/u, "");
    if (!decoded.length || decoded.toString("base64").replace(/=+$/u, "") !== canonical) {
        throw unsupportedContent("image", "invalid base64 data");
    }
    return decoded;
}
