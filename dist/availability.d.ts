export type Availability = {
    available: true;
    implementation: "native" | "adapter";
} | {
    available: false;
    kind: "unknown" | "backend" | "version" | "guard" | "busy" | "negotiation" | "unverified" | "unsupported";
    reason: string;
};
export declare function unavailable(kind: Exclude<Availability, {
    available: true;
}>["kind"], reason: string): Availability;
/** Advertisement and request rejection consume the same decision. */
export declare function requireAvailable(decision: Availability): void;
/** Native policy enforcement is separate from adapter-issued once decisions. */
export declare function nativePolicyAvailability(policy: string, hostVersion: string | null | undefined): Availability;
/** The public host has one authorized workspaceRoot. Reject, never ignore extras. */
export declare function requireSingleWorkspace(additionalDirectories?: readonly string[] | null): void;
//# sourceMappingURL=availability.d.ts.map