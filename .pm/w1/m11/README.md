# w1 · m11 — Delegated worker lifecycle and native child sessions

**Worker:** worker1 **Goal:** Make delegated work visible, inspectable and controllable with correctly routed permissions. **Status:** todo (blocked: public host worker launch unavailable)

## Tasks (in order)

| id   | title                                                  | est | depends_on               |
| ---- | ------------------------------------------------------ | --- | ------------------------ |
| t001 | Render worker and workflow lifecycle cards             | 45m | w1/m10/t008              |
| t002 | Negotiate and route native ACP child sessions          | 45m | w1/m11/t001              |
| t003 | Restore child histories and worker state               | 45m | w1/m11/t002              |
| t004 | Route child approvals through the owning ACP client    | 45m | w1/m11/t003              |
| t005 | Expose verified worker controls and validate lifecycle | 45m | w1/m11/t004              |
| t006 | Simplify milestone changes                             | 30m | w1/m11/t005              |
| t007 | CI and behavior coverage                               | 45m | w1/m11/t005, w1/m11/t006 |
| t008 | Close out the milestone                                | 15m | w1/m11/t007              |

Estimated total: 5h 15m across 8 tasks. Priority: P1 worker visibility; progressive native integration. Scheduled after w1/m10/t008; cross-milestone dependencies refer to logical task IDs even after archival.

## Definition of done

- Start, progress, completion, failure and cancellation update the same worker card.
- Concurrent/nested children remain distinct; delegatedWorkers metadata reflects tested support.
- Negotiated clients see distinct child session streams; baseline clients continue to see cards.
- Repeated child updates do not create duplicate sessions or leak one parent's events into another.
- Load after restart restores available child history with stable identity and no duplicated messages.
- Unavailable history produces an explicit bounded response and does not execute a task.
- A child side effect waits for its corresponding approval and executes only after a valid host-offered grant.
- Denial, missing capability, malformed replies and stale decisions cannot authorize another child or turn.
- A control targets exactly one worker, with clear accepted/terminal results; sibling work remains unaffected.
- Real-host lifecycle evidence and wire tests cover both negotiated and legacy flows; unsupported required host APIs keep the affected implementation task open with a recorded blocker.
- /simplify and all required affected CI profiles pass, with validation evidence recorded before closeout.
- Required host support that cannot be verified leaves its delivery task open with the blocker documented; a schema declaration or an unsupported fallback alone does not satisfy delivery.
- SDK and legacy exec advertise only the behavior each implements; client-specific extensions require explicit negotiation and retain a documented baseline fallback.

## Source + Goal linkage

- **Source:** User request on 2026-09-12 to hand off all recommendations from the read-only muse-code-acp versus `.tmp/codex-acp` comparison to w1. Reference implementation paths: `src/muse-sdk-events.ts`, `src/muse-sdk.ts`, `.tmp/codex-acp/src/subagents/AcpSubagents.ts`, `.tmp/codex-acp/src/subagents/CodexSubagentEventRouter.ts`. The local reference checkout may be temporary; the objectives and acceptance criteria here preserve the handoff.
- **Goal linkage:** Make delegated work visible, inspectable and controllable with correctly routed permissions. This advances the project's goal of a reliable, faithful ACP adapter for Muse Code.
- **Expected outcome:** Provide useful worker visibility to every ACP client without requiring native child-session support. Offer separate child sessions only when both client and adapter support the selected extension. Make worker sessions inspectable after reload using public history surfaces. Ensure native and fallback worker flows preserve real Muse permission gating. Allow supported negotiated clients to target worker operations without affecting unrelated work.
- **Why now:** Richer runtime reporting and host ownership provide the base for child histories and controls; deliver baseline visibility before native extensions.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; this is a shippable milestone rather than an inbox note.
- **Cross-surface parity:** Omitted because changes stay in this adapter's protocol/backend, tests and docs; there is no owned editor UI change. Protocol translation, client capability negotiation and SDK/exec differences remain explicit acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public SDK/MSP APIs and feature detection, exact SDK/minimum-host compatibility, real host-provided permission gating, sandbox defaults, no TUI automation and no silent ambiguous-turn replay. Adapt reference patterns without copying vendor-specific internals.

## Validation evidence

Blocked investigation on 2026-09-12 after shipped m10 (`3b26891`). m9 remains skipped under the earlier user instruction; no m11 task is marked complete.

- Environment: macOS aarch64, Muse Code 1.1.1-R2514.1 (host build b934305d214ca7b7ee5493ac696cd2109020b314), SDK 0.1.1, default durable `muse serve`, isolated dummy credentials and loopback provider; no paid provider calls.
- Reproduction: initialize, start a session, submit a turn; provider emits the host-offered `workflow` tool with `export default async function workflow(host) { return await host.agent({ input: "m11-child-probe: reply hello" }); }`. Wait for root completion and five seconds of background observation. Read root history and list sessions.
- The tool item's public `visibleOutput` claims `status: launched`, but the actual provider-facing `function_call_output` is `workflow_launch_unavailable: this client did not install a workflow launcher; no child work started`. A launch envelope alone is therefore not execution evidence. No workflow/subagent lifecycle items or verified worker control identity were emitted.
- Repeated with `initialize.capabilities.experimentalApi: true`; the host echoed true and produced the same launcher failure. A final independent default-capability run confirmed the exact failure again. `muse serve --help` exposes no workflow-launcher enablement option.
- Positive observation: real `reminderChild` items carry childSessionId values. However each returned child ID rejected both public `session/read` and `session/resume` with MSP `-32020`, session not found. Root read/list succeeded, so these are child lookup failures rather than connection failure. This does not establish readable/restorable child histories or routable child approvals.
- Public SDK declarations expose subagent controls targeting `(parent sessionId, subagentId)` and child history via childSessionId. Installed/reference generated method lists have no `view/subscribe`; a hand-authored transcript mentioning it is not a callable public contract. `MuseClient` ignores unknown-session notifications, and `Connection.onNotification` replaces its router rather than adding a second observer.
- Local reproducible probe and raw evidence are preserved under `.tmp/m11-probe/`: run `node .tmp/m11-probe/probe.mjs` or add `--experimental` after building the repo. This temporary directory is ignored and contains isolated probe data, not production implementation.
- Unblock requires a supported host/public integration with an installed worker launcher and accessible child sessions, followed by real child grant/deny, lifecycle, history and sibling-isolation tests. Alternatively, explicitly revise m11 scope to ship only verified baseline cards and defer native children/controls. No private storage parsing, fabricated transcripts or synthetic permission grants substitute for those requirements.

The investigation changed no production code. m11 remains open; committing this evidence and the parity planning documents does not ship its blocked implementation.
