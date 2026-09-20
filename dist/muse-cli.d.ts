/**
 * Resolve the `muse` binary this adapter wraps. `MUSE_CODE_EXECUTABLE` wins;
 * otherwise the PATH is searched. Throws with an actionable hint when absent
 * so editors surface a useful error instead of a failed spawn later.
 */
export declare function museCliPath(env?: Record<string, string | undefined>): string;
//# sourceMappingURL=muse-cli.d.ts.map