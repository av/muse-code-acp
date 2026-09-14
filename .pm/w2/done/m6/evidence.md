# w2/m6 verification

2026-09-14: SDK 0.1.1, Muse 1.1.1-R2514.1 and 1.2.1-R2847.1,
macOS ARM64, isolated local providers with dummy keys. No paid provider,
publication, native deletion, private protocol or implicit replay was used.

## Inventory and corrections

[Capability audit](../../../../docs/capability-audit.md) enumerates ACP handlers,
configuration, commands, public control methods, all folded notifications and
named item families. The existing ownership ledger was validated, not migrated
again. All 61 historical source allocations still resolve; w1 has only watches
002–012 and w2 has no dependency on them. Current positive workflow, error,
output and settings findings each retain one owner (m9, m8, m7 and completed m5).
The missing ACP dialog action for native userInput/clarify is unverified and not
advertised; no URL settlement contract is invented.

Residual defects fixed here:

- New/load silently ignored extra authorized directories while resume/fork
  rejected them. All four entries now reject nonempty additionalDirectories
  before session effects via shared single-workspace validation.
- The 1.1.1 native policy menu advertised policies rejected on selection. Menu
  filtering and admission now share nativePolicyAvailability. Independent adapter
  bypass/rejection modes remain available under their existing guards.
- Mode selection, restored validation and advertisement share modeAvailability.
  Errors distinguish unknown, backend, guard, version, busy and unverified state;
  defaults and backend are never silently changed.
- Default SDK mode text no longer promises onRequest when an independent native
  policy was selected. Event/item classification points at actual current owners
  and installed-schema tests detect new unclassified families.

## Fresh public-route rechecks

`artifacts/w2-m6/` contains copies of the bounded earlier public SDK probe scripts
and this run's per-version logs. `serve-help-{111,121}.log` records public CLI
options; the installed `msp.d.ts` method/notification map was rechecked.

- `compact.mjs`: completed approved two-stage workspace write, then public
  session/compact. Both hosts: -32030 compaction_unavailable. Native compaction
  remains w1/004; unrelated usage delivery stays current m7.
- `worker.mjs`: public workflow item completes on 1.2.1. The corresponding 1.1.1
  result reports workflow_launch_unavailable. Observed reminder-child IDs reject
  session/read and resume with -32020 on both. Current lifecycle/control work is
  m9; independently accessible child history remains w1/005.
- `rich.mjs`: real MCP initialize/list/call with text/image/link/structured output.
  Both publish flattened visibleOutput without modelVisibleContent/outputRef.
  1.1.1 ends projectionError; 1.2.1 completes. Current output handling remains m7,
  missing native media/retrieval remains w1/007.
- `retry.mjs 503`: both produce retryable modelError after ten provider attempts
  (20 total including subordinate work), without turn/retryScheduled. Current
  truthful errors remain m8; native scheduled events remain w1/006.

These conclusions are narrow observations, not generic SDK incapability. The
public registry still lacks root deletion, goal mutations, account quota/tier,
output retrieval and additional-root/URL settlement contracts. Future watches
have explicit public support triggers and remain independent of current delivery.

## Closing validation

- npm run check; npm run build: passed.
- Full unit suite: 442 tests / 69 files passed after final root and item checks.
- Required Muse loopback suite: 44 tests / 12 files passed on each pinned host;
  no missing-host skips. Updated real safety tests assert the policy advertisement
  matches host enforcement. SDK behavior unchanged by the subsequent early
  extra-root rejection; focused ACP entry tests verify that path starts no host.
- Focused capability/event contracts and four-root entry rejection: passed.
- Link, unique task/dependency/cycle/status and whitespace checks: passed.

Logs: artifacts/w2-m6/unit-final.log, contracts.log, roots.log, live-111.log,
live-121.log, check.log. No package/standalone surface changed.

Simplification removed duplicate mode checks and native-version logic, reused a
single extra-root validator and kept evidence classification separate from host
execution. No extra polling or host recreation was introduced. The broader
historical ADR editorial reconciliation remains loose inbox w2/011.
