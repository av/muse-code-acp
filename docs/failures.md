# Failures and authentication observations

SDK turn failures retain `error.data.failure` with `kind`, `source` (host,
provider or transport), optional host `retryable`, `outcome` and a recovery hint.
Unknown native kinds remain visible. `authRequired` uses ACP's authentication
error; other failures use an internal-error response with this structured data.
Cancellation and step limits retain their standard ACP stop reasons.

A retryable failure does not schedule a retry. The adapter never resubmits an
ambiguous turn. After a transport failure, reload and inspect the session before
explicitly deciding to submit again. Native retry scheduling remains a
[future host integration](../.pm/w1/006.md).

Clients can negotiate `clientCapabilities._meta["muse/authStatus"] = 1`.
Initialize, authenticate and logout responses describe credential configuration;
SDK turns also emit `session_info_update._meta["muse/authStatus"]` with:

- `configured` and `source`: environment, stored file, client provider or none.
  A nonempty credential file is configuration evidence only; its contents are
  never read by the adapter.
- `verification`: `unknown`, `rejected` following native `authRequired`, or
  `acceptedForTurn` following a successful SDK turn. This last value describes
  that turn's outcome, not validation of an account, every stored credential, or
  future requests. Account `identity` is always `unknown`.
- Session-scoped `latestFailure`, cleared by a later successful turn. Other
  sessions retain independent observations. Close/reload, credential replacement
  and logout clear transient verification; restored configuration is unverified.

`authenticate` checks configuration and does not contact a provider. Expired
credentials can therefore be configured with verification unknown until a real
turn rejects them. `muse logout` cannot unset an inherited `META_API_KEY`; logout
still reports that environment key as configured and unverified. All adapter sessions and retained hosts are closed by logout; client gateway
credentials are removed from adapter memory.

Baseline clients receive standard errors and can use SDK `/status` for local
configuration/observation text. Exec supports configuration reporting but has no
structured native turn evidence; it never emits SDK verification observations.
No raw stderr or arbitrary protocol data is copied into SDK turn errors. Error
messages are bounded and redact supplied secret environment values, bearer
credentials and common credential URL forms.
