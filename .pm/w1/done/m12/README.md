# w1 · m12 — Session branching through public Muse fork support

**Worker:** worker1 **Goal:** Let clients explore an alternative conversation without changing the source session. **Status:** done

## Tasks (in order)

| id   | title                                                           | est | depends_on               |
| ---- | --------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify and expose ACP session fork — **DONE**                   | 45m | w1/m10/t008              |
| t002 | Preserve fork workspace and configuration provenance — **DONE** | 45m | w1/m12/t001              |
| t003 | Prove branch continuity across restart — **DONE**               | 45m | w1/m12/t002              |
| t004 | Simplify milestone changes — **DONE**                           | 30m | w1/m12/t003              |
| t005 | CI and behavior coverage — **DONE**                             | 45m | w1/m12/t003, w1/m12/t004 |
| t006 | Close out the milestone — **DONE**                              | 15m | w1/m12/t005              |

Estimated total: 3h 45m across 6 tasks. Priority: P2. Scheduled after w1/m10/t008; cross-milestone dependencies refer to logical task IDs even after archival.

## Definition of done

- A fork returns a distinct session with the requested prior context and leaves the original unchanged.
- Unknown sessions and invalid boundaries return meaningful errors; older hosts do not advertise unsupported fork.
- Source and fork continue independently with correct workspace/model/effort and no shared mutable ACP state.
- In-flight close/disposal cannot resurrect a fork, and sandbox defaults are preserved.
- Provider input for the fork includes exactly the selected history and subsequent fork messages.
- Source history excludes fork-only messages; restored branches retain correct settings and ownership.
- /simplify and all required affected CI profiles pass, with validation evidence recorded before closeout.
- Required host support that cannot be verified leaves its delivery task open with the blocker documented; a schema declaration or an unsupported fallback alone does not satisfy delivery.
- SDK and legacy exec advertise only the behavior each implements; client-specific extensions require explicit negotiation and retain a documented baseline fallback.

## Source + Goal linkage

- **Source:** User request on 2026-09-12 to hand off all recommendations from the read-only muse-code-acp versus `.tmp/codex-acp` comparison to w1. Reference implementation paths: `src/acp-agent.ts`, `src/session-preferences.ts`, `.tmp/codex-acp/src/SessionFork.ts`, `.tmp/codex-acp/src/CodexAcpServer.ts`. The local reference checkout may be temporary; the objectives and acceptance criteria here preserve the handoff.
- **Goal linkage:** Let clients explore an alternative conversation without changing the source session. This advances the project's goal of a reliable, faithful ACP adapter for Muse Code.
- **Expected outcome:** Map ACP session/fork onto public Muse session/fork with validated source and cut boundaries. Bind forks safely to their source workspace and make inheritance explicit. Validate observable history and independent continuation for both source and fork.
- **Why now:** Build branching on the verified session ownership, configuration and history contracts rather than copying native files.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; this is a shippable milestone rather than an inbox note.
- **Cross-surface parity:** Omitted because changes stay in this adapter's protocol/backend, tests and docs; there is no owned editor UI change. Protocol translation, client capability negotiation and SDK/exec differences remain explicit acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public SDK/MSP APIs and feature detection, exact SDK/minimum-host compatibility, real host-provided permission gating, sandbox defaults, no TUI automation and no silent ambiguous-turn replay. Adapt reference patterns without copying vendor-specific internals.

## Validation evidence

Implemented and verified on 2026-09-12 with SDK 0.1.1 and Muse 1.1.1-R2514.1:

- ACP native `session/fork` is advertised for supported SDK hosts. Baseline copies all completed history; negotiated `muse/fork` metadata accepts a completed native turn boundary and reports host provenance. Exec/older/unknown hosts remain unadvertised.
- Workspace ownership, source activity/pending input, distinct identity, boundary provenance and native model are checked. Fork bindings serialize source operations and reject late results after disposal. Config, MCP inventory and saved effort are independent; safety mode resets to default without inherited permission grants.
- Real-host acceptance passed for explicit and full-history forks, invalid boundaries, source/fork model and effort, ACP process restart with load/resume, and independent provider inputs. Loopback provider uses dummy credentials and no paid endpoints.
- Native fork defaults use host settings. An accepted idle `session/setModel` did not produce an observed model change or persisted selection, including a five-second read and separate-host restart probe. Reusing the existing isolated execution-settings overlay with the authoritative source model resolves this host limitation; fork metadata and restart acceptance verify the resulting selection. No direct native-store edits or synthetic turns.
- `npm run check`, `npm run build`, `npm run test:unit`: passed (290 tests, 48 files). `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback`: passed (21 tests, seven files). `npm run test:pack-smoke`: passed clean packed install and ACP initialize/new/prompt/stream/close.
- Simplify reuse/quality/efficiency reviews completed: support lookup reused, preferences saved atomically, temporary test paths cleaned. A second native source read is retained to validate state immediately before mutation.
- Adoption: `docs/session-fork.md`, README, SDK support matrix and ADR003. All six tasks completed and archived in dependency order. Local probes are retained under `.tmp/m12-probe/` and are not release artifacts.

## Dependency review (2026-09-12)

The user-authorized follow-up research removed ordering-only dependence on m11.
Forking uses delivered m10 host/session ownership; unavailable delegated workers
are not prerequisites. Acceptance criteria and native-host evidence requirements
are unchanged by that scheduling correction.
