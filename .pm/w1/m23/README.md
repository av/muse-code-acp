# w1 · m23 — Session commands and remaining editor presentation contracts

**Worker:** worker1 **Goal:** Provide /skills and /logout using existing authoritative adapter operations. Add /rename and live title updates backed by supported persistent metadata. Provide ACP deletion with semantics distinct from closing retained history. Close the client interoperability gap between Muse's exact-target extension and the reference steering contract where semantics can be preserved. Present verified web-search actions/results as useful structured tool cards. **Status:** todo

## Tasks (in order)

| id   | title                                                     | est | depends_on               |
| ---- | --------------------------------------------------------- | --- | ------------------------ |
| t001 | Add local skills and logout command handlers              | 45m | w1/m10/t008              |
| t002 | Implement verified session rename                         | 45m | w1/m23/t001              |
| t003 | Implement verified session deletion                       | 45m | w1/m23/t002              |
| t004 | Assess and implement compatible steering negotiation      | 45m | w1/m23/t003              |
| t005 | Improve search presentation and publish command contracts | 45m | w1/m23/t004              |
| t006 | Simplify milestone changes                                | 30m | w1/m23/t005              |
| t007 | CI and behavior coverage                                  | 45m | w1/m23/t005, w1/m23/t006 |
| t008 | Close out the milestone                                   | 15m | w1/m23/t007              |

Estimated total: 5h 15m across 8 tasks. Only listed dependencies are prerequisites; milestone numbering does not impose a dependency on all earlier work.

## Definition of done

- Wire tests prove handlers do not accidentally submit a model prompt.
- Logout response does not imply exported credentials were removed; command delivery respects close/dispose.
- New titles persist across adapter restart and appear consistently in list/load/live updates.
- Late fallback titles cannot overwrite a user rename; unavailable native rename is not falsely advertised as cross-client persistence.
- Successful deletion makes the target unavailable to subsequent load/list while preserving other sessions.
- No public deletion support leaves delivery open; direct undocumented store deletion and changing close semantics are excluded.
- Wire fixtures for both contracts show accepted requests target the intended turn and stale requests never start unintended work.
- Incompatible idle behavior is explicitly rejected or documented; an alias alone is not claimed as full compatibility.
- Search cards display known query/action information without parsing unsupported private payloads or inventing citations.
- Generic tools still render and the documentation distinguishes supported handlers, native behavior and adapter-owned behavior.
- Required host delivery has acceptance evidence; unsupported required functionality stays open with a concrete upstream blocker.
- Explicit assessment/proposal work may finish with a documented non-target or infeasibility decision, but does not count as delivered parity.
- Adoption docs, /simplify and required affected CI checks are complete before closeout.

## Source + Goal linkage

- **Source:** User handoff of [ADR003 parity work](../../../docs/ADR003-codex-acp-parity.md) on 2026-09-12. The earlier m9–m19 handoffs retain their existing scope. See [handoff coverage](../001.md).
- **Goal linkage:** Close the named remaining editor/runtime integration gaps while preserving truthful, reliable Muse ACP behavior.
- **Expected outcome:** Provide /skills and /logout using existing authoritative adapter operations. Add /rename and live title updates backed by supported persistent metadata. Provide ACP deletion with semantics distinct from closing retained history. Close the client interoperability gap between Muse's exact-target extension and the reference steering contract where semantics can be preserved. Present verified web-search actions/results as useful structured tool cards.
- **Why now:** Close, metadata updates, skills and Muse-specific steering leave separate delete, rename, built-in command and client interoperability gaps.
- **Sizing:** 5 substantive implementation/investigation tasks exceed one hour without counting closing tasks.
- **Cross-surface parity:** Omitted: this is adapter/API, tests and documentation work with no owned editor UI. Protocol and backend differences are tested explicitly.
- **Adoption surface:** Covered by the last implementation task and CI acceptance: update README, applicable SDK/MCP support docs and ADR003; no duplicate closing task is needed.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; public SDK/MSP with feature detection, exact SDK/minimum-host evidence, real host-offered permission gating, sandbox defaults and no TUI automation or ambiguous-turn replay. Do not modify archived milestones or infer publication authorization.

## Validation evidence

Pending implementation. ADR003 is a source-based comparison; new host surfaces still require verification. No feature or task is marked delivered by this handoff.
