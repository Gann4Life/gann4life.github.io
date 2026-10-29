# 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro** | Static output, content collections with typed schemas |
| Interactive islands | None by default | Players are plain HTML or framework-agnostic scripts (native `<audio>`/embeds). Spine work is shown as video so rigs are never published. 3D work is shown as screenshots, not an in-browser viewer. Add an island only if a component genuinely needs one |
| Admin panel | **Keystatic** (local mode) | `npm run dev` → `localhost:4321/keystatic`, commits Markdown to the repo. Remote editing falls back to `github.dev` |
| Hosting | **GitHub Pages** | Free user site at `gann4life.github.io`, deployed from Actions on push to `main` (production) or `dev` (staging under `/dev/`); see "Branches, environments and deploys" |
| Images | In-repo, `astro:assets` + sharp | WebP/AVIF generated at build; stays inside the ~1 GB published-site budget, no CDN |
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
- A release is a PR `dev` → `main` (production deploy). Whether a `hotfix/…` branch may go straight to `main` is still open ([section 8](8-open-decisions.md)).
- `dev` is the former `astro-rewrite`. The v2-era remote `dev` (2023) is kept as the tag `archive/dev-2023` before being replaced.

**Workflow** (`.github/workflows/pages.yml`, the only Pages workflow)
- Trigger: `push` to `main` or `dev`, plus `workflow_dispatch`. Pages source is "GitHub Actions" (the legacy `gh-pages` branch is no longer deployed; v2's `npm run deploy` is retired).
- The file is identical on `main` and `dev`: GitHub runs the copy on the pushed branch, so both branches must carry it.
- Every run builds **both** branches, whichever was pushed: it checks out `main` and `dev` into separate directories, builds each, and assembles one artifact with the `main` output at the root and the `dev` output in `dev/`. Then `actions/upload-pages-artifact` and `actions/deploy-pages` publish it. If either build fails, nothing is deployed and the previous deployment stays live.
- Build detection, per checkout: if `site/package.json` exists, it is the Astro site (`npm ci && npm run build` in `site/`, output `site/dist`); otherwise, if the root `package.json` depends on `react-scripts`, it is v2 (`npm ci && npm run build` at the root, output `build/`); otherwise the run fails. So until cutover `main` builds v2 and `dev` builds Astro; after cutover both build Astro. Staging is only ever built from Astro; a `dev` checkout without `site/` fails the run.
- Deploy target is passed as one environment variable, `DEPLOY_TARGET` = `production` | `staging` (unset = `production`, so local builds behave as production). `astro.config` derives everything from it: `base` is `/` for production and `/dev/` for staging; `site` stays `https://gann4life.github.io`.
- Permissions: `contents: read`, `pages: write`, `id-token: write`. One concurrency group for all runs, no cancel-in-progress. No tokens, secrets or paid services; `GITHUB_TOKEN` is enough to read both branches of the same public repo.
- The `github-pages` environment must allow deployments from both `main` and `dev` (repo settings, deployment branch rules).

**Staging is never indexed**
- Every staging page carries `<meta name="robots" content="noindex, nofollow">`; production pages do not.
- The staging build emits no `sitemap.xml` and no `robots.txt` and does not link a sitemap from `<head>`. Crawlers read `robots.txt` only at the host root, so the production `robots.txt` is the only one that matters; it does not `Disallow: /dev/` (a disallowed page cannot be crawled, so its `noindex` would never be seen). The production sitemap never lists `/dev/` URLs.
- GitHub Pages serves only the root `404.html`, so a missing page under `/dev/` shows the production 404.

**Base path**
- The site must work under any `base`. Internal links and asset URLs follow the base-path rule in [section 3](3-pages.md).
