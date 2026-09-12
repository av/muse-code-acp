# w1 · m19 — Paginated session discovery and live metadata

**Worker:** worker1 **Goal:** Make large session histories discoverable through bounded public APIs and keep client titles and metadata current. **Status:** todo

## Tasks (in order)

| id   | title                                                     | est | depends_on               |
| ---- | --------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify public session listing and history completeness    | 45m | w1/m12/t006              |
| t002 | Implement bounded session pagination and public discovery | 45m | w1/m19/t001              |
| t003 | Publish and restore authoritative session metadata        | 45m | w1/m19/t002              |
| t004 | Simplify milestone changes                                | 30m | w1/m19/t003              |
| t005 | CI and behavior coverage                                  | 45m | w1/m19/t003, w1/m19/t004 |
| t006 | Close out the milestone                                   | 15m | w1/m19/t005              |

Estimated total: 3h 45m across 6 tasks. Prerequisite: w1/m12/t006; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

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

Pending implementation. The originating comparison inspected source and installed SDK declarations; it did not establish host acceptance of the proposed additions.
