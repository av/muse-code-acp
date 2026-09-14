---
name: pm-brainstorm
description: Analyze and decompose a product topic into a text-only proposal for this repository's .pm board. Use to pressure-test scope, size milestones, identify dependencies, or prepare PM commands without writing board files.
---

# Propose milestones and tasks

Usage: `$pm-brainstorm <topic or goal>` (also `/pm-brainstorm`). Treat `$ARGUMENTS` as the topic. Propose work as text and hand materialization to `/pm`; do not write board or implementation files.

Read [the canonical PM skill](../pm/SKILL.md) for hierarchy, sizing, quality gates, closing tasks, templates, and validation. Apply those conventions without duplicating them here.

## Procedure

1. Read `.agents/skills/pm/SKILL.md` and `.pm/DO_NOT_DO.md`. Reject proposals that conflict with anti-goals and explain why.
2. Check freshness with `git fetch origin main`, `git status`, and branch comparison. Fast-forward with `git pull --ff-only origin main` only on a clean `main` that is strictly behind. For dirty or divergent state, preserve local work and inspect relevant remote board files with `git show origin/main:<path>`; disclose which state informs the proposal. If remote access fails, use local evidence and report the freshness limitation.
3. Read relevant workstream indexes, open milestones, inbox notes, and archived milestone READMEs, including nested `done/` directories. Reuse or reshape existing work rather than proposing completed capabilities again. Pick a workstream by capacity, dependency locality, and collision avoidance; prior topics do not imply ownership. Suggest a new queue only when independent capacity is useful.
4. Inspect relevant implementation and documentation to pressure-test scope, dependencies, risks, and observable outcomes. For SDK/MSP or ACP capability work, distinguish public schema support, fake-host tests, negotiated editor support, and observed Muse behavior. Consult relevant capability documentation such as `README.md`, `docs/sdk-migration.md`, and `docs/mcp-passthrough.md`; do not promise unverified host behavior.
5. Decompose into implementation tasks with rough estimates and logical `depends_on` links. Apply PM's sizing and quality gates. Propose inbox notes for undersized work and reshape candidates without meaningful, observable outcomes.
6. Emit the full proposal as text: target workstream, candidate milestone task table, definition of done, source, goal linkage, expected outcome, and why-now rationale, or an inbox note with its `Why:` line. Include implementation tasks only; `/pm` appends standing closing tasks. State whether adoption-surface work applies or is covered by implementation, so materialization can account for it.
7. Finish with a numbered priority summary of all candidates using consistent numbers: `N. <title> (wN, ~size) — <outcome>`. Provide exact materialization commands such as `/pm new milestone w1 <title>`, `/pm add w1 <idea>`, or `/pm promote w1/NNN`, with the preceding proposal supplying the task details. Do not run those commands during brainstorming.
