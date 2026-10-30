---
name: issue
description: File a GitHub issue from a short request ("/issue <what>"). Checks for duplicates, writes it as a work order in the project's issue format, labels it, and continues the current task. Use instead of saying TODO or ISSUE.
argument-hint: <what needs doing>
---

# /issue

Turn `$ARGUMENTS` into one GitHub issue. Conventions, issue format, labels and the remote-write policy: `.claude/github-workflow.md`; project values: the project instructions.

## 1. Understand
- If `$ARGUMENTS` is empty, use the last request in the conversation that was not yet filed.
- If it is too ambiguous to write acceptance criteria, ask one concrete question and stop. Otherwise do not ask.
- Several unrelated requests become several issues.

## 2. Check for duplicates

```
gh issue list --state all --limit 500 --json number,title,state,labels
```

If an open issue already covers it, add a comment to that issue instead of creating a new one. If a closed one does, say so and file a new issue only if the work is really new.

## 3. File
- Small and self-contained (the files and steps are clear): write the issue yourself in the project's issue format, with verified file paths.
- Needs a backlog decision, several issues, dependencies, or a spec change: hand the request to `planner` (spec changes go to `architect` first).
- Labels: one type, one scope, one priority, and `status:ready` or `status:blocked`. Milestone only if the project uses them.
- Remote writes not allowed: give the exact `gh issue create` command instead of running it.

## 4. Report and continue
One line: issue number, title, link. Then resume the task that was in progress; filing an issue never interrupts it.
