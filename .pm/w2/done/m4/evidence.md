# m4 implementation and acceptance evidence

## Delivered contract

Both ACP mode interfaces select `bypassApprovals` and `rejectApprovals` on the SDK
backend. Automatic decisions reuse the stage reconciler, select only offered
once choices and never create client permission responses or persistent grants.
An absent eligible choice fails closed. Cancellation, stale generations and
host policy settlement cannot grant permission. `approvalAlreadyResolved` is
handled separately from other -32051 failures; -32053 refreshes the current stage.

Native policy is independent from automatic decisions and from host launch
posture. The requested policy is applied on start/resume/reuse; effective policy
is recorded from the public response and exposed only through the negotiated
session-state extension. 1.1.1 rejects non-default native selections before
mutation; its adapter automatic modes remain usable. All defaults remain intact.

The separate settings are `sandbox`, `sandboxNetwork`, `workspaceWrite`, and
`shell`. Broader settings retain root guards; disabling sandbox also requires
the existing environment opt-in. No SDK setting trusts workspace rules. Read-only
and planning force both effect routes off. Changes serialize against prompts,
reject foreground/native work, close the old host before overlay removal, and
are included in host identity. Load/resume revalidate preferences and workspace
ownership; forks reset mode and safety preferences.

## Real-host observations

Pinned SDK: @muse-code/sdk 0.1.1. Hosts: 1.1.1-R2514.1 and 1.2.1-R2847.1,
macOS arm64. All model traffic uses the repository loopback provider with dummy
credentials and isolated settings. No paid provider calls.

The reproducible local probe `artifacts/w2-m4/native.mjs` exercised four policies
on both hosts with a baseline known-safe `pwd` and an unresolved redirected
write. Sixteen runs completed. The files `native-{111,121}-*-{matched,unmatched}.log`
record returned effective policy, request/resolution events and filesystem effects.
Here "matched" means the default known-safe effect, not arbitrary user-authored
rule coverage.

| Policy          | 1.1.1                                                 | 1.2.1                                                                         |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| onRequest       | pwd runs; write asks and succeeds after once approval | Same                                                                          |
| promptUnmatched | Same as onRequest                                     | Both commands ask                                                             |
| denyUnmatched   | Still asks and writes after once approval             | Requests emitted then denied by policy; no write; racing reply returns -32051 |
| allowAll        | Still asks                                            | No prompts; write succeeds                                                    |

`src/tests/safety-live.test.ts` verifies the production ACP route: multi-stage
approval and rejection, filesystem containment, explicit sandbox-off, real direct
loopback network connectivity, non-shell writes and idle host replacement. Native
allowAll/denyUnmatched cases assert execution on 1.2.1 and actionable early
rejection on 1.1.1. Proxy-only/restricted block direct loopback; enabled connects.
Both hosts advertise restricted/enabled/proxy-only and the same launch flags.

Linux uses a different OS sandbox. Existing required CI targets Ubuntu 22.04;
Ubuntu 24.04's default AppArmor namespace limitation remains documented. Local
macOS results do not claim a new Linux execution run or universal OS parity.

## Regression and simplification

- Mode/config tests replace the former 010 rejection contract with successful
  SDK bypass selection before a prompt, retaining yolo/root/backend rejections.
- Permission tests cover multistage updates, widened choices, stale requirements,
  automatic rejection, no eligible once choice, malformed/cancelled replies and
  other MSP errors. Live tests reject safety changes during an open approval.
- SDK lifecycle tests cover replacement serialization; fork tests prove broader
  source settings cannot leak; process restart tests retain mode and network
  settings through both load and resume.
- Defaults, validation, CLI arguments and config choices share `safety-settings.ts`.
  No parallel approval loop or synthetic user response was introduced. Unchanged
  settings avoid unnecessary host replacement; policy application is shared by
  opening and reuse. Existing bounded observation and cancellation machinery is
  preserved.
- README, SDK migration guide and the ADR003 safety row describe delivered
  controls, requested/effective distinctions and actual version/platform limits.
  The separate ADR003 inbox reconciliation remains out of this loop's scope.

## Closing checks

- `npm run check`: passed (lint and repository format check).
- `npm run build`: passed.
- `npm run test:unit -- --maxWorkers=3`: 67 files, 431 tests passed on the final implementation.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback -- --maxWorkers=3`: 11 files, 40 tests passed on 1.2.1-R2847.1.
- With both PATH and MUSE_CODE_EXECUTABLE pinned to `artifacts/w2-run/muse-1.1.1/muse`, required loopback with `--maxWorkers=2`: 11 files, 40 tests passed on 1.1.1-R2514.1.
- `npm run test:pack-smoke`: passed initialize/new/prompt/stream/end_turn/close.
- Markdown links, dependency cycles, physical task state and `git diff --check`: passed before archive; archive checks repeated afterward.
- Earlier runs included one unit readiness timeout and one 1.1.1 discovery internal error under contention; both passed focused rechecks and subsequent complete suites. They are not hidden skips.
- No standalone packaging implementation changed; no paid provider, package publication or deployment ran.

Final logs are retained locally in `artifacts/w2-m4/{unit-verified,loopback-final-111,loopback-final-121,check-verified,pack}.log`. Checked-in acceptance tests reproduce the product effects.
