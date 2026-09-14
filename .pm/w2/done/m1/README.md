# w2 · m1 — Multi-stage approval reconciliation and silent-stall guardrails

**Worker:** worker1 **Goal:** Complete multi-stage shell approvals on the SDK backend by reconciling from fold state instead of the SDK router, and turn any future silent wait on a pending host request into a bounded, diagnosable failure. **Status:** done

## Issue cause

Consolidated from inbox note `w2/004` (reported and triaged 2026-09-13) when this milestone was
created; that note is consumed and this section is its record.

**Reported:** 2026-09-13, from Bex Security scans on adapter `852a612` (0.4.1) with host
`1.2.1-R2847.1`. Distinct from [003](../003.md), which closed a repeated-prompt UX report as
expected behavior. This is a hang, and the client answers automatically.

### Symptom

On the SDK backend in Default / `onRequest`, a single `bash` tool call whose compound shell command
needs approval for **more than one** stage never completes. The client answers the one permission
request it receives; the tool never runs and the turn produces no terminal. An unattended client
waits forever — no error, no timeout, no progress. Bex Security shipped a workaround pinning
`MUSE_CODE_ACP_BACKEND=exec` for scans, forgoing remote HTTP MCP and plan mode.

### Reproduction

Deterministic with a compound command containing two writes:

```
echo one > <workspace>/a.txt; ls <workspace>; echo two > <workspace>/b.txt; cat <workspace>/a.txt
```

Prompt it over stdio ACP with `MUSE_CODE_ACP_BACKEND=sdk`, mode `default`, answering every
`session/request_permission` with `allow_once`. Observed: exactly one permission request, answered
in ~0.1 s, then silence. Neither file is created. The host splits the command into four stages, two
of which need a decision:

| requirement `sourceIndex` | argv                    | resolution |
| ------------------------- | ----------------------- | ---------- |
| 0                         | `echo one`              | unresolved |
| 1                         | `ls <workspace>`        | known_safe |
| 2                         | `echo two`              | unresolved |
| 3                         | `cat <workspace>/a.txt` | known_safe |

The same deadlock reproduced through a real Bex Security scan: a diagnostic `bash` call with 11
stages, decision on `sourceIndex: 3`, `terminal: false`, hung ~50 minutes until cancelled.

### Root cause

**The host is not deadlocked.** Muse 1.2.1 continues the multi-stage approval through
`approval/updated` and waits for the client to decide the next requirement. `@muse-code/sdk@0.1.1`
deliberately never routes `approval/updated` to the `onApproval` handler, and the adapter has no
other path to see stage 2, so the second requirement is never decided.

Wire trace of the two-stage command, captured with a stdio tee around `muse-bin-1.2.1-R2847.1`
(loopback provider, dummy credentials, isolated HOME/XDG, no paid model calls):

| t (s) | dir | frame                                                                                                                         |
| ----- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1.991 | ←   | `approval/requested`, `currentRequirementId.sourceIndex: 0`, stages 0 unresolved / 1 known_safe / 2 unresolved / 3 known_safe |
| 1.994 | →   | `approval/decide` `allow_once` for sourceIndex 0 (sent by the SDK router)                                                     |
| 2.010 | ←   | result `{ status: "accepted", terminal: false }`                                                                              |
| 2.010 | ←   | `approval/updated`, `currentRequirementId.sourceIndex: 2`, `change.kind: stageResolved`, `availableChoices` allow_once, abort |
| 30.05 | →   | `turn/cancel` (test timeout); host records decision `abort`, `turn/completed`                                                 |

No second `approval/requested` is ever sent. The host's durable session log agrees: seq 49
`approval_command_intake.settled terminal:false`, then nothing until seq 50 `decision_applied abort`
at cancel. A single-stage control command completes normally with `terminal: true`.

Three facts settle ownership:

- **The host expects the client to drive the next requirement.** A raw SDK probe (no adapter) sent
  `approval/decide` with the `currentRequirementId` carried by `approval/updated`; it returned
  `terminal: true`, both files were written, and the turn completed in 9.5 s.
- **SDK 0.1.1 owns the contract gap.** `facade/session.js` lists `approval/updated` as "deliberately
  NOT routed", citing tdd SS5.6.3 ("a re-issued REQUEST embodies the refresh"); this host never
  re-issues one. The fold does keep the refresh as `pendingApprovals()[i].latestUpdate`, so the data
  reaches consumers; only the router ignores it. npm has only 0.1.0 and 0.1.1, so no upgrade exists.
- **The adapter cannot currently detect the stall.** The SDK handler API never exposes `terminal`
  (the router discards the decide result), and `src/muse-sdk.ts` never reads `latestUpdate`, so a
  non-terminal decision is indistinguishable from a completed one.

A 1.1.1 comparison was not possible locally: the launcher deletes superseded binaries, only 1.2.1 is
cached, and there is no pin mechanism. Whether 1.1.1 re-issued `approval/requested` stays unverified
and does not change the fix, since the adapter must work on 1.2.1.

`session/cancel` unwinds cleanly (the host records `abort` and the prompt returns `cancelled`), so
only a client with no timeout waits forever — which is why the watchdog in t003 is scoped here
rather than deferred.

Local-only evidence is under `artifacts/w2-004/` (gitignored): both frame logs, the host
`session.jsonl`, the adapter-level and raw-probe vitest fixtures, and the tee/parser scripts.

## Tasks (in order)

| id   | title                                                                                  | est | depends_on                                     |
| ---- | -------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| t001 | Replay-capable fake MSP host with multi-stage approval scripts — **DONE**              | 45m | —                                              |
| t002 | Adapter-owned approval reconciler with multi-stage decisions — **DONE**                | 60m | w2/m1/t001                                     |
| t003 | Liveness watchdog for pending approvals and user inputs — **DONE**                     | 45m | w2/m1/t002                                     |
| t004 | Host compatibility metadata and view-event exhaustiveness — **DONE**                   | 45m | w2/m1/t002                                     |
| t005 | Real-host multi-stage approval coverage — **DONE**                                     | 45m | w2/m1/t002, w2/m1/t003                         |
| t006 | Adoption surface: document multi-stage approvals and compatibility metadata — **DONE** | 30m | w2/m1/t002, w2/m1/t003, w2/m1/t004, w2/m1/t005 |
| t007 | Simplify milestone changes — **DONE**                                                  | 30m | w2/m1/t006                                     |
| t008 | CI and behavior coverage — **DONE**                                                    | 45m | w2/m1/t006, w2/m1/t007                         |
| t009 | Close out the milestone — **DONE**                                                     | 15m | w2/m1/t008                                     |

Estimated total: 6h across nine tasks. Implementation spans fixture, reconciler, watchdog and observability work before closing tasks.

## Definition of done

- On Muse `1.2.1-R2847.1` with `@muse-code/sdk@0.1.1` in Default / onRequest, one `bash` call whose compound command has two or more unresolved stages produces one ACP `session/request_permission` per unresolved stage, carrying that stage's `museRequirementId`, and executes after every stage is allowed; the prompt returns `end_turn`. Verified by fake-host unit tests and real-host loopback tests.
- Denying at any stage submits the host-offered deny/abort choice for that stage; no later stage runs, nothing is written, and the prompt still returns `end_turn`.
- Only host-offered `choiceId`s are ever submitted, with the `requirementId` the host most recently published; a stale-requirement rejection (`-32053`) re-reads the fold instead of failing the turn.
- A pending approval or user input with no in-flight ACP request and no fold progress for the watchdog bound fails the prompt with an error naming the approval, requirement, stage evidence and last host event, instead of waiting indefinitely. Verified by a decide-then-silence fake-host script.
- After a host lease initializes, `session_info_update` carries `_meta["muse/hostCompatibility"]` with pinned and actual schema fingerprints, match state and host version; the existing log line remains.
- Every view-event method the SDK folds is classified in an adapter-owned handled/ignored table with a reason, and a test fails when the installed SDK folds a method the table does not know.
- README, `docs/sdk-migration.md` and ADR003 describe multi-stage approvals, the watchdog and the compatibility metadata; `npm run check`, `npm run build`, `npm run test:unit` and `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` pass.

## Source + Goal linkage

- **Source:** inbox note `w2/004`, reported 2026-09-13 from Bex Security scans and triaged the same day; consumed into this milestone's [Issue cause](#issue-cause) section on promotion. Fix direction agreed with the user on 2026-09-13 as phase 1 of the systematic design: fold-state reconciliation plus cheap guardrails.
- **Goal linkage:** A faithful, reliable adapter must never wait forever on a host fact it received but did not act on. The host continues multi-stage approvals through `approval/updated`; the pinned SDK never routes that frame; the adapter relies solely on the SDK router. Reconciling from `session.fold.pendingApprovals()` (the pattern already used for user input) removes the dependency on SDK routing, and the watchdog bounds the whole class of "fold holds a pending fact nobody polls".
- **Expected outcome:** Unattended ACP clients (Bex Security scans) can run compound shell commands on the SDK backend without pinning `MUSE_CODE_ACP_BACKEND=exec`, regaining remote HTTP MCP and plan mode; any future stall of the same class surfaces as an error with diagnostics.
- **Why now:** An adopter shipped a workaround that forgoes SDK-backend features; the failure is silent and unbounded under automation; 1.2.1 is what the Muse launcher installs today; a raw probe already proved that deciding the refreshed requirement completes the command, so the fix is adapter-local and needs no SDK release.
- **Adoption surface:** Included as t006 because the SDK backend's approval behavior changes for users and a new negotiated `_meta` field appears; covers README, `docs/sdk-migration.md`, ADR003 permission rows and CHANGELOG.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: no fabricated approvals, only host-offered choices and scopes, no TUI driving, keep `@muse-code/sdk@0.1.1` pinned, no private MSP methods. `approval/decide` and `approval/listPending` are documented public commands.

## Out of scope

- Session-state diff observers for `session/approvalModeChanged`, `session/modelChanged` and allow-always persistence failures (phase 2).
- Replacing `MuseClient` with a bare `Connection` + `Session` pump to observe raw apply outcomes (phase 3).
- Upstream SDK changes (routing `approval/updated`, exposing `terminal`), the exec backend, and any automatic-approval policy work owned by w1/m25.

## Validation evidence

### Delivery, 2026-09-13

Host `1.2.1-R2847.1` (`muse --version`), SDK 0.1.1, loopback provider with dummy credentials; no
paid model calls.

| Check                                                     | Result                   |
| --------------------------------------------------------- | ------------------------ |
| `npm run check`                                           | pass                     |
| `npm run build`                                           | pass                     |
| `npm run test:unit`                                       | 369 passed, 58 files     |
| `npm run test:pack-smoke`                                 | pass                     |
| `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` | 22 passed, 6 failed (28) |

The 6 real-host failures are the pre-existing Muse 1.2.1 defects the README already records: two
ACP process-restart continuity cases, three HTTP MCP diagnostic cases and one SDK live
session-continuity case. They were measured on this host at `852a612` with the milestone work
stashed and are byte-identical before and after: same six tests, same names. No new real-host
failure remains.

All four new multi-stage live cases pass: two-stage (one request per unresolved stage, both files
written), three-stage (three distinct requirements in source order), deny-at-stage-2 (nothing
written, `end_turn`), and refreshed per-stage evidence for a negotiating client. The two-stage case
that previously hung indefinitely now completes in about 10 seconds.

One assertion was updated rather than the behavior: `workflows-live.test.ts` pinned the old
router error text. A decide rejection still fails the turn with its MSP code and no host detail;
only the wording changed, from "Muse approval round-trip failed (submitFailed; MSP -32603)" to
"Muse approval decision rejected (MSP -32603)".

### Post-closeout verification through Bex Dev, 2026-09-14

Verified against the exact command Bex Dev is configured to launch, read from
`~/.config/bex/settings.json` (`agent_servers` → `Muse Code`): its own Node binary and this
repository's `dist/index.js`, spawned as a real child over NDJSON stdio with a Zed-family
capability set. Loopback provider, no paid model calls. Bex's settings were not modified.

| build                        | permission requests | result                   | files written |
| ---------------------------- | ------------------- | ------------------------ | ------------- |
| `852a612` (before, stashed)  | stage 0 only        | hung; timed out at 60s   | none          |
| this milestone               | stage 0, then 2     | `end_turn` in about 9.8s | both          |
| this milestone, deny stage 2 | stage 0, then 2     | `end_turn` in about 9.8s | none          |

The compatibility announcement arrived with `hostVersion: 1.2.1` and `matches: false`, carrying
the real fingerprint divergence that had previously only been a log line.

Bex's GUI could not be driven automatically: its CLI only opens windows and files, so it cannot
send a prompt. The verification therefore covers the artifact, command, Node binary and wire
Bex uses, not a human clicking in the app.

One finding, recorded as w2/005 and since promoted to [w2/m3](../m3/README.md): both permission frames are identical in every
field a client without the `muse/approval` extension renders, so the user cannot tell the stages
apart. The protocol behavior is correct; the presentation is a separate gap.

### Limitations

- Muse 1.1.1 was not re-tested locally: the launcher removes superseded binaries and offers no pin,
  so only 1.2.1 is installable here. The reconciler reads the current requirement from
  `latestUpdate` when present and from `requested` otherwise, so it covers a host that re-issues
  the request as well as one that refreshes it, but the 1.1.1 lane is verified only by CI.
- This milestone does not change the README's supported-host decision. The other 1.2.1 defects are
  untouched.

### Triage

Triage 2026-09-13 on host `1.2.1-R2847.1`, adapter `852a612`, SDK 0.1.1, loopback provider with dummy credentials (no paid calls): two-stage command yields `approval/requested` (sourceIndex 0) → `approval/decide` allow_once → result `terminal: false` → `approval/updated` with `currentRequirementId.sourceIndex: 2` and `change.kind: stageResolved` → no further host frame until `turn/cancel`. Single-stage control completes. Raw SDK probe deciding stage 2 from the update returned `terminal: true`; both files written; turn completed in 9.5 s. Local-only evidence (frame logs, host `session.jsonl`, probe fixtures) is under `artifacts/w2-004/` (gitignored). A 1.1.1 host comparison was not possible locally (launcher removes superseded binaries; no pin). Delivery evidence is recorded by t005 and t008.

### Resumed delivery verification, 2026-09-14

`npm run check`, `npm run build`, `npm run test:unit` (369 tests, 58 files), and
`npm run test:pack-smoke` pass. The required real-host suite passes **28/28** on
Muse `1.1.1-R2514.1`, SDK 0.1.1, isolated loopback providers and dummy credentials.
The CI-pinned macOS ARM64 public artifact remains downloadable and its SHA-256
matches CI; putting its directory first on `PATH` as well as setting
`MUSE_CODE_EXECUTABLE` pins both in-process and child-process test clients.
This supersedes the earlier claim that local 1.1.1 verification was unavailable.
Logs: `artifacts/w2-run/m1-{check,build,unit,pack,live-pinned}.log` (gitignored).
An initial mixed-host run used only the executable override and is not a valid
host comparison; the fully pinned run is the delivery evidence.
