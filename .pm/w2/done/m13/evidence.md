# m13 delivery evidence

## Attribution and upstream handoff

The native startup issue is tracked in [meta-models/muse-code-sdk #11](https://github.com/meta-models/muse-code-sdk/issues/11). The issue embeds the standalone SDK-only reproduction; it is independently runnable before this repository change is shipped. Local source: `scripts/reproduce-muse-startup.mjs`. Public method/results: `docs/muse-startup-latency.md`.

Pinned Muse 1.3.0-R3057.1, SDK 0.1.1, macOS ARM64. Direct SDK-only measurements with 6,000 synthetic session directories: 998 ms initialization at concurrency 1, 11,831–12,023 ms at concurrency 16; model/list 0–4 ms. Same files moved outside sessions: 57 ms. Empty history: 80 ms single, 105–131 ms concurrent. Zero provider HTTP requests and zero model turns. These are native startup observations, not an adapter-only regression.

## Implementation and behavior

- t001: `newSession`, load and resume use `MuseModelDiscovery.peek`; no automatic catalog-only host. `MuseSdkHost` exposes its existing connection for optional model/list. Requested provider/profile routing is captured before background results arrive. Execution-overlay catalogs are session-local; only standalone base-context results enter the shared per-agent cache.
- t002: `/models` is a standalone SDK local command, available before inference. It reuses a ready host or explicitly starts an owned discovery host with the existing startup deadline. Cancel/close/dispose reap owned hosts; borrowed waiters have independent cancellation. Identity changes or closed/replaced owners discard late results.
- t003: Public issue #11 includes verified synthetic reproduction and measured phases. 014 remains open for a native fix and remeasurement. No private history contents, credentials or target repository are required.
- t004: README, SDK migration, session commands, ADR003 comparison and startup diagnosis describe deferred catalogs, explicit refresh and remaining native costs. Exec behavior is unchanged.
- t005: Three simplify reviews completed. Shared cache insertion preserves captured async identity; a WeakMap coalesces pending requests only on the same connection; unchanged visible menus do not trigger duplicate notifications. No host pool, persistent/global catalog cache, data-home change or credential-backend change was introduced.

## Before/after startup evidence

Prior adapter discovery with 6,000 synthetic history directories and 16 instances: 16/16 fallback results in 6,005–6,016 ms, with 16 catalog-only host starts. Each used five seconds waiting plus approximately one second for cleanup.

The added ACP populated-history test creates 16 independent clients against a shared synthetic data tree, asserts zero serve processes at session creation, executes one loopback turn per client, verifies all clients receive catalog updates, then verifies owned PIDs/process groups are gone.

| Host          | Synthetic history directories | Session creation for 16 clients | Catalog-only serve starts | Total execution serve starts |
| ------------- | ----------------------------: | ------------------------------: | ------------------------: | ---------------------------: |
| 1.1.1-R2514.1 |                         1,000 |                            9 ms |                         0 |                           16 |
| 1.2.1-R2847.1 |                         1,000 |                           10 ms |                         0 |                           16 |
| 1.3.0-R3057.1 |                         6,000 |                           20 ms |                         0 |                           16 |

The 1.3.0 creation-plus-turn phase took 44,751 ms under concurrent machine load. Native initialization was not eliminated; only redundant automatic catalog startup and its blocking wait were removed. The earlier SDK-only baseline and this full ACP execution trial have different workloads, so their total times are not a native speedup claim.

## Validation

- `npm run build`: passed.
- `npm run check`: lint and formatting passed.
- `npm run test:unit -- --maxWorkers=2`: 480 tests across 76 files passed after simplification.
- Required `npm run test:muse-loopback -- --maxWorkers=2`, with native binary and PATH pinned separately to 1.1.1 and 1.2.1: 62 tests across 18 files passed on each host.
- Muse 1.3.0 targeted populated-history test, `MUSE_CODE_ACP_TEST_HISTORY_DIRECTORIES=6000`, `-t 'returns 16 sessions'`: 1 passed; 3 unrelated startup cases intentionally filtered out. This is not a full 1.3.0 compatibility claim.
- After simplification, pinned Muse 1.1.1 affected startup/model/settings suites were repeated: 15/15 tests across 3 files passed (`111-after-simplify.log`).
- Deterministic coverage includes wire-level no-initialize creation, pre-turn model/effort changes, config invalidation, shutdown and cancellation, unresponsive borrowed catalogs with continued turns, no extra host, preserved provider routing, coalesced requests and independent waiter cancellation.

Two full native suites plus all unit files initially ran with unrestricted file parallelism and caused substantial contention/time-bound failures. Those runs are retained as diagnostic failures, not acceptance evidence. Re-running bounded file scheduling passed; the tests' actual 16-client concurrency was retained. A separate fixture race was fixed by copying the fake MSP binary per wire fixture, preventing other tests' chmod calls from changing its host/cache identity.

Local logs are under `artifacts/w2-013-diagnosis/`: `unit-closeout.log`, `verified-111.log`, `verified-121.log`, `verified-130.log`, corresponding JSONL measurements, and build/check delivery logs. Original experiment artifacts remain separate. No paid provider was called; full execution tests use loopback fixtures.

## Remaining limitation

014 and upstream #11 remain open until a native host fix is available and the populated-history matrix improves without losing history visibility. Adapter mitigation is complete independently of that upstream fix. Existing m12 phase, first-failure, cancellation and cleanup protections remain in force.
