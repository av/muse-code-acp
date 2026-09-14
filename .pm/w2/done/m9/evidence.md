# m9 completion evidence — 2026-09-14

Public worker cards, retained background output/lifecycle and exact negotiated
workflow cancellation are delivered. See [contract](../../../../docs/async-tasks.md).

## Current host evidence

- Both Muse 1.1.1 and 1.2.1 produce shell task items that remain in progress after
  the foreground prompt completes, then reach a real terminal. The `background`
  flag was absent in the probe: retention follows actual item state, not an
  invented flag or foreground completion. Reminder-child cards retain identity.
- Muse 1.2.1 emits workflow lifecycle and observed workflowRunId. Public
  `workflow/cancel` returned accepted and the exact workflow subsequently became
  cancelled. Its public conformance transcript is linked from the contract.
  This method is served even though SDK 0.1.1 omits its declaration.
- `workflow/childControl` with an observed childId/attempt returned invalid_target.
  No child control or shell-stop action is advertised. Separate native child
  histories/permissions remain w1/005. On 1.1.1 a workflow tool response does not
  establish a workflow item/control target; no cancellation action is advertised.
- Controls bind the observed item to one host generation and ACP session; they
  never convert workflow handles into child IDs or submit a model prompt.

## Behavior and lifecycle

`async-tasks-live.test.ts` verifies background completion after prompt return,
original card identity with one terminal, observed workflow cancellation while
another session's workflow remains unaffected, close/load and replacement-host
stale target rejection, and unresolved host-close outcomes without late updates.
`async-tasks.test.ts` covers repeated revisions, distinct child attempts, terminal
and unknown status, baseline restore and negotiated actions. Existing restart
coverage ensures resume does not replay historical task cards.

Review reuses the same per-turn translator after foreground completion, so item
revision and accumulated-text deduplication have one owner. Retained observers
share the existing bounded host timer/lifetime. Old-generation callbacks cannot
publish into replacement sessions. Load performs bounded public reads and never
calls an unfinished historical item live without evidence.

## Validation

- 454 unit tests / 72 files passed.
- Required full loopback: 54 tests / 15 files on each supported host; no skips.
- Check and build passed; package smoke is reused from m7 because packaging rules,
  dependencies and entrypoints are unchanged (only live-test command membership).
- Local evidence logs are in ignored `artifacts/w2-m9/`.

Initial fake hosts lacked serverInfo; version gating now treats absent metadata as
unknown. Resume history was corrected to preserve its no-replay contract. Actual
host-loss tests distinguish host retirement from ACP close, which removes the
session before allowing any late callbacks.

## New current capability handoff

The host schema export revealed APIs missing from the pinned SDK type union.
A 300000-byte shell output on 1.2.1 produced an outputRef; public item/readOutput
returned the exact requested first 100 bytes, base64 encoded. Stored-output
retrieval is therefore promoted from w1/007 to w2/m11, with only unavailable rich
MCP payload preservation remaining in w1. Native session/rename accepts a slug
and rejects a title containing spaces; m10 remains the owner of user-title work.
This supersedes the m6 inference that a missing SDK declaration meant no host API.
