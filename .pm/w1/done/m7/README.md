# w1 · m7 — Session lifecycle and prompt-content follow-ups

**Worker:** worker1 **Goal:** Extend the merged image, close and resume features with reliable shutdown, consistent workspaces and complete prompt metadata. **Status:** done

## Tasks (in order)

| id   | title                                                                          | est | depends_on       |
| ---- | ------------------------------------------------------------------------------ | --- | ---------------- |
| t001 | Prevent session bindings from outliving shutdown — **DONE**                    | 45m | —                |
| t002 | Unify workspace validation for new, load and resume — **DONE**                 | 45m | t001             |
| t003 | Preserve resource-link metadata and field boundaries — **DONE**                | 30m | t002             |
| t004 | Test close and resume across pending interactions and image prompts — **DONE** | 45m | t001, t002, t003 |
| t005 | Simplify milestone changes — **DONE**                                          | 30m | t004             |
| t006 | CI and behavior coverage — **DONE**                                            | 45m | t004, t005       |
| t007 | Close out the milestone — **DONE**                                             | 15m | t006             |

Estimated total: 4h 15m across seven tasks. Prioritize shutdown and workspace handling before content and feature-combination coverage.

## Definition of done

- Disposal cannot be followed by session-state resurrection from pending load/resume operations; admission and owned-resource cleanup have tested terminal behavior.
- New/load/resume validate real directories consistently, store canonical paths, and preserve retained-session workspace ownership.
- Resource-link encoding preserves supported metadata including size and unambiguous field boundaries without fetching URIs or reordering SDK content.
- Closing during unanswered permissions/elicitation and receiving late replies after close/resume cannot authorize or alter another turn; subsequent valid work succeeds.
- Image-only SDK behavior is proven against the supported real host and reflected in validation/documentation.
- Simplify and all required CI profiles pass, with evidence recorded here before closeout.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of four read-only review recommendations against main at `dfc1d31`, inspired by merged [PR #3](https://github.com/bex-co/muse-code-acp/pull/3), [PR #4](https://github.com/bex-co/muse-code-acp/pull/4), and [PR #5](https://github.com/bex-co/muse-code-acp/pull/5).
- **Goal linkage:** Continue w1's SDK migration and ACP execution guarantees through complete lifecycle handling, workspace ownership and faithful prompt forwarding.
- **Expected outcome:** Clients can close, shut down and restore sessions without stale operations reviving them, and supported prompt context reaches Muse intact.
- **Why now:** The features are merged; their interactions expose gaps not proven by the existing independent tests. Shutdown and workspace findings have the highest priority. Reproduce inspection-based race findings before selecting fixes.
- **Sizing:** Multiple implementation and verification tasks exceed one hour, so this is a milestone rather than a loose inbox note.
- **Cross-surface parity:** Omitted because this work changes one adapter's protocol/backend behavior and tests, with no owned editor UI. SDK/exec contract consistency remains explicit in implementation and CI acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP APIs, retain permission gating and sandbox defaults, and keep unsupported capabilities unadvertised. Npm publishing-access repair and release management are outside this handoff.

## Validation evidence

Implementation evidence (2026-09-12):

- Reproduced delayed load and SDK resume restoring sessions after disposal before the fix; both regression cases now reject and retain empty state.
- `session-binding.test.ts` covers disposal during reads and replay plus rejection of new admission. `session-close.test.ts` proves child exit and image cleanup for close/dispose, including disposal while close is unwinding.
- `workspace.test.ts` checks invalid directories, canonical paths and symlink retargeting through actual fake-host cwd capture for new/load/resume, including retargeting during export.
- `resource-links.test.ts` checks recoverable metadata (including null, zero, Unicode, quotes, newlines, annotations and opaque metadata), both backend request boundaries and SDK part ordering.
- `close-interactions.test.ts` checks stale permission/elicitation replies after close and after resume while another session is active. The real-host approval suite proves no stale allow creates the file; the real-host image suite verifies image-only input reaches the provider.
- `/simplify`: three review passes completed; removed redundant path validation and duplicate assertions. Efficiency review found no further changes needed.
- `npm ci`: clean install completed (139 packages).
- `npm run check`: lint and repository formatting passed on final source changes and the formatted PM handoff tables.
- `npm run build`: TypeScript build passed.
- `npm run test:unit`: 199 tests across 32 files passed. The initial full run exposed a capture-file read race in the close/dispose test; it now waits for streamed output emitted after the capture write and disposes the agent in a finally block.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback`: all 11 tests across three suites passed in 44.89 seconds, including image-only input, stale approval execution prevention and load/resume across process restart. An earlier run timed out in restart/resume at 180 seconds (10 other tests passed); the complete rerun passed without changing or skipping that test. The isolated timeout's cause was not established.
- `npm run test:pack-smoke`: packed installation passed initialize/new/prompt/stream/end_turn through the installed binary and captured SDK request.
- Local checks mirror the required CI profiles; remote Linux CI was not run in this uncommitted task. No release or npm publication was performed.
- Local host: Muse Code 1.1.1 (1.1.1-R2514.1), macOS. Paid-provider acceptance is optional and was not run; loopback tests use dummy local credentials.
