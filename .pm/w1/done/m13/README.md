# w1 · m13 — Accurate file diffs and per-turn change reports

**Worker:** worker1 **Goal:** Make edits reviewable with real before/after evidence and an honest account of files changed during a turn. **Status:** done

## Tasks (in order)

| id   | title                                                              | est | depends_on               |
| ---- | ------------------------------------------------------------------ | --- | ------------------------ |
| t001 | Establish trustworthy file-change evidence — **DONE**              | 45m | w1/m10/t008              |
| t002 | Emit real before-and-after file diffs — **DONE**                   | 45m | w1/m13/t001              |
| t003 | Produce negotiated per-turn file-change reports — **DONE**         | 45m | w1/m13/t002              |
| t004 | Validate review reports against mixed workspace changes — **DONE** | 45m | w1/m13/t003              |
| t005 | Simplify milestone changes — **DONE**                              | 30m | w1/m13/t004              |
| t006 | CI and behavior coverage — **DONE**                                | 45m | w1/m13/t004, w1/m13/t005 |
| t007 | Close out the milestone — **DONE**                                 | 15m | w1/m13/t006              |

Estimated total: 4h 30m across 7 tasks. Priority: P2. Scheduled after w1/m10/t008; cross-milestone dependencies refer to logical task IDs even after archival.

## Definition of done

- Fixtures demonstrate a reliable preimage path for supported edits and explicit unknown evidence otherwise.
- The design distinguishes observed agent changes from a repository-wide dirty-file list and documents attribution limits.
- An overwrite shows the actual old and new text; create/delete semantics are distinct.
- Failed tools, large/binary files and concurrent edits cannot produce fabricated precise diffs or unbounded reads.
- Negotiated clients receive one report for the intended turn with deduplicated paths and honest completeness/uncertainty.
- Shell/generated changes are included when evidence supports attribution; unknown coverage remains partial, and baseline clients retain existing tool diffs.
- Pre-existing unrelated user edits are not claimed as agent-authored; uncertain overlap is flagged.
- Diff and report failures do not hide the original turn outcome; output is bounded and associated with the correct turn.
- /simplify and all required affected CI profiles pass, with validation evidence recorded before closeout.
- Required host support that cannot be verified leaves its delivery task open with the blocker documented; a schema declaration or an unsupported fallback alone does not satisfy delivery.
- SDK and legacy exec advertise only the behavior each implements; client-specific extensions require explicit negotiation and retain a documented baseline fallback.

## Source + Goal linkage

- **Source:** User request on 2026-09-12 to hand off all recommendations from the read-only muse-code-acp versus `.tmp/codex-acp` comparison to w1. Reference implementation paths: `src/tool-calls.ts`, `src/muse-sdk-events.ts`, `.tmp/codex-acp/src/AgentFileChangeReport.ts`, `.tmp/codex-acp/docs/agent-file-change-report.md`. The local reference checkout may be temporary; the objectives and acceptance criteria here preserve the handoff.
- **Goal linkage:** Make edits reviewable with real before/after evidence and an honest account of files changed during a turn. This advances the project's goal of a reliable, faithful ACP adapter for Muse Code.
- **Expected outcome:** Choose supported sources for before/after content and per-turn attribution without confusing pre-existing user edits with agent changes. Replace whole-file overwrite presentation where trustworthy old and new content is available. Offer a bounded report of changed paths, completeness and uncertainty, including verified shell/generated/child changes. Prove review output remains accurate when user edits, shell tools and worker changes coexist.
- **Why now:** Current oldText:null readback cannot describe overwrites, and tool-only reporting misses changes made through shell commands or child work.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; this is a shippable milestone rather than an inbox note.
- **Cross-surface parity:** Omitted because changes stay in this adapter's protocol/backend, tests and docs; there is no owned editor UI change. Protocol translation, client capability negotiation and SDK/exec differences remain explicit acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public SDK/MSP APIs and feature detection, exact SDK/minimum-host compatibility, real host-provided permission gating, sandbox defaults, no TUI automation and no silent ambiguous-turn replay. Adapt reference patterns without copying vendor-specific internals.

## Validation evidence

- SDK 0.1.1 and real Muse 1.1.1-R2514.1: native file tools report the output path and submitted content, but no preimage; ordinary writes may auto-approve. Bounded working-tree observations supply supported before/after evidence. Approval callbacks refresh evidence only when the host offers them.
- `src/file-change-evidence.ts` limits inventory, actual bytes read, retained content and report paths. Unknown preimages, deletion/move, failed tools, binary/large files and concurrent mismatches retain text fallbacks. Reports explicitly disclaim complete attribution and do not include unrelated dirty files.
- `src/tests/file-change-live.test.ts` verifies real overwrite/creation, an excluded shell-generated file, preserved unrelated edits, negotiated reporting and baseline diffs. The scripted request count proves no audit turn is started.
- Wire and evidence suites cover cancellation/close, failed turns, invalid negotiation, report ordering, growth during read, timeout, aggregate limits and stale/unknown evidence. Legacy exec no longer fabricates creation preimages from post-write readback.
- Simplify: independent reuse, quality and efficiency reviews completed. Shared result-path parsing and text construction replace duplicates; unused logger plumbing removed. No unresolved resource-bound findings.
- Passed `npm run check`, `npm run build`, `npm run test:unit` (310 tests, 51 files), `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` (22 tests, 8 files), and `npm run test:pack-smoke`.
- Scope limits are documented in `docs/file-change-report.md`: observed states can include concurrent edits; reports contain successful native file-tool declarations, never guaranteed shell/generated/child coverage. No paid provider calls or publication.

## Dependency review (2026-09-12)

The user-authorized follow-up research replaced the ordering-only prerequisite with delivered m10 host ownership. This milestone does not require m11 child execution or m12 fork support; child changes remain explicitly unknown in partial reports.
