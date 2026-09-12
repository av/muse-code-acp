# w1 · m21 — Provider configuration, recommendations and account limits

**Worker:** worker1 **Goal:** Define the public host support and provenance for gateway/provider selection, fast tiers, model effort restrictions and quota. Map verified ACP provider/gateway requests into isolated Muse session configuration. Offer fast/service-tier settings and per-model effort limits only where backed by verified host capability. Give opted-in clients concrete usable model/effort recommendations with documented provenance. Expose verified account rate-limit/quota snapshots separately from per-turn token usage. **Status:** todo

## Tasks (in order)

| id   | title                                                        | est | depends_on               |
| ---- | ------------------------------------------------------------ | --- | ------------------------ |
| t001 | Verify provider, tier and account metadata support           | 45m | w1/m8/t007               |
| t002 | Implement client-provided provider and gateway configuration | 45m | w1/m21/t001              |
| t003 | Expose supported service tiers and effort restrictions       | 45m | w1/m21/t002              |
| t004 | Publish negotiated recommended configuration values          | 45m | w1/m21/t003              |
| t005 | Report observed account quota and update adoption docs       | 45m | w1/m21/t004              |
| t006 | Simplify milestone changes                                   | 30m | w1/m21/t005              |
| t007 | CI and behavior coverage                                     | 45m | w1/m21/t005, w1/m21/t006 |
| t008 | Close out the milestone                                      | 15m | w1/m21/t007              |

Estimated total: 5h 15m across 8 tasks. Only listed dependencies are prerequisites; milestone numbering does not impose a dependency on all earlier work.

## Definition of done

- Evidence distinguishes a configured Muse provider from client-supplied ACP provider negotiation.
- Unsupported tier, effort metadata or account APIs have explicit blockers and remain unadvertised.
- Two sessions with different local gateways cannot share credentials or cached model catalogs.
- A loopback turn reaches the intended endpoint; failures cannot silently fall back to a different provider.
- Advertised tier/effort options match observed supported values and survive restore.
- If no Muse service-tier contract exists, fast-mode delivery stays open; labels alone never claim a faster tier.
- Negotiated responses refer to actual advertised choices; catalog changes and unavailable discovery have deterministic fallbacks.
- Baseline clients receive no mandatory extension and user-selected settings are not overwritten.
- Reported quota is sourced from an actual public host/account response and invalidated on account change.
- Absent public quota support leaves that delivery open and unknown; credentials and guessed limits never appear in output.
- Required host delivery has acceptance evidence; unsupported required functionality stays open with a concrete upstream blocker.
- Explicit assessment/proposal work may finish with a documented non-target or infeasibility decision, but does not count as delivered parity.
- Adoption docs, /simplify and required affected CI checks are complete before closeout.

## Source + Goal linkage

- **Source:** User handoff of [ADR003 parity work](../../../docs/ADR003-codex-acp-parity.md) on 2026-09-12. The earlier m9–m19 handoffs retain their existing scope. See [handoff coverage](../001.md).
- **Goal linkage:** Close the named remaining editor/runtime integration gaps while preserving truthful, reliable Muse ACP behavior.
- **Expected outcome:** Define the public host support and provenance for gateway/provider selection, fast tiers, model effort restrictions and quota. Map verified ACP provider/gateway requests into isolated Muse session configuration. Offer fast/service-tier settings and per-model effort limits only where backed by verified host capability. Give opted-in clients concrete usable model/effort recommendations with documented provenance. Expose verified account rate-limit/quota snapshots separately from per-turn token usage.
- **Why now:** Dynamic model selection does not cover ACP provider negotiation, service tiers, recommended choices or account quota; each needs independent evidence.
- **Sizing:** 5 substantive implementation/investigation tasks exceed one hour without counting closing tasks.
- **Cross-surface parity:** Omitted: this is adapter/API, tests and documentation work with no owned editor UI. Protocol and backend differences are tested explicitly.
- **Adoption surface:** Covered by the last implementation task and CI acceptance: update README, applicable SDK/MCP support docs and ADR003; no duplicate closing task is needed.
- **Constraints:** Follow `.pm/DO_NOT_DO.md`; public SDK/MSP with feature detection, exact SDK/minimum-host evidence, real host-offered permission gating, sandbox defaults and no TUI automation or ambiguous-turn replay. Do not modify archived milestones or infer publication authorization.

## Validation evidence

Pending implementation. ADR003 is a source-based comparison; new host surfaces still require verification. No feature or task is marked delivered by this handoff.
