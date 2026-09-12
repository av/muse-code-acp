import { it, expect, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { methods, type ResourceLink } from "@agentclientprotocol/sdk";
import { formatResourceLink } from "../prompt-content.js";
import { connectTestClient, fixturesDir, newTestSession } from "./helpers.js";

const resource: ResourceLink & { type: "resource_link" } = {
  type: "resource_link",
  name: '日本語 "prod"',
  uri: "https://never-fetch.invalid/context",
  description: 'line one\nURI: fake\n"quoted"',
  title: "",
  size: 0,
  mimeType: null,
  annotations: { audience: ["user"], priority: 0 },
  _meta: { opaque: ["a\nb", 0] },
};
const parse = (text: string) => JSON.parse(text.slice("Resource link: ".length));

it("round-trips fields without conflating null, absent and zero", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  try {
    for (const size of [undefined, null, 0, 1024]) {
      const value = { ...resource, size };
      const { type, ...fields } = value;
      expect(type).toBe("resource_link");
      const text = formatResourceLink(value);
      expect(text.split("\n")).toHaveLength(1);
      expect(parse(text)).toEqual(JSON.parse(JSON.stringify(fields)));
    }
    expect(
      parse(formatResourceLink({ type: "resource_link", name: "n", uri: "file:///missing" })),
    ).toEqual({ name: "n", uri: "file:///missing" });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});

it.each(["sdk", "exec"] as const)(
  "forwards complete resource context through %s",
  async (backend) => {
    const root = mkdtempSync(join(tmpdir(), "muse-resource-"));
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
      await ctx.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [
          { type: "text", text: "before" },
          resource,
          ...(backend === "sdk"
            ? [{ type: "image" as const, mimeType: "image/png", data: "YQ==" }]
            : []),
          { type: "text", text: "after" },
        ],
      });
      if (backend === "sdk") {
        const requests = readFileSync(capture, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const parts = requests.find((r) => r.method === "turn/start").params.input;
        expect(parts.map((p: { type: string }) => p.type)).toEqual([
          "text",
          "text",
          "image",
          "text",
        ]);
        expect(parts[0].text).toBe("before");
        expect(parts[3].text).toBe("after");
        expect(parse(parts[1].text)).toEqual(parse(formatResourceLink(resource)));
      } else {
        const parts = JSON.parse(readFileSync(capture, "utf8")).argv.at(-1).split("\n\n");
        expect(parts[0]).toBe("before");
        expect(parts[2]).toBe("after");
        expect(parse(parts[1])).toEqual(parse(formatResourceLink(resource)));
      }
      await expect(
        ctx.request(methods.agent.session.prompt, { sessionId, prompt: [resource] }),
      ).resolves.toEqual({ stopReason: "end_turn" });
    } finally {
      await client.agent.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
