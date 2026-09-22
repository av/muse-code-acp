/**
 * One ACP prompt must stay open across the model loop, the way Gemini CLI's
 * ACP session does: a tool call is not the end of the reply, and a length
 * cutoff is not a finished answer.
 */

export const MAX_EARLY_CONTINUATIONS = 2;

export const EARLY_CONTINUE_TEXT =
  "Continue from the exact point you stopped. The previous model stop was not a finished answer. Use any tool result you have not used yet, then write the rest of the reply. Do not stop immediately after a tool call.";

const TOOL_KINDS = new Set(["toolCall", "userShell", "workflow", "subagent"]);

export interface TurnStopItem {
  turnId?: string;
  kind?: unknown;
  text?: string;
}

/** Length-style provider finish reasons. Other reasons are a real stop. */
export function finishReasonCutOff(finishReason: string | undefined): boolean {
  return !!finishReason && /length|max_tokens|max_output/i.test(finishReason);
}

/**
 * True when a completed host turn did not finish the user-visible reply:
 * the provider cut the message off, the turn ended on a tool, or it ended
 * with no assistant text at all.
 */
export function turnStoppedEarly(
  items: readonly TurnStopItem[],
  turnId: string,
  finishReason?: string,
): boolean {
  if (finishReasonCutOff(finishReason)) return true;
  const mine = items.filter((item) => item.turnId === turnId);
  let lastTool = -1;
  let agentAfterTool = false;
  mine.forEach((item, index) => {
    if (TOOL_KINDS.has(String(item.kind))) lastTool = index;
    if (item.kind === "agentMessage" && item.text?.trim() && index > lastTool) {
      agentAfterTool = true;
    }
  });
  // No tool in this turn: streamed text may live in deltas rather than item.text.
  // That is a finished stop. Only a tool with no reply after it, or a length
  // cutoff, means the model quit early.
  if (lastTool < 0) return false;
  return !agentAfterTool;
}
