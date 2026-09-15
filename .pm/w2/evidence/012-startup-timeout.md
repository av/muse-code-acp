# w2/012 — Captured startup-timeout evidence

Captured 2026-09-14 local time / 2026-09-15 UTC. Adapter revision `012151b`, public SDK 0.1.1, Muse `1.2.1-R2847.1`.

## Provenance and limits

The client/SDK stdout excerpts below are transcribed from the diagnostic commands' captured terminal output in this investigation. They were not originally written to standalone log files. Adapter excerpts come from the probes' persisted `agent.log` files. Only machine-specific executable paths are replaced with labeled placeholders; timing, error text and event values shown are preserved. Omitted events are explicitly identified.

These are synthetic-workspace probes, not transcripts or findings from a scanned repository. The slow adapter probe deliberately adds delay; the SDK-only 29-second startup is a separate, undelayed observation. These captures prove the adapter defect, but do not directly record the timeout callback inside the original failing scan.

## A. Undelayed SDK-only initialization exceeded the adapter limit and succeeded

Captured terminal output from a public `spawnMspConnection` probe with an empty temporary workspace:

```text
INITIALIZE OK after 29012 ms
HOST EXIT: {"kind":"cleanShutdown"}
```

The elapsed timer started immediately before spawning the real executable with `args: ["serve"]`. The probe awaited `initialize({ clientInfo: { name: "diagnostic_probe", version: "0.0.0" } })`, printed the success line, then explicitly called `close()` and awaited `child.exit`. No session or model turn was submitted. Thus `cleanShutdown` is the requested cleanup outcome, not an unexplained host exit.

This probe did not pass through the ACP adapter, its model-discovery step, or its startup timeout. It demonstrates that successful initialization on this host can exceed 20 seconds; it does not establish that every startup takes this long.

## B. Controlled delayed startup fired the timeout and returned EOF

Persisted adapter log from the controlled probe, with only the executable path replaced:

```text
2026-09-15T02:33:02.016Z pid=35437 Muse ACP started
2026-09-15T02:33:08.369Z pid=35437 Muse model discovery timed out
2026-09-15T02:33:08.399Z pid=35437 muse-sdk spawn: <diagnostic-wrapper> serve
```

Complete client event/error output after the initial temporary-directory announcement:

```text
6491 {"type":"thread.started","thread_id":"01a0a2e9-2091-7000-8965-fd80da34f7df"}
6492 {"type":"turn.started"}
27532 ERROR: Internal error: Muse SDK turn failed: connection reached EOF. Reload and inspect the session before deciding whether to submit again; execution may have occurred.
DIAGNOSTIC: 20-second startup timer fired before host became ready
```

Leading numbers are elapsed milliseconds since client-probe start. `thread.started` and `turn.started` are client adapter events; they do not establish that the Muse host initialized or accepted a model turn. The diagnostic marker comes from child stderr, collected and appended to the error by the client. Its printed position after the EOF message is not an event chronology.

The wrapper waited 21 seconds only for exactly one argument, `serve`, then execed the real binary with unchanged arguments. Other invocations, including version/help checks, had no added delay. The equivalent wrapper body below replaces the original absolute binary path with `REAL_MUSE`, a diagnostic-script variable:

```sh
#!/bin/sh
if [ "$#" -eq 1 ] && [ "$1" = serve ]; then sleep 21; fi
exec "$REAL_MUSE" "$@"
```

An isolated copy of the built adapter inserted exactly this line immediately before the existing `failTurn(new Error("Muse SDK startup timed out"))` call:

```js
console.error("DIAGNOSTIC: 20-second startup timer fired before host became ready");
```

The 20-second timeout and owner-close behavior were unchanged. Repository source was not modified. The probe's outer cancellation deadline was 45 seconds, later than the observed failure. This establishes that the adapter's own startup timer fired and its cleanup surfaced as EOF; it was not caller cancellation or a rejected model request.

## C. Undelayed adapter control completed

Persisted adapter log excerpts, omitting the schema-fingerprint advisory and replacing the executable path:

```text
2026-09-15T02:32:10.039Z pid=34336 Muse ACP started
2026-09-15T02:32:16.081Z pid=34336 Muse model discovery timed out
2026-09-15T02:32:16.124Z pid=34336 muse-sdk spawn: <real-muse-executable> serve
2026-09-15T02:32:30.067Z pid=34336 muse-sdk approval policy: requested=onRequest effective={"mode":"onRequest","source":"startup","lastCommandId":null}
```

Final captured client events, omitting preceding startup and internal `reminderChild` tool events:

```text
34887 {"type":"item.completed","item":{"id":"acp-agent_message","type":"agent_message","text":"OK"}}
34887 {"type":"turn.completed","usage":null}
```

The control used the same diagnostic adapter copy and SDK `bypassApprovals` selection without the delayed wrapper. Completion after 34,887 ms is total request duration, not host startup duration. It shows that the local adapter can complete a request when startup fits within its limit.

## Source explanation

At the recorded revision, [src/muse-sdk.ts](../../../src/muse-sdk.ts) starts the 20,000 ms timer before `owner.acquire()`, rejects `turnFailure`, and closes the owner on timeout. The main async operation awaits acquisition directly and only clears the timer after `session.sendUserTurn()` returns. Closing the host can therefore reject pending connection work with EOF, obscuring the already-recorded timeout cause.

[src/muse-sdk-host.ts](../../../src/muse-sdk-host.ts) owns the host handshake and close lifecycle; [src/turn-failure.ts](../../../src/turn-failure.ts) converts the propagated error to the client-facing transport failure. Links point to current source; use revision `012151b` when comparing the exact diagnosed implementation.
