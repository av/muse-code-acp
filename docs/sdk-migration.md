# SDK migration — compatibility and ACP support matrix

This adapter defaults to the Muse Code SDK path (`muse serve` via
`@muse-code/sdk`). Set `MUSE_CODE_ACP_BACKEND=exec` for the legacy
`muse exec --json` path. Unknown selectors fail at startup. SDK turn failures
never silently fall back to exec.

## Pins

| Component                  | Version              | Notes                                             |
| -------------------------- | -------------------- | ------------------------------------------------- |
| `@muse-code/sdk`           | **0.1.1** (exact)    | Public MuseClient / Session / Connection APIs     |
| `@agentclientprotocol/sdk` | **1.3.0** (exact)    | ACP protocol major `PROTOCOL_VERSION` (= 1)       |
| Muse host (`muse serve`)   | **≥ 1.1.1** required | Default backend; `muse serve --help` must succeed |
| Muse host (`muse exec`)    | **≥ 0.2.1**          | Legacy `MUSE_CODE_ACP_BACKEND=exec` only          |

Verified locally with Muse Code **1.1.1**. Older hosts without `serve`, or hosts
that exit with the experimental SDK tier disabled, fail **before** a model turn
with an actionable upgrade hint (or set `MUSE_CODE_ACP_BACKEND=exec`).

## Rollback

```sh
MUSE_CODE_ACP_BACKEND=exec muse-code-acp
```

## ACP surface (advertised)

| Capability                            | Advertised?                                    | Contract owner                                               |
| ------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Protocol major 1                      | yes (always returned as our supported version) | `src/acp-agent.ts` initialize + `src/tests/acp-wire.test.ts` |
| Prompt: text + resource_link          | baseline (no capability flag required)         | `src/prompt-content.ts`                                      |
| Prompt: embedded text resource        | yes (`embeddedContext`)                        | attributed text; binary resources rejected                   |
| Prompt: audio                         | **no**                                         | rejected with invalid params                                 |
| MCP stdio                             | stdio and HTTP (SDK); SSE not advertised       | `docs/mcp-passthrough.md`                                    |
| `session/load`, `session/list`        | yes                                            | session store + export helpers                               |
| Auth logout                           | yes                                            | `src/auth.ts`                                                |
| Terminal auth method                  | only if `clientCapabilities.auth.terminal`     | `src/auth.ts`                                                |
| Interactive permissions (SDK backend) | yes                                            | `src/muse-permissions.ts` + live approval suite              |
| Form elicitation (SDK user input)     | yes when client advertises `elicitation.form`  | `src/muse-user-input.ts`                                     |
| fs / terminal RPC                     | **no**                                         | omitted client caps never invoked                            |
| Session fork/delete                   | **no**                                         | unadvertised                                                 |

## Public SDK API map

| ACP / adapter behavior | Public SDK / MSP API                                                     | Fallback                                                                    |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Spawn MSP host         | `spawnMspConnection` + `MuseClient`                                      | —                                                                           |
| Handshake / durability | `initialize` + `readSessionDurability`                                   | fingerprint mismatch is advisory                                            |
| Start / resume session | `MuseClient.startSession` / `resumeSession`                              | missing session (`-32020`) → start; in-use/busy/wrong workspace fail closed |
| Approval mode          | `startSession({ approvalMode: "onRequest" })` + resume `setApprovalMode` | host default is `promptUnmatched`                                           |
| Set model              | `Connection.command("session/setModel")`                                 | facade has no setModel                                                      |
| Submit turn            | `Session.sendUserTurn`                                                   | —                                                                           |
| Stream items / deltas  | `Turn.items()` / `Turn.deltas()` (+ fold catch-up for pre-ack deltas)    | —                                                                           |
| Cancel                 | `Connection.command("turn/cancel")`                                      | close host if cancel fails                                                  |
| Approvals              | `Session.onApproval` → ACP `session/request_permission`                  | cancel/deny map to a host-offered deny choice; no fabricated grants         |
| User input             | fold `pendingUserInputs` + `userInput/answer`\|`cancel`                  | clients without form elicitation cancel and fail the turn                   |
| View gaps              | Session gap-fill (`view/page`) + `onGapError`                            | stalled/failed fill fails the prompt; no extra `turn/start`                 |

## Retained CLI / store helpers

These stay because public SDK session APIs do not yet provide the required
legacy surface. The **default turn path** uses only the SDK backend.

| Helper                        | Why retained                                                    |
| ----------------------------- | --------------------------------------------------------------- |
| Session store listing         | ACP `session/list` workspace filtering + titles/timestamps      |
| `muse export` history replay  | Complete chronological load when SDK history APIs are absent    |
| `muse login` / logout helpers | Auth surfaces without an SDK credential API                     |
| `muse skills list`            | Slash-command advertisement                                     |
| MCP settings overlay          | Session-owned stdio/HTTP MCP merge; exec retains per-turn stdio |

## Resource-link encoding

MSP `TurnInputPart` only declares `text` \| `image`. ACP `resource_link` blocks
are encoded as ordered text parts:

```text
Resource link: {"name":"notes","uri":"file:///notes.md","size":0}
```

The JSON object preserves name, URI, title, description, MIME type, size,
annotations and opaque metadata. Absent fields are omitted; explicit nulls,
empty strings and zero sizes are retained. JSON escaping keeps quotes and
newlines inside their original field. This replaces the older newline-delimited
encoding. No URI is fetched; the same encoding is used for legacy exec.

## Modes

SDK reasoning-effort choices are `none`, `minimal`, `low`, `medium`, `high`,
`xhigh`, and `ultra`, the public MSP vocabulary accepted in completed Muse 1.1.1
loopback turns. Values pass through unchanged; unknown selections are rejected.
The catalog does not supply per-model effort restrictions. These controls request
a host effort tier; individual providers determine its effect and may map tiers.
An explicit ACP effort selection is saved in adapter-owned
`$XDG_DATA_HOME/muse-code-acp/sessions/` (or `~/.local/share/muse-code-acp/sessions/`).
Loading reads the authoritative model through MSP `session/read` and restores
that effort selection; sessions without one use the current settings default.
Mode resets to `default` on load; Muse session logs and global settings are not
modified by the adapter preference store.

Muse 1.1.1 initializes its execution provider from settings even when MSP
selects a different session model. SDK turns therefore put the selected model
and effort into the same private settings overlay used for MCP, in addition to
the MSP selection. The overlay is removed at turn end; user settings stay intact.

Form elicitation supports single selections, bounded multiple selections, and
free text up to 500 characters. Invalid responses fail the turn and cancel the
input request. Cancelling a turn never waits for a still-open client dialog.

| Mode              | SDK | Exec | Notes                                           |
| ----------------- | --- | ---- | ----------------------------------------------- |
| `default`         | yes | yes  | SDK: ACP permission gating (`onRequest`)        |
| `readOnly`        | yes | yes  | `--disable-write --disable-shell` on serve/exec |
| `bypassApprovals` | no  | yes  | dangerous; not advertised on SDK                |
| `yolo`            | no  | yes  | requires `MUSE_CODE_ACP_ALLOW_YOLO=1`           |

## Test owners / CI profiles

| Profile / suite                     | Covers                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `npm run test:unit`                 | Deterministic fake-MSP/wire contracts; no Muse binary                    |
| `npm run test:muse-loopback`        | Real Muse + loopback: live, approval, ACP process restart                |
| `npm run test:pack-smoke`           | `npm pack` → clean install → stdio initialize/new/prompt/stream/end_turn |
| `RUN_INTEGRATION_TESTS=true`        | Optional external-provider acceptance (separate from CI)                 |
| `src/tests/session-history.test.ts` | Export replay completeness / schema reject                               |
| `src/tests/permissions.test.ts`     | MSP→ACP permission mapping + fake-host gate                              |
| `src/tests/muse-sdk-gap.test.ts`    | Recoverable and failed view/page fills                                   |
| `src/tests/acp-wire.test.ts`        | Spawned `dist/index.js` NDJSON wire                                      |

CI installs the public Linux Muse **1.1.1-R2514.1** artifact and verifies its
pinned SHA-256. Real-host tests run on Ubuntu 22.04: Muse 1.1.1's bundled
Bubblewrap fails to create its loopback namespace under Ubuntu 24.04's default
AppArmor policy (`Failed RTM_NEWADDR: Operation not permitted`). This is a host
sandbox limitation; ACP reports the failed tool result. CI keeps the sandbox
enabled and requires proof that an approved command actually writes its file.
The restart test verifies that provider input includes the prior
conversation and that the saved model/effort survive the ACP process restart.
Publishing resolves the release ref to an immutable commit, runs this same CI
workflow on that commit, and only publishes after all checks succeed. Manual
publishing follows the same checks.

Prompt images are advertised and sent as ordered MSP `image` parts with
`mediaType` and `base64Data`. PNG, JPEG, GIF, and WebP are accepted; malformed
base64 is rejected before a turn starts. Legacy exec stages private temporary
files and requires text or a resource link alongside images.

`session/close` is advertised on both backends. It revokes new prompt admission,
cancels active work, and waits for host and temporary-file cleanup. Closing does
not delete native Muse history. Binding a session and prompting it are serialized.

`session/resume` is advertised on both backends. It requires the original
workspace (symlink-equivalent paths are accepted and canonicalized), refreshes
MCP servers, and emits no history replay. Live mode/config are retained; after
close or restart, the SDK model and saved effort are restored and mode defaults
to `default`. Busy sessions and additional workspace directories are rejected.

SDK image-only prompts are supported and verified against Muse 1.1.1 with the
loopback provider. Legacy exec still requires accompanying text, a resource link or embedded text. New, load and resume all retain canonical workspace directories. Disposal
rejects further session admission and waits for pending bindings, turn cleanup
and command advertisement before returning.

## Runtime discovery and editor context

SDK session creation, load and retained-session resume query public `model/list`
without starting a model turn. ACP model choices use host IDs and labels; the
current configured/restored model is retained even when absent from the catalog.
The option description identifies the catalog source. An unavailable, malformed
or unsupported catalog falls back to the current model only and says so explicitly.
Legacy exec retains its compatibility menu. Changing a model preserves the saved
effort, and previously saved selections survive reload; explicit custom model
selections retain the existing host-validation behavior at submission.

Discovery uses a per-agent 30-second cache (including failures), with at most four
entries and four concurrent probes. Identity includes canonical workspace, binary
identity, environment, settings and auth content hashes. Compatible concurrent
queries share work. The probe deadline is five seconds plus bounded process
shutdown; agent disposal closes pending discovery hosts and prevents session
publication. Catalog changes appear on the next binding after expiry or config
change; existing live session menus remain their binding snapshot.

ACP embedded text resources are encoded as a single ordered text part:

```text
Embedded text resource: {"resource":{"uri":"file:///unsaved.ts","mimeType":"text/typescript","text":"unsaved buffer\n"}}
```

JSON preserves the text, URI, optional MIME type, annotations and opaque metadata
without ambiguous field boundaries. No URI is fetched and an on-disk file is not
required. The aggregate serialized embedded context limit is 64 KiB of UTF-8 per
prompt, including attribution and metadata. Empty text is valid attributed context;
binary/blob resources, missing text/URI and oversized context are rejected before
turn submission. ACP's SDK validates/normalizes the wire schema before conversion.
SDK input retains text/resource/image interleaving. Legacy exec preserves text and
resource order in its prompt string; images remain separate ordered `--image` flags.

## Observed host support (m8)

Evidence uses `@muse-code/sdk@0.1.1`, Muse Code 1.1.1-R2514.1 on macOS, isolated
dummy credentials and a local loopback endpoint; no paid provider was called.

| Surface              | Evidence and current adapter behavior                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initialize           | Observed server version 1.1.1, schema version 1, durable sessions, empty grantedCapabilities and experimentalApi false. These fields alone do not prove every declared method works.                                    |
| Model discovery      | `initialize` followed by `model/list {}` returned `bundledCatalog` with configured `fake-model`; provider discovery need not run and nullable catalog metadata is valid. ACP consumes the returned snapshot.            |
| Effort               | Public schema declares seven tiers; all seven raw SDK turns completed against the loopback host. Adapter forwards exactly those tiers and rejects unknown values. Per-model restrictions are not present in model/list. |
| Embedded context     | ACP resource-only prompt traversed the real SDK/host; captured provider input decoded to the exact unsaved text, URI and MIME attribution.                                                                              |
| Reasoning summaries  | Public item schema declares `reasoning.summary` and indexed summary deltas. Actual summary events are not yet verified or forwarded; private/encrypted reasoning is not accessed.                                       |
| Usage/context        | Public schema declares usage/context data. End-to-end ACP reporting is unverified and remains unadvertised until m9.                                                                                                    |
| Compaction, steering | Public schema declares session/compact and turn/steer. Accepted/terminal lifecycle and provider effects are not verified by m8; implementation remains in m9/m10.                                                       |
| Subagents, fork      | Public schema declares worker lifecycle/control and session/fork. Native ACP routing, permission isolation and branch continuity remain unverified, unadvertised m11/m12 work.                                          |

Schema presence is a discovery lead, not delivery evidence. Later milestones must
verify their required host behavior before claiming support. Existing explicit
exec fallback remains user-selected; an ambiguous SDK turn is never replayed
through another backend.

## Session-owned hosts and steering

The SDK backend reuses one host for compatible turns of the same ACP session.
An idle host expires after 60 seconds, and rotates after 32 successful turns to
release its accumulated in-memory fold. Close/dispose, cancellation, host failure
or an unsafe unfinished interaction closes it. Host ownership includes the native
writer lease: close the old ACP session (or allow idle expiry) before another
client takes over that native session. No host is pooled across ACP sessions.

Compatibility includes canonical workspace, binary identity, environment,
settings/auth content, model, effort, mode and MCP server configuration. Changes
replace the host before the next turn. Private settings overlays remain available
until their owning host closes, including while idle, then are deleted. Read-only
flags are fixed at process creation. SDK permission/elicitation handlers are scoped
to each turn; late replies cannot answer a later turn. Legacy exec keeps its
existing per-turn lifecycle.

Steering is an opt-in adapter extension. Clients initialize with
`clientCapabilities._meta["muse/steering"] = 1`; the SDK adapter responds with
`_meta["muse/steering"] = {"version":1,"method":"_muse/steer"}`. Unnegotiated
clients and legacy exec retain the existing single-prompt-at-a-time behavior.

After a turn is acknowledged, negotiated clients receive a `session_info_update`
whose `_meta["muse/activeTurnId"]` is the exact native turn ID; a null value clears
it on cleanup. Submit `_muse/steer` with `sessionId`, `expectedTurnId` and `prompt`
(the same supported text/resource/image content as normal prompts). The response
`{"status":"accepted","turnId":"…"}` reports admission, **not completion**.
The original `session/prompt` still owns turn completion. There is no idle-session
fallback to a new prompt, and a stale ID or startup-before-ack request is rejected.

Corrections are serialized per session with the captured turn handle and ID.
At most 16 corrections may wait behind an in-flight acknowledgement; excess
requests are rejected so the queue cannot retain unbounded prompt input.
Replacement, close or cancellation invalidates queued work. A failed correction
is not retried as a new command or prompt; an acknowledgement timeout after ten
seconds closes the host and reports an unknown outcome. Already streamed output
cannot be changed. A turn finishing with an acknowledgement still pending closes
its host before any reuse, so the old request cannot interrupt a subsequent turn.
The host consumes corrections at a subsequent execution/model
boundary, and a turn already returning its final answer may finish without a
further provider call even if steering was admitted.

Evidence on Muse 1.1.1-R2514.1: loopback provider input contained two ordered
corrections during a tool turn, then a second compatible turn retained that history
without another execution-host spawn. No paid provider calls were required.

## Remote MCP (m16)

SDK sessions accept validated HTTP MCP URLs and headers, merged into private
canonical Muse `mcpServers` settings. `/mcp` reports inventory and sanitized
last-observed startup failures locally; current connectivity remains unknown
because the public SDK has no MCP status method. The built-in command reserves
the `mcp` skill name. Legacy exec retains stdio only. See
[MCP configuration, diagnostics and evidence](mcp-passthrough.md).

## Goal observation (m18)

SDK sessions retain observed public goal state after prompts, restore it from
history, and expose local `/goal` inspection without a provider call. Opted-in
clients receive session-info metadata; baseline clients can use the command.
Goal controls are unadvertised because public MSP support is unavailable.
Host-owned turns, retention bounds and foreground prompt controls remain distinct;
see the [goal contract and acceptance evidence](goal-extension.md). Exec is unchanged.
