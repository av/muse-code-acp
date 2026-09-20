import { type SessionConfigOption } from "@agentclientprotocol/sdk";
import type { ModeGuardContext } from "./modes.js";
export declare const NATIVE_POLICIES: readonly ["onRequest", "promptUnmatched", "denyUnmatched", "allowAll"];
export interface SafetySettings {
    nativeApprovalPolicy: (typeof NATIVE_POLICIES)[number];
    sandbox: "enabled" | "disabled";
    sandboxNetwork: "proxy-only" | "restricted" | "enabled";
    workspaceWrite: "enabled" | "disabled";
    shell: "enabled" | "disabled";
}
export declare const DEFAULT_SAFETY: SafetySettings;
export declare function isSafetyConfig(id: string): id is keyof SafetySettings;
export declare function validSafety(value: unknown): value is SafetySettings;
export declare function assertSafetyGuard(safety: SafetySettings, guard: ModeGuardContext): void;
export declare function selectSafety(current: SafetySettings | undefined, id: keyof SafetySettings, value: unknown, guard: ModeGuardContext): SafetySettings;
export declare function safetyArgs(safety?: SafetySettings, readOnly?: boolean): string[];
export declare function safetyConfigOptions(current: SafetySettings | undefined, guard: ModeGuardContext, hostVersion?: string | null): SessionConfigOption[];
//# sourceMappingURL=safety-settings.d.ts.map