# 8. Open decisions

## Open

- Single-page home vs separate sections
- Domain name (only worth it to decouple the URL from the repo name)

## Decided

### 2026-10-29 — Exact-duplicate media resolver: fix in the hook, check in CI

- **Decision**: byte-identical files (SHA-256, any type) under `src/assets/` and `public/media/` are merged by `scripts/dedupe-media.mjs`: one copy kept in `src/assets/shared/` or `public/media/shared/` as `<16 hex of SHA-256>.<ext>`, every reference in `src/` and `keystatic.config.*` rewritten in the same path form, other copies deleted. Merges stay within one tree (cross-tree identical files: warning only). Runs in fix mode from the pre-commit hook (re-stages the result; aborts if a file to rewrite has unstaged changes), as a check in the Pages workflow before each Astro build, and by hand (`npm run dupes`, `npm run dupes -- --fix`). The kept copy obeys the per-file draft rule. Defines `public/media/<slug>/` for files served as-is and `public/webgl/<slug>/` (outside the resolver) for WebGL builds.
- **Reason**: duplicates never reach the repo, local drafts are covered too (CI cannot see them), and CI stays read-only.
- **Rejected**: CI auto-fix committing back (needs a write token and bot commits on a repo where only the lead writes to the remote; would also add commits the lead has not reviewed, and CI cannot see local drafts anyway); perceptual matching (false merges); merging across `src/assets/` and `public/` (import vs URL serving are not interchangeable); hash-only names without the extension (breaks MIME detection and Astro's image pipeline).
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git" (hook) and new "Duplicate media files"; [section 1](1-stack.md) workflow build step; [section 4](4-media.md) "Where local media lives".

### 2026-10-29 — Blog follow-ups from issue #14 decided

- **Decision**: (1) [Section 6](6-content-rules.md) binds blog posts; any work by someone else shown in a post is credited in the post; no new fields. (2) Draft exclusion is per file for every asset (`work` and `blog`): an asset file is excluded only when draft entries alone reference it; it is committable once any published entry or non-content source file references it; unreferenced files are a warning only. Blog images stay in the shared `src/assets/blog/`. (3) A slug in a post's `work` that matches no entry fails the build; slugs of draft `work` entries are skipped. (4) `/work/<slug>` ends with "Posts about this project": published posts naming the entry, newest first, omitted when none.
- **Reason**: (2) the per-folder rule committed draft-only images in any shared folder, contradicting "a draft entry and its assets live only on the dev machine"; per file fixes it without changing Keystatic paths. (3) a typo should not vanish silently. (4) the user wants the link back now.
- **Rejected**: (2) per-post folders `src/assets/blog/<slug>/` (Keystatic config change plus path migration, and still per folder).
- **Supersedes**: the per-folder "Asset folder rule" (decisions "Draft entries never enter git" and "Unreferenced asset folders are reported, not excluded", folder parts). The slug-folder heuristic survives per file; `blog/` and `shared/` are not slug folders.
- **Migration**: no data format change and no version bump. The exclude block switches from folder lines to file lines on the next script run (it rewrites only its own block). A draft post with a placeholder `work` slug fails the production build once published unless the slug is fixed.
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git" and "Blog posts"; [section 3](3-pages.md) `/work/<slug>` order; [section 6](6-content-rules.md). Removed the four blog items from Open.

### 2026-10-29 — `blog` collection specified as built (issue #14)

- **Decision**: the content model has two collections. `blog` is specified field-for-field as `src/content.config.ts` defines it (`title`, optional `slug`, `date`, `summary`, `cover`, `work`, `draft`), with the same draft semantics as `work`, routes `/blog/` and `/blog/<slug>/`, and blog URLs in the sitemap only when a post is published. No behavior change.
- **Reason**: the spec said "one collection" while the code, CMS and phase list already shipped a blog.
- **Open follow-ups**: content rules for posts, shared asset folder vs draft exclusion, unknown `work` slugs, back-links. *(All decided 2026-10-29, see "Blog follow-ups from issue #14 decided".)*
- **Affects**: [section 2](2-content-model.md) intro and "Blog posts"; [section 3](3-pages.md) blog route and "Base-path rule" (`related` → `work`).

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

- **Decision**: (a) an asset folder that no entry or file references is no longer excluded and is not blocked by the pre-commit hook: the exclude script prints a `WARNING` naming it and exits 0. Folders referenced only by drafts are still excluded. (b) The script reads frontmatter by parsing only the `draft:` and `slug:` lines inside the leading `---` block; no YAML library or other new dependency. *(Amended 2026-10-29: (a) now applies per file, see "Blog follow-ups from issue #14 decided".)*
- **Reason**: (a) excluding unreferenced folders could silently keep legitimate assets out of git (e.g. files referenced in a way the scanner does not see); a warning is enough to find leftovers. (b) Two plain scalar keys written by Keystatic do not justify a dependency.
- **Rejected**: (b) adding a YAML/frontmatter library.
- **Amends**: the "Draft entries never enter git" decision below (its last sentence on unreferenced folders).
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git": exclude script, frontmatter parsing, asset folder rule.

### 2026-10-29 — Draft entries never enter git

- **Decision**: `draft: true` entries (`work` and `blog`) and their asset folders stay local until published. A Node script in `site/scripts/` writes them into a marked block of `.git/info/exclude`; it runs on `predev`, `prebuild` and from a committed pre-commit hook (`.githooks/pre-commit`, `core.hooksPath`) that blocks staging draft files. Publishing = `draft: false`, after which entry and assets are committed together. Asset folders are excluded unless a non-draft file references them; unreferenced folders are excluded and reported. *(Amended 2026-10-29, issue #11: unreferenced folders are only reported, not excluded. Issue #17: the script now lives in `scripts/` at the repository root. Later 2026-10-29: exclusion is per asset file, not per folder; see "Blog follow-ups from issue #14 decided".)*
- **Reason**: the repo is public and the only thing to keep private is unpublished work. Drafts must not reach the public history, not only the built site.
- **Rejected**: a separate drafts folder (breaks the single Keystatic collection path); a second, private source repo (user rejected it for now).
- **Kept**: the build-time draft filter stays as a second guard for local builds.
- **Not part of the spec** (lead tasks): `git rm --cached` of the 12 draft entries already tracked on the unpushed `astro-rewrite`, and history cleanup before the first push.
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git" and the `draft` field; [section 1](1-stack.md) admin notes.
