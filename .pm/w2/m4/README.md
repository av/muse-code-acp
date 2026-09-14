# w2 · m4 — Verified approval policies and independent sandbox controls

**Worker:** worker1 **Goal:** Implement explicit automatic approval/rejection and independently selected sandbox posture without weakening defaults. **Status:** todo

## Tasks (in order)

| id   | title                                                     | est | depends_on             |
| ---- | --------------------------------------------------------- | --- | ---------------------- |
| t001 | Define verified native and adapter approval policies      | 60m | w1/m10/t008            |
| t002 | Wire selected policies and actionable mode negotiation    | 60m | w2/m4/t001             |
| t003 | Implement automatic host-offered approval decisions       | 60m | w2/m4/t001, w2/m4/t002 |
| t004 | Handle native denial and policy-transition races          | 60m | w2/m4/t002, w2/m4/t003 |
| t005 | Verify independent sandbox launch controls                | 60m | w2/m4/t001             |
| t006 | Implement sandbox configuration and safe host replacement | 60m | w2/m4/t005             |
| t007 | Verify restoration and cross-surface isolation            | 60m | w2/m4/t004, w2/m4/t006 |
| t008 | Update adoption guidance and capability limits            | 30m | w2/m4/t007             |
| t009 | Simplify milestone changes                                | 30m | w2/m4/t008             |
| t010 | CI and behavior coverage                                  | 45m | w2/m4/t008, w2/m4/t009 |
| t011 | Close out milestone                                       | 15m | w2/m4/t010             |

## Definition of done

- All task acceptance criteria are met with recorded evidence; research does not count as production delivery.
- Every advertised control has the promised observable effect, or its unavailable state has an accurate actionable explanation.
- Native support, adapter-owned behavior, host-version limits and unverified cases are separate; schema admission alone is insufficient.
- Safe defaults, session isolation, cancellation and stale-event behavior remain intact.
- Adoption guidance, simplification, required CI and real-host checks pass before physical archive closeout.
- Required host-blocked delivery stays open with a precise unblock condition; independent tasks continue.

## Source + Goal linkage

- **Source:** w2/010 and full superseded w1/m25 scope; user requested all corrective work in w2.
- **Goal linkage:** Implement explicit automatic approval/rejection and independently selected sandbox posture without weakening defaults.
- **Expected outcome:** Tested user controls and truthful capabilities through the current ACP/backend surfaces.
- **Why now:** Native allowAll and denyUnmatched work in targeted 1.2.1 probes; automatic once decisions work on both hosts. Preserve the complete source and migration map.
- **Sizing:** 11 tasks; substantive research and implementation exceed one hour without closing tasks.
- **Adoption surface:** Dedicated documentation task, then simplification, CI and closeout. No owned editor UI change is required.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public APIs, host-offered choices, unchanged defaults, no TUI/private storage or silent replay. Research is evidence of feasibility, not delivery.

## Validation evidence

[Feasibility research and ownership map](../evidence/capability-feasibility.md).
All implementation tasks remain todo. Existing approval and provider-request probes
support feasibility only; each task requires its specified regression coverage.

[Preserved source](sources.md) and [explicit ID migration](migration.md) retain all original m25 requirements and 010 provenance.
