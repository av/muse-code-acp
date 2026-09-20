import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { museDataDir } from "../session-store.js";
import { readSessionEffort, readSessionPreferences, writeSessionEffort, writeSessionMode, writeSessionPreferences, } from "../session-preferences.js";
function isolatedEnv() {
    const home = mkdtempSync(join(tmpdir(), "muse-prefs-test-"));
    return { PATH: process.env.PATH, HOME: home, XDG_DATA_HOME: join(home, "data") };
}
function preferencePath(sessionId, env) {
    return join(dirname(museDataDir(env)), "muse-code-acp", "sessions", `${encodeURIComponent(sessionId)}.json`);
}
function storeRaw(sessionId, env, raw) {
    const path = preferencePath(sessionId, env);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, raw);
}
describe("session preferences", () => {
    it("returns defaults when nothing is stored", () => {
        expect(readSessionPreferences("missing", isolatedEnv())).toEqual({ schemaVersion: 1 });
        expect(readSessionEffort("missing", isolatedEnv())).toBeUndefined();
    });
    it("round-trips effort and mode, preserving the other field", () => {
        const env = isolatedEnv();
        writeSessionEffort("session-1", "high", env);
        expect(readSessionEffort("session-1", env)).toBe("high");
        writeSessionMode("session-1", "plan", env);
        expect(readSessionPreferences("session-1", env)).toMatchObject({
            schemaVersion: 1,
            reasoningEffort: "high",
            modeId: "plan",
        });
    });
    it("merges partial updates through writeSessionPreferences", () => {
        const env = isolatedEnv();
        writeSessionPreferences("session-1", { modeId: "readOnly" }, env);
        writeSessionPreferences("session-1", { reasoningEffort: "low" }, env);
        expect(readSessionPreferences("session-1", env)).toMatchObject({
            modeId: "readOnly",
            reasoningEffort: "low",
        });
    });
    it("rejects stored documents with a wrong schema version", () => {
        const env = isolatedEnv();
        storeRaw("session-1", env, JSON.stringify({ schemaVersion: 2 }));
        expect(() => readSessionPreferences("session-1", env)).toThrow(/Invalid stored ACP session preference/);
    });
    it("rejects stored documents with invalid effort or mode values", () => {
        const env = isolatedEnv();
        storeRaw("session-1", env, JSON.stringify({ schemaVersion: 1, reasoningEffort: "bogus" }));
        expect(() => readSessionPreferences("session-1", env)).toThrow(/Invalid stored ACP session preference/);
        storeRaw("session-1", env, JSON.stringify({ schemaVersion: 1, modeId: "yolo" }));
        expect(() => readSessionPreferences("session-1", env)).toThrow(/Invalid stored ACP session preference/);
    });
    it("surfaces corrupt files instead of returning defaults", () => {
        const env = isolatedEnv();
        storeRaw("session-1", env, "{nope");
        expect(() => readSessionPreferences("session-1", env)).toThrow(SyntaxError);
    });
});
