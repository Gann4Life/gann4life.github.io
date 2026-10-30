# 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro** | Static output, content collections with typed schemas |
| Interactive islands | None by default | Players are plain HTML or framework-agnostic scripts (native `<audio>`/embeds). Spine work is shown as video so rigs are never published. 3D work is shown as screenshots, not an in-browser viewer. Add an island only if a component genuinely needs one |
| Admin panel | **Keystatic** (local mode) + dev-only page editor | `npm run dev` → `localhost:4321/keystatic`, commits Markdown to the repo. Remote editing falls back to `github.dev`. Common `work` fields are also editable in place on `/work/<slug>` on the dev server (see "Dev-only page editor"); Keystatic stays the panel for everything else |
| Hosting | **GitHub Pages** | Free user site at `gann4life.github.io`, deployed from Actions on push to `main` (production) or `dev` (staging under `/dev/`); see "Branches, environments and deploys" |
| Images | In-repo, `astro:assets` + sharp | WebP/AVIF generated at build; stays inside the ~1 GB published-site budget, no CDN. Only exception: appearance fields given as a URL are hotlinked as-is ([section 2](2-content-model.md) "Site appearance") |
| Video | YouTube / Vimeo / itch.io | Embed only |

**Admin decision notes**
- Keystatic local mode needs no OAuth proxy and no server adapter, so the site stays fully static and free.
- Local mode means no browser editing away from the dev machine; `github.dev` covers that for free.
- Drafts edited in the panel stay local and are never committed; see "Drafts stay out of git" in [section 2](2-content-model.md).
- The CMS is additive: plain Markdown files stay the source of truth, so the CMS can be swapped or removed without touching content.

## Branches, environments and deploys

One repo, one Pages site (GitHub Pages serves a single site per repo), two environments:

| Branch | Environment | URL | Indexed |
|---|---|---|---|
| `main` | production | `https://gann4life.github.io/` | yes |
| `dev` | staging | `https://gann4life.github.io/dev/` | no |

**Branch flow**
- Issue branches `<type>/issue-<n>-<slug>` are cut from `dev` and merged into `dev` by PR (staging deploy).
- A release is a PR `dev` → `main` (production deploy).
- **Hotfix**: an urgent production fix is a branch `hotfix/<slug>` (or `hotfix/issue-<n>-<slug>`) cut from `main`, merged into `main` by PR (production deploy); right after, `main` is merged into `dev` so staging carries the fix and the next release PR does not revert it. Nothing else goes to `main` except release PRs.
- `dev` is the former `astro-rewrite`. The v2-era remote `dev` (2023) is kept as the tag `archive/dev-2023` before being replaced.

**Repository layout**
- The Astro project lives at the repository root: `package.json`, `astro.config.*`, `src/`, `public/`, `scripts/`, output `dist/`. `npm run dev`, `npm run build` and every other npm script run from the root. Spec paths are root-relative (`src/lib/paths.ts`, not `site/src/lib/paths.ts`).
- v2 (Create React App) is retired and its files are not on `dev`. It survives only in git history and the tag `archive/v2`.

**Production before cutover**
- Until the v3 cutover (release PR `dev` → `main` carrying the Astro project), `main` holds only a static maintenance page: `index.html`, `404.html`, the self-unregistering `service-worker.js` and `.nojekyll`, linking to the profile hub. The deploy workflow publishes these files as-is; it never builds v2.

**Workflow** (`.github/workflows/pages.yml`, the only Pages workflow)
- Trigger: `push` to `main` or `dev`, plus `workflow_dispatch`. Pages source is "GitHub Actions" (the legacy `gh-pages` branch is no longer deployed; v2's `npm run deploy` is retired).
- The file is identical on `main` and `dev`: GitHub runs the copy on the pushed branch, so both branches must carry it.
- Every run builds **both** branches, whichever was pushed: it checks out `main` and `dev` into separate directories, builds each, and assembles one artifact with the `main` output at the root and the `dev` output in `dev/`. Then `actions/upload-pages-artifact` and `actions/deploy-pages` publish it. If either build fails, nothing is deployed and the previous deployment stays live.
- Build detection, per checkout:
  - if the root `package.json` exists and lists `astro` in `dependencies` or `devDependencies`, it is the Astro site: `npm ci && (npm run dupes || true) && npm run build` at the checkout root, output `dist/` (`npm run dupes` is the duplicate-media check, [section 2](2-content-model.md) "Duplicate media files": it prints duplicates, never fails the run and never writes);
  - otherwise, if the checkout root has an `index.html`, it is a static site: the checkout's files are published as-is, minus `.git/` and `.github/` (no install, no build);
  - otherwise the run fails.
- So until cutover `main` publishes the static maintenance page and `dev` builds Astro; after cutover both build Astro. Staging is only ever built from Astro: a `dev` checkout detected as static, or with neither case, fails the run. v2 is never built: a root `package.json` without `astro` (e.g. `react-scripts`) is ignored by detection.
- Deploy target is passed as one environment variable, `DEPLOY_TARGET` = `production` | `staging` (unset = `production`, so local builds behave as production). `astro.config` derives everything from it: `base` is `/` for production and `/dev/` for staging; `site` stays `https://gann4life.github.io`.
- Permissions: `contents: read`, `pages: write`, `id-token: write`. One concurrency group for all runs, no cancel-in-progress. No tokens, secrets or paid services; `GITHUB_TOKEN` is enough to read both branches of the same public repo.
- The `github-pages` environment must allow deployments from both `main` and `dev` (repo settings, deployment branch rules).

**Remote URL check** (`.github/workflows/remote-urls.yml` + `scripts/check-urls.mjs`)
- Purpose: report external URLs that stopped working. It only reports: it never edits content, never downloads media into the repo, never fails or blocks the Pages workflow (separate workflow, nothing depends on it).
- Triggers: `schedule` weekly (`cron: '0 6 * * 1'`, Monday 06:00 UTC), `workflow_dispatch`, and `push` to `dev` touching `src/data/profile.json` or `src/content/**`. GitHub runs scheduled workflows only from the default branch (`main`), so the schedule is active once the file is on `main`; like `pages.yml`, the file is identical on both branches. Concurrency group `remote-urls`, cancel in progress.
- What it checks: it checks out `dev` (always the superset of published content; CI has no drafts) and collects, with file and line: every `appearance` URL that is in effect (a `url` whose field has no `file`), profile `reel` and `links[].url` from `src/data/profile.json`; and every `http(s)://` URL in the frontmatter block of each published `work` and `blog` entry (`links`, `media` src, `credits` url, `upstream`), found by pattern inside the leading `---` block, published read as in "Drafts stay out of git" (no YAML library). Markdown bodies are not scanned. Duplicate URLs are requested once and listed with every place they occur.
- Request: Node built-in `fetch` (no dependency), `HEAD` with a 10 s timeout, redirects followed; on 403, 405, 501 or a network error it retries once with `GET` (body discarded). At most 4 requests at a time and 1 per host. Timeouts and 5xx are retried once after 30 s.
- Result per URL: **OK** = final status 2xx (for appearance URLs also a `content-type` starting with `image/`); **Broken** = 404, 410, other 4xx except below, 5xx after retry, DNS/TLS error, timeout, or an appearance URL that is not an image; **Unverified** = 401, 403, 429 (sites that block bots).
- Issue: exactly one issue titled `Broken remote URLs`, labels `type:bug`, `scope:content`, `priority:medium`, `status:ready`, found among open issues by that exact title. If any URL is Broken: create it, or replace its body if open. The body lists Broken, then Unverified, as a table (URL, status or error, field, `file:line`), plus the checked commit SHA and the run date. Unverified URLs alone never open the issue. If nothing is Broken: close the open issue, if any, with a comment naming the run. Labels that do not exist are skipped with a warning, never a failure. Uses `gh` from the runner.
- Permissions: `contents: read`, `issues: write`, nothing else; `GITHUB_TOKEN` only, no secrets, no third-party or paid service. This is the only CI job that writes to the remote, and only to that one issue.
- Exit code: 0 whatever the URLs return; non-zero only if the script itself crashes.
- The script exports its pure helpers (URL classification, collection from a given root, frontmatter block, host, draft test) for the tests; the run itself sits behind an entry-point guard, so importing the module does nothing.

**Tests** (`npm test` + `.github/workflows/test.yml`)
- `npm test` = `node --test --test-concurrency=1 "test/*.test.mjs"`: Node's built-in test runner, no test dependency. Files run one at a time because the build and dev smokes share `dist/` and `.astro/`.
- `test/build-smoke.test.mjs`: the staging build (`DEPLOY_TARGET=staging`) and the production build both exit 0; in the staging `dist/`, every root-absolute `href`/`src` in HTML starts with `/dev/` (the `dist/` half of the [section 3](3-pages.md) base-path check). Once the page editor exists, after each build no file in `dist/` contains `data-editor` or `__editor` ("Dev-only page editor"). Leaves `dist/` holding the production build.
- `test/dev-smoke.test.mjs`: skipped when `CI` is set (CI has no drafts). Reuses a dev server answering 200 on `localhost:4321` (fails if one answers anything else, e.g. a staging server), else starts `astro dev` and stops it afterwards. Expects 200 for the home, `/blog/` and every post, and every `/work/<slug>/` including drafts; then runs `npm run build` and expects 200 again for draft entries with a cover (regression for issue #77, [section 8](8-open-decisions.md) "Known issues").
- `test/exclude-drafts.test.mjs` and `test/dedupe-media.test.mjs` run the scripts as subprocesses inside a temporary directory (a git repo for exclude-drafts); they never touch the working repo. The `--hook` mode of `dedupe-media.mjs` is not covered. `test/check-urls.test.mjs` imports the helpers of `scripts/check-urls.mjs` and makes no network request. `test/vocab.test.mjs` fails when a work entry names a tool missing from `TOOLS` in `src/vocab.ts` (Keystatic's Tools picker would drop it on save). `test/work-editor.test.mjs` (once the page editor exists) imports the helpers of `integrations/work-editor/file.mjs` and checks, on fixtures in a temporary directory: id → file resolution (explicit `slug:`, bad ids, path escapes), request checks, merge + validation (`422` cases), the written bytes for a fixture saved by Keystatic, and that loading and re-dumping an unchanged Keystatic-written fixture gives identical bytes. It never touches `src/content/`.
- Workflow: `pull_request` to `dev` or `main`, `ubuntu-latest`, Node 22, `npm ci && npm test`. Permissions `contents: read` only; no secrets. Concurrency group per ref, cancel in progress. It does not deploy and `pages.yml` does not depend on it; making it a required check is a branch-protection setting, not part of this spec.
- Local verify step before committing: `npm test` (it includes both builds), plus frontmatter validation when content changed.

**Dev-only page editor** (issue #136; specified, not built; phases in [section 5](5-phases.md) "Phase 6")

Edits the everyday fields of a `work` entry on its own rendered page (`/work/<slug>`, edit mode in [section 3](3-pages.md)) on the dev server. Keystatic stays installed and is still the panel for every field the editor does not cover; the entry files keep Keystatic's format, so either tool can open what the other saved.

- **Exists only under `astro dev`, by construction**:
  - A local Astro integration, `integrations/work-editor/index.mjs`, is added to `integrations` in `astro.config.mjs` only when `isDev` (as Keystatic is). Its `astro:config:setup` hook also returns early unless `command === 'dev'`.
  - `astro:config:setup` → `injectScript('page', …)` loading `integrations/work-editor/client.ts` (plain TypeScript and DOM, its own CSS file; no framework, no island, no new dependency). The script does nothing on pages without the editor hooks below.
  - `astro:server:setup` → `server.middlewares.use(…)` serving the endpoint below. No adapter, no `output: 'server'`, no Astro API route under `src/pages/`.
  - Editor hooks in `src/pages/work/[slug].astro` (`data-editor-*` attributes, the empty "What I did" slot) are rendered only inside `import.meta.env.DEV` branches, which Vite replaces with `false` in builds.
  - Guard test: after the production and the staging build, no file in `dist/` contains the strings `data-editor` or `__editor` (added to `test/build-smoke.test.mjs`).
- **Module boundaries**: `integrations/work-editor/` may read from `src/` (`src/vocab.ts`, `src/lib/work-schema.ts`), loading them through `server.ssrLoadModule` so TypeScript and `astro/zod` resolve as in the site; nothing under `src/` imports from `integrations/`. File handling lives in `integrations/work-editor/file.mjs` as pure exported helpers (id → file, split, merge, serialize, request checks) with no side effects on import, so tests import them directly.
- **One schema**: the `work` Zod object, refinements included, moves from `src/content.config.ts` to `src/lib/work-schema.ts` as `workSchema(image)`. `src/content.config.ts` calls it with Astro's `image()`; the editor calls it with `z.string()` (image paths stay strings). Collection behaviour does not change. Field help text shared by Keystatic descriptions and editor tooltips lives in `FIELD_HELP` in `src/vocab.ts`.
- **YAML library**: `js-yaml` 4.x — the library Keystatic itself uses (`load` to read, `dump` with no options to write, in `@keystatic/core`). It is already installed as a Keystatic dependency; it becomes a direct dependency in `package.json` at the major version Keystatic resolves, so the editor does not rely on hoisting. `yaml` 2.x is also in `node_modules` (pulled in by the toolchain) and is not used: only `js-yaml` reproduces Keystatic's output.

**Endpoint** (served by the middleware; `<base>` is Vite's `base`, `/` or `/dev/`)
- `GET <base>__editor/work/<id>` → `200 { id, hash, fields, body }`: `fields` holds the raw frontmatter values of the editable fields (dates as `YYYY-MM-DD`), `body` the Markdown after the frontmatter, `hash` the SHA-256 (hex) of the file bytes as read.
- `PUT <base>__editor/work/<id>` with `{ hash, set, body? }` → `200 { hash }` (hash of the written file). `set` holds only fields from the allow-list; `body` is optional.
- Errors, JSON `{ error }` (plus `issues` on 422), nothing written: `400` malformed JSON, unknown field, wrong type; `403` failed request check; `404` no entry with that id; `409` `hash` differs from the file on disk (saved elsewhere, e.g. in Keystatic, since the page loaded); `413` body over 1 MB; `422` the merged entry fails `workSchema` (`issues: [{ path, message }]`) or the file has no leading `---` block; `500` read/write failure.
- **Allow-list per phase**: phase 1 `title`, `contribution`, `draft`, `featured` and `body`; phase 2 adds `kind`, `context`, `status`, `team`, `started`; phase 3 adds `ended`. Lists (`roles`, `tools`, `links`, …), `cover`, `gallery`, `media`, `credits`, `position`, `authorship`, `origin`, `upstream`, `usedIn` and `slug` are not editable here; they stay in Keystatic.
- Types: `title` a string, trimmed, non-empty; `contribution` a string, line endings normalised to LF, trimmed (may be empty); `draft`, `featured` booleans; enums must be in their `src/vocab.ts` list; `started` / `ended` a `YYYY-MM-DD` string that is a real date, `ended` also `null` (= remove the key); `body` a string.

**Request checks** (all requests; any failure → `403`, nothing read or written)
- Remote address is loopback: `127.0.0.1`, `::1` or `::ffff:127.0.0.1`. So `astro dev --host` on a LAN still refuses other machines.
- `Host` header hostname is `localhost`, `127.0.0.1` or `[::1]` (blocks DNS rebinding).
- `PUT` only: `Origin` present and equal to `http://<Host>`; `Content-Type` is `application/json` (cross-origin pages cannot send it without a preflight, and the middleware never answers preflights or sets CORS headers); `Sec-Fetch-Site`, when sent, is `same-origin`.
- No other methods: `405`.

**Files touched**
- `<id>` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. The file is found among the top-level `src/content/work/*.md` files by the id rule of the glob loader: explicit top-level `slug:` (read as in [section 2](2-content-model.md) "Frontmatter parsing"), else the file name without `.md`. Nested folders are not supported (`404`). The resolved real path (symlinks followed) must sit inside `src/content/work/`; anything else is `404`.
- The editor only edits existing entries: it never creates, renames or deletes an entry or any other file. Changing the title does not change the slug or the file name.
- Write: to a temporary file `.<file name>.editor-tmp` in the same folder (no `.md` ending, so the content loader and the exclude script ignore it; `.gitignore` lists `*.editor-tmp`), then renamed over the entry. No shell, no `child_process`, no `eval`, no dynamic import of request data.

**File format** (what a save writes)
- The file is split at the leading `---` block ([section 2](2-content-model.md) "Frontmatter parsing" boundaries; CRLF accepted on read). The frontmatter is read with `js-yaml` `load` (default schema, as Keystatic), the allowed keys are replaced in place (a key not yet present is appended at the end; `ended: null` removes the key), and the whole entry is validated with `workSchema(z.string())` before anything is written.
- Written as `---\n` + `dump(data)` + `---\n` + body, with `js-yaml` `dump` and no options — the same call Keystatic makes — so key order is the file's own and scalars, quoting and folded `>` / `>-` strings come out as Keystatic writes them. Date values of `started` / `ended` are written as plain `YYYY-MM-DD`, as Keystatic's date field does (a `Date` whose `toISOString` returns the date string).
- Body: written as received, line endings normalised to LF; a non-empty body that does not end with a newline gets one. Body Markdown is never reformatted by the editor.
- Untouched keys keep their values, but a file last written by an import script (flow lists like `roles: [artist]`, double quotes) is normalised to Keystatic's style on its first editor save, exactly as a Keystatic save would; that diff is formatting only.

**Staging is never indexed**
- Every staging page carries `<meta name="robots" content="noindex, nofollow">`; production pages do not.
- The staging build emits no `sitemap.xml` and no `robots.txt` and does not link a sitemap from `<head>`. Crawlers read `robots.txt` only at the host root, so the production `robots.txt` is the only one that matters; it does not `Disallow: /dev/` (a disallowed page cannot be crawled, so its `noindex` would never be seen). The production sitemap never lists `/dev/` URLs.
- GitHub Pages serves only the root `404.html`, so a missing page under `/dev/` shows the production 404.

**Retired v2 service worker**
- Older v2 builds registered a service worker at `/service-worker.js` (scope `/`). Browsers that still hold it re-fetch that URL on navigation and keep it unless the new script removes itself, so the production root must always serve a self-unregistering `/service-worker.js`.
- v3 ships it as `public/service-worker.js`, a plain static file (no build step, no dependency, not a module). Behaviour: on `install`, `skipWaiting()`; on `activate`, delete only the caches v2 created (names starting with `workbox-` or `sw-precache-`, the prefixes CRA's Workbox and older sw-precache workers use; to verify against the deployed v2 worker), call `self.registration.unregister()`, then `navigate()` each window client to its current URL so the page reloads without the worker. It has no `fetch` handler.
- v3 pages never register a service worker (no `navigator.serviceWorker.register` anywhere in `src/`).
- Production: the file lands at `/service-worker.js`, the URL v2 registered. Before cutover the maintenance page on `main` carries its own copy with the same behaviour.
- Staging: the same file lands at `/dev/service-worker.js`. v2 never registered a worker there, so it is inert and kept only so both builds come from one `public/`; it adds no indexing or routing concern.
- It must never delete every Cache Storage entry of the origin: other repos publish under `gann4life.github.io` and share its storage.
- Removal: only when a later decision states that v2 workers are no longer expected in the wild; not before.

**Base path**
- The site must work under any `base`. Internal links and asset URLs follow the base-path rule in [section 3](3-pages.md).
