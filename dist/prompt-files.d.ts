import { type ContentBlock } from "@agentclientprotocol/sdk";
export type CompiledMusePrompt = {
    prompt: string;
    imagePaths: string[];
    cleanup(): Promise<void>;
};
export declare function compileMusePrompt(blocks: ContentBlock[]): Promise<CompiledMusePrompt>;
//# sourceMappingURL=prompt-files.d.ts.map