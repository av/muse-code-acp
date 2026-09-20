/**
 * Runs a non-streaming muse subcommand (`export`, `logout`, `skills list`)
 * and captures stdout. Rejects with the command name and stderr on a nonzero
 * exit. Streaming turns use `spawnMuseExec` instead.
 */
export declare function runMuseCapture(args: string[], env?: Record<string, string | undefined>, museBinary?: string): Promise<string>;
//# sourceMappingURL=muse-run.d.ts.map