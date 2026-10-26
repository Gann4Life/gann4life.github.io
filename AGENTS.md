# AGENTS.md

Project instructions for OpenCode. Read this and `DESIGN.md` before changing anything.

## What this repo is

- `main` is the live Portfolio v2: a Create React App published to GitHub Pages at `https://gann4life.github.io`.
- `portfolio-v3` is the rebuild: Astro, static output, git-based content. `DESIGN.md` is the spec.
- v2 stays intact and deployable until v3 renders equivalent content. Do not delete v2 files to "clean up".

## Hard rules

1. **Local commits only.** Never run `git push`, `git push --force`, or anything that writes to the remote. The lead pushes by hand.
2. **`DESIGN.md` is the spec.** Do not weaken it to match code. When reality diverges, report the gap or propose an edit; do not silently rewrite sections.
3. **No paid services.** Free GitHub Pages hosting, no Cloudflare, no image CDN, no managed database. Adding a paid dependency is a blocking decision, not an implementation detail.
4. **No third-party API as the content source.** Snapshot the data into the repo, then read from the snapshot.
5. **Honesty outranks polish.** Authorship, roles, credits, and fork attribution follow `DESIGN.md` section 6. A thinner truthful entry beats a fuller invented one.
6. **No hotlinked media.** Old CDN URLs expire; media must live in the repo.

## Workflow

1. Confirm the branch: `git branch --show-current` must be `portfolio-v3` for v3 work.
2. Read `DESIGN.md` sections 1–2 before writing code or content; read section 6 before writing claims.
3. Keep changes small and single-purpose. One commit per coherent step, imperative subject line.
4. Verify before committing: run the build script that exists (`npm run build` for v2 today; `npx astro build` once Astro is installed) and, when content changed, validate frontmatter against the schema.
5. Commit locally. Then report what changed, what was verified, and what is still unproven.

## Subagent routing

Launch these through the `subagent` tool. Each has its own fixed model and permissions.

| Agent | Use when | Writes? |
|---|---|---|
| `astro-builder` | Astro routes, layouts, components, collection schemas, Pages workflow | Yes, except legacy v2 files and `DESIGN.md` |
| `content-migrator` | Turning legacy v2 data into `work` entries, with honest roles and fork credit | Yes, content files |
| `design-auditor` | Before committing/merging, or when asked to check drift against `DESIGN.md` | No — review only |
| `media-inspector` | New images/art with no alt text or caption | No — returns text |

Rules of thumb

- Never have two writing agents touch the same files at once.
- The lead integrates and commits; subagents do not commit or push.
- Send `design-auditor` the diff summary, not the whole repo, so the audit stays focused.
- If a subagent reports a spec gap, resolve it in `DESIGN.md` with the user before coding around it.

## Definition of done for a v3 step

- Code builds with no errors and no new client-side JS unless the component is explicitly interactive.
- Content validates against the schema and contains no unverifiable claims.
- `design-auditor` returns no blocking findings.
- The change is committed locally on `portfolio-v3`, and `main` still builds and deploys v2.
