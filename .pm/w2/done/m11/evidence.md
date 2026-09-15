# m11 stored-output delivery evidence — 2026-09-14

The public Muse 1.2.1 schema documents `item/readOutput` even though pinned
SDK 0.1.1 does not declare it. Production uses a narrow typed request bridge;
there is no private storage access, URI fetching or model replay.

## Observable delivery

`stored-output-live.test.ts` drives actual ACP requests and an approved native
shell invocation producing 300000 bytes (`yes output-marker | head -c 300000`).
On 1.2.1, the original tool card supplies the exact native reference ID; the
negotiated method returns bytes 77–176 verbatim, repeat reads return the same
page, and the final range returns ten actual bytes with EOF. A fresh adapter
and host reload the session, rediscover the same reference and return the same
page. All reads leave the loopback provider request count unchanged.

Baseline clients retain useful text and receive no output metadata. Muse
1.1.1 receives neither an initialization advertisement nor read handles and
rejects read requests explicitly. The positive 1.2.1 test requires actual
references; it cannot pass by falling through the unsupported branch.

Wrong item/ref IDs, URI strings in place of reference IDs, invalid offsets and
oversized lengths fail. A distinct real session cannot read the first session's
reference. A newly allocated session with no native history and a closed
adapter session fail explicitly. Deterministic tests cover missing availability,
vanished output after validation, malformed pages, exact byte counts and no
second fetch/retry. No private store deletion is used to simulate expiry.

## Simplification and contract

`stored-output.ts` owns bounds, result validation and reference metadata.
`readMuseSdkSession` reuses its existing workspace/session validation,
read-only host and 20-second cleanup bound. One bounded `readLatestItems` scan
serves both task restoration and output reference restoration, preserving opaque
cursors and at most 20 pages of 100 events. Current live metadata merges with
async-task metadata, preserving tool-call identity. No new execution-host cache.

See [output contract](../../../../docs/stored-output.md). Native rich MCP payloads
that are absent from public items remain a future watch in w1/007. Output read
support is verified specifically on 1.2.1, not inferred for all future versions.

## Validation

Commands and exact final results are recorded below. Local
logs/probe artifacts: `artifacts/w2-m11/`. Hosts: 1.2.1-R2847.1 and
1.1.1-R2514.1, SDK 0.1.1, Node 22.17.1. Loopback credentials only; no paid calls
or package publication.

- `npm run check` and `npm run build`: passed.
- `npm run test:unit -- --maxWorkers=1`: 461 tests / 74 files passed.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback -- --maxWorkers=2`:
  58 tests / 17 files passed on each supported host, no required skips.
- Final truthful inline-media wording: 13 focused tests / 3 files passed.
- `npm run test:pack-smoke`: passed; packed install completed stdio initialize,
  new, prompt, streaming, end_turn and close. Final check also passed.
