# w2 · m10 — Embedded input and independent session commands

**Worker:** worker1 **Goal:** Deliver current public/adapter capabilities independently of future native extensions. **Status:** done

## Tasks (in order)

| id   | title                                                  | est | depends_on                                                      |
| ---- | ------------------------------------------------------ | --- | --------------------------------------------------------------- |
| t001 | Verify and forward embedded binary input — **DONE**    | 45m | w1/m8/t007                                                      |
| t002 | Implement local skills and logout commands — **DONE**  | 45m | w2/m10/t001                                                     |
| t003 | Implement persistent adapter session rename — **DONE** | 45m | w2/m10/t002                                                     |
| t004 | Implement compatible steering negotiation — **DONE**   | 45m | w2/m10/t003                                                     |
| t005 | Improve search presentation — **DONE**                 | 45m | w2/m10/t004                                                     |
| t006 | Update adoption guidance — **DONE**                    | 30m | w2/m10/t001, w2/m10/t002, w2/m10/t003, w2/m10/t004, w2/m10/t005 |
| t007 | Simplify milestone changes — **DONE**                  | 30m | w2/m10/t006                                                     |
| t008 | CI and behavior coverage — **DONE**                    | 45m | w2/m10/t007                                                     |
| t009 | Close out milestone — **DONE**                         | 15m | w2/m10/t008                                                     |

## Definition of done

- All task criteria have observable coverage; public payload availability is distinguished from tool execution and provider delivery.
- Preserve root/child identity, safe defaults, cancellation, reload and baseline ACP compatibility.
- No current task waits for an unrelated future host capability. Unsupported required slices require a concrete blocker and explicit ownership, not blanket milestone closure.
- Adoption, simplification, required CI and physical archive closeout complete in order.

## Source + Goal linkage

- **Source:** User requested complete w1 cleanup on 2026-09-14: current work executes only in w2; w1 retains only future SDK/host enablement. See [ownership and preserved acceptance](../../../ownership-2026-09-14.md).
- **Goal linkage:** Deliver useful ACP behavior now without misrepresenting native host support.
- **Expected outcome:** The concrete task-level controls/observations reach users and survive failure and lifecycle transitions.
- **Why now:** Old mixed milestones allowed one native blocker to hold back independent current work.
- **Sizing:** Multiple substantive implementation tasks exceed an hour; closing tasks follow delivery.
- **Adoption surface:** Dedicated docs task; no owned editor UI. SDK/exec/client differences remain explicit.
- **Constraints:** Public SDK/MSP only, no TUI/private storage, unchanged safe defaults, no fabricated permissions or silent replay.

## Validation evidence

Implementation and native evidence are recorded in [delivery evidence](evidence.md).
