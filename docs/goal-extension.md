# Observed session goals

The SDK backend observes Muse's persistent goal separately from an ACP prompt.
Muse 1.1.1-R2514.1 with `@muse-code/sdk` 0.1.1 was verified using a local provider:
`create_goal`, `report_progress` and `update_goal` model tools produced public
`session/goalChanged` events, including progress after the original prompt ended.
These are Muse model tools, not adapter goal-control commands.

## Negotiation and state

Clients opt in with `clientCapabilities._meta["muse/goal"] = 1`. Initialize responds
with `_meta["muse/goal"] = {"version":1,"observation":true,"controls":[]}`. The
adapter sends `session/update` with `sessionUpdate: "session_info_update"` and
`_meta["muse/goal"]` containing one of:

```json
{
  "status": "known",
  "goal": {
    "objective": "Ship the change",
    "status": "active",
    "percentComplete": 75,
    "currentWork": "Testing",
    "nextWork": "Review"
  }
}
```

```json
{ "status": "known", "goal": null }
```

```json
{ "status": "unknown", "reason": "Goal history could not be read" }
```

Only public objective, status, percentComplete, optional currentWork and nextWork
are forwarded. Unknown status strings and finite reported percentages are
preserved, without clamping or inventing budgets or timestamps. Explicit null
clears the previous objective. Missing or malformed observations are unknown;
they are not evidence of a cleared goal. Duplicate observations are suppressed.
New sessions begin with no recorded goal.

Load/resume restores the latest goal from a supported snapshot or public
`view/page` history, including explicit clearing. Recovery reads at most 20 pages
of 100 events under the session reader's deadline. Incomplete, pruned, malformed
or unavailable history reports unknown. A fully exhausted history without any
goal establishes absence. Read-only recovery does not take a session writer lease.

## Inspection and lifecycle

`/goal` and `/goal status` display the last observed state without a model turn.
They work for SDK clients with or without metadata negotiation. Unknown state
triggers a bounded history read. `/goal <task>` explains that persistence is
unavailable and executes the task once in the current mode, with its attached
context. It does not create a goal, background loop or automatic retry. Explicit
pause, resume, clear and edit requests receive local guidance without executing a
model turn. `/goal status` with separate task text returns status then executes
that task; attachments alone do not trigger a turn. The public MSP exposes no
verified goal-control API;
controls remain an upstream dependency and none are advertised. The legacy exec
backend has no goal extension or local goal command.

A retained session host observes folded goal state at 100 ms intervals, with one
update delivery in flight. Intermediate progress can be coalesced. Observation
continues after a foreground prompt completes while the host remains open. The
existing retention bounds apply: 60 seconds after releasing a foreground turn,
or rotation after 32 successful foreground turns. Closing the session closes its
host; loading history restores its recorded goal without starting an adapter loop.

An active goal alone never marks an ACP prompt busy. Muse can independently start
another native turn for that goal. While an actual host-owned turn runs, a new
ordinary prompt fails explicitly with a retry/close instruction; local inspection
still works. Once that turn settles, ordinary prompts work again. ACP cancellation
and steering retain their foreground-turn contract; they are not goal controls.
Background tool permissions are not silently granted outside an ACP foreground
permission interaction. There is no adapter-owned autonomous execution loop.

## Evidence

`goal-live.test.ts` verifies creation, later native progress/completion, inspection
without provider calls, actual background-turn exclusion, subsequent ordinary
prompts and restoration in a new client against the supported host. It is part of
required Muse loopback CI. `goal-wire.test.ts` verifies opted-in and baseline
clients, explicit clearing, duplicate suppression, unsupported commands and
close cleanup using the MSP fixture. `goal-state.test.ts` covers snapshots,
latest-clear precedence, unknown values, session identity and bounded pagination.
Explicit clear delivery is a protocol fixture test; no public clear action is
claimed from that test.
