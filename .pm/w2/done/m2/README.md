# w2 · m2 — Muse 1.2.1 host support: resolve or record the six real-host failures

**Worker:** worker1 **Goal:** Turn the six real-host failures on Muse 1.2.1 into either fixed behavior with evidence or recorded host defects with reproductions, so the README's supported-host statement matches what the adapter actually does on the host the current Muse launcher installs. **Status:** done

## Observed failures

Measured 2026-09-14 on host `1.2.1-R2847.1`, SDK 0.1.1, loopback provider, no paid calls, with
`MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` (22 passed, 6 failed of 28). The same six
failed identically at `852a612` with [m1](../m1/README.md) stashed, so none of them is caused
by the multi-stage approval work. They fall into two causes.

**Cause A — a saved session cannot be re-composed (3 failures).** Loading or resuming a session
fails the prompt with:

```
Muse SDK turn failed: internal error: compose session permission profile:
permission profile ':auto-review' cannot be used: the automated reviewer is unavailable on this host
```

| suite                      | case                                                      |
| -------------------------- | --------------------------------------------------------- |
| `acp-restart-live.test.ts` | restarts the ACP process, binds via **load**, continues   |
| `acp-restart-live.test.ts` | restarts the ACP process, binds via **resume**, continues |
| `muse-sdk-live.test.ts`    | streams, resumes across processes, lists/loads history    |

The initial handoff inferred that the `muse-sdk-live` failure affected an SDK-created
session. Frame evidence below corrects that inference: all three failing resume
requests target legacy-created UUIDv4 sessions. The SDK-created UUIDv7 portions
of those same tests pass. The README's legacy attribution was correct.

**Cause B — failing HTTP MCP endpoints no longer fail the prompt (3 failures).** All three cases in
`mcp-http-live.test.ts` assert the prompt rejects; on 1.2.1 it resolves `end_turn` instead
(`promise resolved "{ stopReason: 'end_turn' }" instead of rejecting`, line 127) for unauthorized,
malformed and unreachable endpoints. The diagnostic contract delivered in
[w1/m16](../../../w1/done/m16/README.md) is therefore not honored on this host. Whether the host still
reports the connection failure through some public surface the adapter is not reading, or has
stopped reporting it, is the open question.

## Tasks (in order)

| id   | title                                                                              | est | depends_on             |
| ---- | ---------------------------------------------------------------------------------- | --- | ---------------------- |
| t001 | Reproduce and classify the six failures against public host surfaces — **DONE**    | 45m | —                      |
| t002 | Resolve or record the `:auto-review` session-composition failure — **DONE**        | 60m | w2/m2/t001             |
| t003 | Resolve or record HTTP MCP endpoint diagnostics on 1.2.1 — **DONE**                | 60m | w2/m2/t001             |
| t004 | Adoption surface: correct the supported-host statement and attributions — **DONE** | 30m | w2/m2/t002, w2/m2/t003 |
| t005 | Simplify milestone changes — **DONE**                                              | 30m | w2/m2/t004             |
| t006 | CI and behavior coverage — **DONE**                                                | 45m | w2/m2/t004, w2/m2/t005 |
| t007 | Close out the milestone — **DONE**                                                 | 15m | w2/m2/t006             |

Estimated total: 4h 45m across seven tasks.

## Definition of done

- Each of the six failures is either fixed with real-host evidence on `1.2.1-R2847.1`, or recorded
  here as a host defect with a minimal public reproduction, the exact host response, and why no
  adapter-side fix exists. A fix and a recorded blocker are both acceptable outcomes; an unexplained
  failure is not.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` on 1.2.1 either passes, or its remaining
  failures are exactly the recorded blockers, named individually with their cause.
- The README's compatibility section states the current supported host truthfully, and its
  attribution of the `:auto-review` failure matches the evidence rather than the earlier
  legacy-exec-only reading.
- No fix weakens a safety default: no fabricated approvals, no disabled sandbox, no invented MSP
  method, no silent backend switch.
- `npm run check`, `npm run build` and `npm run test:unit` pass.

## Source + Goal linkage

- **Source:** real-host measurement while verifying [w2/m1](../m1/README.md) on 2026-09-14, and
  the compatibility section of `README.md` recorded during 0.4.1 release testing.
- **Goal linkage:** truthful capabilities and dependable installation. The adapter currently tells
  users to pin a host the Muse launcher no longer installs, and one of the six failures contradicts
  the README's own explanation of it. Either state is a defect in what the project claims.
- **Expected outcome:** a user running the host their launcher installed either gets working session
  load/resume and honest MCP diagnostics, or reads an accurate statement of what will not work.
- **Why now:** the launcher auto-updates to 1.2.1 and removes superseded binaries, so `MUSE_CODE_EXECUTABLE`
  pinning to 1.1.1 is not reachable for a new install. m1 removed the one 1.2.1 defect that was
  adapter-owned; these six are what remains between the adapter and the current host.
- **Adoption surface:** included as t004, because the supported-host statement is the surface users
  act on.
- **Constraints:** follow `.pm/DO_NOT_DO.md`. Use public SDK/MSP surfaces and feature detection only;
  a host defect that cannot be addressed publicly is recorded, not worked around through private
  internals or the TUI.

## Out of scope

- The multi-stage approval work delivered in m1 and its presentation follow-up in m3.
- Reopening `w1/m16`'s MCP contract design; this milestone restores or records it on a newer host.
- Any change to the exec backend beyond what a recorded reproduction needs.

## Validation evidence

Baseline recorded 2026-09-14 (host `1.2.1-R2847.1`): 6 failed of 28, identical before and after the
m1 changes. Delivery evidence is recorded by t006.

## Triage, 2026-09-14

**Work on it.** At shipped m1 `a82cc2f`, the same six failures reproduce on
`1.2.1-R2847.1`; the three suites contain 13 cases (7 passed, 6 failed).
The goal remains wanted. Public frame capture corrects the legacy-session
attribution and identifies an adapter-side MCP fix. The pinning assumption is
also corrected: the launcher cache is replaceable, but CI's directly downloaded
1.1.1 artifact and checksum work locally (28/28 baseline passes).

## Frame evidence

All probes use isolated HOME/XDG roots, the repository loopback provider, and
dummy credentials; no paid provider, TUI or private host API. Logs and executable
probe scripts are retained under `artifacts/w2-m2/` (gitignored). Capture uses a
stdio tee named `muse` first on PATH plus MUSE_CODE_EXECUTABLE so every client
selects the same host. `muse schema generate-json-schema --out <directory>`
exports this host's public command schema offline.

### A: saved legacy permission profile — recorded host limitation

Minimal public reproduction: create an isolated session with
`muse exec --json --provider echo --session-id <uuidv4> --workspace <root> hello`.
Start `muse serve`, initialize through the pinned SDK, then read/resume that ID.
`probe-profile.mjs` uses the repository's built loopback fixture to supply the
isolated configuration. The echo exec session creation succeeds.

Relevant request and response fields (IDs and workspace paths abbreviated):

```json
{"method":"session/read","params":{"sessionId":"<uuidv4>","excludeItems":true}}
{"result":{"session":{"sessionId":"<uuidv4>","status":"notLoaded","activeTurnId":null,"providerId":"echo","turnCount":1,"approvalMode":{"mode":"promptUnmatched","source":"startup","lastCommandId":null}},"pendingRequests":[]}}
{"method":"session/resume","params":{"sessionId":"<uuidv4>","excludeItems":true,"commandId":"<uuidv7>"}}
{"error":{"code":-32603,"message":"internal error: compose session permission profile: permission profile ':auto-review' cannot be used: the automated reviewer is unavailable on this host","data":{"kind":"internal"}}}
{"method":"session/setApprovalMode","params":{"sessionId":"<uuidv4>","mode":"onRequest","commandId":"<uuidv7>"}}
{"error":{"code":-32024,"message":"session <uuidv4> is not loaded on this host"}}
```

No `session/start` was sent for the failed legacy sessions: they came from exec.
By contrast, the captured SDK-created sessions start with `approvalMode: "onRequest"`
and resume successfully. Public `session/read` exposes effective approval mode,
not the underlying profile; the rejected resume is the first public frame naming
`:auto-review`. The exact internal point where exec attaches it is not exposed.

The exported start/resume schema supplies no permission-profile override;
resume's new `config` object admits only MCP servers. `setApprovalMode` cannot
repair an unloaded session, and `serve --help` has no permission-profile override.
A public adapter-side repair is therefore unavailable without changing policy
or rewriting private persistence. Resume now fails with an actionable message;
no replay, saved-session edit, approval bypass or sandbox change occurs.

Affected cases, individually: `acp-restart-live` load and resume (their final
legacy-continuation portions), and `muse-sdk-live` streams/resumes/history/cancel
(its final legacy-continuation portion). These now assert the exact actionable
error on `1.2.1-R2847.1`; other hosts must still continue the session successfully.
The SDK-created portions always require success. Resume condition: a host with
working reviewer support or a documented profile migration surface. This is a
recorded product limitation, not unfinished adapter work or a blocker for m3.

### B: HTTP MCP startup — fixed in the adapter

At baseline, the settings overlay supplies
`{"mcpServers":{"remote":{"type":"http","url":"<loopback>","headers":{"Authorization":"Bearer <dummy>"}}}}`.
For each of 401, malformed JSON and a closed endpoint, `session/start` succeeds
and `turn/start` reaches `turn/completed` with `terminal: "completed"`.
No item, session state or captured stderr reports the failure. With omitted mode,
a successful terminal therefore does not prove a working MCP connection.

The public schema describes MCP startup `mode: "required" | "optional"`.
`probe-mcp.mjs` verifies that explicitly adding `mode: "required"` to the existing
settings overlay makes the host report a failure. The no-header 401 probe emits:

```json
{
  "method": "turn/completed",
  "params": {
    "terminal": "failed",
    "error": {
      "kind": "configError",
      "message": "invalid run configuration: Required MCP server `remote` failed during startup: it requires an OAuth sign-in; run `muse mcp login remote` and restart.",
      "retryable": false
    }
  }
}
```

The alternative session-config probe is stripped by the pinned SDK facade:
its captured `session/start` params contain no `config` field. This says nothing
about native host support for that extension. The implementation retains the
verified settings path and needs no SDK upgrade or new wire method.
ACP-provided stdio and HTTP servers explicitly require startup. User-inherited
server modes remain untouched, including optional servers. No fallback warning
or independent endpoint probe is needed. Existing authenticated HTTP live tests
pass unchanged: the unauthorized, malformed and unreachable cases reject and
`/mcp` retains the correct sanitized category; the healthy case executes the tool
and verifies credential isolation across host replacement.

## Delivery validation, 2026-09-14

- `npm run check`: pass (lint and formatting).
- `npm run build`: pass.
- `npm run test:unit`: 370 passed, 58 files. After preserving the caught error
  as the diagnostic cause, the affected host suite passes again (10 tests).
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback`: 28 passed,
  10 files, Muse 1.2.1-R2847.1. Three legacy continuations assert the recorded
  actionable host limitation, not successful continuation; no skips.
- Same required suite with CI-pinned Muse 1.1.1-R2514.1 first on PATH and in
  MUSE_CODE_EXECUTABLE: 28 passed, including successful legacy continuation.
- Local Markdown links resolve and `git diff --check` passes. No package,
  entrypoint, or standalone packaging changes; those lanes are unaffected.
- The implementation adds required startup in the existing SDK overlay and a
  narrow resume diagnostic. No new host-capability state or policy workaround.

All six baseline failures are explained: three fixed MCP failures and three
asserted manifestations of one recorded legacy-profile host limitation. The
milestone definition explicitly accepts a reproducible host limitation; no
unexplained failure or unfinished adapter task remains. m3 is independent.
