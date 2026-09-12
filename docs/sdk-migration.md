# SDK migration — compatibility and ACP support matrix

This adapter keeps `muse exec --json` as the default backend and offers an
opt-in Muse Code SDK path (`MUSE_CODE_ACP_BACKEND=sdk`). The SDK remains opt-in
until a later cutover gate.

## Pins

| Component                  | Version              | Notes                                         |
| -------------------------- | -------------------- | --------------------------------------------- |
| `@muse-code/sdk`           | **0.1.1** (exact)    | Public MuseClient / Session / Connection APIs |
| `@agentclientprotocol/sdk` | **1.3.0** (exact)    | ACP protocol major `PROTOCOL_VERSION` (= 1)   |
| Muse host (`muse serve`)   | **≥ 1.1.1** verified | `muse serve --help` must succeed              |

Verified locally with Muse Code **1.1.1**. Older hosts without `serve`, or hosts
that exit with the experimental SDK tier disabled, fail **before** a model turn
with an actionable upgrade hint.

## ACP surface (advertised)

| Capability                                                | Advertised?                                    | Contract owner                                               |
| --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Protocol major 1                                          | yes (always returned as our supported version) | `src/acp-agent.ts` initialize + `src/tests/acp-wire.test.ts` |
| Prompt: text + resource_link                              | baseline (empty `promptCapabilities`)          | `src/prompt-content.ts`                                      |
| Prompt: image / audio / embedded resource                 | **no**                                         | rejected with invalid params                                 |
| MCP stdio                                                 | yes (baseline; http/sse not advertised)        | `docs/mcp-passthrough.md`                                    |
| `session/load`, `session/list`                            | yes                                            | existing session tests                                       |
| Auth logout                                               | yes                                            | `src/auth.ts`                                                |
| Terminal auth method                                      | only if `clientCapabilities.auth.terminal`     | `src/auth.ts`                                                |
| Interactive permissions / elicitation / fs / terminal RPC | **no**                                         | omitted client caps never invoked                            |
| Session fork/delete/close                                 | **no**                                         | unadvertised                                                 |

## Public SDK API map

| ACP / adapter behavior        | Public SDK / MSP API                                                  | Fallback                                                                    |
| ----------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Spawn MSP host                | `spawnMspConnection` + `MuseClient`                                   | —                                                                           |
| Handshake / durability        | `initialize` + `readSessionDurability`                                | fingerprint mismatch is advisory                                            |
| Start / resume session        | `MuseClient.startSession` / `resumeSession`                           | missing session (`-32020`) → start; in-use/busy/wrong workspace fail closed |
| Set model                     | `Connection.command("session/setModel")`                              | facade has no setModel                                                      |
| Submit turn                   | `Session.sendUserTurn`                                                | —                                                                           |
| Stream items / deltas         | `Turn.items()` / `Turn.deltas()` (+ fold catch-up for pre-ack deltas) | —                                                                           |
| Cancel                        | `Connection.command("turn/cancel")`                                   | close host if cancel fails                                                  |
| Approvals / user input / gaps | fail the turn clearly                                                 | interactive approvals land in m5                                            |

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

## Optional event policy

| MSP event family              | ACP mapping                      | Policy                                       |
| ----------------------------- | -------------------------------- | -------------------------------------------- |
| agentMessage (+ deltas)       | `agent_message_chunk`            | emit; deltas + final snapshot once each      |
| toolCall                      | `tool_call` / `tool_call_update` | stable `callId`, raw args, normalized output |
| reasoning / plan / tokenUsage | —                                | not advertised; not fabricated               |
| workers                       | `_meta` says unavailable         | not mapped                                   |

## Remaining CLI helpers

Authentication (`muse login` / logout), skills list, session store listing, and
`muse export` for history replay still use CLI helpers. They are not replaced
merely to eliminate subprocesses.

## Test owners

| Suite                                      | Covers                                       |
| ------------------------------------------ | -------------------------------------------- |
| `src/tests/muse-sdk.test.ts`               | SDK lifecycle over fake MSP (in-process ACP) |
| `src/tests/muse-sdk-live.test.ts`          | Real local Muse host + loopback provider     |
| `src/tests/acp-wire.test.ts`               | Spawned `dist/index.js` NDJSON wire          |
| `src/tests/muse-sdk-events.test.ts`        | Message/tool event semantics                 |
| `src/tests/prompt.test.ts` + wire          | Text / resource_link preservation            |
| `src/tests/muse-cli.test.ts` / host probes | Missing / unsupported host errors            |
