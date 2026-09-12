# w1 · m10 — Reusable SDK hosts and mid-turn steering

**Worker:** worker1 **Goal:** Allow corrections during active work and reduce repeated startup through safely scoped host reuse. **Status:** done

## Tasks (in order)

| id   | title                                                                   | est | depends_on               |
| ---- | ----------------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify host reuse boundaries and steering contract — **DONE**           | 45m | w1/m8/t007               |
| t002 | Introduce a session-owned reusable SDK host — **DONE**                  | 45m | w1/m10/t001              |
| t003 | Preserve settings, MCP and permission isolation during reuse — **DONE** | 45m | w1/m10/t002              |
| t004 | Implement negotiated serialized steering — **DONE**                     | 45m | w1/m10/t003              |
| t005 | Verify steering races and host reuse end to end — **DONE**              | 45m | w1/m10/t004              |
| t006 | Simplify milestone changes — **DONE**                                   | 30m | w1/m10/t005              |
| t007 | CI and behavior coverage — **DONE**                                     | 45m | w1/m10/t005, w1/m10/t006 |
| t008 | Close out the milestone — **DONE**                                      | 15m | w1/m10/t007              |

Estimated total: 5h 15m across 8 tasks. Priority: P1 steering; supporting host lifecycle. Scheduled after w1/m8/t007; cross-milestone dependencies refer to logical task IDs even after archival.

## Definition of done

- An executable test demonstrates accepted steering into the intended active turn.
- Documented reuse rules account for spawn-time sandbox flags, settings overlays, writer leases and shutdown; schema presence alone is not treated as proof.
- Two compatible turns use one host process and retain conversation continuity.
- Closing or disposing releases all owned processes/listeners; host death fails affected work without automatic prompt replay.
- MCP credentials, model/effort and read-only flags never leak between sessions or become stale after a settings change.
- Late replies cannot authorize another turn; replacement/close cleans overlays even after failure.
- Two concurrent steering requests reach the intended turn in deterministic order.
- Unnegotiated/unsupported clients retain baseline prompt behavior; failed or ambiguous steering is not silently replayed as a new turn.
- Race tests cannot deliver a correction to a later unintended turn or leave requests hanging.
- Real-host evidence shows steering delivery and compatible-turn process reuse; required session/approval tests remain valid.
- /simplify and all required affected CI profiles pass, with validation evidence recorded before closeout.
- Required host support that cannot be verified leaves its delivery task open with the blocker documented; a schema declaration or an unsupported fallback alone does not satisfy delivery.
- SDK and legacy exec advertise only the behavior each implements; client-specific extensions require explicit negotiation and retain a documented baseline fallback.

## Source + Goal linkage

- **Source:** User request on 2026-09-12 to hand off all recommendations from the read-only muse-code-acp versus `.tmp/codex-acp` comparison to w1. Reference implementation paths: `src/muse-sdk.ts`, `src/acp-agent.ts`, `src/mcp-overlay.ts`, `.tmp/codex-acp/src/SteeringQueue.ts`, `.tmp/codex-acp/src/CodexAcpServer.ts`. The local reference checkout may be temporary; the objectives and acceptance criteria here preserve the handoff.
- **Goal linkage:** Allow corrections during active work and reduce repeated startup through safely scoped host reuse. This advances the project's goal of a reliable, faithful ACP adapter for Muse Code.
- **Expected outcome:** Define a supported host/session ownership model and exact-target steering behavior before changing lifecycle code. Separate host lifetime from turn translation so compatible consecutive turns reuse their process. Maintain current configuration and security semantics when a process survives a turn. Accept user corrections through a documented ACP steering extension backed by public turn/steer. Prove correction delivery and lifecycle cleanup under competing events.
- **Why now:** Steering needs access to the live session; host reuse must preserve the settings and approval isolation currently provided by per-turn processes.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; this is a shippable milestone rather than an inbox note.
- **Cross-surface parity:** Omitted because changes stay in this adapter's protocol/backend, tests and docs; there is no owned editor UI change. Protocol translation, client capability negotiation and SDK/exec differences remain explicit acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public SDK/MSP APIs and feature detection, exact SDK/minimum-host compatibility, real host-provided permission gating, sandbox defaults, no TUI automation and no silent ambiguous-turn replay. Adapt reference patterns without copying vendor-specific internals.

## Validation evidence

User authorized skipping blocked m9 on 2026-09-12; m10 now depends on shipped m8. It does not require m9 compaction or observability and does not mark those delivered.

Raw public SDK probe against Muse 1.1.1-R2514.1 with dummy loopback credentials verified accepted turn/steer into the exact active turn, correction consumed at the next tool/model boundary, completed turn and two consecutive turns with one host retaining context. An early probe during a final text-only response was admitted but had no later provider call; acceptance is not a guarantee of another model call or that output already streaming changes.

Simplify completed with independent reuse, quality and efficiency reviews. Extracted shared host identity hashing with distinct discovery/execution error policies, replaced fixture rewriting with explicit scenarios, released closed-owner references, and bounded hosts to 32 successful turns and steering queues to 16 waiting requests. Deterministic tests cover configuration replacement, cross-session MCP isolation, exact targets, FIFO, startup/cancel/close/host death, malformed or rejected acknowledgements and completion before acknowledgement. Validation on 2026-09-12, macOS, Muse Code 1.1.1-R2514.1 and SDK 0.1.1: clean `npm ci` (zero vulnerabilities), `npm run check`, `npm run build`, full deterministic unit suite (245 tests), required `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` (14 tests, zero skips), and `npm run test:pack-smoke` all passed. The unit run includes the acknowledgement-deadline regression and all 8 owner tests. Loopback credentials were dummy and no paid provider ran. Real-host provider input verifies two corrections in order and context continuity across two turns with one execution-host spawn.

Regression fixes preserve gap-fill item identity, close the previous writer before cross-client load, isolate test stores/executable fixtures, dispose retained test hosts and retire any host whose turn completes before a pending steering acknowledgement. No latency percentage or paid-provider acceptance is claimed. m9 remains blocked and open; m11 is next.
