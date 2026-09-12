# w1 · m20 — Remaining prompt context and elicitation parity

**Worker:** worker1 **Goal:** Create a capability/evidence matrix for embedded binary input, additional filesystem roots and URL elicitation using public host surfaces. Extend attributed context conversion to verified binary/image resource variants. Expose additionalDirectories only if the public host enforces the required filesystem access contract. Implement verified URL request/completion handling with client capability gating. **Status:** todo

## Tasks (in order)

| id   | title                                                       | est | depends_on               |
| ---- | ----------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify binary, workspace-root and URL elicitation contracts | 45m | w1/m8/t007               |
| t002 | Forward supported embedded binary resources                 | 45m | w1/m20/t001              |
| t003 | Implement verified additional workspace roots               | 45m | w1/m20/t002              |
| t004 | Bridge URL elicitation and document input limits            | 45m | w1/m20/t003              |
| t005 | Simplify milestone changes                                  | 30m | w1/m20/t004              |
| t006 | CI and behavior coverage                                    | 45m | w1/m20/t004, w1/m20/t005 |
| t007 | Close out the milestone                                     | 15m | w1/m20/t006              |

Estimated total: 4h 30m across 7 tasks. Only listed dependencies are prerequisites; milestone numbering does not impose a dependency on all earlier work.

## Definition of done

- Each surface has an observed contract or a concrete unsupported result; merely passing a path in prompt text is not multi-root support.
- No sandbox broadening, TUI automation or private API is proposed.
- Mixed embedded text/binary/image input reaches the provider in the documented form with attribution.
- Malformed, oversized or unsupported binary content is rejected before execution; encoding is not falsely described as semantic document decoding.
- Supported roots remain available across restore and host reuse with unchanged approval/sandbox semantics.
- If no public multi-root support exists, this delivery stays open with evidence; widening to a common ancestor is not an implementation.
- A local fixture proves URL acceptance/completion and cancelled interactions cannot settle a later request.
- Unnegotiated clients get an explicit supported fallback or failure; no URL is opened or fetched without the relevant interaction contract.
- Required host delivery has acceptance evidence; unsupported required functionality stays open with a concrete upstream blocker.
- Explicit assessment/proposal work may finish with a documented non-target or infeasibility decision, but does not count as delivered parity.
- Adoption docs, /simplify and required affected CI checks are complete before closeout.

## Source + Goal linkage

- **Source:** User handoff of [ADR003 parity work](../../../docs/ADR003-codex-acp-parity.md) on 2026-09-12. The earlier m9–m19 handoffs retain their existing scope. See [handoff coverage](../001.md).
- **Goal linkage:** Close the named remaining editor/runtime integration gaps while preserving truthful, reliable Muse ACP behavior.
- **Expected outcome:** Create a capability/evidence matrix for embedded binary input, additional filesystem roots and URL elicitation using public host surfaces. Extend attributed context conversion to verified binary/image resource variants. Expose additionalDirectories only if the public host enforces the required filesystem access contract. Implement verified URL request/completion handling with client capability gating.
- **Why now:** Embedded text is delivered; binary resources, multiple roots and URL interactions remain distinct gaps that must not be simulated with weaker semantics.
- **Sizing:** 4 substantive implementation/investigation tasks exceed one hour without counting closing tasks.
- **Cross-surface parity:** Omitted: this is adapter/API, tests and documentation work with no owned editor UI. Protocol and backend differences are tested explicitly.
- **Adoption surface:** Covered by the last implementation task and CI acceptance: update README, applicable SDK/MCP support docs and ADR003; no duplicate closing task is needed.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; public SDK/MSP with feature detection, exact SDK/minimum-host evidence, real host-offered permission gating, sandbox defaults and no TUI automation or ambiguous-turn replay. Do not modify archived milestones or infer publication authorization.

## Validation evidence

Pending implementation. ADR003 is a source-based comparison; new host surfaces still require verification. No feature or task is marked delivered by this handoff.

## Blocker — public workspace-root and URL contracts (2026-09-12)

Triage outcome: blocked before implementation; no tasks are marked complete.
With pinned SDK 0.1.1 and installed Muse 1.1.1-R2514.1, the public
`SessionStartParams` in `node_modules/@muse-code/sdk/dist/src/msp.d.ts` offers one
`workspaceRoot`; `SessionConfig` is reserved with no members. `muse serve --help`
fixes sandbox posture at host construction and exposes no additional-roots flag.
The general CLI's singular `--workspace` is not a multi-root authorization contract.
No supported way to retain multiple independently authorized roots through
start/resume was found. This blocks required t003; widening the root or disabling
sandboxing would violate its acceptance criteria.

The same public schema's `UserInputRequestParams` carries questions/options and
`userInput/answer` / `userInput/cancel` settlement, with no URL elicitation ID,
URL request variant or URL-completion event. The reference's
`CodexElicitationHandler.buildElicitationRequest` explicitly depends on those
fields for URL mode. Existing form support cannot establish required t004 URL
semantics. No undocumented methods were probed or invented.

Resume when a documented public Muse multi-root authorization contract and URL
request/completion bridge are available, then prove scope and correlation with
real-host fixtures. Embedded binary/image work remains wanted but is not claimed
implemented; the milestone's complete input-contract investigation remains open.
All tasks t001–t007 remain open; no dependent milestones are currently declared.
Continue independent w1 work. This evidence update changes no runtime code;
Markdown formatting and local reference paths were checked.
