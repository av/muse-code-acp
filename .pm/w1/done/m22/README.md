# w1 · m22 — Plan mode, review workflows and permission presentation

**Worker:** worker1 **Goal:** Define which reference workflow semantics can be backed by public Muse host behavior. Expose verified planning behavior and /plan with explicit transition into implementation. Support working-tree, branch and commit reviews with precise target selection. Forward verified permission scope/reviewer states while retaining genuine host gating. **Status:** done

## Tasks (in order)

| id   | title                                                                   | est | depends_on               |
| ---- | ----------------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify plan, review and extended permission contracts — **DONE**        | 45m | w1/m10/t008              |
| t002 | Implement plan collaboration mode and guarded transition — **DONE**     | 45m | w1/m22/t001              |
| t003 | Implement review commands and review result events — **DONE**           | 45m | w1/m22/t002              |
| t004 | Present extended permission lifecycle and document workflows — **DONE** | 45m | w1/m22/t003              |
| t005 | Simplify milestone changes — **DONE**                                   | 30m | w1/m22/t004              |
| t006 | CI and behavior coverage — **DONE**                                     | 45m | w1/m22/t004, w1/m22/t005 |
| t007 | Close out the milestone — **DONE**                                      | 15m | w1/m22/t006              |

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

- **Source:** User handoff of [ADR003 parity work](../../../../docs/ADR003-codex-acp-parity.md) on 2026-09-12. The earlier m9–m19 handoffs retain their existing scope. See [handoff coverage](../../../w2/011.md).
- **Goal linkage:** Close the named remaining editor/runtime integration gaps while preserving truthful, reliable Muse ACP behavior.
- **Expected outcome:** Define which reference workflow semantics can be backed by public Muse host behavior. Expose verified planning behavior and /plan with explicit transition into implementation. Support working-tree, branch and commit reviews with precise target selection. Forward verified permission scope/reviewer states while retaining genuine host gating.
- **Why now:** Todo plans and file-change reports do not provide deliberate plan/review workflows or the reference's richer permission lifecycle.
- **Sizing:** 4 substantive implementation/investigation tasks exceed one hour without counting closing tasks.
- **Cross-surface parity:** Omitted: this is adapter/API, tests and documentation work with no owned editor UI. Protocol and backend differences are tested explicitly.
- **Adoption surface:** Covered by the last implementation task and CI acceptance: update README, applicable SDK/MCP support docs and ADR003; no duplicate closing task is needed.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; public SDK/MSP with feature detection, exact SDK/minimum-host evidence, real host-offered permission gating, sandbox defaults and no TUI automation or ambiguous-turn replay. Do not modify archived milestones or infer publication authorization.

## Validation evidence

Implemented and verified against Muse 1.1.1-R2514.1 with SDK 0.1.1. See docs/workflows.md for the adapter-defined planning/review contract, MCP exclusion, persistence and negotiated permission/review metadata. Public write/shell flags enforce planning constraints; no native collaboration or review API is invented.

- `npm run check`, `npm run build`: passed.
- `npm run test:unit`: 278 tests passed across 46 files after updating the mode list and preserving unreserved skill passthrough coverage.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback`: all 20 tests passed, including real approval metadata and original execution gating. Final strengthened workflow acceptance rerun passed: write/shell denied even with offered allow choices, planning restored, explicit default-mode implementation succeeded, all three Git targets reviewed, attempted review write denied.
- `npm run test:pack-smoke`: passed for 0.3.0.
- Simplify: three independent reuse/quality/efficiency reviews completed. Shared stage projection and command definitions; read preferences once; bounded actual untracked read bytes and descriptor cleanup; fixed cancellation during started-status delivery. Historical approval scans remain on the existing bounded-lifetime turn pump because the public fold offers no cheap revision token; no private observer API introduced.
- Unit/wire regressions cover MCP rejection, active-turn mode changes, cancellation, exact Git snapshots, invalid/oversized inputs, file growth after stat, final permission decisions and unknown stage kinds. Existing stale-choice and dismissal tests continue passing.
- A denied shell permission on the supported host can fail the approval submission; this remains a failed ACP prompt with no execution, not permission success. The stronger offered-allow probe independently proves the read-only shell restriction.
- No paid requests or publication. Exec behavior preserved; commands and protocol fallbacks documented. Logical task IDs remain unchanged.
