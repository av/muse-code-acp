# w2 · m12 — Reliable SDK startup and truthful lifecycle failures

**Worker:** worker1 **Goal:** Allow healthy slow hosts to start and preserve the actual failure cause and submission certainty. **Status:** done

## Source + Goal linkage

- **Source:** User requested promotion of w2/012 after read-only triage. The [original note](source-012.md) preserves all evidence, reproduction steps and acceptance; [captured logs](../../evidence/012-startup-timeout.md) retain probe provenance.
- **Goal linkage:** A dependable ACP adapter must tolerate legitimate host initialization and report actionable failures without silently repeating model work.
- **Expected outcome:** Allowed slow initialization/setup completes; explicit timeout/cancellation cleans up owned hosts, and clients receive the initiating cause with truthful pre/post-submission certainty.
- **Why now:** On revision `012151b`, a fixed 20-second aggregate timer kills startup and cleanup EOF obscures its cause. An undelayed SDK-only initialization succeeded after 29,012 ms; a controlled 21-second delay reproduced the adapter defect.
- **Sizing:** Lifecycle policy, error coordination, related read paths and native/concurrent regression coverage require multiple substantive tasks, beyond an inbox fix.
- **Adoption surface:** Dedicated guidance task for deadline configuration and changed failure/recovery behavior. No editor UI is owned here.
- **Dependencies:** Builds on completed [w2/m8](../m8/README.md) and current host ownership; no future w1 capability is required.

## Tasks (in order)

| id   | title                                                                                | est | depends_on                            |
| ---- | ------------------------------------------------------------------------------------ | --- | ------------------------------------- |
| t001 | [Design and implement phase-aware startup waiting](done/t001.md) — **DONE**          | 60m | —                                     |
| t002 | [Preserve initiating failures and submission certainty](done/t002.md) — **DONE**     | 60m | w2/m12/t001                           |
| t003 | [Audit and repair related read-host timeout paths](done/t003.md) — **DONE**          | 45m | w2/m12/t001, w2/m12/t002              |
| t004 | [Cover delayed startup, error races and concurrent clients](done/t004.md) — **DONE** | 60m | w2/m12/t001, w2/m12/t002, w2/m12/t003 |
| t005 | [Document startup policy and failure recovery](done/t005.md) — **DONE**              | 30m | w2/m12/t004                           |
| t006 | [Simplify lifecycle and deadline ownership](done/t006.md) — **DONE**                 | 30m | w2/m12/t005                           |
| t007 | [Run CI and verify real-host behavior](done/t007.md) — **DONE**                      | 45m | w2/m12/t006                           |
| t008 | [Close out and archive verified startup fix](done/t008.md) — **DONE**                | 15m | w2/m12/t007                           |

## Definition of done

- All original 012 criteria have observable evidence: slow startup/setup, original error preservation, submission certainty, deterministic races, real-host/concurrent behavior, ordinary requests and cancellation cleanup.
- Startup waiting and request deadlines have explicit ownership and evidence-backed policy; increasing a constant alone is insufficient. Late continuations cannot submit after termination.
- Failures before submission are distinguishable from potentially accepted turns. No automatic ambiguous replay, private APIs or weakened permission/sandbox defaults.
- Related read-host timeout patterns are audited and applicable defects repaired without treating all timeouts as interchangeable or claiming unobserved failures.
- Both supported host versions pass required checks; induced delays and natural timing remain separate. The original external integration's cause remains an inference unless newly established.
- Adoption, simplification, CI and evidence-backed physical archive closeout finish in dependency order.

## Validation evidence

Implementation, deadline audit and validation provenance are recorded in
[delivery evidence](evidence.md). Tasks close only after their acceptance is verified.
