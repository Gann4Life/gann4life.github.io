# AGENTS.md

Project instructions for OpenCode. Read this and `DESIGN.md` (the index) before changing anything, then only the `docs/` sections the task needs.

## What this repo is

- `main` is production at `https://gann4life.github.io`: a static maintenance page until the v3 cutover.
- `dev` (formerly `astro-rewrite`) is the rebuild and staging branch, deployed to `https://gann4life.github.io/dev/`: Astro project at the repo root, static output, git-based content. `DESIGN.md` plus `docs/` is the spec.
- v2 (Create React App) is retired; it lives in git history and the tag `archive/v2`.

## Hard rules

1. **The lead runs the GitHub flow; the user directs it.** The lead pushes branches, opens, reviews and merges PRs, and opens, comments on and closes issues without asking, within what the user has asked for. Never force-push and never rewrite published history.
2. **`DESIGN.md` and `docs/` are the spec.** Do not weaken it to match code. When reality diverges, report the gap or propose an edit; do not silently rewrite sections.
3. **No paid services.** Free GitHub Pages hosting, no Cloudflare, no image CDN, no managed database. Adding a paid dependency is a blocking decision, not an implementation detail.
4. **No third-party API as the content source.** Snapshot the data into the repo, then read from the snapshot.
5. **Honesty outranks polish.** Authorship, roles, credits, and fork attribution follow `docs/6-content-rules.md`. A thinner truthful entry beats a fuller invented one.
6. **No hotlinked media.** Old CDN URLs expire; media must live in the repo. Only exception (user decision 2026-10-29): the Site appearance URL fields, checked weekly by the remote URL workflow (`docs/1-stack.md`).

## Workflow

1. One issue, one branch: a Conventional Branch (`<type>/issue-<n>-<slug>`) cut from `dev`. `/next` creates it. Releases are a PR from `dev` to `main`.
2. Read `docs/1-stack.md` and `docs/2-content-model.md` before writing code or content; read `docs/6-content-rules.md` before writing claims.
3. Keep changes small and single-purpose. One Conventional Commit per coherent step (`<type>(<scope>): <description>`, scopes from the table below).
4. Verify before committing: run `npm test` at the repo root (production and staging builds, dev-server smoke, script tests; reuses a dev server on localhost:4321 if one is running) and, when content changed, validate frontmatter against the schema.
5. Commit locally. Then report what changed, what was verified, and what is still unproven.

The lead and every agent follow `.claude/github-workflow.md`: branch and commit conventions, the no-comments rule, and `/issue` (or `TODO` / `ISSUE` in a user message, or new work found mid-task) becoming a new issue.

## Subagent routing

OpenCode launches its set from `.opencode/agents/` through the `subagent` tool. Claude Code launches the tiered set below from `.claude/agents/` through the Agent tool.

### Claude Code: tiered by model

Subagents cannot launch subagents, so the main session (the lead) orchestrates. Flow: `/next` picks an issue → `architect` first if the spec must change → `ui-ux-designer` proposes the design for any interface change (public site or admin panel) → executor implements the issue → `ui-ux-designer` reviews the rendered result → `doc-writer` syncs docs → `design-auditor` reviews, and the lead runs `/code-review` on non-trivial diffs → the lead commits. Before publishing the lead also runs `/security-review` with `security-auditor`; at the end of a phase, `/simplify`. Skills that fan out to agents run in the main session, never inside a subagent; `astro-builder`, `ui-ux-designer` and `perf-auditor` preload `/run`. An executor never decides structure (that is `architect`) or interaction and layout (that is `ui-ux-designer`).

| Tier | Agent | Use when | Writes? |
|---|---|---|---|
| Opus — decides | `planner` | Turning work into GitHub issues that double as work orders; backlog grooming | No — issues only |
| Opus — decides | `architect` | Spec changes, data formats, module boundaries, code/spec disagreements | Spec, architecture and decision docs only |
| Opus — decides | `design-auditor` | After executors finish, before committing: drift against the spec | No |
| Opus — decides | `ui-ux-designer` | Every interface change, site or admin panel: proposes the design before the executor (within what the stack supports), reviews screenshots at desktop and phone width after | No |
| Opus — decides | `security-auditor` | Before publishing, after new dependencies, workflows or bulk imports: secrets, build leaks, deps, embeds, CI | No |
| Sonnet — measures | `perf-auditor` | After bulk content or before release: page weight, images, JS, Lighthouse on the built site | No |
| Sonnet — executes | `astro-builder` | One issue for Astro code | Yes, only the files the issue lists |
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
| Roadmap phases | `docs/5-phases.md`; no milestones (continuous backlog, ranked by priority labels) |
| Decision log | `docs/8-open-decisions.md` |
| Base branch | `dev` (staging, `/dev/`); releases `dev` → `main` (production). Both deploy through `.github/workflows/pages.yml`; PRs to either run `.github/workflows/test.yml` |
| Scopes | `site`, `content`, `docs`, `ci`, `agents` |
| Remote writes allowed | **Yes** (hard rule 1): `planner` writes the backlog; the lead pushes branches and merges PRs. No force-push |
| Agents may commit | **No**: the lead commits |
| Dev server | `npm run dev` at the repo root → `http://localhost:4321` (CMS at `/keystatic`) |
| Production preview | `npm run build && npm run preview` at the repo root; staging: `$env:DEPLOY_TARGET='staging'` first, every URL must sit under `/dev/` |
| Headless browser | Helium (Chromium): `$env:LOCALAPPDATA\imput\Helium\Application\chrome.exe --headless=new --screenshot=<file> --window-size=W,H --virtual-time-budget=10000 <url>` |

### OpenCode set

| Agent | Use when | Writes? |
|---|---|---|
| `astro-builder` | Astro routes, layouts, components, collection schemas, Pages workflow | Yes, except `DESIGN.md` and `docs/` |
| `content-migrator` | Turning legacy data into `work` entries, with honest roles and fork credit | Yes, content files |
| `design-auditor` | Before committing/merging, or when asked to check drift against the spec (`DESIGN.md` + `docs/`) | No — review only |
| `media-inspector` | New images/art with no alt text or caption | No — returns text |

Rules of thumb

- Run one subagent at a time; launch the next only when the previous one reports.
- The lead integrates and commits; subagents do not commit or push.
- Send `design-auditor` the diff summary, not the whole repo, so the audit stays focused.
- If a subagent reports a spec gap, resolve it in the relevant `docs/` file with the user before coding around it.

## Definition of done for a v3 step

- `npm test` passes and no new client-side JS unless the component is explicitly interactive.
- Content validates against the schema and contains no unverifiable claims.
- `design-auditor` returns no blocking findings.
- The change is on its issue branch off `dev`, has no root-absolute internal URLs (`docs/3-pages.md` base-path rule), and `main` still builds and deploys.
