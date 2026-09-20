import { type Availability } from "./availability.js";
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
export type MuseModeId = "default" | "readOnly" | "plan" | "bypassApprovals" | "rejectApprovals" | "yolo";
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
export declare const MODES: Record<MuseModeId, ModeDef>;
export interface ModeGuardContext {
    env: Record<string, string | undefined>;
    /** True when running as uid 0 — dangerous modes are refused outright. */
    isRoot: boolean;
}
export declare function guardContext(): ModeGuardContext;
/** Modes offered to the client under the given guard context. */
export declare function availableModes(guard: ModeGuardContext, backend?: MuseBackendId): ModeDef[];
export declare function modeAvailability(id: string, guard: ModeGuardContext, backend: MuseBackendId): Availability;
export declare function isModeAvailable(id: string, guard: ModeGuardContext, backend?: MuseBackendId): id is MuseModeId;
export declare function modeState(current: MuseModeId, guard: ModeGuardContext, backend?: MuseBackendId): SessionModeState;
//# sourceMappingURL=modes.d.ts.map