---
name: ship
description: Bring main up to date, commit intended pending changes, and push to origin/main, resolving routine rebase conflicts autonomously. Use when the user asks to ship the current main branch or invokes the repository's ship workflow.
---

# Ship the current main branch

Usage: `$ship [context]` (also `/ship`). Treat `$ARGUMENTS` as additional commit context. Bring local `main` up to date, commit the intended changes, and push to `origin/main`. Finish after a successful push; CI monitoring, deployment, and npm publication are separate workflows.

## 1. Verify branch and scope

Run `git branch --show-current` and `git status`. If not on `main`, ask whether to switch or use another explicitly requested delivery workflow; do not silently switch branches.

When you made the pending changes in this conversation, use that knowledge for staging and the commit message; no redundant diff-stat discovery is needed. Inspect unfamiliar changes with `git diff --stat`, `git diff --cached --stat`, and focused diffs before including them. Preserve unrelated work and existing staged changes. Stage only intended paths explicitly, never `git add .` or `git add -A`.

## 2. Integrate latest main

Run `git pull --rebase origin main`. Before pulling with uncommitted changes, preserve them in a named stash, recording its identity and paths; include intended untracked files when necessary. Restore the saved work after integration and retain the stash until restoration is verified. Do not sweep unrelated work into the shipment or discard it to make the pull succeed. With a clean tree and nothing to commit, still pull and push.

Resolve ordinary conflicts autonomously:

1. Inspect `git status`, `git diff --name-only --diff-filter=U`, combined diffs, surrounding code, tests, and history. Use `git show :2:<path>` and `git show :3:<path>` when needed.
2. Preserve both sides' intent in the smallest coherent result. Update dependent code, documentation, lockfiles, or generated output as needed. Do not blindly choose `--ours`, `--theirs`, or the newer side.
3. Remove conflict markers, validate affected behavior, and review for accidental loss. Stage resolved paths explicitly and use `GIT_EDITOR=true git rebase --continue` until the rebase finishes.
4. Resolve stash-restoration conflicts with the same care. Do not run `rebase --continue` when no rebase is active.

Escalate only after repository evidence cannot resolve a material intent decision, necessary credentials/artifacts/external state are unavailable, or proceeding requires an unauthorized destructive action. A conflict, unfamiliar code, or a long rebase alone is not a blocker. If escalation is necessary, preserve the worktree and rebase state and ask one narrow question with the competing behavior and evidence. Do not abort a rebase without direction.

## 3. Verify and commit

Use [PM's repository validation guidance](../pm/SKILL.md#validation-for-engineering-milestones) and current `package.json` and CI configuration for affected checks. Reuse valid results from this session; rerun checks when integration or further edits invalidate them. Docs/skill-only changes need formatting and link consistency checks. A required failing check blocks shipping.

Stage the intended files by name and create a Conventional Commits message. For a multiline message, use a temporary message file and `git commit -F <path>`. Omit generated-by and co-author trailers. If hooks fail, fix the cause and retry with a new commit; never bypass hooks or amend an existing commit to work around them. Skip committing when nothing intended is pending.

## 4. Push and report

Run `git push origin main`. For a non-fast-forward rejection, integrate latest main again, resolve conflicts, rerun affected checks, and retry. Never force-push main, skip hooks, or discard work with `git reset --hard` or `git checkout .`.

Verify the pushed HEAD matches `origin/main` and inspect `git status`; any unrelated preserved changes should remain intact. Report one line using the actual SHA and subject:

```text
Shipped: a1b2c3d feat: add ACP session discovery
```

Do not watch CI or deployments unless the user separately requested it. Do not claim shipment after a failed push.
