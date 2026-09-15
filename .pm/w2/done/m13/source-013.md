# 013 — Model discovery repeatedly times out during short-lived ACP sessions

Why: Repeated unsuccessful catalog discovery adds startup delay and extra host processes while clients continue with fallback model information.

## Evidence

Observed with adapter `06fd6f7`, SDK 0.1.1 and Muse `1.3.0-R3057.1` on 2026-09-14 local time / 2026-09-15 UTC. An automated client created short-lived ACP processes with up to 16 review assignments in parallel. No scan target or private configuration is needed for this report.

At the diagnostic snapshot, the persisted adapter log contained **319 occurrences** of `Muse model discovery timed out`. These exact representative lines were copied from that log:

```text
2026-09-15T04:14:25.366Z pid=19106 Muse model discovery timed out
2026-09-15T04:14:25.366Z pid=19105 Muse model discovery timed out
2026-09-15T04:14:25.366Z pid=19095 Muse model discovery timed out
2026-09-15T04:14:25.367Z pid=19101 Muse model discovery timed out
2026-09-15T04:14:25.368Z pid=19096 Muse model discovery timed out
```

The count is a snapshot of a growing log, not the final run total or a measured failure percentage. Review work continued, so this is not evidence that discovery failures abort turns.

At the recorded revision, [src/model-discovery.ts](../../../../src/model-discovery.ts) starts a separate `muse serve`, then races initialization plus `model/list` against `this.options.timeoutMs ?? 5000`. It closes the host and returns fallback catalog information on timeout. Its cache is per adapter instance. Separate successful execution-host initializations had a 63,865 ms median in the same run; those are a different host population, not measurements of the discovery subprocess itself. Together these observations justify investigating why a five-second discovery path consistently misses while execution proceeds.

## Scope and acceptance

- [ ] Reproduce catalog discovery with synthetic workspaces at concurrency 1 and 16. Record time in host initialization versus `model/list`, timeout rate, cleanup time and additional subprocess count. Use public SDK/MSP; no paid provider calls are needed for catalog-only probes.
- [ ] Determine whether the cause is discovery's deadline, repeated host startup, contention or another measured dependency. Coordinate initialization measurements with [014](../../014.md).
- [ ] Remove demonstrated duplicate work or avoid blocking otherwise runnable sessions on optional discovery, using existing lifecycle/cache mechanisms where appropriate. Preserve truthful model/effort choices and existing fallback behavior; do not invent a global cache, host pool or new public setting without evidence and explicit scope.
- [ ] Test successful discovery, unavailable discovery, catalog changes, cancellation and cleanup. Verify that any reuse keeps account/config/workspace context correct and does not share credentials or session state across unrelated clients.
- [ ] Show before/after startup latency and catalog availability on the supported host, and document remaining host limitations. Increasing a timeout alone is not proof the repeated overhead is fixed.

Related history: [w1/m8](../../../w1/done/m8/README.md) delivered model discovery; [w2/m12](../m12/README.md) repaired execution startup deadlines. This is a new measured discovery follow-up, not a reopening of those completed milestones.

Source: user request to file valuable adapter work with evidence embedded in each issue. This inbox note requests triage; size and promote implementation after attribution is established.
