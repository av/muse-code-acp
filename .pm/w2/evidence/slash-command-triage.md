# Slash-command triage evidence — 2026-09-13

Adapter 0.4.1, commit `e4e137d`; SDK 0.1.1. Diagnostic probe used
`createWireFixture` from `src/tests/acp-wire-helpers.ts`, built `dist/index.js`,
real ACP NDJSON, fake MSP `complete`, and a fresh session for each case.
A temporary Git repository with one commit supplied valid HEAD review targets.
No external model calls or real Muse host were used: this measures adapter dispatch,
not native skill or goal-control execution. Real Bex block ordering remains unverified.

Commands: `npm run build`, then `npx vitest run` with a temporary 40-case wire
probe plus `goal-wire.test.ts`, `workflows-wire.test.ts`, `review-prompt.test.ts`
and `skills.test.ts`. Result: 5 files / 13 tests passed (one probe test loops over
40 inputs). Existing tests stayed unchanged. The temporary probe was removed.

Reproduce using the wire fixture: create a session with no MCP servers, send the
layout below to `session/prompt`, record response/error, count captured
`turn/start` requests and mode updates, then close the session. Resource context
is `{type:"resource",resource:{uri:"file:///context.txt",mimeType:"text/plain",
text:"editor-context-marker"}}`. Text context is a text block with that marker.
`single` is one command text block; other layouts prepend/append context as named.
Every accepted multi-block ordinary turn retained the marker in its MSP input.

| Command                            | Layout         | Result   | Model turns | Mode update |
| ---------------------------------- | -------------- | -------- | ----------- | ----------- |
| `/goal`                            | single         | end_turn | 0           | none        |
| `/goal`                            | context-after  | -32602   | 0           | none        |
| `/goal`                            | context-before | end_turn | 1           | none        |
| `/goal`                            | text-before    | end_turn | 1           | none        |
| `/mcp`                             | single         | end_turn | 0           | none        |
| `/mcp`                             | context-after  | -32602   | 0           | none        |
| `/mcp`                             | context-before | end_turn | 1           | none        |
| `/mcp`                             | text-before    | end_turn | 1           | none        |
| `/plan work`                       | single         | end_turn | 1           | plan        |
| `/plan work`                       | context-after  | -32602   | 0           | none        |
| `/plan work`                       | context-before | end_turn | 1           | none        |
| `/plan work`                       | text-before    | end_turn | 1           | none        |
| `/review`                          | single         | end_turn | 1           | none        |
| `/review`                          | context-after  | -32602   | 0           | none        |
| `/review`                          | context-before | end_turn | 1           | none        |
| `/review`                          | text-before    | end_turn | 1           | none        |
| `/review-branch HEAD`              | single         | end_turn | 1           | none        |
| `/review-branch HEAD`              | context-after  | -32602   | 0           | none        |
| `/review-branch HEAD`              | context-before | end_turn | 1           | none        |
| `/review-branch HEAD`              | text-before    | end_turn | 1           | none        |
| `/review-commit HEAD`              | single         | end_turn | 1           | none        |
| `/review-commit HEAD`              | context-after  | -32602   | 0           | none        |
| `/review-commit HEAD`              | context-before | end_turn | 1           | none        |
| `/review-commit HEAD`              | text-before    | end_turn | 1           | none        |
| `/skill-example work`              | single         | end_turn | 1           | none        |
| `/skill-example work`              | context-after  | end_turn | 1           | none        |
| `/skill-example work`              | context-before | end_turn | 1           | none        |
| `/skill-example work`              | text-before    | end_turn | 1           | none        |
| `/compact`                         | single         | end_turn | 1           | none        |
| `/compact`                         | context-after  | end_turn | 1           | none        |
| `/compact`                         | context-before | end_turn | 1           | none        |
| `/compact`                         | text-before    | end_turn | 1           | none        |
| `/goal <exact reported objective>` | single         | -32602   | 0           | none        |
| `/goal status`                     | single         | end_turn | 0           | none        |
| `/goal clear`                      | single         | -32602   | 0           | none        |
| `/mcp status`                      | single         | end_turn | 0           | none        |
| `/mcp reconnect`                   | single         | -32602   | 0           | none        |
| `/review extra`                    | single         | -32602   | 0           | none        |
| `/review-branch`                   | single         | -32602   | 0           | none        |
| `/review-commit`                   | single         | -32602   | 0           | none        |

## Interpretation

`-32602` for unsupported arguments is deliberate validation; the error wording
and actionable alternative are inadequate for goal/MCP. Appended context makes
all six otherwise valid built-ins fail. Prepended context evades command selection
for all six and enters the ordinary prompt path. `/skill-example` is only a
representative non-reserved skill string, not proof of an installed skill. The
same applies to `/compact`: successful turn completion does not prove compaction.

Source coverage: command advertisement/reserved names in `src/acp-agent.ts`
`advertiseCommands`; local dispatch in `prompt`; workflow parse/argument checks
in `src/review-prompt.ts`; skill advertisement in `src/skills.ts`. Existing
workflow MCP rejection is intentional and separate from the block-order issue.
