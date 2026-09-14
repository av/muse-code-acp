import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { museSettingsPath, readMuseSettings } from "../muse-settings.js";
import { capturingLogger, silentLogger } from "./helpers.js";

function settingsEnv(contents: string | null): Record<string, string | undefined> {
  const configHome = mkdtempSync(join(tmpdir(), "muse-settings-test-"));
  if (contents !== null) {
    mkdirSync(join(configHome, "muse"), { recursive: true });
    writeFileSync(join(configHome, "muse", "settings.json"), contents);
  }
  return { ...process.env, XDG_CONFIG_HOME: configHome };
}

describe("museSettingsPath", () => {
  it("prefers XDG_CONFIG_HOME", () => {
    expect(museSettingsPath({ XDG_CONFIG_HOME: "/xdg" })).toBe("/xdg/muse/settings.json");
  });

  it("falls back to HOME/.config", () => {
    expect(museSettingsPath({ HOME: "/home/user" })).toBe("/home/user/.config/muse/settings.json");
  });
});

describe("readMuseSettings edge cases", () => {
  it("ignores a settings file that is not an object", () => {
    const lines: string[] = [];
    expect(readMuseSettings(settingsEnv("5"), capturingLogger(lines))).toEqual({});
    expect(lines.some((line) => line.includes("is not an object"))).toBe(true);
  });

  it("ignores non-string fields while keeping valid ones", () => {
    expect(
      readMuseSettings(
        settingsEnv(JSON.stringify({ provider: 5, model: "m", reasoning_effort: null })),
        silentLogger(),
      ),
    ).toEqual({ model: "m" });
  });
});
