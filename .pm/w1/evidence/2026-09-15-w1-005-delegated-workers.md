# w1/005 bounded reassessment — delegated workers on Muse 1.3.0

Date: 2026-09-15 UTC. Scope: the one bounded reassessment budgeted in
[005](../005.md). No production code changed; `delegatedWorkers` stays `false`.

## Environment

- macOS aarch64, Muse Code **1.3.0 (1.3.0-R3057.1)**, host build `ac7280f2aca67769d1455a8847bb502b617d50f6`, SDK `@muse-code/sdk` 0.1.1, adapter at `f0da62b`.
- Default durable `muse serve`, isolated dummy credentials, loopback provider. No paid provider calls; all provider traffic terminated at `127.0.0.1`.
- Public reproduction committed as [`scripts/reproduce-delegated-workers.mjs`](../../../scripts/reproduce-delegated-workers.mjs): `node scripts/reproduce-delegated-workers.mjs "$(which muse)"`. It depends only on `@muse-code/sdk`, not on adapter code, and emits one JSON row per observation.
- Exploratory probe and raw captures preserved under `.tmp/w1-005-probe/` (ignored): `probe.mjs`, `provider2.mjs`, `tools.mjs`, plus `items.json`, `requests.json` and per-run logs. Three exploratory runs plus one public-script run; results identical.

## What changed since the 1.1.1/1.2.1 evidence

**The old launcher blocker is gone.** `workflow_launch_unavailable` did not
reproduce on any run. The workflow tool launched, the child executed real
provider I/O and reached a terminal result. The reconciliation envelope reports
`launch_admitted: true`, `production_owner_loop_started: true`,
`child_work_started: true`, `provider_or_tool_io_started: true`.

One harness artifact is worth recording so it is not mistaken for a host defect:
a workflow child is granted a `submit_result` tool and must call it. A loopback
provider that only returns text makes the child terminate `failed` with
`child_result_missing` in ~270 ms. After scripting `submit_result`, the same child
terminated `completed` in 145–194 ms. Both findings below come from runs with a
**successfully completed** child.

## Finding 1 — the `subagent` item kind is never emitted

Across all three runs, with a healthy completed child, no item of kind
`subagent` appeared. `items.filter(i => i.subagentId)` was empty every time.
The child is observable only as a `WorkflowChild` entry inside the `workflow`
item's `children[]`:

```json
{
  "childId": "01a0a77a-7078-7bf0-bf34-8e857d2e7c88",
  "attempt": 1,
  "status": "terminal",
  "durationMs": 145,
  "terminal": "completed",
  "resultRef": "subagent-result://01a0a77a-7078-7bf0-bf34-8e857d2e7c88/task/…"
}
```

`WorkflowChild` carries **neither `subagentId` nor `childSessionId`**. The
`resultRef` uses a `subagent-result://` scheme, so a subagent identity exists
internally, but no public item surfaces it.

Consequence: the nine `subagent/*` methods declared in `MspMethod`
(`msp.d.ts:1895`) have no reachable target through any public surface. They are
implemented rather than absent — an invented `subagentId` is rejected with
`-32030 commandRejected … invalid_target`, which is method dispatch, not
`methodNotFound`. They are simply untargetable. The probe could not exercise the
real-target path at all, so grant/deny, sibling isolation and targeted-control
semantics remain **unverified, not refuted**.

Tool-catalog check: the root turn's 23 offered tools include `workflow` but no
direct agent/task spawn tool, so the workflow script is the only public
delegation route available to test.

## Finding 2 — documented child history reads still fail

`msp.d.ts:477` states that `childSessionId` is "readable via
`session/read`/`view/page`". Every `childSessionId` observed on 1.3.0 came from
`reminderChild` items, and every read of one failed:

| target                        | `session/read`   | `view/page`      | `session/resume` |
| ----------------------------- | ---------------- | ---------------- | ---------------- |
| 3 × `reminderChild` child ids | `-32020` ×3 runs | `-32020` ×3 runs | `-32020` ×3 runs |
| root session (control)        | OK, 7 items      | OK, 10 events    | n/a              |

Exact error: `sessionNotFound`, `session <uuid> was not found`. Nine child
observations per method family, zero successes. The root control succeeded on
the same connection in the same run, so this is child-session lookup, not
connection or method failure. `session/list` returns only the root session.

This reproduces the 1.2.1 observation (4 ids) on 1.3.0 (3 ids) and extends it to
`view/page`, which the doc comment names explicitly.

## Assessment

The w1/005 revisit trigger — "accessible child histories and stable routable
native-child/control identities" — is **not met**. Two independent gaps remain,
and they are now sharper than before:

1. No public item exposes a `subagentId`, so declared controls are unreachable.
2. Observable `childSessionId` values violate their documented readability.

Finding 2 is a clean contract-versus-behavior mismatch with a root control and a
deterministic reproduction, which makes it the stronger upstream report. Finding
1 is better framed as a spec question (is `subagent` expected to be emitted for
workflow children on this path?) than as a defect claim, since we cannot rule out
that the item kind belongs to a delegation route we have no public access to.

`delegatedWorkers: false` in `src/acp-agent.ts` remains the accurate
declaration. w2/m9's observed worker cards remain the delivered capability, and
this reassessment delivers no feature.

## Correction to a prior note

005 recorded a `workflow/childControl` … `invalid_target` observation. That
method is not in `MspMethod`; the rejection came from calling a method that does
not exist in the public contract. It is not evidence of a host defect and should
not appear in an upstream report.
