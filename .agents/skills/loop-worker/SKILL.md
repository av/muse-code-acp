---
name: loop-worker
description: Autonomously drain a muse-code-acp .pm workstream by triaging milestones, implementing and verifying actionable work, closing or dropping stale items with evidence, and continuing past blocked work to independent milestones. Use for an explicit loop-worker invocation or a request to work through a whole workstream backlog, not a timed poll or a single task.
---

# Drain a workstream

Usage: `$loop-worker <wN>` (also `/loop-worker <wN>`).

Work sequentially through the named queue until no pending milestones remain or all remaining work is blocked or deferred. Read [the PM skill](../pm/SKILL.md) for board operations, templates, dependency resolution and validation. Apply those procedures directly with file tools; a slash-command runner is not required.

## Start

- Require a target workstream from the request; if absent, ask which queue to drain. Verify `.pm/<wN>/README.md` exists.
- Read applicable repository instructions, `.pm/DO_NOT_DO.md`, the workstream index and current Git status/branch/upstream. Preserve pre-existing work; use an isolated worktree when needed rather than including unrelated edits. Do not require switching to main merely to implement work.
- Determine delivery scope from the user's request and existing session authorization. A backlog request authorizes implementation and board maintenance; committing/pushing follows explicit delivery instructions. If shipping is authorized, use the delivery procedure below. Otherwise keep verified changes local and continue; report them as locally completed, not shipped. This skill does not authorize package publication, deployment or paid-provider runs.

## 1. Select actionable work

Cross-check unchecked index entries against live milestone directories and archives. Report discrepancies and repair affected drift using PM conventions before relying on it. Do not infer completion from a checkbox alone.

Select the lowest-numbered actionable milestone, honoring task `depends_on` links and prerequisites in scope/acceptance criteria, including transitive and cross-workstream dependencies. Resolve logical task IDs through archives without changing their IDs. Numbering alone is not a dependency. Read existing blocker evidence before attempting an unchanged failed prerequisite.

Skip blocked/deferred milestones and their dependents; scan later independent milestones before concluding no work can proceed. Stay in the requested workstream; do not implement cross-workstream prerequisites automatically. Loose inbox notes are outside this loop: leave them for explicit promotion and list them at exit.

## 2. Triage before implementation

Read the milestone README and all task files, including completed-task evidence when relevant. Inspect named source files, history, current behavior and observable checks. Announce the outcome and supporting evidence before making changes:

| Outcome               | Evidence and action                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Work on it            | Goal remains wanted and some acceptance criteria are unmet. Follow the intent when paths or details have gone stale; close individually satisfied tasks through PM with evidence and implement the rest.                                                  |
| Close as already done | All acceptance criteria, closing checks and the observable definition of done already hold in existing code. Use PM `done` in dependency order, Closeout last, recording commit/path/test evidence. This is board reconciliation, not new implementation. |
| Drop                  | A recorded decision or anti-goal retires the work, or a demonstrably superseding milestone makes it unnecessary. Use PM `drop` with evidence and inspect dependent work. A moved/renamed surface alone is not proof its goal is obsolete.                 |
| Defer                 | A product/scope decision only the user can make prevents determining what is wanted. Leave the milestone unchanged, record the specific question, and continue independent work. Difficulty or stale task details do not justify deferral.                |

Do not drop explicitly approved work based on suspicion, or use drop for already fulfilled work. Unobservable required host behavior is a blocker, not proof of completion. A supported public schema or successful fake host does not establish actual Muse support. Follow the board's existing documented host limitations and require new evidence before claiming they are resolved.

## 3. Implement and verify

Work in dependency order through the entire milestone, including docs, configuration and client-visible behavior. Honor `.pm/DO_NOT_DO.md`: documented SDK/MSP and feature detection, real permission gating, sandbox defaults, truthful capabilities and no silent replay of ambiguous turns. Distinguish SDK and legacy exec behavior and require negotiated extensions where the acceptance criteria specify them.

Use the PM skill's validation section and current repository CI for affected checks. Run host acceptance early when the milestone depends on a capability whose availability is uncertain. Do not implement an entire chain on the assumption that an unverified prerequisite will work.

Complete the standing closing work: surface documentation where applicable, behavior-preserving simplification, meaningful coverage and CI, then Closeout. Existing task references to `/simplify` or `/ci` describe this work; use applicable skills if available or perform the repository-specific procedures directly. Never apply another project's monorepo checks.

After verifying each task, use PM `done` and record evidence. Leave unfinished or blocked tasks open. Closeout requires the actual definition of done, including required host delivery; graceful unsupported fallback alone cannot satisfy it. Verify the milestone moved to `.pm/<wN>/done/mN/` and the index is checked.

## 4. Deliver each milestone

Keep each implemented milestone, triage closure or drop as a separate reviewable unit, with its code and board changes together. Record validation results and limitations before continuing.

When the user has authorized shipping:

1. Inspect the diff and stage only this milestone's files and board changes. Use an applicable ship skill if available and compatible with the authorized branch; otherwise follow this procedure.
2. Fetch and integrate the latest target branch without discarding local work or rewriting unrelated commits. Resolve routine conflicts and rerun checks affected by integration. Respect the user's branch/PR workflow; do not infer permission to push main from a request to open a PR.
3. Commit one milestone outcome with a descriptive message. Board-only examples: `chore(pm): close w1/mN already satisfied by <SHA>` or `chore(pm): drop w1/mN <reason>`.
4. Push to the authorized remote/branch without force. Verify the push succeeded and the branch matches its upstream; record the shipped HEAD. Report remote CI separately from local checks, and monitor it when required by the request.

A failed push is not a shipped milestone. Repair resolvable failures; otherwise preserve the work and treat the delivery failure as a blocker. Without shipping authorization, retain each milestone's verified local changes and evidence, then continue through the queue without pausing to request a push.

## 5. Route around blockers

Record each blocker, its evidence, the condition needed to resume, and dependent milestones in a run-local ledger. Report it in a progress update and use PM conventions for any durable board evidence. Do not wait for an answer while independent work remains.

Preserve partial code and board changes together in an isolated worktree or a named stash before switching work. Never discard partial work or let it enter another milestone's delivery. Keep previously completed local work intact; start independent work from the appropriate verified baseline. Do not mark a blocked milestone done to clean up the tree.

A shared blocker such as unavailable required push access applies to all outcomes needing that delivery; isolation does not fix it. Revisit a blocker only when evidence, dependencies or user input changes. Do not repeatedly retry unchanged external failures.

Return to selection after every completed outcome or isolated blocker. One blocked milestone does not end the run while independent milestones can proceed.

## Exit and reporting

Finish when the queue has no pending milestones, all remaining milestones are blocked/deferred or depend on unresolved work, or the user stops or explicitly bounds the run. A progress checkpoint alone is not a reason to abandon an authorized backlog.

Report implemented milestones (shipped SHAs or explicitly local status), triage closures with evidence, drops with reasons, blockers and deferred questions, dependent milestones, preserved partial-work locations and remaining inbox notes. Do not call a queue complete while deferred or blocked milestones remain. Distinguish observed passes, skipped checks and unverified claims.
