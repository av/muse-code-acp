import { textContent, writtenFilePath } from "./tool-calls.js";
import {
  constants,
  lstatSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  realpathSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { FoldedItem } from "@muse-code/sdk";
import type { ClientCapabilities, ToolCallContent } from "@agentclientprotocol/sdk";

const MAX_FILES = 128;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_SNAPSHOT_BYTES = 1024 * 1024;
const MAX_REPORT_BYTES = 256 * 1024;
const FILE_TOOLS = new Set(["write_file", "edit_file"]);
type Snapshot = { kind: "text"; text: string } | { kind: "absent" } | { kind: "unknown" };
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
function air(meta: unknown) {
  return record(record(record(meta).jetbrains).air);
}
export function supportsFileReport(capabilities: ClientCapabilities): boolean {
  const value = air(capabilities._meta);
  return (
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version >= 1 &&
    Array.isArray(value.capabilities) &&
    value.capabilities.includes("agentFileChangeReport")
  );
}
export const FILE_REPORT_CAPABILITIES = {
  jetbrains: { air: { version: 1, capabilities: ["agentFileChangeReport"] } },
};
export function fileReportRequest(meta: unknown): string | undefined {
  const request = record(air(meta).agentFileChangeReportRequest);
  return Object.keys(request).length === 2 &&
    request.version === 1 &&
    typeof request.requestId === "string" &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(request.requestId)
    ? request.requestId
    : undefined;
}
function args(text: string | undefined): Record<string, unknown> {
  try {
    return record(JSON.parse(text ?? "{}"));
  } catch {
    return {};
  }
}

/** Bounded observed states, never a claim that every workspace edit was made by Muse. */
export class FileChangeEvidence {
  private readonly cwd: string;
  private readonly before = new Map<string, Snapshot>();
  private readonly paths = new Set<string>();
  private bytes = 0;
  private reportBytes = 0;
  private truncated = false;
  private snapshotTimedOut = false;
  constructor(cwd: string) {
    try {
      this.cwd = realpathSync(cwd);
    } catch {
      this.cwd = resolve(cwd);
    }
    // Only tracked candidates, with bounded enumeration and content. Non-Git or
    // large workspaces retain tool output with unavailable preimages.
    try {
      const names = execFileSync("git", ["ls-files", "--cached", "-z"], {
        cwd: this.cwd,
        timeout: 1000,
        maxBuffer: MAX_REPORT_BYTES,
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      })
        .toString("utf8")
        .split("\0");
      for (const name of names) {
        if (this.before.size >= MAX_FILES || this.bytes >= MAX_SNAPSHOT_BYTES) break;
        if (name) this.capturePath(name);
      }
    } catch (error) {
      this.snapshotTimedOut = (error as { code?: string }).code === "ETIMEDOUT";
      /* Git is optional; unavailable evidence never prevents a turn. */
    }
  }
  private path(value: unknown): string | undefined {
    if (typeof value !== "string" || !value || value.length > 4096 || value.includes("\0")) return;
    try {
      const requested = resolve(this.cwd, value);
      const path = join(realpathSync(dirname(requested)), basename(requested));
      const rel = relative(this.cwd, path);
      if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return;
      return path;
    } catch {
      return;
    }
  }
  private read(path: string): Snapshot {
    let fd: number | undefined;
    try {
      if (lstatSync(path).isSymbolicLink()) return { kind: "unknown" };
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const before = fstatSync(fd);
      if (!before.isFile() || before.size > MAX_FILE_BYTES) return { kind: "unknown" };
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let size = 0;
      while (size < buffer.length) {
        const n = readSync(fd, buffer, size, buffer.length - size, null);
        if (!n) break;
        size += n;
      }
      const after = fstatSync(fd);
      if (
        size > MAX_FILE_BYTES ||
        size !== before.size ||
        before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs ||
        buffer.subarray(0, size).includes(0)
      )
        return { kind: "unknown" };
      return {
        kind: "text",
        text: new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size)),
      };
    } catch (error) {
      return (error as { code?: string }).code === "ENOENT"
        ? { kind: "absent" }
        : { kind: "unknown" };
    } finally {
      if (fd !== undefined) {
        try {
          closeSync(fd);
        } catch {
          /* Evidence must not change the turn outcome. */
        }
      }
    }
  }
  private remember(path: string, snapshot: Snapshot): void {
    const previous = this.before.get(path);
    if (previous?.kind === "text") this.bytes -= Buffer.byteLength(previous.text);
    const size = snapshot.kind === "text" ? Buffer.byteLength(snapshot.text) : 0;
    if (this.bytes + size > MAX_SNAPSHOT_BYTES) snapshot = { kind: "unknown" };
    else this.bytes += size;
    this.before.set(path, snapshot);
  }
  private capturePath(value: unknown): void {
    const path = this.path(value);
    if (!path || (!this.before.has(path) && this.before.size >= MAX_FILES)) return;
    this.remember(path, this.read(path));
  }
  beforeApproval(tool: string, rawArgs: string): void {
    if (FILE_TOOLS.has(tool)) this.capturePath(args(rawArgs).path);
  }
  present(item: FoldedItem): ToolCallContent[] | undefined {
    if (
      item.kind !== "toolCall" ||
      !FILE_TOOLS.has(item.tool ?? "") ||
      item.status === "inProgress"
    )
      return;
    const output = item.visibleOutput ?? item.text ?? item.failureReason ?? "";
    // Failed tools never turn a readback into proof of a successful edit.
    if (item.status !== "completed") return [textContent(output)];
    const declared = writtenFilePath(output);
    const path = this.path(declared);
    if (!path) return [textContent(output)];
    if (!this.paths.has(path)) {
      const bytes = Buffer.byteLength(JSON.stringify(path)) + 1;
      if (this.paths.size >= 1024 || this.reportBytes + bytes > MAX_REPORT_BYTES - 4096)
        this.truncated = true;
      else {
        this.paths.add(path);
        this.reportBytes += bytes;
      }
    }
    const input = args(item.args);
    const old = this.before.get(path);
    const after = this.read(path);
    if (this.before.has(path) || this.before.size < MAX_FILES) this.remember(path, after);
    if (
      !old ||
      old.kind === "unknown" ||
      after.kind !== "text" ||
      item.tool !== "write_file" ||
      this.path(input.path) !== path ||
      typeof input.content !== "string" ||
      input.content !== after.text
    )
      return [
        textContent(
          `${output}\nExact before/after evidence unavailable; content may be large, binary, uncaptured or concurrently changed.`,
        ),
      ];
    if (old.kind === "text" && old.text === after.text) return [textContent(output)];
    return [
      textContent(
        "Observed content at turn start, before approval, or after an earlier tool; compared with content after this tool. Concurrent edits may contribute; this is not exclusive attribution.",
      ),
      { type: "diff", path, oldText: old.kind === "absent" ? null : old.text, newText: after.text },
    ];
  }
  report(requestId: string, outcome: "completed" | "cancelled" | "failed") {
    const report =
      outcome === "cancelled"
        ? { version: 1, requestId, status: "unavailable", reason: "cancelled" }
        : this.snapshotTimedOut && this.paths.size === 0
          ? { version: 1, requestId, status: "unavailable", reason: "timeout" }
          : {
              version: 1,
              requestId,
              status: "reported",
              paths: [...this.paths],
              declaredComplete: false,
              truncated: this.truncated,
              uncertainty: `${outcome === "failed" ? "The turn failed. " : ""}Only successful native file-tool declarations are included. Shell, generated and child changes may be missing. Observed snapshots may include concurrent user edits.`,
            };
    return { jetbrains: { air: { version: 1, agentFileChangeReport: report } } };
  }
}
