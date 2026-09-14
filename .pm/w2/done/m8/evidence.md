# m8 completion evidence — 2026-09-14

SDK failures retain open host categories, source, retryability and recovery hints
on the ACP wire. Ambiguous transport outcomes remain unknown and are never
replayed. Configuration checks no longer claim credential verification.
Negotiated `muse/authStatus` reports session-scoped rejection/successful-turn
observations with identity unknown. See [contract](../../../../docs/failures.md).

## Evidence

- `failure-live.test.ts`: actual 401 authRequired and 503 modelError on both host
  versions, baseline and negotiated clients; explicit later success clears stale
  failures, another session remains unknown, local status makes no provider call.
- `auth.test.ts`: nonempty/expired-looking stored credentials remain unverified;
  authenticate only checks configuration; logout with exported META_API_KEY still
  reports environment configuration and verification unknown, without key values.
- `muse-sdk.test.ts` and `turn-failure.test.ts`: unknown future categories retain
  their wire values and retryability; one failed submission stays one turn;
  bounded diagnostics redact supplied credentials and bearer/URL credentials.
- Existing disconnect, close, cancellation, approval and recovery suites pass.
  Native scheduling remains [w1/006](../../../w1/006.md), not implemented or advertised.
- Simplification centralized SDK terminal/transport mapping and authentication
  metadata. Credential replacement resets transient verification; old sessions
  cannot publish into replacement sessions. No account identity is inferred.

## Validation

Full unit suite: 452 tests in 71 files. Required real-host loopback: 51 tests in
14 files on each of Muse 1.1.1 and 1.2.1-R2847.1, without missing-host skips.
`npm run check` and build pass. Logs: ignored `artifacts/w2-m8/`.

Initial regression failures exposed overly broad credential-name redaction and
error-message assertions; fixed while retaining safe host-exit guidance. The 503
fixture was corrected to return server_error and bounded Retry-After. A wire test
briefly ran the old dist build during compilation; rebuilt wire and full unit
verification were rerun. Final live runs use two workers to bound host load.

All eight task criteria are delivered; no future native scheduling or identity
verification scope was marked completed.
