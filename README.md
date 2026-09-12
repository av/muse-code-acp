# muse-code-acp

An [ACP](https://agentclientprotocol.com)-compatible coding agent powered by
[Muse Code](https://dev.meta.ai/docs/muse-code/), Meta's terminal coding agent.
Use Muse Code from any ACP client: Zed, VS Code (via
[`vscode-acp`](https://github.com/formulahendry/vscode-acp)), and others.

> **Unofficial adapter.** Muse Code and Muse Spark are products of Meta
> Platforms, Inc. This project is a community adapter and is not affiliated
> with, endorsed by, or supported by Meta.

## Quickstart

1. Install [Muse Code](https://dev.meta.ai/docs/muse-code/) (`muse`, >= 0.2.1)
   and make sure it is on `PATH` (or set `MUSE_CODE_EXECUTABLE`).
2. Authenticate: `muse login` (browser), or export `META_API_KEY`.
3. Install the adapter: `npm install -g @bex-co/muse-code-acp`.
4. Point your editor at it.

### Zed

```json
{
  "agent_servers": {
    "Muse Code": {
      "command": "muse-code-acp"
    }
  }
}
```

(Check Zed's [external agents docs](https://zed.dev/docs/ai/external-agents)
for the current settings shape.)

## How it works

The default backend uses `muse exec --json` — one process per prompt turn streaming JSONL events, with
conversation continuity through `--session-id` and muse's replay-exact session
log. This adapter translates that stream into ACP session updates:

| Muse                          | ACP                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `run.output.delta`            | `agent_message_chunk`                                                        |
| tool `side_effect_intent`     | `tool_call` (pending, policy verdict in `_meta`)                             |
| `tool.result`                 | `tool_call_update` (`rawInput` command, normalized output, diffs, locations) |
| `run.terminal.*` + exit code  | stop reason / error                                                          |
| session store + `muse export` | `session/list` + `session/load` history replay                               |
| `muse skills list`            | ACP slash commands (prompt passthrough)                                      |

### Try the Muse Code SDK backend

An initial migration path uses the official
[`@muse-code/sdk`](https://github.com/meta-models/muse-code-sdk) (pinned to 0.1.1).
With a Muse binary that supports `serve` (verified with ≥ 1.1.1) and a configured provider:

```sh
MUSE_CODE_ACP_BACKEND=sdk muse-code-acp
```

See [`docs/sdk-migration.md`](docs/sdk-migration.md) for the compatibility matrix,
ACP support surface, resource-link encoding, and test owners.

Set the same environment variable on your editor's agent process to use it there.
This backend starts one durable `muse serve` host per prompt, starts or resumes
the session over MSP, translates message and tool items into ACP updates, and
cancels using `turn/cancel`. Authentication, skills, session listing/history
export, and the per-turn MCP settings overlay use the existing implementation.
New SDK sessions use UUIDv7 IDs, as required by MSP.

The SDK backend is opt-in while feature parity is completed. It offers `default`
and `readOnly` modes; `serve` does not accept the CLI's approval-bypass flags.
SDK sessions set approval mode `onRequest` and route Muse approvals through ACP
`session/request_permission`, supported user input through form elicitation, and
recoverable `view/gap` fills through the SDK fold (failed fills error the turn).
Use a configured provider; Muse's echo provider is supported by the `exec`
backend only. This first migration retains per-turn startup latency.
The SDK is a developer preview; its API may change before 1.0.

The SDK tests include the real local Muse host with a loopback provider and dummy
credentials, covering streaming, multiple turns, history reload, cancellation,
and allow/deny/cancel tool effects without external API calls. Run them with:

```sh
npx vitest run src/tests/muse-sdk.test.ts src/tests/muse-sdk-live.test.ts \
  src/tests/muse-sdk-approval-live.test.ts
```

## Capabilities

| Surface                                                      | Status                                             |
| ------------------------------------------------------------ | -------------------------------------------------- |
| Prompt turns with streamed text                              | ✅                                                 |
| Tool calls with results, diffs, locations                    | ✅ (title upgraded at result time)                 |
| Cancellation (`session/cancel` → SIGINT, safe resume)        | ✅                                                 |
| Multi-turn sessions, `session/list`, `session/load`          | ✅                                                 |
| Session modes: default / read-only / bypass-approvals / yolo | ✅ (see below)                                     |
| Model + reasoning-effort config options                      | ✅                                                 |
| Skills as slash commands                                     | ✅                                                 |
| Auth: browser login, `META_API_KEY`, logout                  | ✅                                                 |
| Interactive per-tool-call permission prompts                 | ✅ (SDK backend; exec remains non-interactive)     |
| Thinking/reasoning stream                                    | ❌ (muse encrypts reasoning)                       |
| Client-provided stdio MCP servers                            | ✅ (see `docs/mcp-passthrough.md`)                 |
| Additional workspace directories                             | ❌ (muse supports one workspace root)              |
| Delegated workers                                            | ❌ (advertised in namespaced ACP metadata)         |
| Token usage                                                  | ❌ (not forwarded by the adapter)                  |
| Editor-side file edits (fs proxying)                         | ❌ (muse edits in its own sandbox; diffs reported) |

### Default exec backend limitations (originally verified with muse 0.2.1)

- **No interactive approvals on the exec backend.** Muse's headless `exec` mode
  resolves tool approvals internally (policy engine + LLM judge). The adapter
  reports each decision (`_meta.musePolicyDecision` on tool calls) but cannot
  pause a tool call for your confirmation. Modes map onto muse's spawn-time
  safety flags instead:
  - `default` — approval policy + judge + OS sandbox, report-only
  - `readOnly` — `--disable-write --disable-shell`
  - `bypassApprovals` — `--disable-approval` (sandbox stays on)
  - `yolo` — muse's `--yolo`; hidden unless `MUSE_CODE_ACP_ALLOW_YOLO=1`,
    never available as root
    If muse nevertheless enters an approval wait, the adapter stops the child
    and fails the prompt clearly instead of leaving the ACP request blocked.
- **Mode/config changes apply from the next prompt** (flags are per-spawn).
- **Exit code 0 means the turn completed,** not that your tests pass.
- **Per-turn spawn latency**: each prompt starts a fresh `muse exec`.
- ACP-client-provided stdio MCP servers are merged with Muse's user-configured
  servers in a private per-turn settings overlay. The user's settings file is
  never modified, and the overlay is removed after the turn. HTTP, SSE, and
  ACP MCP transports are not advertised.
- **No additional workspace roots.** Muse's headless CLI exposes one workspace
  root, so the adapter does not advertise ACP `additionalDirectories`.

## Environment

| Variable                   | Effect                                              |
| -------------------------- | --------------------------------------------------- |
| `MUSE_CODE_EXECUTABLE`     | Path to the `muse` binary (else `PATH` lookup)      |
| `MUSE_CODE_ACP_BACKEND`    | `exec` (default) or the initial `sdk` backend       |
| `META_API_KEY`             | Headless auth (muse precedence: env > stored login) |
| `MUSE_AGENT_LOGS`          | Directory for adapter log files                     |
| `MUSE_CODE_ACP_ALLOW_YOLO` | `1` offers the yolo mode                            |

## Troubleshooting

- Adapter fails at startup with "Could not find the `muse` CLI" — install
  muse or set `MUSE_CODE_EXECUTABLE`.
- Auth errors mid-turn surface as ACP auth-required; run
  `muse-code-acp --cli login` in a terminal (it execs `muse login`).
- Set `MUSE_AGENT_LOGS=/tmp/muse-acp-logs` to capture spawn argv, skipped
  JSONL lines, and muse's stderr preamble.

## Development

```sh
npm run build         # tsc
npm run test:run      # vitest (offline; live echo-provider tests auto-skip without muse)
npm run check         # eslint + prettier
RUN_INTEGRATION_TESTS=true npm run test:integration   # one real-model turn
```

The work board lives in `.pm/` (workstream w1, milestones m1–m6).

## Roadmap

- Finish session continuity and cut over the SDK backend to default (m6).
- Map MSP worker and token-usage events into ACP.

## License

Apache-2.0. Portions derived from
[claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp)
(Zed Industries) — see `NOTICE`.
