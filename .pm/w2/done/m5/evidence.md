# w2/m5 delivery evidence

Date: 2026-09-14. SDK 0.1.1, Muse 1.1.1-R2514.1 and 1.2.1-R2847.1.
All provider traffic used isolated local HTTP fixtures and dummy credentials.

## Observed settings contract

| Case                                                                            | 1.1.1                                                        | 1.2.1                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| Main requested none/minimal/low/medium/high/xhigh/ultra                         | Effort absent for all seven                                  | minimal/minimal/low/medium/high/xhigh/max |
| Idle model switch with settings overlay alone                                   | Resume metadata agrees but execution retains prior model     | Same                                      |
| Idle switch plus explicit public setter, including when metadata already agrees | Main request uses new model                                  | Main request uses new model               |
| Same-session effort update                                                      | Same host; requested preference retained, main effort absent | Same host; mapped main effort changes     |
| Active steering with selected ultra                                             | Same active turn; effort absent                              | Same active turn; main effort max         |
| Distinct explicit gateways                                                      | Separate endpoints and bearer keys                           | Separate endpoints and bearer keys        |
| Endpoint auth rejection                                                         | No default-provider fallback                                 | No default-provider fallback              |

The adapter originally skipped `session/setModel` when resume metadata matched
startup settings. Independent raw MSP and SDK facade probes disproved the initial
hypothesis that the host could not change models. The shipped fix always sends the
public setter with provider identity when opening an execution host, then checks
public metadata before submitting. An accepted response alone was not the evidence:
`settings-live.test.ts` checks actual main-provider model after seven effort turns.
No relay, request rewrite, implicit fork or replay is used.

Main-provider captures select exact user markers, distinguishing wrapped reminder
requests. Raw probes are retained locally under `artifacts/w2-m5/`: `effort-*.log`,
`native-model-reconfigure.mjs`, `native-model-overlay-single.mjs`,
`native-model-facade.mjs`, `native-model-two-overlays.mjs`. Earlier
`model-reload-*` and `live-guarded-*` results reflect the rejected hypothesis,
not the delivered behavior or a durable upstream blocker.

## Implementation and acceptance coverage

- t001–t003: `settings-live.test.ts`, `model-identity.test.ts`,
  `model-discovery.test.ts`, and `session-host-reuse.test.ts` verify provider/profile
  identity, overlapping IDs, discovery fallback, all effort mappings, same-host
  updates, explicit setter and busy-setting rejection. Unknown/stale qualified
  choices fail; raw custom IDs remain requested values subject to host admission.
- t009: explicit negotiated `muse/provider` provisions Meta-compatible gateway
  settings and bearer credentials in per-session environments. Endpoint fingerprints
  exclude keys; close/restart requires credentials again, idle resume permits key
  rotation, and two sessions never share endpoint traffic or authorization. A 401
  endpoint cannot fall back. Catalog cache keys include credential/config identity.
- t010: optional `muse/configRecommendations` refers only to displayed options with
  catalog or retained-selection provenance and `applied: false`. Baseline clients
  require no extension; unknown per-model/tier restrictions stay unknown.
- t004: successful model/provider selections and explicit effort are recorded
  outside native logs; restore preserves explicit intent, then reapplies it publicly.
  Host observations stay separate through `muse/sessionState`. Restart/load/resume,
  fork and reuse tests cover continuity, current settings and isolated ownership.
- t005–t006: README, SDK migration and relevant ADR003 rows describe requested versus
  observed values and extension contracts. Recommendation logic is extracted;
  provider/profile resolution is shared; effort no longer forces host recreation.
  No new account facts or named-profile effective-routing claims are made.

## Closing checks

- `npm run check` and `npm run build`: passed.
- `npm run test:unit -- --maxWorkers=3`: 437 tests / 68 files passed.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback -- --maxWorkers=2`:
  44 tests / 12 files passed separately on both pinned hosts. For 1.1.1 set
  PATH and MUSE_CODE_EXECUTABLE to `artifacts/w2-run/muse-1.1.1/muse`.
- Updated identity/no-op tests: 12 passed. Updated settings/restart/legacy migration
  tests on 1.2.1: 14 passed after the full suite.
- `npm run test:pack-smoke`: passed initialize/new/prompt/stream/end_turn/close.
- Board links and dependency/status validation pass during closeout.

Logs: `artifacts/w2-m5/unit-verified.log`, `check-verified.log`,
`live-verified-111.log`, `live-model-fixed-121.log`, `live-updated-121.log`,
`identity-verified.log`, `closing-targeted.log`, `pack-verified.log`.
Initial discovery internal-error failure under concurrent load did not recur in
complete runs. Legacy echo migration initially failed `unsupported_route` after
provider identity preservation; tests now explicitly select Meta before continuation.
The 1.2.1 saved `:auto-review` limitation remains covered by an explicit failure
assertion, not a skipped test. No paid-provider or publication step was run.
