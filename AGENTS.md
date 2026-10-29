# AGENTS.md

Project instructions for OpenCode. Read this and `DESIGN.md` (the index) before changing anything, then only the `docs/` sections the task needs.

## What this repo is

- `main` is the live Portfolio v2: a Create React App published to GitHub Pages at `https://gann4life.github.io`.
- `astro-rewrite` is the rebuild: Astro project in `site/`, static output, git-based content. `DESIGN.md` plus `docs/` is the spec.
- v2 stays intact and deployable until v3 renders equivalent content. Do not delete v2 files to "clean up".

## Hard rules

1. **Local commits only.** Never run `git push` or `git push --force`; the user pushes by hand. `gh` writes for the backlog (issues, labels, milestones, comments) are allowed.
2. **`DESIGN.md` and `docs/` are the spec.** Do not weaken it to match code. When reality diverges, report the gap or propose an edit; do not silently rewrite sections.
3. **No paid services.** Free GitHub Pages hosting, no Cloudflare, no image CDN, no managed database. Adding a paid dependency is a blocking decision, not an implementation detail.
4. **No third-party API as the content source.** Snapshot the data into the repo, then read from the snapshot.
5. **Honesty outranks polish.** Authorship, roles, credits, and fork attribution follow `docs/6-content-rules.md`. A thinner truthful entry beats a fuller invented one.
6. **No hotlinked media.** Old CDN URLs expire; media must live in the repo.

## Workflow

1. One issue, one branch: a Conventional Branch (`<type>/issue-<n>-<slug>`) cut from the base branch (`astro-rewrite` for v3 work). `/next` creates it.
2. Read `docs/1-stack.md` and `docs/2-content-model.md` before writing code or content; read `docs/6-content-rules.md` before writing claims.
3. Keep changes small and single-purpose. One Conventional Commit per coherent step (`<type>(<scope>): <description>`, scopes from the table below).
4. Verify before committing: run the build script that exists (`npm run build` for v2 today; `npx astro build` once Astro is installed) and, when content changed, validate frontmatter against the schema.
5. Commit locally. Then report what changed, what was verified, and what is still unproven.

The lead and every agent follow `.claude/github-workflow.md`: branch and commit conventions, the no-comments rule, and `TODO` / `ISSUE` in a user message (or new work found mid-task) going to `planner` as a new issue.

## Subagent routing

OpenCode launches its set from `.opencode/agents/` through the `subagent` tool. Claude Code launches the tiered set below from `.claude/agents/` through the Agent tool.

### Claude Code: tiered by model

Subagents cannot launch subagents, so the main session (the lead) orchestrates. Flow: `/next` picks an issue → `architect` first if the spec must change → executor implements the issue → `doc-writer` syncs docs → `design-auditor` reviews, and the lead runs `/code-review` on non-trivial diffs → the lead commits. Before publishing the lead also runs `/security-review` with `security-auditor`; at the end of a phase, `/simplify`. Skills that fan out to agents run in the main session, never inside a subagent; `astro-builder`, `ux-reviewer` and `perf-auditor` preload `/run`.

| Tier | Agent | Use when | Writes? |
|---|---|---|---|
| Opus — decides | `planner` | Turning work into GitHub issues that double as work orders; backlog grooming | No — issues only |
| Opus — decides | `architect` | Spec changes, data formats, module boundaries, code/spec disagreements | Spec, architecture and decision docs only |
| Opus — decides | `design-auditor` | After executors finish, before committing: drift against the spec | No |
| Opus — decides | `ux-reviewer` | After visual changes: screenshots at desktop and phone width, navigation and design findings | No |
| Opus — decides | `security-auditor` | Before publishing, after new dependencies, workflows or bulk imports: secrets, build leaks, deps, embeds, CI | No |
| Sonnet — measures | `perf-auditor` | After bulk content or before release: page weight, images, JS, Lighthouse on the built site | No |
| Sonnet — executes | `astro-builder` | One issue for Astro code in `site/` | Yes, only the files the issue lists |
| Sonnet — executes | `content-migrator` | One issue for `work` entries | Yes, only the files the issue lists |
| Sonnet — executes | `doc-writer` | After implementation: README, docs, CHANGELOG/TODO in sync with the code | Docs only |
| Haiku — reads | `reader` | Lookups: where something is, what a file holds, which entries use a field | No — returns excerpts |
| Haiku — reads | `media-inspector` | Images with no alt text or caption | No — returns text |

Executors never decide. A prompt without a work order gets `NEEDS ORDER`; an incomplete one gets `BLOCKED` with the open question, which goes back to `planner` (or the user, if it is theirs to decide).

`planner`, `architect`, `doc-writer` and the `/next` skill are generic: their conventions (issue format = work order, labels, branches, commits, versioning, remote-write policy) live in `.claude/github-workflow.md`, and they read this project's values from the table below.

### Project facts for the generic agents

| Fact | Value |
|---|---|
| Spec | `DESIGN.md` (index) + `docs/` |
| Roadmap phases | `docs/5-phases.md` (one milestone per phase) |
| Decision log | `docs/8-open-decisions.md` |
| Base branch | `astro-rewrite` until cutover, then `main` |
| Scopes | `site`, `content`, `docs`, `ci`, `agents` |
| Remote writes allowed | `gh` backlog writes (issues, labels, milestones, comments): **yes**. `git push`, PRs, releases: **no**, the user does them (hard rule 1) |
| Agents may commit | **No**: the lead commits |
| Dev server | `npm run dev` in `site/` → `http://localhost:4321` (CMS at `/keystatic`) |
| Production preview | `npm run build && npm run preview` in `site/` |
| Headless browser | Helium (Chromium): `$env:LOCALAPPDATA\imput\Helium\Application\chrome.exe --headless=new --screenshot=<file> --window-size=W,H --virtual-time-budget=10000 <url>` |

### OpenCode set

| Agent | Use when | Writes? |
|---|---|---|
| `astro-builder` | Astro routes, layouts, components, collection schemas, Pages workflow | Yes, except legacy v2 files, `DESIGN.md`, and `docs/` |
| `content-migrator` | Turning legacy v2 data into `work` entries, with honest roles and fork credit | Yes, content files |
| `design-auditor` | Before committing/merging, or when asked to check drift against the spec (`DESIGN.md` + `docs/`) | No — review only |
| `media-inspector` | New images/art with no alt text or caption | No — returns text |

Rules of thumb

- Run one subagent at a time; launch the next only when the previous one reports.
- The lead integrates and commits; subagents do not commit or push.
- Send `design-auditor` the diff summary, not the whole repo, so the audit stays focused.
- If a subagent reports a spec gap, resolve it in the relevant `docs/` file with the user before coding around it.

## Definition of done for a v3 step

- Code builds with no errors and no new client-side JS unless the component is explicitly interactive.
- Content validates against the schema and contains no unverifiable claims.
- `design-auditor` returns no blocking findings.
- The change is committed locally on `astro-rewrite`, and `main` still builds and deploys v2.
