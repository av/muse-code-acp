import { expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { museHostIdentity } from "../host-identity.js";
import { sdkHostConfiguration } from "../host-configuration.js";
test("execution rejects unreadable settings while discovery can identify unavailable config", () => {
    const root = mkdtempSync(join(tmpdir(), "muse-identity-"));
    try {
        mkdirSync(join(root, "muse", "settings.json"), { recursive: true });
        const env = { ...process.env, XDG_CONFIG_HOME: root };
        expect(() => sdkHostConfiguration(root, { model: "test", reasoningEffort: "high" }, "default", [], env, process.execPath)).toThrow();
        const result = museHostIdentity(root, env, process.execPath, true);
        expect(result.identity).toMatch(/^[a-f0-9]{64}$/);
        expect(result.identity).not.toContain(root);
    }
    finally {
        rmSync(root, { recursive: true, force: true });
    }
});
