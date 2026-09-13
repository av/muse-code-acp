# w1 · m19 — Paginated session discovery and live metadata

**Worker:** worker1 **Goal:** Make large session histories discoverable through bounded public APIs and keep client titles and metadata current. **Status:** done

## Tasks (in order)

| id   | title                                                                | est | depends_on               |
| ---- | -------------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify public session listing and history completeness — **DONE**    | 45m | w1/m10/t008              |
| t002 | Implement bounded session pagination and public discovery — **DONE** | 45m | w1/m19/t001, w1/m12/t006 |
| t003 | Publish and restore authoritative session metadata — **DONE**        | 45m | w1/m19/t002              |
| t004 | Simplify milestone changes — **DONE**                                | 30m | w1/m19/t003              |
| t005 | CI and behavior coverage — **DONE**                                  | 45m | w1/m19/t003, w1/m19/t004 |
| t006 | Close out the milestone — **DONE**                                   | 15m | w1/m19/t005              |

Estimated total: 3h 45m across 6 tasks. Prerequisite: w1/m10/t008; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

## Definition of done

- Multi-page fixtures and real-host evidence establish ordering, cursor behavior and history limitations.
- A migration plan explicitly preserves complete chronological load or reports unsupported/truncated history instead of silently omitting it.
- A large fixture traverses all sessions under the documented ordering with bounded per-request results.
- Workspace filtering, source/fork sessions and malformed cursors behave consistently; listing does not acquire an unnecessary writer lease.
- Supported public listing avoids a full native-store scan on each request.
- List/load/resume and live updates agree on known titles and provenance; fallback generation never overwrites a newer authoritative title.
- History remains complete under the verified API/fallback policy and metadata updates do not duplicate transcript events.
- No extra paid model call is introduced solely for title generation.
- /simplify and required affected CI profiles pass with recorded evidence before closeout.
- SDK and exec capability claims match implemented behavior. Negotiated extensions retain a documented baseline-client fallback.
- Required delivery blocked by missing host support stays open with evidence. Explicitly conditional controls may remain unadvertised when unavailable; document the supported subset and upstream dependency rather than inventing an API.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of all findings from the second read-only comparison with `.tmp/codex-acp`, including the additional authentication-state finding. Existing m8–m13 retain the first comparison's scope. Reference paths: `src/session-store.ts`, `src/session-export.ts`, `src/acp-agent.ts`, `.tmp/codex-acp/src/SessionMetadata.ts`, `.tmp/codex-acp/src/TitleGenerator.ts`. This milestone preserves the requirements even if the temporary reference checkout disappears.
- **Goal linkage:** Make large session histories discoverable through bounded public APIs and keep client titles and metadata current. Advance faithful, reliable Muse behavior in ACP clients.
- **Expected outcome:** Determine when public session/list/read/history can replace existing filesystem/export helpers without losing completeness. Return paginated sessions with stable documented cursor semantics and truthful workspace filtering. Keep titles, recency and provenance consistent between session lists and live updates.
- **Why now:** Filesystem scans and first-prompt titles limit session navigation; align public discovery with m12 branch provenance and existing history guarantees.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; a milestone is appropriate.
- **Cross-surface parity:** Omitted because this changes one adapter's protocol/backend, tests and documentation, with no owned editor UI. Protocol translation, SDK/exec differences and client negotiation are covered explicitly.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP interfaces with feature detection and verified minimum host versions, preserve exact SDK pins and real approval gating, keep sandbox defaults, and never replay ambiguous turns automatically. Do not automate the TUI or copy vendor-specific internals.

## Validation evidence

- SDK 0.1.1, real Muse 1.1.1-R2514.1: public `session/list` traversed 52 retained sessions over two ACP pages, including a source and native fork. Listing while writer hosts remained alive required no lease. Native index catch-up was observed explicitly, not assumed synchronous.
- `src/session-discovery.ts` bounds pages to 50, wraps native cursors with workspace/backend identity, validates malformed cursors, and retires discovery hosts on disposal. SDK pages do not enumerate the native store. Exec retains explicit scan/offset compatibility.
- Titles prefer a supplied authoritative field, otherwise reuse a bounded 64 KiB log-head/80-character first-prompt fallback. Current host exposes no title/rename event; no native rename capability is claimed. List, load, cold resume and successful idle native turns share metadata projection and negotiated fork provenance. Optional metadata timeouts preserve completion and retire the host without replay; active native work is not disturbed for enrichment.
- `docs/session-discovery.md` records eventual index consistency, concurrent-page limitations, fallback policy and complete chronological export replay. Anchored/snapshot public history never silently replaces a full transcript; existing schema and output bounds remain enforced.
- New wire/unit tests traverse 123 rows and verify cursor scoping, title precedence, disposal during a delayed list response, and metadata timeout across successive turns. The real suite verifies public pagination, fork discovery, full load replay and zero additional provider calls for navigation.
- Simplify: independent reuse, quality and efficiency reviews completed. Shared metadata notification projection and fork constants, explicit unknown narrowing, disposal tracking and timed-out-host retirement applied.
- Passed `npm run check`, `npm run build`, `npm run test:unit` (314 tests, 52 files), `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` (23 tests, 9 files), and `npm run test:pack-smoke`. Updated the goal test to accept standard metadata notifications without `_meta`.

## Dependency review (2026-09-12)

The user-authorized research removed the ordering-only m18 prerequisite in favor of delivered m10 host ownership. Required m12 native fork delivery is now complete and covered by the source/fork discovery acceptance.
