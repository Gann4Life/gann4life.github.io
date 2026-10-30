# Portfolio v3 — Astro site

Static rebuild of the portfolio. `DESIGN.md` at the repo root indexes the spec in `docs/`; this
README only covers running the app.

The v2 Create React App still lives at the repo root and is still what deploys
to <https://gann4life.github.io> until cutover. This directory is independent:
it has its own `package.json`, lockfile, and build output.

## Setup

Once per clone, from the repo root: `git config core.hooksPath .githooks`. The pre-commit hook keeps draft entries and their assets out of git (docs/2-content-model.md, "Drafts stay out of git").

## Commands

Run from `site/`:

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at <http://localhost:4321>, admin at <http://localhost:4321/keystatic> |
| `npm run sync` | Pull everything from the profiles in `src/data/profile.json` as draft entries and fill in missing covers (re-run anytime) |
| `npm run add -- <url> [<url> ...]` | Import specific works (e.g. SoundCloud tracks) as draft entries |
| `npm run drafts` | Refresh the list of drafts kept out of git; also runs before dev and build |
| `npm run build` | Static build into `site/dist/` (drafts excluded) |
| `npm run preview` | Serve the built output locally |

## Layout

```
site/
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

`.github/workflows/pages.yml` builds `site/` and publishes `site/dist` with the
official GitHub Pages actions. It is dormant (`workflow_dispatch` only) so it
cannot publish over v2; the push-to-`main` trigger is added at cutover.
