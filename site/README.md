# Portfolio v3 — Astro site

Static rebuild of the portfolio. `DESIGN.md` at the repo root indexes the spec in `docs/`; this
README only covers running the app.

The v2 Create React App still lives at the repo root and is still what deploys
to <https://gann4life.github.io> until cutover. This directory is independent:
it has its own `package.json`, lockfile, and build output.

## Commands

Run from `site/`:

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at <http://localhost:4321> |
| `npm run build` | Static build into `site/dist/` |
| `npm run preview` | Serve the built output locally |

## Layout

```
site/
├─ astro.config.mjs        # static output, site URL
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

Entries are hand-written Markdown; the schema in `src/content.config.ts` is the
only gate. Rules for claims, credits, forks, and AI-built work live in
`docs/2-content-model.md` and `docs/6-content-rules.md` — follow those, not this file.

Images must live in the repo (`src/assets/` referenced relatively from the
Markdown file, or `public/` for unprocessed files). No hotlinked media.

## Deploy

`.github/workflows/pages.yml` builds `site/` and publishes `site/dist` with the
official GitHub Pages actions. It triggers on push to `main`; v2's own deploy
path is untouched until the lead confirms cutover.
