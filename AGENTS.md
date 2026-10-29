# AGENTS.md

Project instructions for OpenCode. Read this and `DESIGN.md` (the index) before changing anything, then only the `docs/` sections the task needs.

## What this repo is

- `main` is the live Portfolio v2: a Create React App published to GitHub Pages at `https://gann4life.github.io`.
- `astro-rewrite` is the rebuild: Astro project in `site/`, static output, git-based content. `DESIGN.md` plus `docs/` is the spec.
- v2 stays intact and deployable until v3 renders equivalent content. Do not delete v2 files to "clean up".

## Hard rules

1. **Local commits only.** Never run `git push`, `git push --force`, or anything that writes to the remote. The lead pushes by hand.
2. **`DESIGN.md` and `docs/` are the spec.** Do not weaken it to match code. When reality diverges, report the gap or propose an edit; do not silently rewrite sections.
3. **No paid services.** Free GitHub Pages hosting, no Cloudflare, no image CDN, no managed database. Adding a paid dependency is a blocking decision, not an implementation detail.
4. **No third-party API as the content source.** Snapshot the data into the repo, then read from the snapshot.
5. **Honesty outranks polish.** Authorship, roles, credits, and fork attribution follow `docs/6-content-rules.md`. A thinner truthful entry beats a fuller invented one.
6. **No hotlinked media.** Old CDN URLs expire; media must live in the repo.

## Workflow

1. Confirm the branch: `git branch --show-current` must be `astro-rewrite` for v3 work.
2. Read `docs/1-stack.md` and `docs/2-content-model.md` before writing code or content; read `docs/6-content-rules.md` before writing claims.
3. Keep changes small and single-purpose. One commit per coherent step, imperative subject line.
4. Verify before committing: run the build script that exists (`npm run build` for v2 today; `npx astro build` once Astro is installed) and, when content changed, validate frontmatter against the schema.
5. Commit locally. Then report what changed, what was verified, and what is still unproven.

## Subagent routing

OpenCode launches its set from `.opencode/agents/` through the `subagent` tool. Claude Code launches the tiered set below from `.claude/agents/` through the Agent tool.

### Claude Code: tiered by model

Subagents cannot launch subagents, so the main session (the lead) orchestrates: it asks `planner` for orders, hands each order to an executor, and sends the result to `design-auditor`.

| Tier | Agent | Use when | Writes? |
|---|---|---|---|
| Opus — decides | `planner` | Any non-trivial change: makes the choices, writes work orders | No |
| Opus — decides | `design-auditor` | After executors finish, before committing: drift against the spec | No |
| Sonnet — executes | `astro-builder` | One work order for Astro code in `site/` | Yes, only the files the order lists |
| Sonnet — executes | `content-migrator` | One work order for `work` entries | Yes, only the files the order lists |
| Haiku — reads | `reader` | Lookups: where something is, what a file holds, which entries use a field | No — returns excerpts |
| Haiku — reads | `media-inspector` | Images with no alt text or caption | No — returns text |

Executors never decide. A prompt without a work order gets `NEEDS ORDER`; an incomplete one gets `BLOCKED` with the open question, which goes back to `planner` (or the user, if it is theirs to decide).

### Work orders

Every order for an executor uses this format:

```
WORK ORDER <short-id> — <agent>
Goal: <one sentence>
Read first: <paths>
Files: <every path to create or change; nothing else may be touched>
Steps:
  1. <concrete action with exact names, fields, props, structure>
  2. ...
Empty cases: <what renders or is omitted when data is missing>
Do not: <explicit exclusions>
Acceptance: <command> → <expected result>
Report: <what to return>
```

### OpenCode set

| Agent | Use when | Writes? |
|---|---|---|
| `astro-builder` | Astro routes, layouts, components, collection schemas, Pages workflow | Yes, except legacy v2 files, `DESIGN.md`, and `docs/` |
| `content-migrator` | Turning legacy v2 data into `work` entries, with honest roles and fork credit | Yes, content files |
| `design-auditor` | Before committing/merging, or when asked to check drift against the spec (`DESIGN.md` + `docs/`) | No — review only |
| `media-inspector` | New images/art with no alt text or caption | No — returns text |

Rules of thumb

- Never have two writing agents touch the same files at once.
- The lead integrates and commits; subagents do not commit or push.
- Send `design-auditor` the diff summary, not the whole repo, so the audit stays focused.
- If a subagent reports a spec gap, resolve it in the relevant `docs/` file with the user before coding around it.

## Definition of done for a v3 step

- Code builds with no errors and no new client-side JS unless the component is explicitly interactive.
- Content validates against the schema and contains no unverifiable claims.
- `design-auditor` returns no blocking findings.
- The change is committed locally on `astro-rewrite`, and `main` still builds and deploys v2.
