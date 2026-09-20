import { type SafetySettings } from "./safety-settings.js";
/** Pinned `@muse-code/sdk` and the Muse host verified against it for `serve`. */
export declare const SDK_PACKAGE = "@muse-code/sdk@0.1.1";
export declare const MIN_MUSE_HOST_FOR_SDK = "1.1.1";
export interface SdkHostCheck {
    binary: string;
    version: string | null;
    serveHelpOk: boolean;
    serveHelp?: string;
}
/**
 * Probe whether the resolved Muse binary exposes `serve` (MSP host). Used
 * before starting an SDK turn so missing/disabled hosts fail with an upgrade
 * hint instead of hanging on model submission.
 */
export declare function probeSdkHost(env?: Record<string, string | undefined>, museBinary?: string): SdkHostCheck;
/** Fail before a model turn when the host cannot run the pinned SDK path. */
export declare function assertSdkHostSupport(env?: Record<string, string | undefined>, museBinary?: string): SdkHostCheck;
/** Map an SDK host exit into an actionable ACP error when possible. */
export declare function sdkHostExitMessage(stderr: string): string | undefined;
/** Validate requested controls before binding them or starting a model turn. */
export declare function assertSdkSafetySupport(safety?: SafetySettings, env?: Record<string, string | undefined>, binary?: string): void;
//# sourceMappingURL=muse-host.d.ts.map