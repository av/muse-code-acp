import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ grow: false, path: "", bytes: 0, closes: 0, timeout: false }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    fstatSync: (...args: unknown[]) => {
      const stat = Reflect.apply(fs.fstatSync, fs, args);
      if (state.grow) {
        state.grow = false;
        fs.writeFileSync(state.path, "x".repeat(128 * 1024));
      }
      return stat;
    },
    readSync: (...args: unknown[]) => {
      const count = Reflect.apply(fs.readSync, fs, args);
      state.bytes += count;
      return count;
    },
    closeSync: (...args: unknown[]) => {
      state.closes++;
      return Reflect.apply(fs.closeSync, fs, args);
    },
  };
});
vi.mock("node:child_process", async (original) => {
  const cp = await original<typeof import("node:child_process")>();
  return {
    ...cp,
    execFileSync: (...args: unknown[]) => {
      if (state.timeout) throw Object.assign(new Error("git timed out"), { code: "ETIMEDOUT" });
      return Reflect.apply(cp.execFileSync, cp, args);
    },
  };
});
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FoldedItem } from "@muse-code/sdk";
import { FileChangeEvidence } from "../file-change-evidence.js";
it("bounds actual read bytes when a file grows after stat and closes descriptors", () => {
  const cwd = mkdtempSync(join(tmpdir(), "evidence-growth-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd });
    state.path = join(cwd, "target");
    writeFileSync(state.path, "small");
    execFileSync("git", ["add", "target"], { cwd });
    state.grow = true;
    state.bytes = 0;
    state.closes = 0;
    const evidence = new FileChangeEvidence(cwd);
    expect(state.bytes).toBe(65537);
    expect(state.closes).toBe(1);
    writeFileSync(state.path, "new");
    const content = evidence.present({
      itemId: "item",
      kind: "toolCall",
      tool: "write_file",
      status: "completed",
      revision: 2,
      args: JSON.stringify({ path: state.path, content: "new" }),
      visibleOutput: `wrote 3 bytes to ${state.path}`,
    } as FoldedItem);
    expect(content?.some((c) => c.type === "diff")).toBe(false);
    expect(state.closes).toBe(2);
  } finally {
    state.grow = false;
    rmSync(cwd, { recursive: true, force: true });
  }
});
it("reports a bounded snapshot timeout without throwing from evidence collection", () => {
  state.timeout = true;
  try {
    const evidence = new FileChangeEvidence(tmpdir());
    expect(evidence.report("timeout", "completed").jetbrains.air.agentFileChangeReport).toEqual({
      version: 1,
      requestId: "timeout",
      status: "unavailable",
      reason: "timeout",
    });
  } finally {
    state.timeout = false;
  }
});
