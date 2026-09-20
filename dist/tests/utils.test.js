import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { nodeToWebReadable, nodeToWebWritable, Pushable, sleep, unreachable } from "../utils.js";
describe("Pushable", () => {
    it("delivers queued items in order, then ends", async () => {
        const pushable = new Pushable();
        pushable.push(1);
        pushable.push(2);
        pushable.end();
        const seen = [];
        for await (const value of pushable) {
            seen.push(value);
        }
        expect(seen).toEqual([1, 2]);
    });
    it("wakes a waiting consumer when items arrive", async () => {
        const pushable = new Pushable();
        const collected = (async () => {
            const seen = [];
            for await (const value of pushable) {
                seen.push(value);
            }
            return seen;
        })();
        pushable.push("a");
        await sleep(5);
        pushable.push("b");
        pushable.end();
        await expect(collected).resolves.toEqual(["a", "b"]);
    });
    it("ends a consumer that is already waiting", async () => {
        const pushable = new Pushable();
        const collected = (async () => {
            const seen = [];
            for await (const value of pushable) {
                seen.push(value);
            }
            return seen;
        })();
        await sleep(5);
        pushable.end();
        await expect(collected).resolves.toEqual([]);
    });
});
describe("unreachable", () => {
    it("logs the unexpected value as JSON", () => {
        const lines = [];
        unreachable("boom", { log: () => { }, error: (...args) => lines.push(args.join(" ")) });
        expect(lines).toEqual(['Unexpected case: "boom"']);
    });
    it("survives circular values instead of throwing", () => {
        const lines = [];
        const circular = {};
        circular.self = circular;
        expect(() => unreachable(circular, { log: () => { }, error: () => lines.push("logged") })).not.toThrow();
        expect(lines).toEqual(["logged"]);
    });
});
describe("sleep", () => {
    it("resolves after the delay", async () => {
        await expect(sleep(5)).resolves.toBeUndefined();
    });
});
describe("stream bridges", () => {
    it("writes web chunks into a node writable", async () => {
        const nodeStream = new PassThrough();
        const chunks = [];
        nodeStream.on("data", (chunk) => chunks.push(chunk));
        const web = nodeToWebWritable(nodeStream);
        const writer = web.getWriter();
        await writer.write(new Uint8Array([1, 2, 3]));
        await writer.close();
        await sleep(10);
        expect(Buffer.concat(chunks)).toEqual(Buffer.from([1, 2, 3]));
    });
    it("reads node chunks through a web readable", async () => {
        const web = nodeToWebReadable(Readable.from([Buffer.from("ab"), Buffer.from("c")]));
        const reader = web.getReader();
        const bytes = [];
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bytes.push(...value);
        }
        expect(Buffer.from(bytes).toString()).toBe("abc");
    });
    it("forwards node stream errors to the web reader", async () => {
        const nodeStream = new Readable({ read() { } });
        const web = nodeToWebReadable(nodeStream);
        const reader = web.getReader();
        const failure = new Error("node exploded");
        nodeStream.destroy(failure);
        await expect(reader.read()).rejects.toBe(failure);
    });
});
