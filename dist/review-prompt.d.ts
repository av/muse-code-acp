export declare const MAX_REVIEW_BYTES: number;
export type WorkflowCommand = {
    kind: "plan";
    text: string;
} | {
    kind: "review";
    target: "workingTree" | "branch" | "commit";
    ref?: string;
};
/** Freeze exact Git inputs before asking Muse to review; refs are argv data. */
export declare function buildReviewPrompt(cwd: string, command: Extract<WorkflowCommand, {
    kind: "review";
}>): Promise<string>;
//# sourceMappingURL=review-prompt.d.ts.map