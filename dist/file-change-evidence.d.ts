import type { FoldedItem } from "@muse-code/sdk";
import type { ClientCapabilities, ToolCallContent } from "@agentclientprotocol/sdk";
export declare function supportsFileReport(capabilities: ClientCapabilities): boolean;
export declare const FILE_REPORT_CAPABILITIES: {
    jetbrains: {
        air: {
            version: number;
            capabilities: string[];
        };
    };
};
export declare function fileReportRequest(meta: unknown): string | undefined;
/** Bounded observed states, never a claim that every workspace edit was made by Muse. */
export declare class FileChangeEvidence {
    private readonly cwd;
    private readonly before;
    private readonly paths;
    private bytes;
    private reportBytes;
    private truncated;
    private snapshotTimedOut;
    constructor(cwd: string);
    private path;
    private read;
    private remember;
    private capturePath;
    beforeApproval(tool: string, rawArgs: string): void;
    present(item: FoldedItem): ToolCallContent[] | undefined;
    report(requestId: string, outcome: "completed" | "cancelled" | "failed"): {
        jetbrains: {
            air: {
                version: number;
                agentFileChangeReport: {
                    version: number;
                    requestId: string;
                    status: string;
                    reason: string;
                    paths?: undefined;
                    declaredComplete?: undefined;
                    truncated?: undefined;
                    uncertainty?: undefined;
                } | {
                    version: number;
                    requestId: string;
                    status: string;
                    paths: string[];
                    declaredComplete: boolean;
                    truncated: boolean;
                    uncertainty: string;
                    reason?: undefined;
                };
            };
        };
    };
}
//# sourceMappingURL=file-change-evidence.d.ts.map