# w1 · m17 — Rich tool results and output artifacts

**Worker:** worker1 **Goal:** Preserve images, links and structured artifacts returned by tools instead of flattening all results to text. **Status:** todo

## Tasks (in order)

| id   | title                                              | est | depends_on               |
| ---- | -------------------------------------------------- | --- | ------------------------ |
| t001 | Verify rich-output references and retrieval        | 45m | w1/m9/t009               |
| t002 | Translate supported structured tool content        | 45m | w1/m17/t001              |
| t003 | Verify artifact lifecycle and client compatibility | 45m | w1/m17/t002              |
| t004 | Simplify milestone changes                         | 30m | w1/m17/t003              |
| t005 | CI and behavior coverage                           | 45m | w1/m17/t003, w1/m17/t004 |
| t006 | Close out the milestone                            | 15m | w1/m17/t005              |

Estimated total: 3h 45m across 6 tasks. Prerequisite: w1/m9/t009; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

## Definition of done

- Documented examples identify inline versus referenced content and verified public retrieval paths.
- Missing, inaccessible, binary and oversized artifacts have explicit presentation fallbacks.
- A mixed text/image/link result remains ordered and visible with the original tool call ID.
- Completion-only results render once; malformed or unsupported content retains a useful fallback without failing unrelated output.
- Cleanup does not invalidate an artifact before its documented lifetime; expired references are explicitly unavailable.
- Wire tests cover supported rich output and baseline fallback, with bounded memory and no unsolicited URI fetching.
- /simplify and required affected CI profiles pass with recorded evidence before closeout.
- SDK and exec capability claims match implemented behavior. Negotiated extensions retain a documented baseline-client fallback.
- Required delivery blocked by missing host support stays open with evidence. Explicitly conditional controls may remain unadvertised when unavailable; document the supported subset and upstream dependency rather than inventing an API.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of all findings from the second read-only comparison with `.tmp/codex-acp`, including the additional authentication-state finding. Existing m8–m13 retain the first comparison's scope. Reference paths: `src/muse-sdk-events.ts`, `src/tool-calls.ts`, `.tmp/codex-acp/src/CodexToolCallMapper.ts`. This milestone preserves the requirements even if the temporary reference checkout disappears.
- **Goal linkage:** Preserve images, links and structured artifacts returned by tools instead of flattening all results to text. Advance faithful, reliable Muse behavior in ACP clients.
- **Expected outcome:** Establish which modelVisibleContent and output references the public host exposes and how clients may access them. Emit ordered ACP tool content for verified images, resource links and structured results with text fallback. Prove artifacts remain usable for the promised lifetime and behave honestly after reload.
- **Why now:** Prompt images and m13 file reports do not carry rich tool outputs; extend m9 translation with verified artifact access.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; a milestone is appropriate.
- **Cross-surface parity:** Omitted because this changes one adapter's protocol/backend, tests and documentation, with no owned editor UI. Protocol translation, SDK/exec differences and client negotiation are covered explicitly.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP interfaces with feature detection and verified minimum host versions, preserve exact SDK pins and real approval gating, keep sandbox defaults, and never replay ambiguous turns automatically. Do not automate the TUI or copy vendor-specific internals.

## Validation evidence

Pending implementation. The originating comparison inspected source and installed SDK declarations; it did not establish host acceptance of the proposed additions.
