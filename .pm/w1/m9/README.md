# w1 · m9 — Usage, context management and live run visibility

**Worker:** worker1 **Goal:** Let ACP clients observe consumption, context pressure, plans and live progress, and explicitly compact supported sessions. **Status:** todo (blocked: durable Muse compaction unavailable)

## Tasks (in order)

| id   | title                                                      | est | depends_on             |
| ---- | ---------------------------------------------------------- | --- | ---------------------- |
| t001 | Forward token usage and context pressure                   | 45m | w1/m8/t007             |
| t002 | Expose explicit compaction and its lifecycle               | 45m | w1/m9/t001             |
| t003 | Map todo snapshots to ACP plans                            | 30m | w1/m9/t002             |
| t004 | Stream provider-exposed reasoning summaries                | 45m | w1/m9/t003             |
| t005 | Forward live tool output and render unsupported item kinds | 45m | w1/m9/t004             |
| t006 | Add status command and validate observability recovery     | 45m | w1/m9/t005             |
| t007 | Simplify milestone changes                                 | 30m | w1/m9/t006             |
| t008 | CI and behavior coverage                                   | 45m | w1/m9/t006, w1/m9/t007 |
| t009 | Close out the milestone                                    | 15m | w1/m9/t008             |

Estimated total: 5h 45m across 9 tasks. Priority: P1 usage/context; P2 plans and progress. Scheduled after w1/m8/t007; cross-milestone dependencies refer to logical task IDs even after archival.

## Definition of done

- Repeated events, gap recovery and reload do not double-count usage; child totals are not silently added to parent totals.
- Known usage and context pressure reach the ACP client, while unavailable measurements remain unavailable.
- Accepted compaction is not reported as complete until a terminal event arrives; noop is handled as success.
- Failure, cancellation and session close settle pending work and do not launch a duplicate turn.
- Create, modify, complete and empty-list events produce the expected ACP plan.
- Gap catch-up and session load do not retain obsolete entries.
- Summary deltas and terminal-only summary items render once in order.
- Providers exposing no summary remain supported; encrypted/private reasoning is never accessed.
- Interleaved tools and completion-only events produce correctly correlated progress with no duplicate output.
- Unknown items retain visible lifecycle/fallback text; truncated output is not presented as complete.
- Status reports observed configuration and usage without starting a model turn.
- Replay/live transitions preserve plans, usage and progress without duplication; unsupported clients receive a documented baseline fallback.
- /simplify and all required affected CI profiles pass, with validation evidence recorded before closeout.
- Required host support that cannot be verified leaves its delivery task open with the blocker documented; a schema declaration or an unsupported fallback alone does not satisfy delivery.
- SDK and legacy exec advertise only the behavior each implements; client-specific extensions require explicit negotiation and retain a documented baseline fallback.

## Source + Goal linkage

- **Source:** User request on 2026-09-12 to hand off all recommendations from the read-only muse-code-acp versus `.tmp/codex-acp` comparison to w1. Reference implementation paths: `src/muse-sdk-events.ts`, `src/muse-sdk.ts`, `.tmp/codex-acp/src/CodexEventHandler.ts`, `.tmp/codex-acp/src/CodexCommands.ts`. The local reference checkout may be temporary; the objectives and acceptance criteria here preserve the handoff.
- **Goal linkage:** Let ACP clients observe consumption, context pressure, plans and live progress, and explicitly compact supported sessions. This advances the project's goal of a reliable, faithful ACP adapter for Muse Code.
- **Expected outcome:** Map authoritative session and turn counters into supported ACP usage surfaces and negotiated metadata where necessary. Provide a /compact command backed by session/compact and observable asynchronous completion. Render authoritative Muse todo lists as live ACP plan updates. Forward public reasoning summaries where the host/provider supplies them. Keep long tools visible and avoid silently losing new SDK item kinds. Make observed usage/context available through /status and verify all new surfaces across recovery boundaries.
- **Why now:** The current translator discards richer MSP items and session notifications; expose verified events before introducing more control surfaces.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; this is a shippable milestone rather than an inbox note.
- **Cross-surface parity:** Omitted because changes stay in this adapter's protocol/backend, tests and docs; there is no owned editor UI change. Protocol translation, client capability negotiation and SDK/exec differences remain explicit acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public SDK/MSP APIs and feature detection, exact SDK/minimum-host compatibility, real host-provided permission gating, sandbox defaults, no TUI automation and no silent ambiguous-turn replay. Adapt reference patterns without copying vendor-specific internals.

## Validation evidence

Blocked investigation (2026-09-12), after shipping m8 at 5188179:

- Host: Muse Code 1.1.1-R2514.1, SDK 0.1.1, macOS; isolated local loopback provider with dummy credentials.
- Reproduction: spawn `muse serve` with default durable sessions; initialize; `session/start`; `turn/start`; await `turn/completed`; submit public `session/compact` for that session.
- Result: MSP error `-32030`, `session/compact ... rejected: compaction_unavailable`. A second independent run with `initialize.capabilities.experimentalApi: true` confirmed negotiation true, a completed turn, and the same rejection.
- This is an admission rejection, not a completed/noop compaction. Required accepted-to-terminal behavior cannot be proven, so t002 and the milestone remain open. No fake-host success substitutes for host delivery.
- Public SDK reference checkout at `fbce769` contains QA scenario D19778 in `clients/sdk-ts/qa/scenarios/defect-classes.ts` (around line178). It describes durable compaction being refused because the retained-session sink lacks the strict-append channel, before target classification. The observed rejection is consistent with that documented defect; adapter code alone does not establish a host fix.
- Positive observation: the successful raw SDK turn emitted `session/tokenUsage` with cumulative prompt1/output1/total2. Usage/context/plan delivery remains unimplemented and no task is marked done.
- Resume requires a supported Muse build with working durable compaction (and updated compatibility evidence), or an explicit decision to revise m9 scope/dependencies. Do not switch to ephemeral sessions, synthesize local summaries or skip to m10 to declare completion.
- Partial exploration is preserved locally under `.tmp/m9-blocked/`; it is unverified and excluded from production source and commits. The user subsequently authorized skipping m9; independent m10 shipped at `3b26891`. m9 remains open and none of its delivery is implied by m10.
