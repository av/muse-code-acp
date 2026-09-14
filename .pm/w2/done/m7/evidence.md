# m7 completion evidence — 2026-09-14

Delivered authoritative root usage/context observations and replacement ACP plans,
public reasoning summaries, correlated live tool output and bounded explicit
fallbacks. `/status` reports requested and observed settings separately without
starting a provider turn. See [progress contract](../../../../docs/progress.md).

## Behavioral evidence

- `progress-live.test.ts`: real public summary appears exactly once; cumulative
  root usage survives close/load; status and restore issue no provider requests.
- Actual public `write_todos` create, modify, complete and empty snapshots reach
  ACP; close/load restores the latest plan without a model call.
- Approved shell output arrives while the original tool call is in progress,
  before its completion, and final output retains the original call ID.
- `session-progress.test.ts`: root/child separation, replacement totals, missing
  context denominator remains unknown, pressure metadata, cancellation mapping,
  empty/reset plans and latest-first opaque-cursor restoration.
- `muse-sdk-events.test.ts`: completion-only and streamed public summaries,
  private reasoning ignored, interleaved tools and inaccessible rich-reference
  fallbacks; repeated accumulated catch-up does not duplicate any text surface.
- Shared host observation reuses the existing lifecycle timer. Review removed
  duplicated catch-up logic and distinguished absolute accumulated text from
  deltas. Output and todo bounds retain explicit truncation notices.

## Validation

- Full unit suite: 448 tests / 70 files passed (`unit-close.log`).
- Required full loopback: 47 tests / 13 files on each of Muse 1.1.1 and
  1.2.1-R2847.1 (`live-final-111.log`, `live-final-121.log`), no missing-host skips.
- Final context metadata assertion: 3 focused tests passed. Final live metadata
  verification: 3 tests per host (`metadata-live-111.log`, `metadata-live-121.log`).
- `npm run check`, `npm run build`, package smoke passed. Local logs are under
  ignored `artifacts/w2-m7/`.
- A parallel unit run hit a shared temporary-directory test race; the complete
  serial run passed. No product failure was hidden by that rerun.

No private reasoning, invented cost/quota/context window, output-fetch endpoint
or child usage total is advertised. Rich bytes absent from the public host remain
future [w1/007](../../../w1/007.md); worker lifecycle is separately owned by m9.
All nine tasks have delivery evidence; no blocker or future task was closed.
