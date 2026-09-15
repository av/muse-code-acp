# w2 · m13 — Nonblocking catalogs and native startup handoff

**Worker:** worker1 **Goal:** Eliminate automatic catalog-only startup overhead and preserve useful model selection. **Status:** done

## Tasks (in order)

| id   | title                                                                                   | est | depends_on       |
| ---- | --------------------------------------------------------------------------------------- | --- | ---------------- |
| t001 | Remove automatic catalog hosts and observe catalogs on execution connections — **DONE** | 60m | —                |
| t002 | Preserve explicit pre-turn catalog refresh and cancellation — **DONE**                  | 45m | t001             |
| t003 | Publish a public-safe native startup reproduction and track 014 — **DONE**              | 45m | —                |
| t004 | Document lazy catalogs and remaining native startup limitations — **DONE**              | 20m | t001, t002, t003 |
| t005 | Simplify milestone changes — **DONE**                                                   | 20m | t004             |
| t006 | CI and behavior coverage — **DONE**                                                     | 45m | t005             |
| t007 | Close out the milestone — **DONE**                                                      | 15m | t006             |

## Definition of done

- New/load/resume do not spawn or await a host solely for model discovery. Cached catalogs retain workspace/config/auth identity.
- Execution connections supply bounded optional model/list results without blocking turns, closing borrowed hosts, changing an in-flight model selection or publishing stale results.
- `/models` refreshes model choices before a first turn without inference; cancellation, close and disposal drain owned discovery hosts.
- Synthetic populated-history reproduction and measurements accompany a public upstream issue. 014 tracks unresolved native startup work without claiming it is fixed by the adapter.
- Affected deterministic tests, check/build and required pinned real-host loopback suites pass; changed surfaces are documented.

## Source + Goal linkage

- **Source:** User approved adapter implementation and upstream handoff after controlled diagnosis of [013](source-013.md) and [014](../../014.md).
- **Goal linkage:** Dependable ACP startup and truthful model choices through public SDK/MSP.
- **Expected outcome:** Sessions return without a redundant history scan; callers can explicitly refresh choices before inference and see verified catalogs as execution hosts become ready.
- **Why now:** 16/16 discovery timeouts reproduced with 6,000 synthetic history directories; native SDK initialization alone takes about 17 seconds while model/list takes 0–3 ms.
- **Adoption surface:** t004 documents `/models`, deferred catalog updates and unchanged session/data ownership.

## Validation evidence

See [delivery evidence](evidence.md). All seven tasks are complete and archived. Native follow-up remains open in 014 and upstream #11.
