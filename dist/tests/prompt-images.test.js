import { methods, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeImage, IMAGE_EXTENSIONS } from "../prompt-images.js";
import { capturingLogger, connectTestClient, fakeMuseBinary, newTestSession } from "./helpers.js";
function capturePath() {
    return join(mkdtempSync(join(tmpdir(), "muse-content-capture-")), "capture.json");
}
function fakeClient(capture, mode = "exit0") {
    return connectTestClient({
        backend: "exec",
        museBinary: fakeMuseBinary(),
        env: {
            ...process.env,
            FAKE_MUSE_ARGV_CAPTURE: capture,
            FAKE_MUSE_MODE: mode,
        },
    });
}
function readCapture(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
describe("ACP prompt content", () => {
    it("advertises images and embedded text without claiming audio", async () => {
        const testClient = fakeClient(capturePath());
        const ctx = await testClient.connect();
        const response = await ctx.request(methods.agent.initialize, {
            protocolVersion: PROTOCOL_VERSION,
        });
        expect(response.agentCapabilities?.promptCapabilities).toEqual({
            image: true,
            embeddedContext: true,
        });
    });
    it("stages supported images privately and removes them after the turn", async () => {
        const capture = capturePath();
        const testClient = fakeClient(capture);
        const { ctx, sessionId } = await newTestSession(testClient);
        const data = Buffer.from("image bytes").toString("base64");
        await ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [
                { type: "image", data, mimeType: "image/png" },
                { type: "image", data, mimeType: "image/jpeg" },
                { type: "image", data, mimeType: "image/gif" },
                { type: "image", data, mimeType: "image/webp" },
                { type: "text", text: "Describe the images." },
            ],
        });
        const result = readCapture(capture);
        expect(result.directoryMode).toBe(0o700);
        expect(result.images.map((image) => image.mode)).toEqual([0o600, 0o600, 0o600, 0o600]);
        expect(result.images.map((image) => image.data)).toEqual([data, data, data, data]);
        expect(result.images.map((image) => image.path.slice(image.path.lastIndexOf(".")))).toEqual([
            ".png",
            ".jpg",
            ".gif",
            ".webp",
        ]);
        expect(result.images.every((image) => !existsSync(image.path))).toBe(true);
        expect(result.argv.at(-1)).toBe("Describe the images.");
    });
    it("reserves the session while image files are being staged", async () => {
        const testClient = fakeClient(capturePath());
        const { sessionId } = await newTestSession(testClient);
        const first = testClient.agent.prompt({
            sessionId,
            prompt: [
                { type: "image", data: "YQ==", mimeType: "image/png" },
                { type: "text", text: "First prompt." },
            ],
        });
        await expect(testClient.agent.prompt({
            sessionId,
            prompt: [{ type: "text", text: "Second prompt." }],
        })).rejects.toMatchObject({
            code: -32600,
            message: expect.stringMatching(/already has a prompt/),
        });
        await expect(first).resolves.toEqual({ stopReason: "end_turn" });
    });
    it("honors cancellation while image files are being staged", async () => {
        const capture = capturePath();
        const testClient = fakeClient(capture);
        const { sessionId } = await newTestSession(testClient);
        const prompt = testClient.agent.prompt({
            sessionId,
            prompt: [
                { type: "image", data: "YQ==", mimeType: "image/png" },
                { type: "text", text: "Cancel before spawn." },
            ],
        });
        await testClient.agent.cancel({ sessionId });
        await expect(prompt).resolves.toEqual({ stopReason: "cancelled" });
        expect(existsSync(capture)).toBe(false);
    });
    it.each([
        {
            name: "audio",
            block: { type: "audio", data: "YQ==", mimeType: "audio/wav" },
            message: /unsupported prompt content type: audio/,
        },
        {
            name: "embedded resource",
            block: {
                type: "resource",
                resource: { uri: "file:///context.bin", blob: "YQ==" },
            },
            message: /embedded.*text|binary/i,
        },
        {
            name: "unsupported image MIME",
            block: { type: "image", data: "YQ==", mimeType: "image/bmp" },
            message: /supported MIME types/,
        },
        {
            name: "invalid image base64",
            block: { type: "image", data: "not base64!", mimeType: "image/png" },
            message: /invalid base64 data/,
        },
    ])("rejects $name before spawning Muse", async ({ block, message }) => {
        const lines = [];
        const testClient = connectTestClient({
            backend: "exec",
            museBinary: fakeMuseBinary(),
            env: { ...process.env, FAKE_MUSE_MODE: "exit0" },
        }, capturingLogger(lines));
        const { ctx, sessionId } = await newTestSession(testClient);
        await expect(ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "text", text: "Use this." }, block],
        })).rejects.toMatchObject({ code: -32602, message });
        expect(lines.some((line) => line.includes("muse-exec spawn"))).toBe(false);
    });
    it("rejects image-only prompts with the native Muse requirement", async () => {
        const testClient = fakeClient(capturePath());
        const { ctx, sessionId } = await newTestSession(testClient);
        await expect(ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [{ type: "image", data: "YQ==", mimeType: "image/png" }],
        })).rejects.toMatchObject({
            code: -32602,
            message: expect.stringMatching(/requires text or a resource link alongside image content/),
        });
    });
    it("removes staged images when the Muse child fails", async () => {
        const capture = capturePath();
        const testClient = fakeClient(capture, "exit1");
        const { ctx, sessionId } = await newTestSession(testClient);
        await expect(ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [
                { type: "image", data: "YQ==", mimeType: "image/png" },
                { type: "text", text: "Fail after staging." },
            ],
        })).rejects.toMatchObject({ code: -32603 });
        const [image] = readCapture(capture).images;
        if (!image) {
            throw new Error("fake Muse did not capture the staged image");
        }
        expect(existsSync(dirname(image.path))).toBe(false);
    });
    it("removes staged images when the Muse process cannot spawn", async () => {
        const lines = [];
        const testClient = connectTestClient({
            backend: "exec",
            museBinary: join(tmpdir(), "missing-muse-binary"),
            env: { ...process.env },
        }, capturingLogger(lines));
        const { ctx, sessionId } = await newTestSession(testClient);
        await expect(ctx.request(methods.agent.session.prompt, {
            sessionId,
            prompt: [
                { type: "image", data: "YQ==", mimeType: "image/png" },
                { type: "text", text: "Fail before starting." },
            ],
        })).rejects.toMatchObject({ code: -32603 });
        const spawnLine = lines.find((line) => line.includes("muse-exec spawn"));
        const imagePath = spawnLine?.match(/--image (\S+)/u)?.[1];
        if (!imagePath) {
            throw new Error("spawn diagnostics did not include the staged image path");
        }
        expect(existsSync(dirname(imagePath))).toBe(false);
    });
});
describe("IMAGE_EXTENSIONS", () => {
    it("maps the supported MIME types to file extensions", () => {
        expect([...IMAGE_EXTENSIONS.entries()].sort()).toEqual([
            ["image/gif", "gif"],
            ["image/jpeg", "jpg"],
            ["image/png", "png"],
            ["image/webp", "webp"],
        ]);
    });
});
describe("decodeImage", () => {
    it("round-trips valid base64 data", () => {
        const decoded = decodeImage(Buffer.from("hello-png").toString("base64"));
        expect(decoded.toString()).toBe("hello-png");
    });
    it("ignores whitespace in the payload", () => {
        const encoded = Buffer.from("hello-png").toString("base64");
        const spaced = `${encoded.slice(0, 4)} \n ${encoded.slice(4)}`;
        expect(decodeImage(spaced).toString()).toBe("hello-png");
    });
    it("rejects empty data", () => {
        expect(() => decodeImage("")).toThrow(/unsupported ACP prompt content: image.*invalid base64/);
    });
    it("rejects lengths that cannot be base64", () => {
        expect(() => decodeImage("a")).toThrow(/invalid base64/);
    });
    it("rejects non-base64 characters", () => {
        expect(() => decodeImage("!!!")).toThrow(/invalid base64/);
    });
    it("rejects payloads that do not round-trip canonically", () => {
        expect(() => decodeImage("ab")).toThrow(/invalid base64/);
    });
});
