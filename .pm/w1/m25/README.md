# w1 · m25 — Verified SDK approval policies and sandbox configuration

**Worker:** worker1 **Goal:** Expose independently verified approval policies and explicitly selected host sandbox posture without weakening defaults or pending-action safety. **Status:** todo

## Tasks (in order)

| id   | title                                                         | est | depends_on               |
| ---- | ------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify policy enforcement and define SDK safety options       | 45m | w1/m10/t008              |
| t002 | Wire requested and effective approval policy through sessions | 45m | w1/m25/t001              |
| t003 | Implement explicit host-lifetime sandbox configuration        | 45m | w1/m25/t002              |
| t004 | Verify mode transitions and compatibility end to end          | 45m | w1/m25/t003              |
| t005 | Document safety semantics and update ADR003                   | 30m | w1/m25/t004              |
| t006 | Simplify milestone changes                                    | 30m | w1/m25/t005              |
| t007 | CI and behavior coverage                                      | 45m | w1/m25/t005, w1/m25/t006 |
| t008 | Close out the milestone                                       | 15m | w1/m25/t007              |

Estimated total: 5h across eight tasks; implementation/investigation exceeds one hour without closing work. Depends on delivered host ownership m10, not blocked compaction or worker milestones.

## Definition of done

- Supported approval policies are selected over public MSP and actual tool enforcement is verified.
- Sandbox posture is explicitly configured at host creation and changes cause safe host replacement; approval mode and workspace trust are not conflated.
- Default behavior remains onRequest with sandbox protection; no stale permission can authorize another action.
- New/load/resume/reuse, cancellation, close, plan/readOnly and concurrent-session isolation have meaningful wire and real-host coverage.
- README, SDK compatibility and ADR003 match delivered options and limits; Simplify and all required affected CI pass.

## Source + Goal linkage

- **Source:** User requested research and PM handoff for remaining ADR003 gaps on 2026-09-12; research and reproduction recorded below.
- **Goal linkage:** Close the missing SDK safety-configuration contract through public Muse mechanisms while preserving reliable ACP integration.
- **Expected outcome:** Clients can explicitly choose supported approval and sandbox behavior and observe the effective configuration.
- **Why now:** Fresh host evidence proves all four approval policies can be selected; serve help exposes sandbox flags. Existing hard-coded defaults prevent this configuration, and m10 supplies safe host replacement.
- **Cross-surface parity:** Omitted because no owned editor UI changes; backend/protocol consistency remains in task acceptance.
- **Adoption surface:** Covered by t005 and CI; no duplicate closing task.
- **Constraints:** Follow .pm/DO_NOT_DO.md; retain safe defaults and host-offered decisions, pin SDK/minimum host, avoid TUI/private APIs and do not silently replay turns.

## Validation evidence

Research only: Muse 1.1.1-R2514.1 with SDK 0.1.1 accepted denyUnmatched, promptUnmatched, allowAll and onRequest and returned matching completed effectiveMode state in an isolated no-turn session. Zero provider requests. Actual tool enforcement and broader sandbox effects are not yet verified; they are t001/t004 delivery work.

## Enforcement blocker (2026-09-12)

The zero-turn selection result reproduced, but tool execution did not establish the advertised policy distinctions on Muse 1.1.1-R2514.1 with SDK 0.1.1. Isolated public MSP probes requested `printf allowed > policy-marker.txt` through the loopback model and an otherwise unconfigured shell policy:

| Selected policy | Effective state                                                      | Observed tool gate     | Result after explicit allow_once |
| --------------- | -------------------------------------------------------------------- | ---------------------- | -------------------------------- |
| onRequest       | matching startup state                                               | one approval/requested | marker written                   |
| promptUnmatched | matching startup state                                               | one approval/requested | marker written                   |
| denyUnmatched   | completed reconfiguration                                            | one approval/requested | marker written                   |
| allowAll        | completed reconfiguration and, independently, matching startup state | one approval/requested | marker written                   |

A separate allowAll run verified the marker was absent before the decision and remained absent after the host-provided abort choice. Therefore allowAll did not bypass this approval gate, and denyUnmatched did not automatically deny the tested unmatched shell action. This is an observed limitation of these fixtures, not a claim that every tool path ignores every policy. It does mean accepted effectiveMode metadata alone is insufficient to label new client choices with those enforcement promises.

Resume t001 with a documented public configuration/tool path that verifies the intended matched/unmatched distinctions and explain how it interacts with explicit SDK approval requests. Then implement only proven choices, and continue separate sandbox-posture enforcement/host-replacement checks in t003/t004. Do not synthesize approvals or add disable-sandbox/yolo defaults to force the tests through. All eight tasks remain open; no safety options were advertised or production policy changed. Local executable probes and public notifications are retained in `.tmp/m25-probe/`. No paid providers or external writes were used.
