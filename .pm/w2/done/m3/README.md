# w2 · m3 — Distinguishable staged permission prompts

**Worker:** worker1 **Goal:** Make each permission request for a multi-stage shell command say which part of the command it is asking about, using only fields the host published, so a client that negotiates no Muse extension can tell the prompts apart. **Status:** done

## Issue cause

Consolidated from inbox note `w2/005` (2026-09-14) on promotion; that note is consumed and this
section is its record.

[w2/m1](../m1/README.md) made a compound shell command ask once per unresolved stage, which is
the correct protocol behavior. The user-facing half is missing. Verified 2026-09-14 through the
exact command Bex Dev launches (`node dist/index.js`), host `1.2.1-R2847.1`, loopback provider, no
paid calls: for the two-stage command, both `session/request_permission` frames are byte-identical
in every field a Zed-family client renders.

| field      | request 1                  | request 2                  |
| ---------- | -------------------------- | -------------------------- |
| `title`    | `Run the compound command` | `Run the compound command` |
| `kind`     | `execute`                  | `execute`                  |
| `rawInput` | the whole compound command | the whole compound command |
| `options`  | Allow once / Reject        | Allow once / Reject        |

Only `_meta.museRequirementId.sourceIndex` differs (0, then 2), and `_meta` is not rendered. The
user sees the same dialog twice with no way to tell what they are approving or how many prompts
remain.

The host publishes per-stage `argv`, `position`, `totalStages` and `resolution.kind`.
Before m3, `approvalStageMetadata` forwarded position, total and resolution only
inside the opt-in `muse/approval` block. Contrary to the initial handoff wording,
it did not forward argv. The new title uses that existing host-published argv;
the negotiated metadata projection remains unchanged.

This is also the likely shape of the original [003](../003.md) report, "Repeated Allow once
confirmations", which was closed as expected behavior on the evidence of two separate tool calls.
One compound command producing repeated identical prompts is the same experience from a different
cause, so closing 003 did not address it.

## Tasks (in order)

| id   | title                                                                          | est | depends_on             |
| ---- | ------------------------------------------------------------------------------ | --- | ---------------------- |
| t001 | Present the stage being decided in the ACP permission request — **DONE**       | 60m | —                      |
| t002 | Cover staged presentation with and without the negotiated extension — **DONE** | 45m | w2/m3/t001             |
| t003 | Adoption surface: document staged permission presentation — **DONE**           | 30m | w2/m3/t001, w2/m3/t002 |
| t004 | Simplify milestone changes — **DONE**                                          | 30m | w2/m3/t003             |
| t005 | CI and behavior coverage — **DONE**                                            | 45m | w2/m3/t003, w2/m3/t004 |
| t006 | Close out the milestone — **DONE**                                             | 15m | w2/m3/t005             |

Estimated total: 3h 45m across six tasks.

## Definition of done

- For a compound command with two or more unresolved stages, consecutive `session/request_permission`
  frames differ in a field a client renders without negotiating any Muse extension, and each one
  identifies the stage it is deciding and how many stages there are.
- Every rendered value is derived from host-published stage evidence. No stage text is invented,
  reordered or re-parsed from the raw command by the adapter.
- A single-stage approval's presentation is unchanged, verified by the existing approval tests.
- Clients that do negotiate `muse/approval` keep receiving the current stage metadata unchanged.
- Verified on a real host with a two-stage and a three-stage command, and against a client that
  advertises no Muse extension.
- `npm run check`, `npm run build`, `npm run test:unit` and the real-host loopback suite hold, with
  no new failure beyond the blockers recorded in w2/m2.

## Source + Goal linkage

- **Source:** inbox note `w2/005`, raised 2026-09-14 while verifying m1 through Bex Dev's launch
  command; consumed into the [Issue cause](#issue-cause) section on promotion.
- **Goal linkage:** usable editor integration and truthful capabilities. An approval prompt is the
  one place the adapter asks a user to take responsibility for an action; showing two identical
  dialogs for two different decisions asks for consent the user cannot give informedly.
- **Expected outcome:** a user in any ACP client can see which part of a compound command each
  prompt covers and how far through the sequence they are.
- **Why now:** m1 just made multi-stage prompting common on the SDK backend, so the ambiguity that
  used to need two separate tool calls now appears for a single ordinary command.
- **Adoption surface:** included as t003; permission presentation is a user-visible contract already
  described in `docs/sdk-migration.md` and ADR003.
- **Prior art:** the permission presentation this refines was delivered by
  [w1/m22](../../../w1/done/m22/README.md), which forwards observed stage, scope and decision metadata
  as an opt-in. This milestone extends the non-negotiated baseline rather than reopening that scope.
- **Constraints:** follow `.pm/DO_NOT_DO.md`. Offer only host-provided choices and scopes, and derive
  presentation only from host-published stage evidence; the adapter must not parse or split the
  shell command itself.

## Out of scope

- Changing which choices are offered, how decisions are made, or the stage sequencing delivered by m1.
- Automatic or remembered approvals; those remain w1/m25.
- The 1.2.1 host failures owned by w2/m2.

## Validation evidence

Reproduction recorded 2026-09-14 in the Issue cause table, captured from real ACP frames through
Bex Dev's configured command; frame logs retained under `artifacts/w2-m1-bex/` (gitignored).
Delivery evidence is recorded by t005.

## Triage and implementation, 2026-09-14

**Work on it.** At m2 shipment `39fc8a5`, approvalToPermissionRequest still uses
only whole-command description/command/path for every stage. The host already
publishes the required argv and position; no host change or m2 dependency remains.

Titles now render the matching host requirement as `Stage N of T: <arguments>`.
T is the host's total, including known-safe stages, not a promised dialog count.
Arguments with whitespace, empty values or shell punctuation are quoted as display
text, and the complete unparsed command stays in rawInput because host argv can
omit redirections. Only explicitly known-safe resolutions are excluded when
checking for multiple decision stages; already decided stages still count after
refresh, and unknown kinds are not remapped. A single stage or sole decision
among known-safe stages retains the original presentation. Missing or invalid
stage evidence also falls back rather than inventing position or command text.

The stage lookup is shared with stall diagnostics and matches both approval ID
and source index. No new mutable state or change to choices, decision sequencing
or the negotiated metadata projection was introduced.

## Delivery validation, 2026-09-14

- `npm run check`: pass; `npm run build`: pass.
- `npm run test:unit`: 372 passed, 58 files. Includes plain and negotiating
  client titles, exact metadata, single-stage fallback and argument display.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` on Muse
  1.2.1-R2847.1: 28 passed, 10 files. The three known legacy-profile limitations
  remain explicit assertions as documented by m2; no missing-host skips.
- The same suite with pinned 1.1.1-R2514.1 first on PATH and in
  MUSE_CODE_EXECUTABLE: 28 passed on rerun. The first run returned 51 rather than
  52 sessions during the raw-host discovery fixture's polling window, before
  invoking the adapter. It passed on rerun without code or assertion changes.
  Both logs are retained; no failure was suppressed or counted as a pass.
- Real non-negotiating two-stage titles: `Stage 1 of 4: echo one`, then
  `Stage 3 of 4: echo two`. Three-stage titles: `Stage 1 of 3: echo one`,
  `Stage 2 of 3: echo two`, `Stage 3 of 3: echo three`.
- Bex's exact configured Node/adapter command was exercised over NDJSON with a
  plain filesystem/terminal client on 1.2.1. The same two titles arrived;
  allow-all wrote both files and returned end_turn in 13.7s; deny-second wrote
  neither and returned end_turn in 12.0s. This verifies its launch command and
  protocol, not manual GUI interaction. Bex settings were not modified.
- Isolated loopback provider and dummy credentials throughout; no paid calls.
  Logs: `artifacts/w2-run/m3-*.log` and `artifacts/w2-m3/` (gitignored).
- Local Markdown links and board dependencies/archive consistency checked.
  Packaging and entrypoints are unchanged, so standalone/packaging checks are
  not required for this milestone.

The definition of done holds; no new host limitation blocks this milestone.
Loose inbox notes remain outside the loop. The concurrently added release note
009 is preserved locally, and depends on inbox work 006–008 as well as m3.
