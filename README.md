# muse-code-acp

Use [Muse Code](https://dev.meta.ai/docs/muse-code/) through an
[Agent Client Protocol (ACP)](https://agentclientprotocol.com) client, such as
Zed or VS Code with an ACP extension. Available features depend on the client.

> **Unofficial adapter.** Muse Code and Muse Spark are products of Meta
> Platforms, Inc. This community project is not affiliated with, endorsed by,
> or supported by Meta.

## Requirements and compatibility

- **Node.js 22+** for the npm installation.
- **Muse Code 1.1.1-R2514.1**, installed separately, with `muse serve`.
  This is the verified host for adapter **0.4.x**; the latest Muse installer
  may install a different version. Select the verified binary with
  `MUSE_CODE_EXECUTABLE`.
- Muse authentication through browser login or `META_API_KEY`.

**Muse 1.2.1-R2847.1 is not supported by this release.** Release testing found
six failures across 23 real-host tests: legacy exec session continuation failed
because its saved `:auto-review` permission profile was unavailable in `serve`,
and unauthorized, malformed or unreachable HTTP MCP endpoints no longer failed
the prompt as required by the adapter's diagnostic contract. Pin the verified
host; disabling approvals or sandboxing is not a workaround.

The npm adapter and its pinned `@muse-code/sdk@0.1.1` dependency do not include
the Muse executable. Native execution, model access, persistence and sandboxing
remain owned by Muse.

## Quickstart

Install Node.js and the verified Muse host above, then replace the example path:

```sh
export MUSE_CODE_EXECUTABLE="/absolute/path/to/muse-1.1.1"
"$MUSE_CODE_EXECUTABLE" --version
"$MUSE_CODE_EXECUTABLE" serve --help
"$MUSE_CODE_EXECUTABLE" login
npm install -g @bex-co/muse-code-acp
muse-code-acp --version
```

For headless use, provide `META_API_KEY` to the adapter process instead of browser
login. The adapter speaks ACP over stdio; launch it through your editor rather
than expecting an interactive chat UI in the terminal.

### Zed

Add a [custom external agent](https://zed.dev/docs/ai/external-agents#custom-agents)
to Zed settings, replacing the Muse path:

```json
{
  "agent_servers": {
    "Muse Code": {
      "type": "custom",
      "command": "muse-code-acp",
      "args": [],
      "env": {
        "MUSE_CODE_EXECUTABLE": "/absolute/path/to/muse-1.1.1"
      }
    }
  }
}
```

Select Muse Code in the Agent Panel. If Zed cannot find `muse-code-acp`, use its
absolute executable path as `command`. Node must also be available to the editor.
Set the host path in the editor configuration even if you exported it in a shell;
GUI applications may not inherit that shell's environment.

Other ACP clients use the same command and environment. Browser login inside a
client requires terminal-auth support; otherwise authenticate beforehand.

## Capabilities

The default SDK backend supports the following on the verified host:

| Surface            | Behavior                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Prompt execution   | Streamed text, tool calls/results, cancellation and multi-turn continuity                                        |
| Prompt context     | PNG/JPEG/GIF/WebP images, resource links and embedded text; audio and binary resources unsupported               |
| Session navigation | Paginated list, full history load, resume without replay, close, and native fork                                 |
| Permissions        | Interactive host-offered choices through ACP; cancellation and stale replies fail closed                         |
| Modes              | Default, read-only and guarded plan mode; implementation requires an explicit mode change                        |
| Model settings     | Public model discovery with current-model fallback; seven supported effort tiers                                 |
| MCP                | Client-provided stdio and HTTP servers; local configuration/last-failure diagnostics, not live connection status |
| File changes       | Bounded observed diffs; optional negotiated reports explicitly mark partial coverage                             |
| Workflows          | Skills as slash commands, planning and Git reviews                                                               |
| Goals              | Native goal observation and local `/goal`; no goal controls                                                      |
| Mid-turn steering  | Available only when explicitly negotiated by the client                                                          |

Delegated workers and token usage are explicitly reported as unavailable.
Reasoning summaries, editor-side filesystem proxying, multiple authorized
workspace roots and native session deletion are not implemented. Closing a
session retains its native history. This adapter does not implement every ACP
feature or every feature of Muse's terminal UI.

## How it works

The official [Muse SDK](https://github.com/meta-models/muse-code-sdk) communicates
with `muse serve` over MSP. The adapter starts or resumes native sessions,
translates message/tool items into ACP updates, routes permission requests to the
client, and cancels using `turn/cancel`.

Each SDK session can retain its host across compatible turns. Idle hosts expire
after 60 seconds; session close also releases them. Close a session before moving
its native conversation to another client.

Session listing uses public `session/list` with bounded pagination. Full history
replay still uses validated `muse export`; read-only store helpers remain for
compatibility lookups and title fallback. Auth and skills use CLI helpers.
Session indexes are eventually consistent, so a new session may not appear
immediately in a refreshed list.

### Legacy exec backend (rollback)

```sh
MUSE_CODE_ACP_BACKEND=exec muse-code-acp
```

The legacy backend runs `muse exec --json` per turn. It supports the echo provider,
uses store-based session listing and accepts stdio MCP servers only. Approvals
resolve inside Muse rather than through interactive ACP permissions. Default and
read-only modes are available; bypass-approvals is exec-only, and advertising
yolo requires `MUSE_CODE_ACP_ALLOW_YOLO=1`.

SDK failures never silently switch to exec. The legacy backend was introduced
for Muse 0.2.1; this release's integration baseline remains 1.1.1-R2514.1.

## Environment

| Variable                   | Meaning                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `MUSE_CODE_EXECUTABLE`     | Path to the external Muse binary; takes precedence over PATH discovery |
| `MUSE_CODE_ACP_BACKEND`    | `sdk` (default) or `exec`; unknown values fail at startup              |
| `META_API_KEY`             | Provider credential; takes priority over stored auth                   |
| `MUSE_CODE_ACP_ALLOW_YOLO` | Set to `1` to advertise yolo mode on exec only                         |
| `MUSE_AGENT_LOGS`          | Directory for adapter spawn/stderr logs                                |

`muse-code-acp --cli login` and `muse-code-acp --cli logout` delegate to the
selected Muse executable. Logout does not unset an exported `META_API_KEY`.

## Detailed documentation

- [SDK support, model discovery, editor context and steering](https://github.com/bex-co/muse-code-acp/blob/main/docs/sdk-migration.md)
- [Session discovery and metadata](https://github.com/bex-co/muse-code-acp/blob/main/docs/session-discovery.md)
- [Native session branching](https://github.com/bex-co/muse-code-acp/blob/main/docs/session-fork.md)
- [File-change evidence and negotiated reports](https://github.com/bex-co/muse-code-acp/blob/main/docs/file-change-report.md)
- [MCP passthrough and diagnostics](https://github.com/bex-co/muse-code-acp/blob/main/docs/mcp-passthrough.md)
- [Planning and Git reviews](https://github.com/bex-co/muse-code-acp/blob/main/docs/workflows.md)
- [Goal observation](https://github.com/bex-co/muse-code-acp/blob/main/docs/goal-extension.md)
- [Standalone Apple Silicon macOS builds](https://github.com/bex-co/muse-code-acp/blob/main/docs/standalone.md): source build and CI verification only; prebuilt binaries are not published. These builds include Node and still require external Muse.

## Development and verification

From a repository checkout:

```sh
npm ci
npm run check                 # eslint + prettier
npm run build                 # TypeScript compilation
npm run test:unit             # deterministic contracts; no Muse host required
npm run test:pack-smoke       # clean tarball install and ACP execution
```

For real-host tests, put the verified Muse binary on PATH as `muse` and also set
`MUSE_CODE_EXECUTABLE` to it. Build first, then run:

```sh
MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback
```

These tests use a local loopback provider and are required in CI. The required
flag prevents a missing host from silently skipping acceptance. `npm run test:run`
builds and runs the full local Vitest suite; paid-provider tests are opt-in via
`npm run test:integration` and require credentials.

The work board lives in `.pm/`. Repository skills for
[release](https://github.com/bex-co/muse-code-acp/blob/main/.agents/skills/release/SKILL.md),
[PM](https://github.com/bex-co/muse-code-acp/blob/main/.agents/skills/pm/SKILL.md) and
[workstream execution](https://github.com/bex-co/muse-code-acp/blob/main/.agents/skills/loop-worker/SKILL.md)
live in `.agents/skills/`. npm publishing runs through GitHub Actions after CI
validates the exact release commit.

## License

Apache-2.0. Portions derived from
[claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp)
(Zed Industries) — see [NOTICE](https://github.com/bex-co/muse-code-acp/blob/main/NOTICE).
