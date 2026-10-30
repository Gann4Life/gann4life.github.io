# Portfolio v3 — Astro site

Static rebuild of the portfolio. `DESIGN.md` at the repo root indexes the spec in `docs/`; this
README only covers running the app.

The Astro project lives at the repository root. `dev` deploys to staging at <https://gann4life.github.io/dev/>; `main` deploys to production at <https://gann4life.github.io>, which shows a static maintenance page until the v3 cutover. v2 (Create React App) is retired and archived as the tag `archive/v2`.

## Setup

Once per clone, from the repo root: `git config core.hooksPath .githooks`. The pre-commit hook keeps draft entries and their assets out of git (docs/2-content-model.md, "Drafts stay out of git").

## Commands

Run from the repository root:

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at <http://localhost:4321>, admin at <http://localhost:4321/keystatic> |
| `npm run sync` | Pull everything from the profiles in `src/data/profile.json` as draft entries and fill in missing covers (re-run anytime) |
| `npm run add -- <url> [<url> ...]` | Import specific works (e.g. SoundCloud tracks) as draft entries |
| `npm run drafts` | Refresh the list of drafts kept out of git; also runs before dev and build |
| `npm run build` | Static build into `dist/` (drafts excluded); with `DEPLOY_TARGET=staging` it builds for `/dev/` |
| `npm run preview` | Serve the built output locally |
| `npm test` | Production and staging builds, dev-server smoke (reuses a running `npm run dev`), script tests; CI runs it on PRs without the dev smoke |
| `npm run check-urls -- --dry-run` | Check the remote URLs of published content and print each with `file:line` and status (OK, Broken, Unverified); without `--dry-run` it also writes the "Broken remote URLs" GitHub issue, which only CI should do |

## Layout

```
./
├─ astro.config.mjs        # static output, site URL, dev-only Keystatic
├─ keystatic.config.ts     # admin fields for `work`, mirrors the Zod schema
├─ src/
│  ├─ content.config.ts    # `work` collection loader + Zod schema
│  ├─ content/work/*.md    # one Markdown file per entry
│  ├─ assets/              # images processed by astro:assets
│  ├─ components/          # .astro components
│  ├─ layouts/             # page shells
│  ├─ pages/               # routes
│  └─ styles/              # plain CSS
├─ public/                 # copied as-is: robots.txt, favicon.svg, service-worker.js
├─ scripts/                # npm scripts (sync, add, exclude-drafts)
├─ test/                   # `npm test` (node:test)
└─ dist/                   # build output (gitignored)
```

Requires Node `>=22.23.4` (Astro 7).

## Content

Entries are Markdown, written by hand or through Keystatic at `/keystatic`
(dev server only, local mode: it edits files in the working tree; commit them
yourself). The schema in `src/content.config.ts` is the only gate; Keystatic is
loaded only under `astro dev`, so builds stay static and ship no React. Rules for claims, credits, forks, and AI-built work live in
`docs/2-content-model.md` and `docs/6-content-rules.md` — follow those, not this file.

Images must live in the repo (`src/assets/` referenced relatively from the
Markdown file, or `public/` for unprocessed files). No hotlinked media.

## Deploy

`.github/workflows/pages.yml` runs on every push to `main` or `dev`. It checks out both branches and builds each: a root `package.json` listing `astro` is built with `npm ci && npm run build`; otherwise a root `index.html` is published as-is (the maintenance page on `main` until cutover). `main` goes to the site root, `dev` to `/dev/` (not indexed). If either build fails, nothing is deployed. `public/service-worker.js` removes the worker v2 used to register; v3 never registers one. Details: `docs/1-stack.md`.
