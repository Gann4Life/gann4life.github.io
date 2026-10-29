# 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro** | Static output, content collections with typed schemas |
| Interactive islands | None by default | Players are plain HTML or framework-agnostic scripts (native `<audio>`/embeds, Spine Web Player). 3D work is shown as screenshots, not an in-browser viewer. Add an island only if a component genuinely needs one |
| Admin panel | **Keystatic** (local mode) | `npm run dev` → `localhost:4321/keystatic`, commits Markdown to the repo. Remote editing falls back to `github.dev` |
| Hosting | **GitHub Pages** | Free user site at `gann4life.github.io`, deployed from Actions on push |
| Images | In-repo, `astro:assets` + sharp | WebP/AVIF generated at build; stays inside the ~1 GB published-site budget, no CDN |
| Video | YouTube / Vimeo / itch.io | Embed only |

**Admin decision notes**
- Keystatic local mode needs no OAuth proxy and no server adapter, so the site stays fully static and free.
- Local mode means no browser editing away from the dev machine; `github.dev` covers that for free.
- The CMS is additive: plain Markdown files stay the source of truth, so the CMS can be swapped or removed without touching content.
