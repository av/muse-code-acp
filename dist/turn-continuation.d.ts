/**
 * One ACP prompt must stay open across the model loop, the way Gemini CLI's
 * ACP session does: a tool call is not the end of the reply, and a length
 * cutoff is not a finished answer.
 */
export declare const MAX_EARLY_CONTINUATIONS = 2;
export declare const EARLY_CONTINUE_TEXT = "Continue from the exact point you stopped. The previous model stop was not a finished answer. Use any tool result you have not used yet, then write the rest of the reply. Do not stop immediately after a tool call.";
export interface TurnStopItem {
    turnId?: string;
    kind?: unknown;
    text?: string;
}
/** Length-style provider finish reasons. Other reasons are a real stop. */
export declare function finishReasonCutOff(finishReason: string | undefined): boolean;
/**
 * True when a completed host turn did not finish the user-visible reply:
 * the provider cut the message off, the turn ended on a tool, or it ended
 * with no assistant text at all.
 */
export declare function turnStoppedEarly(items: readonly TurnStopItem[], turnId: string, finishReason?: string): boolean;
//# sourceMappingURL=turn-continuation.d.ts.map