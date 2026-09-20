/** Shared spawn identity; credentials enter only an opaque digest, never its result. */
export declare function museHostIdentity(cwd: string, env: Record<string, string | undefined>, museBinary?: string, tolerateUnreadableConfig?: boolean): {
    binary: string;
    cwd: string;
    identity: string;
};
//# sourceMappingURL=host-identity.d.ts.map