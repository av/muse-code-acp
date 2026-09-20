import { nativePolicyAvailability, requireAvailable } from "./availability.js";
import { DEFAULT_SAFETY, safetyArgs } from "./safety-settings.js";
import { spawnSync } from "node:child_process";
import { RequestError } from "@agentclientprotocol/sdk";
import { museCliPath } from "./muse-cli.js";
/** Pinned `@muse-code/sdk` and the Muse host verified against it for `serve`. */
export const SDK_PACKAGE = "@muse-code/sdk@0.1.1";
export const MIN_MUSE_HOST_FOR_SDK = "1.1.1";
const probed = new Map();
/**
 * Probe whether the resolved Muse binary exposes `serve` (MSP host). Used
 * before starting an SDK turn so missing/disabled hosts fail with an upgrade
 * hint instead of hanging on model submission.
 */
export function probeSdkHost(env = process.env, museBinary) {
    const binary = museBinary ?? museCliPath(env);
    const cached = probed.get(binary);
    if (cached) {
        return cached;
    }
    const version = spawnSync(binary, ["--version"], {
        encoding: "utf8",
        env: env,
        timeout: 5_000,
    });
    const help = spawnSync(binary, ["serve", "--help"], {
        encoding: "utf8",
        env: env,
        timeout: 5_000,
    });
    const versionText = `${version.stdout ?? ""}${version.stderr ?? ""}`.trim();
    const match = versionText.match(/(\d+\.\d+\.\d+)/);
    const check = {
        binary,
        version: match?.[1] ?? null,
        serveHelpOk: help.status === 0,
        serveHelp: `${help.stdout ?? ""}${help.stderr ?? ""}`,
    };
    probed.set(binary, check);
    return check;
}
/** Fail before a model turn when the host cannot run the pinned SDK path. */
export function assertSdkHostSupport(env = process.env, museBinary) {
    let check;
    try {
        check = probeSdkHost(env, museBinary);
    }
    catch (error) {
        throw RequestError.internalError(undefined, `Muse SDK backend requires a Muse host with \`serve\` support ` +
            `(verified with ${MIN_MUSE_HOST_FOR_SDK}+, SDK ${SDK_PACKAGE}). ` +
            `${error instanceof Error ? error.message : String(error)}`);
    }
    if (!check.serveHelpOk) {
        throw RequestError.internalError(undefined, `Muse binary at ${check.binary} does not support \`muse serve\` ` +
            `(needed for ${SDK_PACKAGE}). Upgrade Muse Code to ${MIN_MUSE_HOST_FOR_SDK} or newer, ` +
            `or set MUSE_CODE_ACP_BACKEND=exec.`);
    }
    return check;
}
/** Map an SDK host exit into an actionable ACP error when possible. */
export function sdkHostExitMessage(stderr) {
    if (/experimental SDK tier is disabled/i.test(stderr)) {
        return ("the experimental SDK tier is disabled on this Muse host; " +
            `upgrade Muse Code to ${MIN_MUSE_HOST_FOR_SDK}+ with SDK support enabled, ` +
            "or set MUSE_CODE_ACP_BACKEND=exec");
    }
    return undefined;
}
/** Validate requested controls before binding them or starting a model turn. */
export function assertSdkSafetySupport(safety = DEFAULT_SAFETY, env = process.env, binary) {
    const check = assertSdkHostSupport(env, binary);
    requireAvailable(nativePolicyAvailability(safety.nativeApprovalPolicy, check.version));
    for (const flag of safetyArgs(safety).filter((arg) => arg.startsWith("--"))) {
        if (!check.serveHelp?.includes(flag))
            throw RequestError.invalidParams(undefined, `Muse SDK host does not advertise ${flag}; use default posture or upgrade Muse`);
    }
}
