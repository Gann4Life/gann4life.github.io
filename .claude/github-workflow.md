# GitHub workflow conventions

Shared by the lead (main session), the `planner`, `architect` and `doc-writer` agents and the `/next` skill. Project-specific values (spec location, base branch, scopes, milestones, whether agents may write to the remote) come from the project instructions (`CLAUDE.md` / `AGENTS.md`); this file never hard-codes them.

## Project facts to look up first

| Fact | Where | Default if unstated |
|---|---|---|
| Spec / design doc | project instructions, else `DESIGN.md` | none: report that there is no spec |
| Roadmap phases | spec's roadmap / phases section | one milestone per phase |
| Decision log | project instructions | `docs/decisions/` |
| Base branch | project instructions | `gh repo view --json defaultBranchRef` |
| Scopes | project instructions | top-level areas of the repo |
| Remote writes allowed | project instructions | **no** |

## Remote-write policy

Remote writes are `git push`, `gh issue|pr|label|release create/edit/close`, and `gh api` calls that change data.
- Allowed: run them.
- Not allowed (the default): run read-only commands only, and end the report with a **"Commands for the lead"** block holding every write command, exact and in order.

## Issues are the backlog and the work orders

GitHub issues are the single source of truth for pending work. An issue is also the work order an executor agent follows, so it must be complete enough to implement without making decisions.

```
### Type
feature | bug | chore | docs | spike
### Scope
<one project scope>
### Goal
<what it delivers and why>
### Spec
<spec section(s)>
### Files
<every path to create or change; nothing else may be touched>
### Steps
1. <concrete action with exact names, fields, props, structure>
### Empty cases
<what happens when data is missing, or "n/a">
### Acceptance criteria
- [ ] <command> → <expected result>
### Depends on
#3, #7 (or "none")
```

- **Title:** short imperative summary, usable as the description of a Conventional Commit.
- **Size:** one branch and one PR per issue. Split anything larger.
- **`TODO.md`**, if the repo has one, is a generated index of the issues: `doc-writer` regenerates it, nobody edits it by hand.

## Capturing new work

- **`TODO` / `ISSUE` in a user message** (any case, as a marker, e.g. "TODO: tiles need captions") means: file it. The lead hands the text to `planner`, which turns it into an issue under the remote-write policy, then the lead continues the current task. No confirmation needed unless the item is ambiguous enough that the issue could not be written.
- **Work discovered during a task** is not done on the current branch: it goes to `planner` the same way.

## General rules

- **No AI attribution** in commits, trailers (`Co-Authored-By`), PR bodies, file headers, docs or changelog. If the project's content rules require disclosing how published work was made, those rules govern that content.
- **No code comments.** Code explains itself through naming and structure: no line or block comments (CSS and markup included), no commented-out code, no TODO comments (pending work goes in issues).
- **Docstrings only:** exported functions, classes, types and components get a short docstring in the language's standard format (e.g. JSDoc/TSDoc): contract, units, side effects. Anything longer belongs in the docs.
- **English** for code, docs, commits and issues, unless the project instructions say otherwise.
- **Confidentiality:** no client names, credentials, tokens or private data in the repo, issues or commits. Use generic terms and placeholders.

## Labels and milestones

- Type: `type:feature`, `type:bug`, `type:chore`, `type:docs`, `type:spike`.
- Scope: `scope:<area>` from the project's scopes.
- Priority: `priority:high` (bugs, spikes, anything that unblocks others or reduces risk), `priority:medium` (roadmap work), `priority:low` (polish).
- Status: `status:blocked` while any dependency is open, otherwise `status:ready`.
- Milestone: the roadmap phase.
- Each issue has exactly one type, one scope, one priority and one status label.

## Branches, commits, PRs

- Branch (Conventional Branch): `<type>/issue-<number>-<slug>`. `<type>` is `feature`, `bugfix`, `hotfix` or `chore`; spikes and docs use `chore`. The slug is 2–5 lowercase hyphenated words from the title.
- Commits and PR titles: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`, `build:`, `perf:`, `style:`; `!` plus a `BREAKING CHANGE:` footer for breaking).
- Keep them short: subjects imperative, lower-case, no trailing period, 50–72 characters. Bodies and PR descriptions say what changed and why; no narration, no file-by-file lists.
- The PR body says `Closes #<number>`. Merged PRs close issues; agents never close them.

## Versioning (only if the repo has a CHANGELOG.md or release tags)

- Next version from `git describe --tags --abbrev=0` (`v0.0.0` if none) and the PR's commit type: `feat` → minor; other types → patch; breaking → major (minor while < 1.0.0).
- `CHANGELOG.md` follows Keep a Changelog 1.1.0. Entries are written for users, one line each; they are not commit messages.
