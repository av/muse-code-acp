import { z } from "zod";
/**
 * Muse Code JSONL event envelope, as emitted by `muse exec --json` (verified
 * against muse 0.2.1). Every stdout line is one envelope. Payloads are kept
 * open: unknown `payload_type`s must flow through untouched so newer muse
 * versions degrade gracefully instead of breaking the adapter.
 */
export declare const MUSE_ENVELOPE_SCHEMA_VERSION = 1;
export declare const museEnvelopeSchema: z.ZodObject<{
    schema_version: z.ZodNumber;
    id: z.ZodString;
    stream: z.ZodObject<{
        kind: z.ZodString;
        id: z.ZodString;
    }, z.core.$strip>;
    sequence: z.ZodNumber;
    recorded_at: z.ZodNumber;
    record_type: z.ZodString;
    durability: z.ZodString;
    causation_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payload_type: z.ZodString;
    payload_schema_version: z.ZodNumber;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$loose>;
export type MuseEnvelope = z.infer<typeof museEnvelopeSchema>;
/** `payload_type: "run.output.delta"` — streamed assistant text. */
export declare const runOutputDeltaPayloadSchema: z.ZodObject<{
    kind: z.ZodLiteral<"run_output_delta">;
    text: z.ZodString;
}, z.core.$loose>;
/** `payload_type: "run.terminal.*"` — end of a run. */
export declare const runTerminalPayloadSchema: z.ZodObject<{
    kind: z.ZodLiteral<"run_terminal">;
    terminal: z.ZodString;
    text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$loose>;
/** `payload_type: "turn.input.user"` — echo of the submitted prompt. */
export declare const turnInputUserPayloadSchema: z.ZodObject<{
    kind: z.ZodLiteral<"turn_input_user">;
    prompt: z.ZodString;
}, z.core.$loose>;
/**
 * `payload_type: "task.lifecycle.side_effect_intent"` — the durable record
 * muse writes before any side effect runs. Tool calls surface here first:
 * `operation: "tool:<name>"`, `idempotency_key: "tool:<call_id>"`, and the
 * policy verdict that let it run (e.g. "allow:policy").
 */
export declare const sideEffectIntentPayloadSchema: z.ZodObject<{
    kind: z.ZodLiteral<"task_lifecycle">;
    task_id: z.ZodString;
    event: z.ZodObject<{
        kind: z.ZodLiteral<"side_effect_intent">;
        task_id: z.ZodString;
        operation: z.ZodString;
        idempotency_key: z.ZodString;
        policy_decision: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>;
}, z.core.$loose>;
/**
 * `payload_type: "tool.result"` — a tool call settled. `correlation_facts`
 * carries the tool name and outcome on real tool executions; argument
 * validation failures come through with `text: "tool failed: …"` and no
 * correlation facts.
 */
export declare const toolResultPayloadSchema: z.ZodObject<{
    kind: z.ZodLiteral<"tool_result">;
    call_id: z.ZodString;
    text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    correlation_facts: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        tool_name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        outcome: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>>;
}, z.core.$loose>;
/** `payload_type: "approval_wait.effect.started"` — muse entered a
 * headless approval wait that ACP cannot answer in muse 0.2.1. */
export declare const approvalWaitStartedPayloadSchema: z.ZodObject<{
    kind: z.ZodLiteral<"approval_wait_effect">;
    run_id: z.ZodString;
    record: z.ZodObject<{
        kind: z.ZodString;
        pending_action_id: z.ZodString;
        task_id: z.ZodString;
        tool_call_id: z.ZodString;
        tool_name: z.ZodString;
    }, z.core.$loose>;
}, z.core.$loose>;
export type RunOutputDeltaPayload = z.infer<typeof runOutputDeltaPayloadSchema>;
export type RunTerminalPayload = z.infer<typeof runTerminalPayloadSchema>;
export type SideEffectIntentPayload = z.infer<typeof sideEffectIntentPayloadSchema>;
export type ToolResultPayload = z.infer<typeof toolResultPayloadSchema>;
/**
 * Incremental line splitter + envelope parser for a muse `--json` stdout
 * stream. Non-JSON lines and schema mismatches never throw: they are reported
 * to `onGarbage` (file logger territory) and skipped, because losing one event
 * must not kill a turn.
 */
export declare class MuseLineParser {
    private readonly onEnvelope;
    private readonly onGarbage;
    private buffer;
    constructor(onEnvelope: (envelope: MuseEnvelope) => void, onGarbage?: (line: string, reason: string) => void);
    push(chunk: string): void;
    /** Flush any trailing partial line (call once, at stream end). */
    end(): void;
    private parseLine;
}
//# sourceMappingURL=muse-events.d.ts.map