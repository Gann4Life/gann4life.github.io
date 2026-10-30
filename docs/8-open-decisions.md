# 8. Open decisions

## Open

- Single-page home vs separate sections
- Domain name (only worth it to decouple the URL from the repo name)

## Decided

### 2026-10-29 — Hotfix path (issue #17)

- **Decision**: a `hotfix/…` branch is cut from `main` and merged into `main` by PR; right after, `main` is merged into `dev`. All other work still goes through `dev`, and `main` only otherwise receives release PRs `dev` → `main`.
- **Reason**: production (today the maintenance page) must be fixable without shipping unreleased `dev` work; merging `main` back keeps the next release from reverting the fix.
- **Rejected**: every change through `dev` (blocks urgent fixes behind unfinished staging work).
- **Affects**: [section 1](1-stack.md) "Branch flow". Removed from Open.

### 2026-10-29 — v2 retired; maintenance page in production until cutover (issue #17)

- **Decision**: v2 (Create React App) is retired. Its files are deleted from `dev`; v2 survives in git history and the tag `archive/v2`. Until the v3 cutover, `main` holds a static maintenance page (`index.html`, `404.html`, a self-unregistering `service-worker.js`, `.nojekyll`) and the deploy workflow publishes it as-is. Build detection per checkout: root `package.json` with `astro` → Astro build at the root (output `dist/`); else root `index.html` → static files published as-is; else the run fails. Staging is only ever Astro. v2 is never built.
- **Reason**: v2 is no longer worth keeping deployable; a maintenance page is honest and needs no build.
- **Rejected**: keeping v2 built for the root until cutover (the previous rule).
- **Amends**: "Branches, environments and deploys" below (its build-detection and "`main` keeps publishing v2" parts). Retires the AGENTS.md rule "v2 stays intact and deployable until v3 renders equivalent content" (AGENTS.md is edited by the lead).
- **Affects**: [section 1](1-stack.md) "Repository layout", "Production before cutover", workflow build detection; [section 5](5-phases.md) Phase 1.

### 2026-10-29 — Astro project moves to the repository root (issue #17)

- **Decision**: the Astro project moves from `site/` to the repository root (`package.json`, `astro.config.*`, `src/`, `public/`, `scripts/`, output `dist/`); npm scripts run from the root. Every spec path drops the `site/` prefix (e.g. `src/lib/paths.ts`, `scripts/exclude-drafts.mjs`, `src/assets/<slug>/`).
- **Reason**: with v2 gone the subfolder has no purpose; root-level commands are simpler for people and agents.
- **Consequence**: v2 removal must land before or together with the move, because v2's root `package.json`, `src/` and `public/` occupy the same paths. Open issues that cite `site/…` paths need updating.
- **Affects**: [section 1](1-stack.md) "Repository layout" and build detection; [section 2](2-content-model.md) "Adding work" and "Drafts stay out of git"; [section 3](3-pages.md) "Base-path rule" and its check; [section 5](5-phases.md) Phase 1.

### 2026-10-29 — v3 keeps a self-unregistering service worker (issue #17)

- **Decision**: v3 publishes `public/service-worker.js`, a self-unregistering worker (skipWaiting; on activate delete only v2's `workbox-`/`sw-precache-` caches, unregister, reload window clients; no `fetch` handler). It lands at `/service-worker.js` in production and, inert, at `/dev/service-worker.js` in staging. v3 never registers a worker. Kept until a later decision removes it.
- **Reason**: browsers that installed v2's worker keep serving v2's cached shell until the script at that URL removes itself.
- **Rejected**: clearing every Cache Storage entry (other repos share the `gann4life.github.io` origin); dropping the file at cutover (stale v2 workers would survive).
- **Affects**: [section 1](1-stack.md) "Retired v2 service worker"; [section 3](3-pages.md) route list; [section 5](5-phases.md) Phase 1.

### 2026-10-29 — Branches, environments and deploys

- **Decision**: `main` = production at `https://gann4life.github.io/`; `dev` = staging at `https://gann4life.github.io/dev/`. One workflow on push to `main` or `dev` checks out both branches, builds `main` at the root and `dev` with `base: '/dev/'` (via `DEPLOY_TARGET=staging`), combines both into one artifact and deploys with the official Pages actions; Pages source switches from the `gh-pages` branch to "GitHub Actions". Each checkout is built as Astro if `site/package.json` exists, else as v2 CRA, so `main` keeps publishing v2 until cutover. Staging pages are `noindex, nofollow`, and the staging build has no sitemap or robots.txt. Issue branches start from `dev`, PR into `dev`; a release is a PR `dev` → `main`. `astro-rewrite` becomes `dev`; the 2023 remote `dev` is kept as the tag `archive/dev-2023`. *(Amended 2026-10-29, issue #17: v2 is never built; `main` publishes a static maintenance page until cutover; Astro lives at the repository root; see "v2 retired" and "Astro project moves to the repository root" above.)*
- **Reason**: a staging URL to check work before it goes live, free, no secrets, while v2 stays the production site until v3 is ready.
- **Rejected**: a second staging repo deployed with a personal access token (adds a secret and a second repo to keep in sync); a separate Pages site per branch (impossible: GitHub Pages serves one site per repo); `Disallow: /dev/` in robots.txt (it stops crawlers from seeing `noindex`, so blocked URLs can still be indexed from links).
- **Consequence**: every internal link and asset URL must work under any base path; the new base-path rule makes `withBase` mandatory.
- **Affects**: [section 1](1-stack.md) hosting row and "Branches, environments and deploys"; [section 3](3-pages.md) reserved `/dev/` and "Base-path rule"; [section 5](5-phases.md) Phase 1.

### 2026-10-29 — Unreferenced asset folders are reported, not excluded

- **Decision**: (a) an asset folder that no entry or file references is no longer excluded and is not blocked by the pre-commit hook: the exclude script prints a `WARNING` naming it and exits 0. Folders referenced only by drafts are still excluded. (b) The script reads frontmatter by parsing only the `draft:` and `slug:` lines inside the leading `---` block; no YAML library or other new dependency.
- **Reason**: (a) excluding unreferenced folders could silently keep legitimate assets out of git (e.g. files referenced in a way the scanner does not see); a warning is enough to find leftovers. (b) Two plain scalar keys written by Keystatic do not justify a dependency.
- **Rejected**: (b) adding a YAML/frontmatter library.
- **Amends**: the "Draft entries never enter git" decision below (its last sentence on unreferenced folders).
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git": exclude script, frontmatter parsing, asset folder rule.

### 2026-10-29 — Draft entries never enter git

- **Decision**: `draft: true` entries (`work` and `blog`) and their asset folders stay local until published. A Node script in `site/scripts/` writes them into a marked block of `.git/info/exclude`; it runs on `predev`, `prebuild` and from a committed pre-commit hook (`.githooks/pre-commit`, `core.hooksPath`) that blocks staging draft files. Publishing = `draft: false`, after which entry and assets are committed together. Asset folders are excluded unless a non-draft file references them; unreferenced folders are excluded and reported. *(Amended 2026-10-29, issue #11: unreferenced folders are only reported, not excluded. Issue #17: the script now lives in `scripts/` at the repository root.)*
- **Reason**: the repo is public and the only thing to keep private is unpublished work. Drafts must not reach the public history, not only the built site.
- **Rejected**: a separate drafts folder (breaks the single Keystatic collection path); a second, private source repo (user rejected it for now).
- **Kept**: the build-time draft filter stays as a second guard for local builds.
- **Not part of the spec** (lead tasks): `git rm --cached` of the 12 draft entries already tracked on the unpushed `astro-rewrite`, and history cleanup before the first push.
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git" and the `draft` field; [section 1](1-stack.md) admin notes.
