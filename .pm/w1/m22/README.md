# w1 · m22 — Plan mode, review workflows and permission presentation

**Worker:** worker1 **Goal:** Define which reference workflow semantics can be backed by public Muse host behavior. Expose verified planning behavior and /plan with explicit transition into implementation. Support working-tree, branch and commit reviews with precise target selection. Forward verified permission scope/reviewer states while retaining genuine host gating. **Status:** todo

## Tasks (in order)

| id   | title                                                        | est | depends_on               |
| ---- | ------------------------------------------------------------ | --- | ------------------------ |
| t001 | Verify plan, review and extended permission contracts        | 45m | w1/m10/t008              |
| t002 | Implement plan collaboration mode and guarded transition     | 45m | w1/m22/t001              |
| t003 | Implement review commands and review result events           | 45m | w1/m22/t002              |
| t004 | Present extended permission lifecycle and document workflows | 45m | w1/m22/t003              |
| t005 | Simplify milestone changes                                   | 30m | w1/m22/t004              |
| t006 | CI and behavior coverage                                     | 45m | w1/m22/t004, w1/m22/t005 |
| t007 | Close out the milestone                                      | 15m | w1/m22/t006              |

Estimated total: 4h 30m across 7 tasks. Only listed dependencies are prerequisites; milestone numbering does not impose a dependency on all earlier work.

## Definition of done

- Plan-before-implementation and review target behavior have testable definitions.
- No reference permission choice is fabricated when Muse did not offer it.
- Planning does not silently start implementation or bypass approval after a mode change.
- Wire and host tests prove the advertised behavior; missing enforcement keeps delivery blocked rather than using a misleading label.
- Local repository fixtures show the intended diff is reviewed for each command without modifying user files.
- Unsupported targets fail clearly; review execution is distinct from m13 change reporting and does not invent a native review API.
- Only live host-offered choices can grant an operation; display metadata cannot broaden scope.
- Unknown review stages render honestly and unavailable provider-specific fields remain absent.
- Required host delivery has acceptance evidence; unsupported required functionality stays open with a concrete upstream blocker.
- Explicit assessment/proposal work may finish with a documented non-target or infeasibility decision, but does not count as delivered parity.
- Adoption docs, /simplify and required affected CI checks are complete before closeout.

## Source + Goal linkage

- **Source:** User handoff of [ADR003 parity work](../../../docs/ADR003-codex-acp-parity.md) on 2026-09-12. The earlier m9–m19 handoffs retain their existing scope. See [handoff coverage](../001.md).
- **Goal linkage:** Close the named remaining editor/runtime integration gaps while preserving truthful, reliable Muse ACP behavior.
- **Expected outcome:** Define which reference workflow semantics can be backed by public Muse host behavior. Expose verified planning behavior and /plan with explicit transition into implementation. Support working-tree, branch and commit reviews with precise target selection. Forward verified permission scope/reviewer states while retaining genuine host gating.
- **Why now:** Todo plans and file-change reports do not provide deliberate plan/review workflows or the reference's richer permission lifecycle.
- **Sizing:** 4 substantive implementation/investigation tasks exceed one hour without counting closing tasks.
- **Cross-surface parity:** Omitted: this is adapter/API, tests and documentation work with no owned editor UI. Protocol and backend differences are tested explicitly.
- **Adoption surface:** Covered by the last implementation task and CI acceptance: update README, applicable SDK/MCP support docs and ADR003; no duplicate closing task is needed.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; public SDK/MSP with feature detection, exact SDK/minimum-host evidence, real host-offered permission gating, sandbox defaults and no TUI automation or ambiguous-turn replay. Do not modify archived milestones or infer publication authorization.

## Validation evidence

Pending implementation. ADR003 is a source-based comparison; new host surfaces still require verification. No feature or task is marked delivered by this handoff.
