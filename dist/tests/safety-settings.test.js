import { expect, it } from "vitest";
import { DEFAULT_SAFETY, safetyArgs, selectSafety, validSafety } from "../safety-settings.js";
import { availableModes } from "../modes.js";
it("keeps independent defaults and read-only disables both effect routes", () => {
    expect(safetyArgs()).toEqual([]);
    expect(safetyArgs(DEFAULT_SAFETY, true)).toEqual(["--disable-write", "--disable-shell"]);
    expect(safetyArgs({ ...DEFAULT_SAFETY, workspaceWrite: "disabled" })).toEqual([
        "--disable-write",
    ]);
    expect(safetyArgs({ ...DEFAULT_SAFETY, sandboxNetwork: "restricted" })).toEqual([
        "--sandbox-network",
        "restricted",
    ]);
});
it("validates stored selections and requires explicit sandbox opt-in", () => {
    expect(validSafety({ ...DEFAULT_SAFETY, shell: "bogus" })).toBe(false);
    const normal = { env: {}, isRoot: false };
    expect(() => selectSafety(undefined, "sandbox", "disabled", normal)).toThrow(/MUSE_CODE_ACP_ALLOW_YOLO/);
    expect(selectSafety(undefined, "nativeApprovalPolicy", "allowAll", normal).sandbox).toBe("enabled");
    expect(selectSafety(undefined, "sandbox", "disabled", {
        env: { MUSE_CODE_ACP_ALLOW_YOLO: "1" },
        isRoot: false,
    }).nativeApprovalPolicy).toBe("onRequest");
    expect(() => selectSafety(undefined, "sandboxNetwork", "enabled", { env: {}, isRoot: true })).toThrow(/root/);
    expect(availableModes({ env: {}, isRoot: true }, "sdk").map((m) => m.id)).not.toContain("bypassApprovals");
});
