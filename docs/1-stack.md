# 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro** | Static output, content collections with typed schemas |
| Interactive islands | None by default | Players are plain HTML or framework-agnostic scripts (native `<audio>`/embeds). Spine work is shown as video so rigs are never published. 3D work is shown as screenshots, not an in-browser viewer. Add an island only if a component genuinely needs one |
| Admin panel | **Keystatic** (local mode) | `npm run dev` → `localhost:4321/keystatic`, commits Markdown to the repo. Remote editing falls back to `github.dev` |
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
- `test/build-smoke.test.mjs`: the staging build (`DEPLOY_TARGET=staging`) and the production build both exit 0; in the staging `dist/`, every root-absolute `href`/`src` in HTML starts with `/dev/` (the `dist/` half of the [section 3](3-pages.md) base-path check). Leaves `dist/` holding the production build.
- `test/dev-smoke.test.mjs`: skipped when `CI` is set (CI has no drafts). Reuses a dev server answering 200 on `localhost:4321` (fails if one answers anything else, e.g. a staging server), else starts `astro dev` and stops it afterwards. Expects 200 for the home, `/blog/` and every post, and every `/work/<slug>/` including drafts; then runs `npm run build` and expects 200 again for draft entries with a cover (regression for issue #77, [section 8](8-open-decisions.md) "Known issues").
- `test/exclude-drafts.test.mjs` and `test/dedupe-media.test.mjs` run the scripts as subprocesses inside a temporary directory (a git repo for exclude-drafts); they never touch the working repo. The `--hook` mode of `dedupe-media.mjs` is not covered. `test/check-urls.test.mjs` imports the helpers of `scripts/check-urls.mjs` and makes no network request.
- Workflow: `pull_request` to `dev` or `main`, `ubuntu-latest`, Node 22, `npm ci && npm test`. Permissions `contents: read` only; no secrets. Concurrency group per ref, cancel in progress. It does not deploy and `pages.yml` does not depend on it; making it a required check is a branch-protection setting, not part of this spec.
- Local verify step before committing: `npm test` (it includes both builds), plus frontmatter validation when content changed.

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
