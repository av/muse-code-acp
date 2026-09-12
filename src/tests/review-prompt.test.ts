import { afterEach, expect, it, vi } from "vitest";
import * as fsPromises from "node:fs/promises";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildReviewPrompt, workflowCommand, MAX_REVIEW_BYTES } from "../review-prompt.js";
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
}));
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function repo() {
  const cwd = mkdtempSync(join(tmpdir(), "muse review "));
  roots.push(cwd);
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  writeFileSync(join(cwd, "a.txt"), "base\n");
  git("add", "a.txt");
  git("commit", "-qm", "base");
  git("branch", "base");
  writeFileSync(join(cwd, "a.txt"), "committed\n");
  git("commit", "-qam", "change");
  return { cwd, git };
}
it("reviews exact staged, unstaged and untracked data without changing the worktree", async () => {
  const { cwd, git } = repo();
  writeFileSync(join(cwd, "a.txt"), "staged\n");
  git("add", "a.txt");
  writeFileSync(join(cwd, "a.txt"), "unstaged\n");
  writeFileSync(join(cwd, "new.txt"), "untracked\n");
  const before = git("status", "--porcelain");
  const prompt = await buildReviewPrompt(cwd, { kind: "review", target: "workingTree" });
  for (const text of ["staged", "unstaged", "untracked", "new.txt"]) expect(prompt).toContain(text);
  expect(git("status", "--porcelain")).toBe(before);
});
it("branch and commit reviews use resolved commits and reject invalid option-like refs", async () => {
  const { cwd } = repo();
  expect(await buildReviewPrompt(cwd, { kind: "review", target: "branch", ref: "base" })).toContain(
    "+committed",
  );
  expect(await buildReviewPrompt(cwd, { kind: "review", target: "commit", ref: "HEAD" })).toContain(
    "+committed",
  );
  await expect(
    buildReviewPrompt(cwd, { kind: "review", target: "commit", ref: "missing" }),
  ).rejects.toMatchObject({ code: -32602 });
  for (const text of [
    "/review extra",
    "/review-branch --output=x",
    "/review-commit",
    "/review-commit HEAD extra",
  ])
    expect(() => workflowCommand([{ type: "text", text }])).toThrow();
});
it("rejects unsafe untracked types and oversized snapshots explicitly", async () => {
  const { cwd } = repo();
  symlinkSync("a.txt", join(cwd, "link"));
  await expect(
    buildReviewPrompt(cwd, { kind: "review", target: "workingTree" }),
  ).rejects.toMatchObject({ code: -32602 });
  rmSync(join(cwd, "link"));
  writeFileSync(join(cwd, "binary"), Buffer.from([0, 1]));
  await expect(
    buildReviewPrompt(cwd, { kind: "review", target: "workingTree" }),
  ).rejects.toMatchObject({ code: -32602 });
  rmSync(join(cwd, "binary"));
  writeFileSync(join(cwd, "big"), "a".repeat(300000));
  await expect(
    buildReviewPrompt(cwd, { kind: "review", target: "workingTree" }),
  ).rejects.toMatchObject({ code: -32602 });
});

it("rejects an untracked file growing after stat and closes the opened handle", async () => {
  const { cwd } = repo();
  const path = join(cwd, "growing.txt");
  writeFileSync(path, "small");
  const originalOpen = fsPromises.open;
  let opened: Awaited<ReturnType<typeof fsPromises.open>> | undefined;
  const intercepted = vi.spyOn(fsPromises, "open").mockImplementation(async (...args) => {
    const handle = await originalOpen(...args);
    opened = handle;
    const stat = await handle.stat();
    vi.spyOn(handle, "stat").mockImplementation(async () => {
      writeFileSync(path, "x".repeat(MAX_REVIEW_BYTES * 2));
      return stat;
    });
    return handle;
  });
  try {
    await expect(
      buildReviewPrompt(cwd, { kind: "review", target: "workingTree" }),
    ).rejects.toMatchObject({ code: -32602 });
    expect(opened?.fd).toBe(-1);
  } finally {
    intercepted.mockRestore();
    await opened?.close();
  }
});
