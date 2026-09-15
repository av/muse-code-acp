# m12 delivery evidence — 2026-09-14

## Implementation and original acceptance

- **Startup policy (t001):** `SdkOperation` owns phase transitions, deadlines and the initiating failure. Initialization and session preparation each get `MUSE_CODE_ACP_STARTUP_TIMEOUT_MS` (default 120000); acknowledgement gets `MUSE_CODE_ACP_SUBMIT_TIMEOUT_MS` (default 30000). Running model work has no startup deadline. Positive integer validation rejects zero/invalid settings. The default startup budget gives roughly fourfold headroom over the original observed 29012 ms cold start while remaining bounded and configurable; it is not an empirical upper bound. Phase timings are recorded without prompt text. Controlled-clock tests allow 29012 ms in initialization and another 29012 ms in preparation.
- **Failure fidelity (t002):** Acquisition, submission and execution all observe one initiating failure channel. Timeouts are recorded before owned-host cleanup; cleanup EOF and even a rejected cleanup cannot replace them. Normal cancellation retains ACP cancelled responses, including session close; cancellation after a recorded failure cannot conceal it. Public host diagnostics and provider/authentication errors remain supported and redacted.
- **Submission certainty (t002):** The submitting phase is entered before `sendUserTurn`, rather than after its acknowledgement. Failed initialization/preparation reports `execution: notSubmitted`; a dropped acknowledgement reports a possibly submitted turn and unknown outcome. The fake MSP emits acceptance then withholds acknowledgement; exactly one turn/start is observed, with no adapter replay.
- **Ownership and late work (t001/t003):** Host-open continuations check stopped state before advancing; the turn coordinator checks readiness again before submission. Caller cancellation and adapter disposal stop owned processes. Read/control operations join disposal tracking, and the shared control host uses one idempotent cleanup promise. Tests check both owned PID and POSIX process-group disappearance.
- **Regression evidence (t004):** Deterministic stdio cases cover initialization/setup timeout, caller cancellation in each phase, independent exit, lost acknowledgement, read timeout/cancellation, disposal and cleanup rejection. Controlled-clock tests cover independent startup/read budgets and late readiness after termination. Real ACP tests exercise induced 21-second startup, real delayed-host timeout/cancellation with zero provider requests, and 16 independent undelayed clients; each client reaches its loopback provider and retains a distinct session ID. Both supported hosts are required.

## Deadline audit and related repairs (t003)

| Path                                                                   | Finding and disposition                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution host (`muse-sdk.ts`, `muse-sdk-host.ts`)                     | Confirmed original aggregate timeout and error-channel defect. Replaced with separate initialization/preparation/submission phases and primary-cause preservation.                                                                                                                                                                                                                |
| Session read/list                                                      | Same close-only aggregate timer identified in source; delayed initialization/EOF and abort exercised with deterministic SDK stdio. Shared control host separates startup from the existing 20-second bounded read budget. Public session/workspace checks and cursor bounds remain.                                                                                               |
| Load/resume, goal inspection, stored output                            | Consumers reuse the repaired read host; adapter disposal aborts and awaits them. Output requests preserve their existing unavailable-session error code while retaining structured cause data. No provider replay.                                                                                                                                                                |
| Fork control host                                                      | Audit found the same aggregate cutoff. Shared startup/read handling is followed by a separate 20-second forking phase. No model turn is submitted, but after fork submission an unknown result records `mutation: possiblyApplied`; inspect session/list before retrying. Source checks remain before mutation. Deterministic lost-fork-response coverage observes one fork call. |
| Model discovery                                                        | Existing five-second advisory timeout already races its own error, closes its host and returns an explicit fallback. Retained rather than applying execution-startup latency to optional catalog discovery.                                                                                                                                                                       |
| Version/help probes                                                    | Existing five-second synchronous capability probes retained; these are bounded compatibility checks, not host initialize/session setup.                                                                                                                                                                                                                                           |
| Post-turn metadata, steering, pending-work watchdog and idle retention | Existing operation-specific limits retained. Post-turn metadata is optional and must not change the completed model outcome; these are not initialization budgets.                                                                                                                                                                                                                |

## Adoption and simplification (t005/t006)

[Failure guidance](../../../../docs/failures.md#startup-phases-and-deadlines), README,
SDK migration and stored-output docs describe settings, phases, recovery and
read/control distinctions. No editor UI or exec behavior change is claimed.
Shared `sdk-control-host.ts` replaces duplicate host/timer/cleanup logic in read,
list and fork. `SdkOperation` centralizes timeout provenance and phase data;
execution-owner guards preserve existing session/policy invariants. Cleanup is
idempotent, observed, and cannot mask an initiating failure.

## Validation and provenance

Original source evidence remains in [012](source-012.md) and its linked captures.
Induced delay is separate from naturally observed cold-start timing. The original
external scan's cause remains an inference; its client's suppression/retry policy
has not been changed. All new provider requests use a local fixture, with no paid
providers or package publication.

Local command logs and timing records live under `artifacts/w2-m12/` (not shipped).
During validation the system launcher auto-updated from 1.2.1 to 1.3.0. Runs that
could cross that change are not authoritative 1.2.1 acceptance. Final acceptance
uses fixed native binaries, with both PATH and MUSE_CODE_EXECUTABLE set. The
1.2.1-R2847.1 aarch64 macOS artifact was downloaded from its public release
manifest and verified against SHA-256
`020ebed5248767450413a7972a5cbc12c228ad82d4bdcf221e5d6350df39604c`.
The pinned 1.1.1-R2514.1 binary was used throughout its runs. SDK is 0.1.1;
Node is 22.17.1. This milestone makes no new 1.3.0 compatibility claim.

Final verified results:

- `npm run check` and `npm run build`: passed.
- `npm run test:unit -- --maxWorkers=1`: 475 tests in 76 files passed (`unit-closeout.log`).
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback -- --maxWorkers=2`: 61 tests in 18 files passed per fixed host. Authoritative logs: `live-final-111.log` and `live-pinned-121.log`. No required skips.
- The discarded auto-updating-launcher run had four failures involving restart/legacy-reviewer state and workflow expectations. It is recorded as a mixed-version failure, not counted as a pass and not diagnosed as a new 1.3.0 defect by this milestone.

Pinned timing records (milliseconds; concurrent elapsed includes client initialization and session creation):

| Host          | Delayed ACP prompt (21-second induced launch delay) | All 16 concurrent clients | Maximum concurrent initialize / prepare / submit phase |
| ------------- | --------------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| 1.1.1-R2514.1 | 21788                                               | 5755                      | 188 / 1023 / 1163                                      |
| 1.2.1-R2847.1 | 21852                                               | 5951                      | 163 / 1496 / 435                                       |

Both runs completed all 16 requests with distinct session IDs and verified removal
of owned PIDs and process groups after disposal. These synthetic-workspace
observations do not bound production tail latency or reproduce the external scan.

`npm run test:pack-smoke` passed after the final build: packed install completed
stdio initialize/new/prompt/stream/end_turn/close. All eight task requirements
were checked against the implementation and these results before archive closure.
