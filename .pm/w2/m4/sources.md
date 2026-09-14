# Preserved sources for w2/m4

Historical provenance only. The todo statuses below describe the superseded plan, not active tasks. Current work and IDs are in [m4](README.md).

## Original w2/010

# 010 — SDK backend rejects `bypassApprovals` before automated review can start

Why: Automated ACP clients selecting the adapter's existing bypass-approval mode cannot start a review on the default SDK backend.

## Confirmed reproduction

Reported and reproduced on 2026-09-14 with `@bex-co/muse-code-acp` 0.5.0. `MUSE_CODE_ACP_BACKEND` was unset, selecting the SDK backend.

1. Start the published adapter over ACP stdio.
2. Send `initialize`, then `session/new` with an existing, empty temporary directory as `cwd` and `mcpServers: []`.
3. Send `session/set_mode` with the returned session ID and `modeId: "bypassApprovals"`.
4. Observe rejection before any `session/prompt` is sent:

```text
Invalid params: unknown or unavailable session mode: bypassApprovals
```

A minimal client reproduction using an empty temporary workspace and a no-tools prompt hit this exact error before prompt execution. A running automated-review client used the same default backend and mode selection, repeatedly creating unsuccessful assignments with no accepted file coverage. Its retry/error-reporting behavior is a separate client-side defect.

## Adapter evidence and requested outcome

- `src/modes.ts` defines `bypassApprovals` for exec, but `availableModes()` excludes dangerous modes on SDK.
- `src/acp-agent.ts` rejects the selection in `setSessionMode`. This is an SDK/exec compatibility gap, not evidence that the adapter violates ACP mode negotiation or that every ACP implementation must expose this mode.
- Request SDK support for explicitly selected `bypassApprovals`, retaining sandbox protection and unchanged defaults, if the public Muse SDK/host can enforce those semantics.
- If host support is missing, preserve truthful capabilities and record the precise host limitation; improve the rejection to identify the backend and supported alternatives instead of only saying the mode is unknown or unavailable. Do not silently switch backends or equate bypassing approvals with disabling the sandbox.

## Existing work and triage acceptance

Coordinate with [w1/m25](sources.md), which already owns verified SDK approval policies and sandbox configuration. Its recorded host probes accepted `allowAll` metadata but still required approval for tested shell writes. This note adds a concrete client compatibility reproduction; it does not duplicate that implementation milestone or establish that host enforcement is fixed.

- [ ] Reproduce the mode rejection with a deterministic ACP test and link the result to w1/m25.
- [ ] Resolve the support request through w1/m25 with real-host evidence that an explicitly selected policy bypasses the intended approval gates while preserving the sandbox, or document the concrete upstream blocker.
- [ ] Cover backend-specific mode negotiation and actionable unsupported-mode errors; update the relevant README/SDK migration guidance to match delivered behavior.

Source: user request to file the diagnosed Muse ACP compatibility issue in w2. No scan targets, session transcripts, credentials, or private source are needed to reproduce it.

## Triage and fresh verification (2026-09-14)

The adapter's generic rejection is intentional capability gating, but its native
support assumption was too broad. [Fresh verification](../evidence/010-sdk-approval-verification.md)
proves allowAll bypasses the tested shell approvals on Muse 1.2.1-R2847.1, including
multi-stage commands and reconfiguration from onRequest. The same native promise
remains unverified on 1.1.1, where the probe still requests approval.

Automatic client decisions using public host-offered once choices completed the
two-stage write on both hosts. Both this approach and native 1.2.1 allowAll retained
the tested sandbox filesystem denial. Thus this is feasible implementation work;
waiting for an upstream change is not the only path.

Route implementation and durable regression coverage through existing w1/m25,
including native-versus-adapter policy semantics, mode negotiation, actionable
errors and documentation. No duplicate milestone is created and this note remains
open until those acceptance criteria are delivered. The current code still excludes
SDK bypassApprovals. Existing mode suites passed 14 tests during triage; they do
not constitute coverage of the proposed automatic mode. Client assignment retries
remain outside this adapter task.

## Original w1/m25 milestone

# w1 · m25 — Verified SDK approval policies and sandbox configuration

**Worker:** worker1 **Goal:** Expose independently verified approval policies and explicitly selected host sandbox posture without weakening defaults or pending-action safety. **Status:** todo

## Tasks (in order)

| id   | title                                                         | est | depends_on               |
| ---- | ------------------------------------------------------------- | --- | ------------------------ |
| t001 | Verify policy enforcement and define SDK safety options       | 45m | w1/m10/t008              |
| t002 | Wire requested and effective approval policy through sessions | 45m | w1/m25/t001              |
| t003 | Implement explicit host-lifetime sandbox configuration        | 45m | w1/m25/t002              |
| t004 | Verify mode transitions and compatibility end to end          | 45m | w1/m25/t003              |
| t005 | Document safety semantics and update ADR003                   | 30m | w1/m25/t004              |
| t006 | Simplify milestone changes                                    | 30m | w1/m25/t005              |
| t007 | CI and behavior coverage                                      | 45m | w1/m25/t005, w1/m25/t006 |
| t008 | Close out the milestone                                       | 15m | w1/m25/t007              |

Estimated total: 5h across eight tasks; implementation/investigation exceeds one hour without closing work. Depends on delivered host ownership m10, not blocked compaction or worker milestones.

## Definition of done

- Supported approval policies are selected over public MSP and actual tool enforcement is verified.
- Sandbox posture is explicitly configured at host creation and changes cause safe host replacement; approval mode and workspace trust are not conflated.
- Default behavior remains onRequest with sandbox protection; no stale permission can authorize another action.
- New/load/resume/reuse, cancellation, close, plan/readOnly and concurrent-session isolation have meaningful wire and real-host coverage.
- README, SDK compatibility and ADR003 match delivered options and limits; Simplify and all required affected CI pass.

## Source + Goal linkage

- **Source:** User requested research and PM handoff for remaining ADR003 gaps on 2026-09-12; research and reproduction recorded below.
- **Goal linkage:** Close the missing SDK safety-configuration contract through public Muse mechanisms while preserving reliable ACP integration.
- **Expected outcome:** Clients can explicitly choose supported approval and sandbox behavior and observe the effective configuration.
- **Why now:** Fresh host evidence proves all four approval policies can be selected; serve help exposes sandbox flags. Existing hard-coded defaults prevent this configuration, and m10 supplies safe host replacement.
- **Cross-surface parity:** Omitted because no owned editor UI changes; backend/protocol consistency remains in task acceptance.
- **Adoption surface:** Covered by t005 and CI; no duplicate closing task.
- **Constraints:** Follow .pm/DO_NOT_DO.md; retain safe defaults and host-offered decisions, pin SDK/minimum host, avoid TUI/private APIs and do not silently replay turns.

## Validation evidence

Research only: Muse 1.1.1-R2514.1 with SDK 0.1.1 accepted denyUnmatched, promptUnmatched, allowAll and onRequest and returned matching completed effectiveMode state in an isolated no-turn session. Zero provider requests. Actual tool enforcement and broader sandbox effects are not yet verified; they are t001/t004 delivery work.

## Enforcement blocker (2026-09-12)

The zero-turn selection result reproduced, but tool execution did not establish the advertised policy distinctions on Muse 1.1.1-R2514.1 with SDK 0.1.1. Isolated public MSP probes requested `printf allowed > policy-marker.txt` through the loopback model and an otherwise unconfigured shell policy:

| Selected policy | Effective state                                                      | Observed tool gate     | Result after explicit allow_once |
| --------------- | -------------------------------------------------------------------- | ---------------------- | -------------------------------- |
| onRequest       | matching startup state                                               | one approval/requested | marker written                   |
| promptUnmatched | matching startup state                                               | one approval/requested | marker written                   |
| denyUnmatched   | completed reconfiguration                                            | one approval/requested | marker written                   |
| allowAll        | completed reconfiguration and, independently, matching startup state | one approval/requested | marker written                   |

A separate allowAll run verified the marker was absent before the decision and remained absent after the host-provided abort choice. Therefore allowAll did not bypass this approval gate, and denyUnmatched did not automatically deny the tested unmatched shell action. This is an observed limitation of these fixtures, not a claim that every tool path ignores every policy. It does mean accepted effectiveMode metadata alone is insufficient to label new client choices with those enforcement promises.

Resume t001 with a documented public configuration/tool path that verifies the intended matched/unmatched distinctions and explain how it interacts with explicit SDK approval requests. Then implement only proven choices, and continue separate sandbox-posture enforcement/host-replacement checks in t003/t004. Do not synthesize approvals or add disable-sandbox/yolo defaults to force the tests through. All eight tasks remain open; no safety options were advertised or production policy changed. Local executable probes and public notifications are retained in `.tmp/m25-probe/`. No paid providers or external writes were used.

## User-impact follow-up — 2026-09-13

[w2/003](../done/003.md) is closed as expected Allow once behavior, not as
an automatic-execution fix. Real Bex Dev two-operation probes on local adapter
ed57631 / SDK 0.1.1 with Muse 1.1.1 and, separately, 1.2.1 verified that each
operation waited for its own approval and executed only after Bex returned it.
No broader choice was offered or discarded. This does not prove an automatic
policy failure: those integration runs used Default / onRequest.

The user's request for a selectable automatic-execution mode remains here. All
existing tasks and acceptance criteria remain open; t001 is next and w1/m10/t008
is complete. Keep the native policy enforcement investigation above separate
from correct manual approval behavior. No duplicate inbox implementation remains.

The separate ed57631 interface fix exposes existing modes through configOptions
and synchronizes legacy mode/config updates, including `/plan` and restored state.
It does not deliver native automatic approval. Fresh native comparisons found
`pwd` and ordinary `write_file` complete without approval in both onRequest and
allowAll, while the tested shell redirect still requests approval under allowAll
with an unresolved stage, protectedWrite=false and judgeEscalated=false. Rejection
prevents that write. The pinned Muse schema has no Codex-style reviewer selector.
Prioritize verified automatic approvals with sandbox retained; full sandbox-off
YOLO remains a separate choice. Policy probes in `.tmp/m25-probe/` are retained.

## Updated enforcement evidence — 2026-09-14

[w2/010](sources.md) adds a published-0.5.0 client compatibility reproduction.
[Fresh public-host probes](../evidence/010-sdk-approval-verification.md) now
verify native allowAll on Muse 1.2.1-R2847.1 for single/multi-stage writes and an
onRequest-to-allowAll reconfiguration, with zero approval requests. The 1.1.1
native limitation remains. Earlier onRequest-only 1.2.1 runs did not establish
that allowAll was unavailable on that host.

Automatic decisions of host-offered once choices also complete two-stage writes
on both versions; a separate outside-workspace write remains sandbox-denied on
both. This removes the assumption that automatic execution must wait for upstream.
Resume t001 by defining native versus adapter-controlled policy semantics and
extend t002/t004/t005 to cover explicit bypassApprovals selection, both ACP mode
interfaces, actionable unsupported errors and accurate documentation. Reuse the
existing approval reconciler and retain cancellation/stale-request guards.

These targeted macOS probes establish a viable path, not full m25 completion.
All task statuses stay open; sandbox configuration/replacement, native policy
matrix, cross-session behavior and durable regression coverage remain required.

## Original t001.md

```markdown
---
id: w1/m25/t001
title: "Verify policy enforcement and define SDK safety options"
worker: worker1
status: todo
estimate: 45m
depends_on: [w1/m10/t008]
---

## Objective

Extend the successful zero-turn selection probe into evidence of actual enforcement before deciding mode labels.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Reproduce the four policy selections on the pinned host with isolated local fixtures, then test matched/unmatched tools and real allow/deny behavior.
2. Define separate approval policy, sandbox network/filesystem and workspace-trust settings; identify unsupported combinations and explicit broader-access gates.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] Each advertised policy has observed tool-side enforcement, not only an accepted configuration response.
- [ ] Default remains onRequest with sandboxing; allowAll is not described as sandbox-off and no root/trust guard is silently removed.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t002.md

```markdown
---
id: w1/m25/t002
title: "Wire requested and effective approval policy through sessions"
worker: worker1
status: todo
estimate: 45m
depends_on: [w1/m25/t001]
---

## Objective

Replace hard-coded onRequest with explicitly selected, verified session policy while preserving defaults.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Thread policy through ACP configuration, MuseSdkHost start/resume, saved preferences and compatibility identity.
2. Use setApprovalMode returned effective state and verified change notifications; apply at an idle/next-action boundary and protect pending decisions.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] New, resumed and reused sessions use the selected supported policy and report actual effective state.
- [ ] A policy change cannot retroactively resolve a pending permission or accept a stale reply; unavailable choices fail before mutation.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t003.md

```markdown
---
id: w1/m25/t003
title: "Implement explicit host-lifetime sandbox configuration"
worker: worker1
status: todo
estimate: 45m
depends_on: [w1/m25/t002]
---

## Objective

Expose only verified spawn-time sandbox controls with clear, separate approval semantics.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Map documented serve flags, with explicit selection and accurate broader-access labels/gates; do not automatically trust workspace rules or hooks.
2. Recreate the host on changed posture and include flags/network settings in host compatibility; retain overlays until old-host disposal completes.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] Sandbox changes replace the host and do not leak across sessions or change an in-flight action.
- [ ] Safe defaults, canonical workspace ownership and cancellation cleanup remain enforced; broader posture is never inferred from an approval policy.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t004.md

```markdown
---
id: w1/m25/t004
title: "Verify mode transitions and compatibility end to end"
worker: worker1
status: todo
estimate: 45m
depends_on: [w1/m25/t003]
---

## Objective

Prove startup, resume and mixed-session safety behavior through ACP and the actual host.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Add wire/real-host loopback tests for grant/deny, stricter/looser policy changes, sandbox replacement and late approvals.
2. Exercise close, restore, plan/readOnly interaction and unsupported older hosts without paid providers or TUI driving.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] Local tool effects demonstrate intended access and denial; skipped/mocked tests cannot establish host delivery.
- [ ] Plan/readOnly cannot be weakened by unrelated policy selection, and legacy exec behavior remains explicit.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t005.md

```markdown
---
id: w1/m25/t005
title: "Document safety semantics and update ADR003"
worker: worker1
status: todo
estimate: 30m
depends_on: [w1/m25/t004]
---

## Objective

Make the newly supported choices understandable and correct stale SDK limitations.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Update README, sdk-migration, ADR003 and mode descriptions from verified results.
2. Link follow-up research and distinguish configurable approval from fixed host posture and independent workspace trust.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] Docs describe default, opt-in broader settings, enforcement evidence, host limits and restore semantics accurately.
- [ ] No claim of universal full-access/yolo parity is made from flag names or selection acknowledgement alone.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t006.md

```markdown
---
id: w1/m25/t006
title: "Simplify milestone changes"
worker: worker1
status: todo
estimate: 30m
depends_on: [w1/m25/t005]
---

## Objective

Run /simplify on the milestone changes while preserving verified behavior.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Review repeated settings/host-key logic, state ownership and event handling.
2. Apply behavior-preserving cleanup and recheck affected behavior.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] Simplify findings are resolved and evidence recorded.
- [ ] No change to advertised policy semantics or permission gating.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t007.md

```markdown
---
id: w1/m25/t007
title: "CI and behavior coverage"
worker: worker1
status: todo
estimate: 45m
depends_on: [w1/m25/t005, w1/m25/t006]
---

## Objective

Run /ci with this repository's required checks and prove safety-mode behavior.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Run npm run check, npm run build, npm run test:unit and npm run test:pack-smoke.
2. Run MUSE_CODE_ACP_REQUIRE_MUSE=1 npm run test:muse-loopback plus new mode-specific real-host cases; fix failures and record versions/results.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] All required checks pass with no missing-host skips treated as success.
- [ ] Host acceptance evidence covers the policies/postures actually advertised; broader unsupported combinations remain unavailable.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```

## Original t008.md

```markdown
---
id: w1/m25/t008
title: "Close out the milestone"
worker: worker1
status: todo
estimate: 15m
depends_on: [w1/m25/t007]
---

## Objective

Close only when actual policy/posture delivery and all closing checks are complete.

## Context

- Why: Public host mechanisms exist, but the adapter currently hard-codes onRequest and restricts SDK safety choices.
- Read `docs/ADR003-followup-research.md` and `.pm/DO_NOT_DO.md`.
- Public policy changes apply next-action and never retroactively decide pending approvals.
- Reference implementation paths: `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`, `src/modes.ts`, `src/session-preferences.ts`.

## Steps

1. Verify all acceptance criteria and recorded evidence; unsupported required delivery stays open.
2. Use /pm done to mark tasks done, move them into done/ and mark table rows — **DONE**; run it for this task last.
3. Set milestone Status to done, move it to w1/done/m25/ and check the w1 checkbox, preserving logical IDs.

## Files

- `src/acp-agent.ts`, `src/modes.ts`, `src/config-options.ts`
- `src/muse-sdk-host.ts`, `src/muse-sdk.ts`, `src/host-configuration.ts`
- `src/session-preferences.ts`, `src/muse-permissions.ts`
- `src/tests/` (mode, permission, host-reuse and wire/live cases)
- `README.md`, `docs/sdk-migration.md`, `docs/ADR003-codex-acp-parity.md`

## Acceptance criteria

- [ ] All implementation and checks satisfy the definition of done before archival.
- [ ] Task frontmatter, table status, milestone status, archive paths and workstream checkbox agree.

## Out of scope

- New plan/review workflows owned by m22, native goal controls, MCP diagnostic APIs and unrelated feature work.
- Default sandbox weakening, fabricated approvals, private host methods or publication.
```
