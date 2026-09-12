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

| Capability                                | Advertised?                                    | Contract owner                                               |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Protocol major 1                          | yes (always returned as our supported version) | `src/acp-agent.ts` initialize + `src/tests/acp-wire.test.ts` |
| Prompt: text + resource_link              | baseline (empty `promptCapabilities`)          | `src/prompt-content.ts`                                      |
| Prompt: image / audio / embedded resource | **no**                                         | rejected with invalid params                                 |
| MCP stdio                                 | yes (baseline; http/sse not advertised)        | `docs/mcp-passthrough.md`                                    |
| `session/load`, `session/list`            | yes                                            | session store + export helpers                               |
| Auth logout                               | yes                                            | `src/auth.ts`                                                |
| Terminal auth method                      | only if `clientCapabilities.auth.terminal`     | `src/auth.ts`                                                |
| Interactive permissions (SDK backend)     | yes                                            | `src/muse-permissions.ts` + live approval suite              |
| Form elicitation (SDK user input)         | yes when client advertises `elicitation.form`  | `src/muse-user-input.ts`                                     |
| fs / terminal RPC                         | **no**                                         | omitted client caps never invoked                            |
| Session fork/delete/close                 | **no**                                         | unadvertised                                                 |

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

| Helper                        | Why retained                                                 |
| ----------------------------- | ------------------------------------------------------------ |
| Session store listing         | ACP `session/list` workspace filtering + titles/timestamps   |
| `muse export` history replay  | Complete chronological load when SDK history APIs are absent |
| `muse login` / logout helpers | Auth surfaces without an SDK credential API                  |
| `muse skills list`            | Slash-command advertisement                                  |
| MCP settings overlay          | Per-turn stdio MCP merge without mutating user settings      |

## Resource-link encoding

MSP `TurnInputPart` only declares `text` \| `image`. ACP `resource_link` blocks
are encoded as ordered text parts:

```
Resource: <name>
URI: <uri>
Title: <title>          # optional
Description: <description>  # optional
MIME: <mimeType>        # optional
```

No URI is fetched during conversion. The same text is used for the legacy
`muse exec` prompt string.

## Modes

| Mode              | SDK | Exec | Notes                                           |
| ----------------- | --- | ---- | ----------------------------------------------- |
| `default`         | yes | yes  | SDK: ACP permission gating (`onRequest`)        |
| `readOnly`        | yes | yes  | `--disable-write --disable-shell` on serve/exec |
| `bypassApprovals` | no  | yes  | dangerous; not advertised on SDK                |
| `yolo`            | no  | yes  | requires `MUSE_CODE_ACP_ALLOW_YOLO=1`           |

## Test owners / CI profiles

| Profile / suite                     | Covers                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| `npm run test:unit`                 | Deterministic fake-MSP/wire contracts; no Muse binary     |
| `npm run test:muse-loopback`        | Real Muse + loopback: live, approval, ACP process restart |
| `npm run test:pack-smoke`           | `npm pack` → clean install → stdio initialize             |
| `RUN_INTEGRATION_TESTS=true`        | Optional external-provider acceptance (separate from CI)  |
| `src/tests/session-history.test.ts` | Export replay completeness / schema reject                |
| `src/tests/permissions.test.ts`     | MSP→ACP permission mapping + fake-host gate               |
| `src/tests/muse-sdk-gap.test.ts`    | Recoverable and failed view/page fills                    |
| `src/tests/acp-wire.test.ts`        | Spawned `dist/index.js` NDJSON wire                       |
