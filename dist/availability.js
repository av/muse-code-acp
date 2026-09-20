import { RequestError } from "@agentclientprotocol/sdk";
export function unavailable(kind, reason) {
    return { available: false, kind, reason };
}
/** Advertisement and request rejection consume the same decision. */
export function requireAvailable(decision) {
    if (decision.available)
        return;
    const data = { availability: decision.kind };
    if (decision.kind === "busy")
        throw RequestError.invalidRequest(data, decision.reason);
    throw RequestError.invalidParams(data, decision.reason);
}
/** Native policy enforcement is separate from adapter-issued once decisions. */
export function nativePolicyAvailability(policy, hostVersion) {
    if (policy === "onRequest")
        return { available: true, implementation: "native" };
    if (!["promptUnmatched", "denyUnmatched", "allowAll"].includes(policy))
        return unavailable("unknown", "Unknown native approval policy; choose an advertised option");
    const version = hostVersion
        ?.match(/^(\d+)\.(\d+)\.(\d+)/)
        ?.slice(1)
        .map(Number);
    if (!version)
        return unavailable("unverified", "Native policy enforcement is unverified on this host; use onRequest with adapter bypassApprovals/rejectApprovals");
    if (version[0] > 1 ||
        (version[0] === 1 && (version[1] > 2 || (version[1] === 2 && version[2] >= 1))))
        return { available: true, implementation: "native" };
    return unavailable("version", `Native ${policy} enforcement is not verified on Muse ${hostVersion}; use onRequest with bypassApprovals/rejectApprovals, or Muse 1.2.1+`);
}
/** The public host has one authorized workspaceRoot. Reject, never ignore extras. */
export function requireSingleWorkspace(additionalDirectories) {
    if (additionalDirectories?.length)
        requireAvailable(unavailable("unsupported", "Muse Code supports one workspace root; start a separate session for another workspace. No additional directory was authorized"));
}
