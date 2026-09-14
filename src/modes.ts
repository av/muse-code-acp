import { SessionModeState } from "@agentclientprotocol/sdk";

/**
 * ACP session modes mapped onto Muse safety levers.
 *
 * Exec backend: modes choose spawn-time `muse exec` flags. Approvals resolve
 * inside Muse (policy + judge) unless the SDK path is selected.
 *
 * SDK backend: modes select prompted, automatic once, rejection, or read-only
 * operation. Native approval policy and sandbox posture are independent settings.
 */
export type MuseModeId =
  "default" | "readOnly" | "plan" | "bypassApprovals" | "rejectApprovals" | "yolo";
export type MuseBackendId = "exec" | "sdk";

export interface ModeDef {
  id: MuseModeId;
  name: string;
  description: string;
  /** Flags appended to every `muse exec` spawn while this mode is active. */
  flags: string[];
  /** Gated behind MUSE_CODE_ACP_ALLOW_YOLO=1; never available as root. */
  dangerous?: boolean;
}

const EXEC_DEFAULT_DESCRIPTION =
  "Muse's approval policy and LLM judge decide tool calls autonomously inside its " +
  "sandbox; decisions are reported, not asked. Applies from the next prompt.";

const SDK_DEFAULT_DESCRIPTION =
  "Tool calls that need approval are offered through ACP permission requests " +
  "(approval mode onRequest). Applies from the next prompt.";

export const MODES: Record<MuseModeId, ModeDef> = {
  default: {
    id: "default",
    name: "Default",
    description: EXEC_DEFAULT_DESCRIPTION,
    flags: [],
  },
  readOnly: {
    id: "readOnly",
    name: "Read-only",
    description:
      "Disable workspace file writes and shell execution for the run. Applies from the next prompt.",
    flags: ["--disable-write", "--disable-shell"],
  },
  plan: {
    id: "plan",
    name: "Plan",
    description:
      "Plan with workspace writes and shell execution disabled. Select another mode explicitly to implement. Applies from the next prompt.",
    flags: ["--disable-write", "--disable-shell"],
  },
  bypassApprovals: {
    id: "bypassApprovals",
    name: "Bypass approvals",
    description:
      "Skip muse's approval prompts; the OS sandbox stays on. Applies from the next prompt. Exec backend only.",
    flags: ["--disable-approval"],
    dangerous: true,
  },
  rejectApprovals: {
    id: "rejectApprovals",
    name: "Reject approval requests",
    description:
      "Reject genuine pending prompts using host-offered denial choices. Known-safe tools may still run. Applies from the next prompt.",
    flags: [],
  },
  yolo: {
    id: "yolo",
    name: "Yolo (no approval, no sandbox)",
    description:
      "Disable approval AND the OS sandbox and trust this workspace — muse's own --yolo. " +
      "Only for already-isolated environments. Exec backend only. Applies from the next prompt.",
    flags: ["--yolo"],
    dangerous: true,
  },
};

export interface ModeGuardContext {
  env: Record<string, string | undefined>;
  /** True when running as uid 0 — dangerous modes are refused outright. */
  isRoot: boolean;
}

export function guardContext(): ModeGuardContext {
  return {
    env: process.env,
    isRoot: typeof process.getuid === "function" && process.getuid() === 0,
  };
}

/** Modes offered to the client under the given guard context. */
export function availableModes(
  guard: ModeGuardContext,
  backend: MuseBackendId = "exec",
): ModeDef[] {
  return Object.values(MODES).filter((mode) => {
    if ((mode.id === "plan" || mode.id === "rejectApprovals") && backend !== "sdk") return false;
    if (backend === "sdk" && mode.id === "yolo") return false;
    if (!mode.dangerous) {
      return true;
    }
    if (guard.isRoot) {
      return false;
    }
    if (mode.id === "yolo") {
      return guard.env.MUSE_CODE_ACP_ALLOW_YOLO === "1";
    }
    return true;
  });
}

export function isModeAvailable(
  id: string,
  guard: ModeGuardContext,
  backend: MuseBackendId = "exec",
): id is MuseModeId {
  return availableModes(guard, backend).some((mode) => mode.id === id);
}

export function modeState(
  current: MuseModeId,
  guard: ModeGuardContext,
  backend: MuseBackendId = "exec",
): SessionModeState {
  return {
    currentModeId: current,
    availableModes: availableModes(guard, backend).map((mode) => ({
      id: mode.id,
      name: mode.name,
      description:
        mode.id === "default" && backend === "sdk"
          ? SDK_DEFAULT_DESCRIPTION
          : mode.id === "bypassApprovals" && backend === "sdk"
            ? "Automatically select host-offered approved/once choices at each stage. No persistent grants; sandbox stays enabled unless separately changed. Applies from the next prompt."
            : mode.description,
    })),
  };
}
