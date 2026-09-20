declare const FAKE_MODEL_ID = "fake-model";
export declare const ALTERNATE_MODEL_ID = "fake-model-alternate";
export interface LoopbackProviderOptions {
    statusCode?: number;
    publicSummary?: string;
    holdMsForRequest?: (request: Record<string, unknown>) => number;
    /** Substrings that must all appear in the request body to script a bash tool call. */
    scriptedToolCallWhen: readonly string[];
    scriptedToolCallCommand: string;
    /** Override the default bash call when exercising another host-provided tool. */
    scriptedToolCall?: {
        name: string;
        arguments: Record<string, unknown>;
    };
    scriptedToolCallForRequest?: (request: Record<string, unknown>) => {
        name: string;
        arguments: Record<string, unknown>;
    } | undefined | Promise<{
        name: string;
        arguments: Record<string, unknown>;
    } | undefined>;
    replyText?: string;
    /** Hold SSE open so cancel races stay deterministic. */
    holdMs?: number;
}
export interface LoopbackProvider {
    home: string;
    root: string;
    baseUrl: string;
    catalogGets(): number;
    authorizations(): (string | undefined)[];
    scriptedToolCalls(): number;
    requests(): Record<string, unknown>[];
    close(): Promise<void>;
}
export declare function startLoopbackProvider(options: LoopbackProviderOptions): Promise<LoopbackProvider>;
export { FAKE_MODEL_ID };
//# sourceMappingURL=loopback-provider.d.ts.map