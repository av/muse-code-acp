# w2 · m5 — Faithful model, effort and restored session settings

**Worker:** worker1 **Goal:** Make each advertised model/effort setting reach its intended target or clearly report its actual limitation. **Status:** done

## Tasks (in order)

| id   | title                                                                   | est | depends_on                                     |
| ---- | ----------------------------------------------------------------------- | --- | ---------------------------------------------- |
| t001 | Build a provider-observed settings matrix — **DONE**                    | 60m | w1/m8/t007                                     |
| t002 | Fix model and provider selection fidelity — **DONE**                    | 60m | w2/m5/t001                                     |
| t003 | Make effort choices truthful for each backend and host — **DONE**       | 60m | w2/m5/t001                                     |
| t009 | Implement isolated client provider and gateway configuration — **DONE** | 60m | w2/m5/t001                                     |
| t010 | Publish negotiated configuration recommendations — **DONE**             | 60m | w2/m5/t003, w2/m5/t009                         |
| t004 | Reconcile requested, observed and restored settings — **DONE**          | 60m | w2/m5/t002, w2/m5/t003, w2/m5/t009, w2/m5/t010 |
| t005 | Update adoption guidance and capability limits — **DONE**               | 30m | w2/m5/t004                                     |
| t006 | Simplify milestone changes — **DONE**                                   | 30m | w2/m5/t005                                     |
| t007 | CI and behavior coverage — **DONE**                                     | 45m | w2/m5/t005, w2/m5/t006                         |
| t008 | Close out milestone — **DONE**                                          | 15m | w2/m5/t007                                     |

## Definition of done

- All task acceptance criteria are met with recorded evidence; research does not count as production delivery.
- Every advertised control has the promised observable effect, or its unavailable state has an accurate actionable explanation.
- Native support, adapter-owned behavior, host-version limits and unverified cases are separate; schema admission alone is insufficient.
- Safe defaults, session isolation, cancellation and stale-event behavior remain intact.
- Adoption guidance, simplification, required CI and real-host checks pass before physical archive closeout.
- Required host-blocked delivery stays open with a precise unblock condition; independent tasks continue.

## Source + Goal linkage

- **Source:** User requested feasibility research and fixes for other directives after the approval capability finding.
- **Goal linkage:** Make each advertised model/effort setting reach its intended target or clearly report its actual limitation.
- **Expected outcome:** Tested user controls and truthful capabilities through the current ACP/backend surfaces.
- **Why now:** Provider-wire probes distinguish host versions and main versus reminder requests; no generic SDK incapability assumption is justified.
- **Sizing:** 10 tasks; substantive research and implementation exceed one hour without closing tasks.
- **Adoption surface:** Dedicated documentation task, then simplification, CI and closeout. No owned editor UI change is required.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public APIs, host-offered choices, unchanged defaults, no TUI/private storage or silent replay. Research is evidence of feasibility, not delivery.

## Validation evidence

[Feasibility research and ownership map](../../evidence/capability-feasibility.md).
Delivered behavior, provider-wire results and closing checks are recorded in
[evidence](evidence.md). Metadata equality does not establish execution identity;
the explicit public model setter is required even when resume reports the requested model.
