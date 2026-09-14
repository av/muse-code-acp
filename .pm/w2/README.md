# w2 — project workstream (worker1)

**Worker:** worker1. This is a general-purpose muse-code-acp workstream. Placement records scheduling and history, not permanent ownership or a component boundary.

## Milestones

- [x] **m1** — Multi-stage approval reconciliation and silent-stall guardrails (9 tasks) ← from w2/004 triage (2026-09-13)
- [x] **m2** — Muse 1.2.1 host support: resolve or record the six real-host failures (7 tasks) ← from m1 real-host verification (2026-09-14)
- [x] **m3** — Distinguishable staged permission prompts (6 tasks) ← from w2/005 (2026-09-14)

## Inbox

- [008 — Report the SDK's unrouted `approval/updated` upstream](008.md) — 30m; no repository change.

## Done

- [x] [001 — `/goal <objective>` command UX](done/001.md) — shipped in `d9f509f`; executes the task once with an explicit persistence limitation.
- [x] [002 — Slash-command routing with editor context](done/002.md) — shipped in `d9f509f`; preserves context and workflow enforcement.

- [x] [003 — Repeated Allow once confirmations](done/003.md) — closed as expected behavior; automatic-execution feature work remains in w1/m25.

- [x] [m1 — Multi-stage approval reconciliation and silent-stall guardrails](done/m1/README.md) — consumed inbox note 004; multi-stage shell approvals now complete on the SDK backend and stalled host requests fail with diagnostics. Verified on Muse 1.2.1-R2847.1.

The 001 and 002 fixes shipped in `d9f509f`; m1 shipped in `a82cc2f` and m2 in
`39fc8a5`. These fixes and m3 remain Unreleased on npm. Until publication, npm
adopters still need the exec workaround for the multi-stage hang. Release item 009 follows the remaining inbox work, per the expanded loop request.

- [x] [m2](done/m2/README.md) — HTTP MCP startup failures restored; legacy-profile host limitation reproduced and explained.

- [x] [m3](done/m3/README.md) — Permission titles distinguish host stages in plain ACP clients; verified through Bex and both host versions.

- [x] [006 — Observe host session state](done/006.md) — negotiated reporting, idle model/mode changes and durable policy-persistence outcomes; 377 unit and 29 live tests passed on both host versions.

- [x] [007 — Notification observation recommendation](done/007.md) — retain SDK routing and narrow public reads; alternatives and engineering costs recorded.
