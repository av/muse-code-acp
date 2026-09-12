# w1 · m16 — Remote MCP transport and connection diagnostics

**Worker:** worker1 **Goal:** Connect client-provided remote MCP servers through supported Muse transports and explain connection failures. **Status:** done

## Tasks (in order)

| id   | title                                                             | est | depends_on               |
| ---- | ----------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify remote MCP transport and status APIs — **DONE**            | 45m | w1/m10/t008              |
| t002 | Map remote servers into isolated session configuration — **DONE** | 45m | w1/m16/t001              |
| t003 | Expose MCP diagnostics and validate failures — **DONE**           | 45m | w1/m16/t002              |
| t004 | Simplify milestone changes — **DONE**                             | 30m | w1/m16/t003              |
| t005 | CI and behavior coverage — **DONE**                               | 45m | w1/m16/t003, w1/m16/t004 |
| t006 | Close out the milestone — **DONE**                                | 15m | w1/m16/t005              |

Estimated total: 3h 45m across 6 tasks. Prerequisite: w1/m10/t008; logical dependency IDs remain valid after archival. Numbering records the queue, not an additional dependency on every earlier milestone.

## Definition of done

- The supported request/config shape has real-host evidence; unknown or unavailable transport remains unadvertised.
- Status distinguishes configured servers from successful connections and observed failures.
- A local HTTP MCP tool is discoverable and callable through ACP on the supported host.
- Stdio remains functional; concurrent sessions cannot leak headers or override another session's servers.
- Malformed/unsupported transport is rejected before execution and secrets are omitted from diagnostics.
- /mcp reports supported transport and observed connection state without a model turn or secret values.
- Failure tests distinguish configuration errors from connection errors and keep unsupported status unknown.
- A required remote transport lacking host support remains open with evidence rather than being declared delivered.
- /simplify and required affected CI profiles pass with recorded evidence before closeout.
- SDK and exec capability claims match implemented behavior. Negotiated extensions retain a documented baseline-client fallback.
- Required delivery blocked by missing host support stays open with evidence. Explicitly conditional controls may remain unadvertised when unavailable; document the supported subset and upstream dependency rather than inventing an API.

## Source + Goal linkage

- **Source:** User handoff on 2026-09-12 of all findings from the second read-only comparison with `.tmp/codex-acp`, including the additional authentication-state finding. Existing m8–m13 retain the first comparison's scope. Reference paths: `src/mcp-overlay.ts`, `src/skills.ts`, `.tmp/codex-acp/src/CodexAcpClient.ts`, `.tmp/codex-acp/src/CodexCommands.ts`. This milestone preserves the requirements even if the temporary reference checkout disappears.
- **Goal linkage:** Connect client-provided remote MCP servers through supported Muse transports and explain connection failures. Advance faithful, reliable Muse behavior in ACP clients.
- **Expected outcome:** Determine supported Muse HTTP configuration, header handling and connection-status observation. Support verified HTTP MCP servers alongside existing stdio servers without changing user settings. Provide /mcp status and useful failure reasons based on observed connection information.
- **Why now:** The current overlay rejects non-command servers; broaden integrations after m10 makes host/config replacement explicit.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; a milestone is appropriate.
- **Cross-surface parity:** Omitted because this changes one adapter's protocol/backend, tests and documentation, with no owned editor UI. Protocol translation, SDK/exec differences and client negotiation are covered explicitly.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; use public SDK/MSP interfaces with feature detection and verified minimum host versions, preserve exact SDK pins and real approval gating, keep sandbox defaults, and never replay ambiguous turns automatically. Do not automate the TUI or copy vendor-specific internals.

## Validation evidence

Implementation verified on macOS with Muse Code 1.1.1-R2514.1 and SDK 0.1.1 using local MCP/provider fixtures and dummy credentials. Selected as the first independent milestone under the repository loop-worker rules: m9/m11 remain blocked and m12/m13/m14/m15/m17/m19 depend on those unresolved chains. m16 depends on completed m10 and does not require m9 command implementation.

- Public CLI help identifies Streamable HTTP entries under mcpServers. Real host probes verified canonical `type: http`, URL and headers, plus canonical `type: stdio`. The ACP test invokes the discovered HTTP tool and checks returned content in provider input.
- SDK overlays normalize legacy/canonical settings with canonical then session precedence; exec retains its legacy stdio overlay. HTTP URL/header validation happens before session mutation. Unit and live tests cover source immutability, header isolation between resident sessions and header changes replacing the old host/overlay.
- Local `/mcp` and `/mcp status` reserve the built-in name and report sanitized inventory, configuration failures and recognized last-observed host MCP startup failures. Current connectivity remains unknown because no public MCP status API exists. Authentication rejection, invalid JSON responses and unreachable endpoints produce distinct observed host errors; no prompt is replayed. Close waits for local command delivery.
- Simplify reuse, quality and efficiency reviews completed. Reused museSettingsPath and alias normalization, normalized loopback tool selection, enclosed HTTP fixture setup in cleanup scope and fixed local-command lifecycle accounting.
- Required combined testing exposed an existing steering-fixture race: a reminder request could consume its scripted bash call. The loopback fixture now requires the scripted tool to be present in the request's offered tools, with a regression test. This corrects fixture routing rather than weakening steering assertions.

`npm run check`, `npm run build`, `npm run test:unit` (255 tests, including the loopback routing regression), `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback` (18 tests, zero skips) and `npm run test:pack-smoke` all passed on 2026-09-12. No paid provider or third-party OAuth acceptance is claimed.
