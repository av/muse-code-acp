# w2 — project workstream (worker1)

**Worker:** worker1. This is a general-purpose muse-code-acp workstream. Placement records scheduling and history, not permanent ownership or a component boundary.

## Milestones

- [x] **m1** — Multi-stage approval reconciliation and silent-stall guardrails (9 tasks) ← from w2/004 triage (2026-09-13)
- [x] **m2** — Muse 1.2.1 host support: resolve or record the six real-host failures (7 tasks) ← from m1 real-host verification (2026-09-14)
- [x] **m3** — Distinguishable staged permission prompts (6 tasks) ← from w2/005 (2026-09-14)

## Inbox

None. All tasks and notes are resolved and archived.

## Done

- [x] [001 — `/goal <objective>` command UX](done/001.md) — shipped in `d9f509f`; executes the task once with an explicit persistence limitation.
- [x] [002 — Slash-command routing with editor context](done/002.md) — shipped in `d9f509f`; preserves context and workflow enforcement.

- [x] [003 — Repeated Allow once confirmations](done/003.md) — closed as expected behavior; automatic-execution feature work remains in w1/m25.

- [x] [m1 — Multi-stage approval reconciliation and silent-stall guardrails](done/m1/README.md) — consumed inbox note 004; multi-stage shell approvals now complete on the SDK backend and stalled host requests fail with diagnostics. Verified on Muse 1.2.1-R2847.1.

The 001/002 fixes, m1–m3, and session-state reporting are published in
[0.5.0](https://github.com/bex-co/muse-code-acp/releases/tag/v0.5.0), npm's verified
latest version. The SDK multi-stage hang no longer requires the exec workaround.
The documented 1.2.1 legacy-reviewer host limitation remains.

- [x] [m2](done/m2/README.md) — HTTP MCP startup failures restored; legacy-profile host limitation reproduced and explained.

- [x] [m3](done/m3/README.md) — Permission titles distinguish host stages in plain ACP clients; verified through Bex and both host versions.

- [x] [006 — Observe host session state](done/006.md) — negotiated reporting, idle model/mode changes and durable policy-persistence outcomes; 377 unit and 29 live tests passed on both host versions.

- [x] [007 — Notification observation recommendation](done/007.md) — retain SDK routing and narrow public reads; alternatives and engineering costs recorded.

- [x] [008 — Report SDK approval routing defect](done/008.md) — filed [upstream #10](https://github.com/meta-models/muse-code-sdk/issues/10) with a fresh SDK-only reproduction.

- [x] [009 — Publish the completed w2 fixes](done/009.md) — 0.5.0 released; full release CI, npm latest, published-package smoke and GitHub release verified.
