# w2 — project workstream (worker1)

**Worker:** worker1. This is a general-purpose muse-code-acp workstream. Placement records scheduling and history, not permanent ownership or a component boundary.

## Milestones

- [x] **m1** — Multi-stage approval reconciliation and silent-stall guardrails (9 tasks) ← from w2/004 triage (2026-09-13)
- [ ] **m2** — Muse 1.2.1 host support: resolve or record the six real-host failures (7 tasks) ← from m1 real-host verification (2026-09-14)
- [ ] **m3** — Distinguishable staged permission prompts (6 tasks) ← from w2/005 (2026-09-14)

## Inbox

- [006 — Surface session-state changes the adapter folds and ignores](006.md) — phase 2 of the m1 design; reporting-only is about an hour.
- [007 — Evaluate observing raw MSP notifications instead of polling the fold](007.md) — phase 3; a recommendation, not an implementation.
- [008 — Report the SDK's unrouted `approval/updated` upstream](008.md) — 30m; no repository change.

## Done

- [x] [001 — `/goal <objective>` command UX](done/001.md) — shipped in `d9f509f`; executes the task once with an explicit persistence limitation.
- [x] [002 — Slash-command routing with editor context](done/002.md) — shipped in `d9f509f`; preserves context and workflow enforcement.

- [x] [003 — Repeated Allow once confirmations](done/003.md) — closed as expected behavior; automatic-execution feature work remains in w1/m25.

- [x] [m1 — Multi-stage approval reconciliation and silent-stall guardrails](done/m1/README.md) — consumed inbox note 004; multi-stage shell approvals now complete on the SDK backend and stalled host requests fail with diagnostics. Verified on Muse 1.2.1-R2847.1.

The 001 and 002 fixes are on `origin/main` and remain unreleased on npm. The m1 fix is verified for shipment;
until it is released, an adopter on npm still hits the multi-stage hang and needs the
`MUSE_CODE_ACP_BACKEND=exec` workaround.
