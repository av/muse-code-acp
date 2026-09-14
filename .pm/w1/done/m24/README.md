# w1 · m24 — Portable packaging and reference distribution assessment

**Worker:** worker1 **Goal:** Choose a supportable packaging approach based on platform, licensing and runtime availability. Implement standalone adapter packaging for verified supported targets. Make supported installation paths reviewable and document remaining distribution-policy choices. **Status:** done

## Tasks (in order)

| id   | title                                                                  | est | depends_on               |
| ---- | ---------------------------------------------------------------------- | --- | ------------------------ |
| t001 | Assess standalone and Muse runtime distribution constraints — **DONE** | 45m | w1/m8/t007               |
| t002 | Build reproducible standalone adapter artifacts — **DONE**             | 45m | w1/m24/t001              |
| t003 | Validate clean installation and document release options — **DONE**    | 45m | w1/m24/t002              |
| t004 | Simplify milestone changes — **DONE**                                  | 30m | w1/m24/t003              |
| t005 | CI and behavior coverage — **DONE**                                    | 45m | w1/m24/t003, w1/m24/t004 |
| t006 | Close out the milestone — **DONE**                                     | 15m | w1/m24/t005              |

Estimated total: 3h 45m across 6 tasks. Only listed dependencies are prerequisites; milestone numbering does not impose a dependency on all earlier work.

## Definition of done

- The plan identifies supported targets, runtime requirements and reproducible sources without implying Meta affiliation.
- Unavailable redistribution rights or platform support is recorded as a blocker; no runtime is silently bundled.
- Supported standalone artifacts start without a separately installed Node runtime and report missing/incompatible Muse actionably.
- Existing npm entrypoint and explicit executable override remain functional; untested targets are not advertised.
- Documented supported install paths pass real package smoke and applicable host acceptance.
- Preview/registry parity has an explicit evidence-backed proposal or non-target rationale; no publication or release-policy change is inferred from this PM handoff.
- Required host delivery has acceptance evidence; unsupported required functionality stays open with a concrete upstream blocker.
- Explicit assessment/proposal work may finish with a documented non-target or infeasibility decision, but does not count as delivered parity.
- Adoption docs, /simplify and required affected CI checks are complete before closeout.

## Source + Goal linkage

- **Source:** User handoff of [ADR003 parity work](../../../../docs/ADR003-codex-acp-parity.md) on 2026-09-12. The earlier m9–m19 handoffs retain their existing scope. See [handoff coverage](../../../w2/011.md).
- **Goal linkage:** Close the named remaining editor/runtime integration gaps while preserving truthful, reliable Muse ACP behavior.
- **Expected outcome:** Choose a supportable packaging approach based on platform, licensing and runtime availability. Implement standalone adapter packaging for verified supported targets. Make supported installation paths reviewable and document remaining distribution-policy choices.
- **Why now:** npm installation works, but reference standalone binaries and bundled compatible runtime reduce setup friction; feasibility and release policy need explicit treatment.
- **Sizing:** 3 substantive implementation/investigation tasks exceed one hour without counting closing tasks.
- **Cross-surface parity:** Omitted: this is adapter/API, tests and documentation work with no owned editor UI. Protocol and backend differences are tested explicitly.
- **Adoption surface:** Covered by the last implementation task and CI acceptance: update README, applicable SDK/MCP support docs and ADR003; no duplicate closing task is needed.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; public SDK/MSP with feature detection, exact SDK/minimum-host evidence, real host-offered permission gating, sandbox defaults and no TUI automation or ambiguous-turn replay. Do not modify archived milestones or infer publication authorization.

## Validation evidence

Implemented and verified on 2026-09-12:

- Native darwin-arm64 Node 26.8.2 SEA with Bun 1.3.3 JavaScript bundling, pinned SDK 0.1.1, explicit license notices, build provenance and SHA-256 manifest. Muse stays external; other native targets and bundled Muse distribution are not claimed. See `docs/standalone.md` for assessment and release-policy follow-up.
- `npm run check`, `npm run build`, `npm run test:unit`: passed (278 tests, 46 files). Required `MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback`: passed (20 tests, six files). `npm run test:pack-smoke`: passed clean npm install and ACP initialize/new/prompt/stream/close.
- `npm run build:standalone` with the checksum-verified official Node 26.8.2 binary and `npm run test:standalone -- <artifact>` passed on macOS 26.5.1 ARM64. Real external Muse 1.1.1-R2514.1 from the checksum-pinned public download completed a local loopback prompt; Node/Bun were absent from child PATH. Verified checksums, executable paths with spaces, CLI delegation, missing/incompatible Muse, ignored dotenv and fixed Node runtime flags. No paid provider requests.
- One run using a fresh copy of the locally installed Muse timed out during CLI delegation; the pinned downloadable host used by CI passed the complete final smoke. This does not establish acceptance for every separately installed host build.
- Added native macOS 15 CI acceptance job; remote execution is tracked separately from the observed local pass. No publishing or release-policy change.
- Simplify reuse/quality/efficiency reviews completed. Shared bounded ACP artifact smoke now covers npm and standalone with explicit session close and process cleanup; notification accumulation is bounded.
- All six tasks verified and archived in dependency order; assessment non-targets are documented rather than represented as delivered cross-platform parity.
