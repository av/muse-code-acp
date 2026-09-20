/**
 * What this adapter knows about the host it is actually talking to.
 *
 * The pinned SDK treats a schema-fingerprint divergence as an advisory warning
 * and keeps going, which is correct (additive evolution) but left the adapter
 * logging one line no ACP client could ever see. The w2/m1 stall happened on a
 * host that printed that warning on every run. Publishing the comparison gives
 * clients and bug reports the version facts without making a mismatch fatal.
 */
import { type FingerprintWarning } from "@muse-code/sdk";
/**
 * Muse hosts this adapter has been exercised against end to end. Membership is
 * evidence of testing, not a support promise, and never gates a connection.
 */
export declare const VERIFIED_MUSE_HOSTS: readonly ["1.1.1", "1.2.1"];
export interface HostCompatibility {
    /** The pinned SDK package this adapter speaks MSP through. */
    sdk: string;
    /** Reported by `muse --version`; null when the probe was skipped. */
    hostVersion: string | null;
    minimumHostVersion: string;
    verifiedHosts: readonly string[];
    pinnedFingerprint: string;
    servedFingerprint: string;
    /** False when the host serves a schema the pinned SDK was not written against. */
    matches: boolean;
}
/** Read the served schema fingerprint out of an `initialize` result. */
export declare function servedFingerprint(initializeResult: unknown): string | undefined;
export declare function hostCompatibility(options: {
    hostVersion?: string | null;
    served?: string;
    fingerprintWarning?: FingerprintWarning;
}): HostCompatibility;
//# sourceMappingURL=host-compatibility.d.ts.map