# 012 — Startup timeout terminates healthy SDK hosts and surfaces as misleading EOF

Why: Automated ACP clients can repeatedly lose healthy but slow-starting Muse hosts without receiving the actual timeout cause.

## Confirmed evidence

See [captured logs and probe provenance](../../evidence/012-startup-timeout.md) for the SDK-only success output, delayed-start timeout/EOF capture, successful control, diagnostic instrumentation and source references.

Diagnosed 2026-09-14 (local date) against local adapter revision `012151b`, SDK 0.1.1 and Muse `1.2.1-R2847.1`.

- A direct public-SDK `spawnMspConnection` probe, without the ACP adapter, successfully completed `initialize` after **29,012 ms**. The probe then requested shutdown and observed `cleanShutdown`; it submitted no model turn.
- `src/muse-sdk.ts` starts a fixed **20,000 ms** timer before `owner.acquire()`. It calls `failTurn(new Error("Muse SDK startup timed out"))` and closes the owner. The timer is only cleared after `session.sendUserTurn()` returns, so host initialization, session setup and turn submission share this budget.
- A controlled adapter probe delayed only the actual `muse serve` launch by 21 seconds, leaving `--version` and `serve --help` probes unchanged. An isolated copy of the built adapter added a diagnostic print at the existing timeout callback; timing and production behavior were otherwise unchanged.
- The callback fired, and the client received this error after **27,532 ms** total (including earlier adapter setup):

```text
Internal error: Muse SDK turn failed: connection reached EOF. Reload and inspect the session before deciding whether to submit again; execution may have occurred.
DIAGNOSTIC: 20-second startup timer fired before host became ready
```

The controlled probe never reached host initialization or model execution. It proves both premature termination of slow startup and loss of the initiating timeout cause. A separate undelayed single-request control completed successfully through the same local adapter.

## Integration impact and attribution limits

An automated review client launching 16 host-managed assignments repeatedly restarted workers with zero accepted file coverage. Logs showed approximately 27-second restart cycles, including roughly six seconds of adapter model discovery and twenty seconds after host spawn. Both the normal launcher and direct Muse executable exhibited the loop. A probe using the review environment returned the same EOF error.

The original integration run did not instrument the timeout callback, so its specific cause remains a strong timing-based inference, not a directly observed callback. The SDK-only slow initialization and controlled adapter failure above establish the adapter defect independently. Client-side suppression and repeated retry of assignment errors is a separate integration issue.

## Reproduction

1. With a supported real Muse host, time public SDK `spawnMspConnection({ command, args: ["serve"], cwd, env })` followed by `initialize({ clientInfo: { name: "diagnostic_probe", version: "0.0.0" } })`; close the connection afterward. Use an empty temporary workspace and record host version and duration.
2. For deterministic slow startup, point `MUSE_CODE_EXECUTABLE` at a temporary executable that waits 21 seconds only when invoked with exactly `serve`, then execs the real binary with unchanged arguments. All other invocations must pass through immediately.
3. Start the ACP adapter, create a session in an empty temporary workspace, select SDK `bypassApprovals`, and submit a trivial no-tools prompt. Record the timeout callback and returned error. No scan target or private configuration is required.
4. Include an undelayed control. Distinguish induced delay from naturally observed startup duration in all evidence.

## Requested resolution and acceptance

- [ ] Allow legitimate slow SDK initialization and session setup to complete; replace or revise the blanket 20-second cutoff based on observed lifecycle behavior rather than choosing another arbitrary limit. Preserve caller cancellation and cleanup of owned processes.
- [ ] Preserve the initiating timeout/cancellation/host-exit cause across cleanup; a locally triggered startup timeout must not be replaced by the resulting transport EOF.
- [ ] Distinguish failure before turn submission from ambiguous failures after a turn may have been accepted. Do not claim possible model execution for a verified pre-initialization timeout, or automatically replay an ambiguous turn.
- [ ] Add deterministic delayed-start and cleanup/error-ordering coverage. Verify real-host startup and concurrent-client behavior, reporting host/SDK versions and actual outcomes.
- [ ] Confirm ordinary requests still complete and canceled starts leave no owned hosts running. Update failure guidance if observable error behavior changes.

Related implementation: `src/muse-sdk.ts`, `src/muse-sdk-host.ts`, `src/turn-failure.ts`; coordinate with the lifecycle/failure behavior delivered by [w2/m8](../m8/README.md).

Source: user request to diagnose the remaining scan failure and file confirmed Muse ACP defects in w2. This note records an investigation/fix request; implementation sizing and milestone promotion remain to be done.
