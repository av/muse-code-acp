# w1 · m8 — Embedded editor context and runtime model discovery

**Worker:** worker1 **Goal:** Forward editor-provided context faithfully and offer model settings verified against the Muse host. **Status:** done

## Tasks (in order)

| id   | title                                                                     | est | depends_on             |
| ---- | ------------------------------------------------------------------------- | --- | ---------------------- |
| t001 | Verify public host support and correct capability claims — **DONE**       | 45m | w1/m7/t007             |
| t002 | Discover models and supported reasoning settings — **DONE**               | 45m | w1/m8/t001             |
| t003 | Forward embedded text resources as attributed context — **DONE**          | 45m | w1/m8/t002             |
| t004 | Verify context and discovery through ACP and document fallback — **DONE** | 45m | w1/m8/t003             |
| t005 | Simplify milestone changes — **DONE**                                     | 30m | w1/m8/t004             |
| t006 | CI and behavior coverage — **DONE**                                       | 45m | w1/m8/t004, w1/m8/t005 |
| t007 | Close out the milestone — **DONE**                                        | 15m | w1/m8/t006             |

Estimated total: 4h 30m across 7 tasks. Priority: P1 context; P2 model discovery. Scheduled after w1/m7/t007; cross-milestone dependencies refer to logical task IDs even after archival.

## Definition of done

- Each claimed supported surface has a host version and observed request/event evidence; unverified surfaces are explicitly identified.
- Unsupported/older hosts produce a bounded, documented fallback without silently changing backend.
- A fake host changing its model list changes advertised choices without a source edit.
- Unsupported discovery retains the configured default and explicit fallback; unsupported effort selections are rejected rather than falsely advertised.
- Reload and model-change behavior remain compatible with saved preferences.
- Mixed text, embedded text, image and resource-link prompts preserve order in SDK input and supported exec input.
- Unsaved text reaches the model verbatim; malformed or unsupported binary content fails before host execution.
- Capability advertisement and tests match actual accepted content.
- Wire tests cover content acceptance/rejection and discovery fallback; real-host evidence confirms embedded text reaches provider input.
- Documentation no longer categorically denies APIs or summaries that the supported host exposes.
- /simplify and all required affected CI profiles pass, with validation evidence recorded before closeout.
- Required host support that cannot be verified leaves its delivery task open with the blocker documented; a schema declaration or an unsupported fallback alone does not satisfy delivery.
- SDK and legacy exec advertise only the behavior each implements; client-specific extensions require explicit negotiation and retain a documented baseline fallback.

## Source + Goal linkage

- **Source:** User request on 2026-09-12 to hand off all recommendations from the read-only muse-code-acp versus `.tmp/codex-acp` comparison to w1. Reference implementation paths: `src/prompt-content.ts`, `src/config-options.ts`, `src/muse-host.ts`, `.tmp/codex-acp/src/CodexAcpClient.ts`. The local reference checkout may be temporary; the objectives and acceptance criteria here preserve the handoff.
- **Goal linkage:** Forward editor-provided context faithfully and offer model settings verified against the Muse host. This advances the project's goal of a reliable, faithful ACP adapter for Muse Code.
- **Expected outcome:** Establish a reproducible support matrix for the installed SDK and minimum host, separating declared schema from observed host/provider support. Replace the static SDK model menu with validated runtime discovery while retaining a documented compatibility fallback. Support editor selections, unsaved buffers and retrieved text sent as ACP embedded resources. Prove the two features at the wire and supported host boundaries and publish a consistent support matrix.
- **Why now:** Build on m7 content/workspace fixes and replace stale SDK-era assumptions before expanding capabilities.
- **Sizing:** Multiple implementation and verification tasks exceed one hour; this is a shippable milestone rather than an inbox note.
- **Cross-surface parity:** Omitted because changes stay in this adapter's protocol/backend, tests and docs; there is no owned editor UI change. Protocol translation, client capability negotiation and SDK/exec differences remain explicit acceptance criteria.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`: public SDK/MSP APIs and feature detection, exact SDK/minimum-host compatibility, real host-provided permission gating, sandbox defaults, no TUI automation and no silent ambiguous-turn replay. Adapt reference patterns without copying vendor-specific internals.

## Validation evidence

Implemented 2026-09-12. Public model/list accepted by Muse 1.1.1-R2514.1; returned bundledCatalog with configured fake-model and nullable metadata. Exact source and verification limits are in docs/sdk-migration.md. All seven public effort tiers completed through raw SDK turns; per-model restrictions are not supplied by the catalog.

- Model discovery tests cover coalescing, bounded TTL/LRU, settings/auth/environment/binary invalidation, malformed/unsupported/empty catalogs, timeout child cleanup and disposal.
- Spawned ACP config tests cover changing catalogs, retained custom model and effort, unsupported selection rejection, explicit fallback and SDK turn parameters. New-session disposal regression prevents publication after pending discovery.
- Embedded text tests cover lossless metadata, Unicode/newlines/field-looking content, exact aggregate UTF-8 size boundaries, binary/malformed rejection before turn/start and SDK/exec content ordering. Exec retains separate image flags.
- Focused real-host suite: 5 tests passed, including exact unsaved embedded text decoded from captured provider input and all seven effort tiers. Dummy loopback credentials only; paid providers not tested.
- Simplify: reuse, quality and efficiency passes completed. Centralized effort vocabulary/type validation and removed duplicate backend branches; no further efficiency changes needed.
- Initial full contracts exposed exec-only fixtures hanging during new discovery and shared executable chmod invalidating cache assertions. Fixtures now explicitly reject unsupported serve; cache tests own private binaries and still verify replacement invalidation. Final CI passed.

Final validation:

- `npm ci`: clean dependency install, zero audit vulnerabilities.
- `npm run check` and `npm run build`: lint, formatting and TypeScript build passed.
- `npm run test:unit`: 217 tests across 35 files passed.
- `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback`: 13 tests across all three required real-host suites passed (44.88 seconds); no required test skipped.
- `npm run test:pack-smoke`: packed initialize/new/prompt/stream/end_turn passed.
- `git diff --check`: passed. Local Muse 1.1.1-R2514.1 on macOS; remote Linux CI and paid-provider acceptance not claimed by these local results.
