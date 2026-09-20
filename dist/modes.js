import { unavailable } from "./availability.js";
const EXEC_DEFAULT_DESCRIPTION = "Muse's approval policy and LLM judge decide tool calls autonomously inside its " +
    "sandbox; decisions are reported, not asked. Applies from the next prompt.";
const SDK_DEFAULT_DESCRIPTION = "Tool calls that need approval are offered through ACP permission requests " +
    "unless the independently configured native policy settles them. Applies from the next prompt.";
export const MODES = {
    default: {
        id: "default",
        name: "Default",
        description: EXEC_DEFAULT_DESCRIPTION,
        flags: [],
    },
    readOnly: {
        id: "readOnly",
        name: "Read-only",
        description: "Disable workspace file writes and shell execution for the run. Applies from the next prompt.",
        flags: ["--disable-write", "--disable-shell"],
    },
    plan: {
        id: "plan",
        name: "Plan",
        description: "Plan with workspace writes and shell execution disabled. Select another mode explicitly to implement. Applies from the next prompt.",
        flags: ["--disable-write", "--disable-shell"],
    },
    bypassApprovals: {
        id: "bypassApprovals",
        name: "Auto-approve",
        description: "Skip muse's approval prompts; the OS sandbox stays on. Applies from the next prompt. Exec backend only.",
        flags: ["--disable-approval"],
        dangerous: true,
    },
    rejectApprovals: {
        id: "rejectApprovals",
        name: "Reject prompts",
        description: "Reject genuine pending prompts using host-offered denial choices. Known-safe tools may still run. Applies from the next prompt.",
        flags: [],
    },
    yolo: {
        id: "yolo",
        name: "No approval, no sandbox",
        description: "Disable approval AND the OS sandbox and trust this workspace — muse's own --yolo. " +
            "Only for already-isolated environments. Exec backend only. Applies from the next prompt.",
        flags: ["--yolo"],
        dangerous: true,
    },
};
export function guardContext() {
    return {
        env: process.env,
        isRoot: typeof process.getuid === "function" && process.getuid() === 0,
    };
}
/** Modes offered to the client under the given guard context. */
export function availableModes(guard, backend = "exec") {
    return Object.values(MODES).filter((mode) => modeAvailability(mode.id, guard, backend).available);
}
export function modeAvailability(id, guard, backend) {
    if (!Object.hasOwn(MODES, id))
        return unavailable("unknown", `Unknown session mode ${id}; choose an advertised mode`);
    const mode = MODES[id];
    if (((id === "plan" || id === "rejectApprovals") && backend !== "sdk") ||
        (id === "yolo" && backend === "sdk"))
        return unavailable("backend", `Mode ${id} is unavailable on backend ${backend}; choose an advertised mode. The backend was not changed`);
    if (mode.dangerous && guard.isRoot)
        return unavailable("guard", `Mode ${id} is unavailable as root; use the default mode or a non-root environment`);
    if (id === "yolo" && guard.env.MUSE_CODE_ACP_ALLOW_YOLO !== "1")
        return unavailable("guard", "Yolo requires explicit MUSE_CODE_ACP_ALLOW_YOLO=1; use the default sandboxed mode");
    return { available: true, implementation: backend === "sdk" ? "adapter" : "native" };
}
export function isModeAvailable(id, guard, backend = "exec") {
    return availableModes(guard, backend).some((mode) => mode.id === id);
}
export function modeState(current, guard, backend = "exec") {
    return {
        currentModeId: current,
        availableModes: availableModes(guard, backend).map((mode) => ({
            id: mode.id,
            // `muse --approval-mode` calls this posture `on-request`. Only the SDK
            // backend earns that name: there each approval reaches the client as a
            // request, whereas exec settles approvals inside muse.
            name: mode.id === "default" && backend === "sdk" ? "On request" : mode.name,
            description: mode.id === "default" && backend === "sdk"
                ? SDK_DEFAULT_DESCRIPTION
                : mode.id === "bypassApprovals" && backend === "sdk"
                    ? "Automatically select host-offered approved/once choices at each stage. No persistent grants; sandbox stays enabled unless separately changed. Applies from the next prompt."
                    : mode.description,
        })),
    };
}
