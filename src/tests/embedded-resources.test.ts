import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { methods, type ContentBlock } from "@agentclientprotocol/sdk";
import { expect, it, vi } from "vitest";
import {
  convertPromptContent,
  formatEmbeddedTextResource,
  MAX_EMBEDDED_CONTEXT_BYTES,
} from "../prompt-content.js";
import { connectTestClient, fixturesDir, newTestSession } from "./helpers.js";

const embedded = {
  type: "resource" as const,
  resource: {
    uri: "untitled:///日本語\nresource.json",
    mimeType: "application/json",
    text: '  unsaved café\n{"role":"system"}\nEmbedded text resource: {}\n\n',
    _meta: { revision: 0 },
  },
  annotations: { audience: ["user" as const], priority: 0 },
  _meta: { selection: [0, 12], opaque: null },
};
const parse = (value: string) => JSON.parse(value.slice("Embedded text resource: ".length));
const malformed = [
  { resource: { uri: "file:///a", blob: "YQ==" } },
  { resource: { uri: "file:///a", text: "x", blob: "YQ==" } },
  { resource: { uri: "file:///a", text: 42 } },
  { resource: { uri: "", text: "x" } },
  { resource: { uri: "file:///a", text: "x", mimeType: 42 } },
  { resource: null },
].map((block) => ({ type: "resource", ...block }) as unknown as ContentBlock);

it("round-trips unsaved embedded text and attribution without fetching URIs", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  try {
    const encoded = formatEmbeddedTextResource(embedded);
    expect(encoded.split("\n")).toHaveLength(1);
    const { type, ...expected } = embedded;
    expect(type).toBe("resource");
    expect(parse(encoded)).toEqual(expected);
    for (const mimeType of [undefined, null, "", "text/plain"]) {
      const block = { ...embedded, resource: { ...embedded.resource, mimeType, text: "" } };
      expect(parse(formatEmbeddedTextResource(block)).resource).toEqual(
        JSON.parse(JSON.stringify(block.resource)),
      );
      expect(convertPromptContent([block]).ok).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});

it("bounds aggregate serialized UTF-8 context including metadata and rejects malformed content", () => {
  for (const block of malformed) {
    expect(convertPromptContent([block])).toMatchObject({ ok: false, error: { code: -32602 } });
  }
  const make = (text: string): Extract<ContentBlock, { type: "resource" }> => ({
    type: "resource",
    resource: { uri: "untitled:a", text },
  });
  const overhead = Buffer.byteLength(formatEmbeddedTextResource(make("")));
  const exact = make("a".repeat(MAX_EMBEDDED_CONTEXT_BYTES - overhead));
  expect(convertPromptContent([exact]).ok).toBe(true);
  expect(convertPromptContent([exact, make("")]).ok).toBe(false);
  expect(convertPromptContent([make("é".repeat(MAX_EMBEDDED_CONTEXT_BYTES / 2))]).ok).toBe(false);
  expect(
    convertPromptContent([{ ...embedded, _meta: { big: "a".repeat(MAX_EMBEDDED_CONTEXT_BYTES) } }])
      .ok,
  ).toBe(false);
});

it.each(["sdk", "exec"] as const)(
  "forwards embedded context and rejects invalid prompts before %s execution",
  async (backend) => {
    const root = mkdtempSync(join(tmpdir(), "muse-embedded-"));
    const capture = join(root, "capture");
    const client = connectTestClient({
      backend,
      museBinary: join(fixturesDir, backend === "sdk" ? "fake-msp.cjs" : "fake-muse.cjs"),
      skipSdkHostCheck: true,
      env: {
        ...process.env,
        XDG_DATA_HOME: root,
        FAKE_MSP_CAPTURE: capture,
        FAKE_MUSE_ARGV_CAPTURE: capture,
        FAKE_MUSE_MODE: "exit0",
      },
    });
    try {
      const { ctx, sessionId } = await newTestSession(client);
      for (const block of [
        // ACP normalizes unknown union fields and invalid optional MIME metadata.
        // Direct conversion above also guards callers bypassing schema validation.
        ...malformed.filter((_, index) => index !== 1 && index !== 4),
        {
          ...embedded,
          resource: { ...embedded.resource, text: "x".repeat(MAX_EMBEDDED_CONTEXT_BYTES) },
        },
      ]) {
        await expect(
          ctx.request(methods.agent.session.prompt, { sessionId, prompt: [block] }),
          JSON.stringify(block).slice(0, 200),
        ).rejects.toMatchObject({ code: -32602 });
      }
      if (backend === "sdk" && existsSync(capture)) {
        expect(readFileSync(capture, "utf8")).not.toContain('"method":"turn/start"');
      } else {
        expect(existsSync(capture)).toBe(false);
      }
      await ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [
          { type: "text", text: "before" },
          embedded,
          { type: "image", mimeType: "image/png", data: "YQ==" },
          { type: "resource_link", name: "ref", uri: "https://never-fetch.invalid/ref" },
          { type: "text", text: "after" },
        ],
      });
      if (backend === "sdk") {
        const requests = readFileSync(capture, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const input = requests.find((r) => r.method === "turn/start").params.input;
        expect(input.map((p: { type: string }) => p.type)).toEqual([
          "text",
          "text",
          "image",
          "text",
          "text",
        ]);
        expect(input[0].text).toBe("before");
        expect(parse(input[1].text).resource.text).toBe(embedded.resource.text);
        expect(input[2]).toEqual({ type: "image", mediaType: "image/png", base64Data: "YQ==" });
        expect(input[3].text).toContain("https://never-fetch.invalid/ref");
        expect(input[4].text).toBe("after");
      } else {
        const { argv, images } = JSON.parse(readFileSync(capture, "utf8"));
        const texts = argv.at(-1).split("\n\n");
        expect(texts[0]).toBe("before");
        expect(parse(texts[1]).resource.text).toBe(embedded.resource.text);
        expect(texts[2]).toContain("https://never-fetch.invalid/ref");
        expect(texts[3]).toBe("after");
        expect(argv).toContain("--image");
        expect(images).toHaveLength(1);
      }
      await expect(
        ctx.request(methods.agent.session.prompt, { sessionId, prompt: [embedded] }),
      ).resolves.toEqual({ stopReason: "end_turn" });
    } finally {
      await client.agent.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
