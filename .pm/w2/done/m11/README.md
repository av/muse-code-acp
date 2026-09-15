# w2 · m11 — Verified stored-output retrieval

**Worker:** worker1 **Goal:** Deliver newly verified public output reads. **Status:** done

## Source and outcome

User-authorized current capability delivery in w2. m9 host-schema verification
found item/readOutput in Muse 1.2.1, and a real truncated shell output probe
returned exact bounded bytes. This promotes the retrieval slice of w1/007;
missing MCP rich media remains a future watch. See [ownership](../../../ownership-2026-09-14.md).

## Tasks (in order)

| id   | title                                                                 | est | depends_on  |
| ---- | --------------------------------------------------------------------- | --- | ----------- |
| t001 | Read verified stored output through a bounded public route — **DONE** | 45m | w2/m7/t009  |
| t002 | Verify output lifetime, recovery and baseline behavior — **DONE**     | 45m | w2/m11/t001 |
| t003 | Update adoption guidance — **DONE**                                   | 45m | w2/m11/t002 |
| t004 | Simplify retrieval and lifecycle code — **DONE**                      | 45m | w2/m11/t003 |
| t005 | Run CI and real-host validation — **DONE**                            | 45m | w2/m11/t004 |
| t006 | Close out and archive verified delivery — **DONE**                    | 45m | w2/m11/t005 |

## Definition of done

Public bytes reach a negotiated client with bounded reads and original identity;
restore/lifetime and baseline behavior remain truthful. Docs, simplification,
required CI, archive and per-milestone shipment complete. No schema-only claims.

## Delivery evidence

See [verified behavior and limits](evidence.md), including actual bytes across
host restart, session isolation, negotiation and the remaining rich-media watch.
