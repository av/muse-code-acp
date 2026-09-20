import { mkdtempSync, writeFileSync, unlinkSync, rmSync, symlinkSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";
import { FileChangeEvidence, fileReportRequest, supportsFileReport, } from "../file-change-evidence.js";
const roots = [];
afterEach(() => {
    for (const root of roots.splice(0))
        rmSync(root, { recursive: true, force: true });
});
function workspace() {
    const cwd = mkdtempSync(join(tmpdir(), "file-evidence-"));
    roots.push(cwd);
    execFileSync("git", ["init", "-q"], { cwd });
    return cwd;
}
function track(cwd, name, text) {
    const path = join(cwd, name);
    writeFileSync(path, text);
    execFileSync("git", ["add", "--", name], { cwd });
    return path;
}
function item(path, content, status = "completed") {
    return {
        itemId: "item",
        callId: "call",
        turnId: "turn",
        kind: "toolCall",
        tool: "write_file",
        revision: 2,
        status,
        args: JSON.stringify({ path, content }),
        visibleOutput: `wrote ${Buffer.byteLength(content)} bytes to ${path}`,
    };
}
it("shows actual dirty working-tree preimages, updates repeated observations, and excludes unrelated dirty files", () => {
    const cwd = workspace();
    const path = track(cwd, "target", "index text");
    const unrelated = track(cwd, "unrelated", "base");
    writeFileSync(unrelated, "user edit");
    writeFileSync(path, "dirty user preimage");
    const evidence = new FileChangeEvidence(cwd);
    writeFileSync(path, "agent text");
    expect(evidence.present(item(path, "agent text"))).toContainEqual(expect.objectContaining({
        type: "diff",
        oldText: "dirty user preimage",
        newText: "agent text",
    }));
    writeFileSync(path, "later text");
    expect(evidence.present(item(path, "later text"))).toContainEqual(expect.objectContaining({ type: "diff", oldText: "agent text", newText: "later text" }));
    const report = evidence.report("request", "completed").jetbrains.air.agentFileChangeReport;
    expect(report).toMatchObject({
        paths: [expect.stringContaining("target")],
        declaredComplete: false,
        truncated: false,
    });
    expect(JSON.stringify(report)).not.toContain("unrelated");
});
it("distinguishes known absence from an unknown preimage and a later deletion", () => {
    const cwd = workspace();
    const path = track(cwd, "recreated", "previous");
    unlinkSync(path);
    const evidence = new FileChangeEvidence(cwd);
    writeFileSync(path, "created");
    expect(evidence.present(item(path, "created"))).toContainEqual(expect.objectContaining({ type: "diff", oldText: null, newText: "created" }));
    const unknown = join(cwd, "untracked");
    writeFileSync(unknown, "existing content");
    expect(evidence.present(item(unknown, "existing content"))?.some((c) => c.type === "diff")).toBe(false);
    unlinkSync(path);
    expect(evidence.present(item(path, "new"))?.some((c) => c.type === "diff")).toBe(false);
});
it("never turns failed tools or concurrent post-write edits into precise diffs", () => {
    const cwd = workspace();
    const path = track(cwd, "target", "old");
    const evidence = new FileChangeEvidence(cwd);
    writeFileSync(path, "unexpected user text");
    expect(evidence.present(item(path, "intended"))?.some((c) => c.type === "diff")).toBe(false);
    expect(evidence.present(item(path, "unexpected user text", "failed"))?.some((c) => c.type === "diff")).toBe(false);
});
it("can refresh a bounded preimage immediately before a host-offered approval", () => {
    const cwd = workspace();
    const path = join(cwd, "untracked");
    writeFileSync(path, "old");
    const evidence = new FileChangeEvidence(cwd);
    writeFileSync(path, "edited while permission pending");
    evidence.beforeApproval("write_file", JSON.stringify({ path }));
    writeFileSync(path, "allowed");
    expect(evidence.present(item(path, "allowed"))).toContainEqual(expect.objectContaining({
        type: "diff",
        oldText: "edited while permission pending",
        newText: "allowed",
    }));
});
it.each(["large", "binary", "invalid-utf8", "symlink"])("keeps %s evidence unavailable", (kind) => {
    const cwd = workspace();
    const path = track(cwd, "target", "old");
    if (kind === "large")
        writeFileSync(path, "x".repeat(65537));
    if (kind === "binary")
        writeFileSync(path, "x\0y");
    if (kind === "invalid-utf8")
        writeFileSync(path, Buffer.from([0xff]));
    if (kind === "symlink") {
        unlinkSync(path);
        symlinkSync(join(cwd, "other"), path);
    }
    const evidence = new FileChangeEvidence(cwd);
    if (kind === "symlink")
        unlinkSync(path);
    writeFileSync(path, "new");
    expect(evidence.present(item(path, "new"))?.some((c) => c.type === "diff")).toBe(false);
});
it("bounds report size, deduplicates paths and marks cancellation unavailable", () => {
    const cwd = workspace();
    const evidence = new FileChangeEvidence(cwd);
    for (let i = 0; i < 1030; i++)
        evidence.present(item(join(cwd, `file-${i}`), ""));
    evidence.present(item(join(cwd, "file-0"), ""));
    const metadata = evidence.report("bounded", "completed");
    expect(metadata.jetbrains.air.agentFileChangeReport).toMatchObject({
        paths: expect.any(Array),
        truncated: true,
        declaredComplete: false,
    });
    expect(Buffer.byteLength(JSON.stringify(metadata))).toBeLessThan(256 * 1024);
    expect(evidence.report("cancelled", "cancelled").jetbrains.air.agentFileChangeReport).toEqual({
        version: 1,
        requestId: "cancelled",
        status: "unavailable",
        reason: "cancelled",
    });
});
it("requires the versioned capability and validates request identifiers", () => {
    expect(supportsFileReport({
        _meta: { jetbrains: { air: { version: 1, capabilities: ["agentFileChangeReport"] } } },
    })).toBe(true);
    expect(supportsFileReport({
        _meta: { jetbrains: { air: { capabilities: ["agentFileChangeReport"] } } },
    })).toBe(false);
    for (const requestId of ["", "bad id", "x".repeat(129)])
        expect(fileReportRequest({
            jetbrains: { air: { agentFileChangeReportRequest: { version: 1, requestId } } },
        })).toBeUndefined();
    expect(fileReportRequest({
        jetbrains: { air: { agentFileChangeReportRequest: { version: 1, requestId: "valid-1" } } },
    })).toBe("valid-1");
});
it("does not attribute shell moves or child changes without native file declarations", () => {
    const cwd = workspace();
    const path = track(cwd, "before", "text");
    const evidence = new FileChangeEvidence(cwd);
    renameSync(path, join(cwd, "after"));
    expect(evidence.present({
        ...item(path, ""),
        tool: "bash",
        args: JSON.stringify({ command: "mv before after" }),
    })).toBeUndefined();
    expect(evidence.present({ ...item(path, ""), kind: "worker" })).toBeUndefined();
    expect(evidence.report("mixed", "completed").jetbrains.air.agentFileChangeReport).toMatchObject({
        paths: [],
        declaredComplete: false,
        uncertainty: expect.stringContaining("child changes may be missing"),
    });
});
it("keeps snapshots within the aggregate content budget", () => {
    const cwd = workspace();
    for (let i = 0; i < 17; i++)
        track(cwd, `file-${String(i).padStart(2, "0")}`, "x".repeat(65536));
    const evidence = new FileChangeEvidence(cwd);
    const captured = join(cwd, "file-00");
    const overBudget = join(cwd, "file-16");
    writeFileSync(captured, "new");
    writeFileSync(overBudget, "new");
    expect(evidence.present(item(captured, "new"))?.some((c) => c.type === "diff")).toBe(true);
    expect(evidence.present(item(overBudget, "new"))?.some((c) => c.type === "diff")).toBe(false);
});
