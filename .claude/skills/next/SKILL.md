---
name: next
description: Pick the most relevant open GitHub issue to work on next, explain why, and on confirmation create its Conventional Branch from the base branch.
---

# /next

Choose the next task from GitHub issues by relevance, not by age. Conventions and project facts: `.claude/github-workflow.md`.

## 1. Gather

```
gh issue list --state open --limit 200 --json number,title,labels,milestone,body,assignees
gh pr list --state open --json number,headRefName,body
git branch --list
gh api user --jq .login
```

## 2. Drop
- Issues with an open "Depends on" or labeled `status:blocked`.
- Issues already in progress: referenced by an open PR, or a local branch contains `issue-<number>`.
- Issues assigned to someone else.

## 3. Rank what remains
1. `type:bug` with `priority:high`.
2. Earliest milestone, if the project uses them: roadmap order is binding.
3. Unblocking power: how many open issues depend on it, directly or transitively.
4. Risk reduction: `type:spike` and items tied to the spec's open questions.
5. Priority label: high > medium > low.
6. Lowest issue number.

## 4. Present
- The pick (number, title, milestone, labels) and 2–3 lines on why, citing the criteria.
- Two alternatives, one line each.
- Who implements it: `architect` first if it changes behavior, a data format, a public API or module structure; otherwise the executor agent named in the issue or the project instructions.

Ask the user to confirm before doing anything else.

## 5. On confirmation

```
git switch <base>
git pull --ff-only
git switch -c <type>/issue-<number>-<slug>
```

Then assign the issue (`gh issue edit <number> --add-assignee "@me"`) if remote writes are allowed; otherwise give the user that command.
