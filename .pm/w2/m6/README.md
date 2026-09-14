# w2 · m6 — Capability audit and evidence-backed directive fixes

**Worker:** worker1 **Goal:** Correct feasible omissions and misleading availability claims across the current adapter surface, with precise ownership for remaining blockers. **Status:** todo

## Tasks (in order)

| id   | title                                                     | est | depends_on             |
| ---- | --------------------------------------------------------- | --- | ---------------------- |
| t001 | Inventory advertised, rejected and ignored capabilities   | 60m | —                      |
| t002 | Recheck public routes and faithful adapter alternatives   | 90m | w2/m6/t001             |
| t003 | Fix residual capability routing and advertisement defects | 90m | w2/m6/t002             |
| t004 | Centralize actionable availability decisions              | 60m | w2/m6/t001, w2/m6/t003 |
| t005 | Validate ownership and prevent stale capability blockers  | 60m | w2/m6/t003, w2/m6/t004 |
| t006 | Update adoption guidance and capability limits            | 30m | w2/m6/t005             |
| t007 | Simplify milestone changes                                | 30m | w2/m6/t006             |
| t008 | CI and behavior coverage                                  | 45m | w2/m6/t006, w2/m6/t007 |
| t009 | Close out milestone                                       | 15m | w2/m6/t008             |

## Definition of done

- All task acceptance criteria are met with recorded evidence; research does not count as production delivery.
- Every advertised control has the promised observable effect, or its unavailable state has an accurate actionable explanation.
- Native support, adapter-owned behavior, host-version limits and unverified cases are separate; schema admission alone is insufficient.
- Safe defaults, session isolation, cancellation and stale-event behavior remain intact.
- Adoption guidance, simplification, required CI and real-host checks pass before physical archive closeout.
- Required host-blocked delivery stays open with a precise unblock condition; independent tasks continue.

## Source + Goal linkage

- **Source:** User requested research of approval, sandbox, settings and other unsupported capabilities, followed by a PM handoff entirely in w2.
- **Goal linkage:** Correct feasible omissions and misleading availability claims across the current adapter surface, with precise ownership for remaining blockers.
- **Expected outcome:** Tested user controls and truthful capabilities through the current ACP/backend surfaces.
- **Why now:** Existing declarations and older blockers mix native support, adapter feasibility and absence of verification; fix the classification and the underlying feasible omissions.
- **Sizing:** 9 tasks; substantive research and implementation exceed one hour without closing tasks.
- **Adoption surface:** Dedicated documentation task, then simplification, CI and closeout. No owned editor UI change is required.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public APIs, host-offered choices, unchanged defaults, no TUI/private storage or silent replay. Research is evidence of feasibility, not delivery.

## Validation evidence

[Feasibility research and ownership map](../evidence/capability-feasibility.md).
All implementation tasks remain todo. Existing approval and provider-request probes
support feasibility only; each task requires its specified regression coverage.

## Ownership after w1 cleanup

The [2026-09-14 ledger](../../ownership-2026-09-14.md) has completed the task
allocation; do not repeat that migration or implement features owned by
m4/m5/m7/m8/m9/m10. This milestone owns capability classification, uncovered
routing/advertisement defects and regression checks preventing contradictory
availability or blanket blockers. A fresh unowned positive finding must receive
one explicit w2 task, not duplicate an existing owner. Future w1 watches need a
new public support trigger; current unknown feasibility stays with its w2 owner.
