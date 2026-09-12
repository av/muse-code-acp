# w1 · m18 — Session goal state and verified goal controls

**Worker:** worker1 **Goal:** Expose persistent objective and progress separately from whether a prompt is currently running. **Status:** todo

## Tasks (in order)

| id   | title                                                    | est | depends_on               |
| ---- | -------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify goal snapshots and define capability subset       | 45m | w1/m10/t008              |
| t002 | Publish persistent goal state through ACP                | 45m | w1/m18/t001              |
| t003 | Expose goal inspection and only verified control actions | 45m | w1/m18/t002              |
| t004 | Simplify milestone changes                               | 30m | w1/m18/t003              |
| t005 | CI and behavior coverage                                 | 45m | w1/m18/t003, w1/m18/t004 |
| t006 | Close out the milestone                                  | 15m | w1/m18/t005              |

Estimated total: 3h 45m across 6 tasks. Prerequisite: w1/m10/t008; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

## Definition of done

- Goal objective, status, current/next work and reported progress have a documented mapping without invented budgets or timestamps.
- Schema-only or unavailable controls are not advertised; observation support is distinguished from control support.
- A goal can remain active after session/prompt finishes and receive subsequent observed updates.
- Clear removes old state; reload and duplicate events do not resurrect stale objectives or block ordinary prompts.
- Clients can inspect observed goals even when no control API exists.
- Advertised controls match the tested subset; unverified actions fail explicitly and cannot start unintended work.
- Host-owned goal work and prompt/steering lifecycle remain separate; absent controls are documented as an upstream dependency.
- /simplify and required affected CI profiles pass with recorded evidence before closeout.
- SDK and exec capability claims match implemented behavior. Negotiated extensions retain a documented baseline-client fallback.
- Required delivery blocked by missing host support stays open with evidence. Explicitly conditional controls may remain unadvertised when unavailable; document the supported subset and upstream dependency rather than inventing an API.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of all findings from the second read-only comparison with `.tmp/codex-acp`, including the additional authentication-state finding. Existing m8–m13 retain the first comparison's scope. Reference paths: `src/muse-sdk.ts`, `src/acp-agent.ts`, `.tmp/codex-acp/docs/goal-extension.md`. This milestone preserves the requirements even if the temporary reference checkout disappears.
- **Goal linkage:** Expose persistent objective and progress separately from whether a prompt is currently running. Advance faithful, reliable Muse behavior in ACP clients.
- **Expected outcome:** Document public goal state semantics and independently verify any available controls. Forward snapshots and changes with correct restore and clear behavior across prompt boundaries. Provide /goal inspection and any supported negotiated goal actions without implementing an adapter-owned autonomous loop.
- **Why now:** Goal snapshots are currently ignored and are distinct from m9 todo plans; m10 session-owned subscriptions support updates outside a turn.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; a milestone is appropriate.
- **Cross-surface parity:** Omitted because this changes one adapter's protocol/backend, tests and documentation, with no owned editor UI. Protocol translation, SDK/exec differences and client negotiation are covered explicitly.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP interfaces with feature detection and verified minimum host versions, preserve exact SDK pins and real approval gating, keep sandbox defaults, and never replay ambiguous turns automatically. Do not automate the TUI or copy vendor-specific internals.

## Validation evidence

Pending implementation. The originating comparison inspected source and installed SDK declarations; it did not establish host acceptance of the proposed additions.
