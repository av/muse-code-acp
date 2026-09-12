# w1 · m14 — Structured failures, retry progress and truthful authentication state

**Worker:** worker1 **Goal:** Help clients distinguish waiting, recoverable failures and invalid credentials without guessing from generic errors. **Status:** todo

## Tasks (in order)

| id   | title                                                   | est | depends_on               |
| ---- | ------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify failure and authentication observation contracts | 45m | w1/m9/t009               |
| t002 | Map failures into actionable ACP errors                 | 45m | w1/m14/t001              |
| t003 | Publish host-scheduled retry progress                   | 45m | w1/m14/t002              |
| t004 | Expose truthful authentication state changes            | 45m | w1/m14/t003              |
| t005 | Verify recovery and auth transitions through ACP        | 45m | w1/m14/t004              |
| t006 | Simplify milestone changes                              | 30m | w1/m14/t005              |
| t007 | CI and behavior coverage                                | 45m | w1/m14/t005, w1/m14/t006 |
| t008 | Close out the milestone                                 | 15m | w1/m14/t007              |

Estimated total: 5h 15m across 8 tasks. Prerequisite: w1/m9/t009; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

## Definition of done

- Evidence distinguishes configured, verified, rejected and unknown states; file existence alone never proves validity.
- A documented error taxonomy preserves unknown kinds and distinguishes provider evidence from local transport failures.
- Wire tests distinguish known categories and preserve useful unknown errors.
- Ambiguous transport failure never causes automatic prompt replay or a synthetic successful completion.
- A scheduled retry is visible without completing or restarting the ACP prompt.
- Late events cannot resurrect a closed turn; reported delays reflect observed host values.
- Expired stored credentials and invalid keys are not reported as verified merely because they exist.
- Logout with META_API_KEY still set reports the remaining configured credential correctly; no key or token is emitted.
- Unavailable public verification yields an explicit unknown/unverified state without claiming logout.
- A successful later turn clears obsolete failure state while keeping the correct credential status.
- Test evidence covers baseline clients and extension-aware clients without leaking sensitive diagnostics.
- /simplify and required affected CI profiles pass with recorded evidence before closeout.
- SDK and exec capability claims match implemented behavior. Negotiated extensions retain a documented baseline-client fallback.
- Required delivery blocked by missing host support stays open with evidence. Explicitly conditional controls may remain unadvertised when unavailable; document the supported subset and upstream dependency rather than inventing an API.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of all findings from the second read-only comparison with `.tmp/codex-acp`, including the additional authentication-state finding. Existing m8–m13 retain the first comparison's scope. Reference paths: `src/muse-sdk.ts`, `src/auth.ts`, `.tmp/codex-acp/src/CodexEventHandler.ts`, `.tmp/codex-acp/src/AuthStatusMeta.ts`. This milestone preserves the requirements even if the temporary reference checkout disappears.
- **Goal linkage:** Help clients distinguish waiting, recoverable failures and invalid credentials without guessing from generic errors. Advance faithful, reliable Muse behavior in ACP clients.
- **Expected outcome:** Document supported host error kinds, retry events and public credential/account observations; separate credentials configured from authenticated and identity unknown. Preserve machine-readable failure categories and recovery hints without altering turn execution. Show the host's retry attempt and delay while retaining the original prompt lifecycle. Report credential configuration separately from host-observed authentication and optional identity. Prove progress, terminal errors and authentication changes form a consistent user-visible lifecycle.
- **Why now:** Error and credential-presence checks obscure recovery choices; this P1 work builds on m9 event reporting.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; a milestone is appropriate.
- **Cross-surface parity:** Omitted because this changes one adapter's protocol/backend, tests and documentation, with no owned editor UI. Protocol translation, SDK/exec differences and client negotiation are covered explicitly.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP interfaces with feature detection and verified minimum host versions, preserve exact SDK pins and real approval gating, keep sandbox defaults, and never replay ambiguous turns automatically. Do not automate the TUI or copy vendor-specific internals.

## Validation evidence

Pending implementation. The originating comparison inspected source and installed SDK declarations; it did not establish host acceptance of the proposed additions.
