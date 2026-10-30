# 5. Phases

### Phase 1 — Skeleton
- [x] Create the Astro project on the `astro-rewrite` branch (now `dev`)
- [ ] Retire v2 and move the Astro project from `site/` to the repository root (v2 kept as the tag `archive/v2`; [section 1](1-stack.md) "Repository layout")
- [ ] Self-unregistering `public/service-worker.js` ([section 1](1-stack.md) "Retired v2 service worker")
- [x] Define `work` collection schema (Zod) matching [section 2](2-content-model.md)
- [x] Configure Keystatic in local mode at `/keystatic`
- [ ] Deploy to GitHub Pages from Actions: one workflow, production from `main` at `/`, staging from `dev` at `/dev/` (noindex), the static maintenance page from `main` at the root until cutover ([section 1](1-stack.md) "Branches, environments and deploys")
- [ ] Base-path-safe links: every internal URL through `withBase` ([section 3](3-pages.md) "Base-path rule")

### Phase 2 — Core pages
- [x] Home: full-size category tiles; one page per category with overlay thumbnails and cascade animation
- [x] ~~Filters by kind, context and role~~ — replaced by category pages
- [x] Detail page with conditional sections (contribution, credits, links, usedIn)
- [x] Authorship badge + fork/upstream block
- [x] Skills list generated from `hand-made` and `ai-assisted` entries only
- [x] Responsive + dark/light (follows the system setting)

### Phase 3 — Media components
- [x] Gallery/lightbox (CSS only, no JS)
- [x] Audio player (SoundCloud/Bandcamp embeds, native `<audio>`)
- [x] ~~3D viewer~~ — dropped: 3D work is shown as screenshots ([section 4](4-media.md))
- [x] ~~Spine player~~ — dropped: published rigs can be ripped; Spine work is shown as video
- [x] Video/WebGL embeds
- [x] Image pipeline: `astro:assets` with WebP/AVIF output

### Phase 4 — Content migration
v2 held no project data of its own (everything came from CodersRank, now dropped), so content is entered fresh through the panel.
- [ ] Re-export original art (old site hotlinked expiring CDN URLs)
- [ ] Add music entries (SoundCloud/Bandcamp embeds) + `usedIn` relations
- [ ] Add software entries
- [ ] Add game entries with roles and contribution text
- [ ] Add AI-built projects with authorship badge, design-focused roles and `docs` links — RagAssembler2D done
- [ ] Add forked projects with upstream credit and contribution list (update their READMEs first) — Pixeler pending its contribution list

### Phase 5 — Polish
- [x] SEO: meta tags, Open Graph images per entry, sitemap, robots.txt, 404, favicon
- [ ] Privacy-friendly analytics (optional)
- [ ] Lighthouse pass (performance, accessibility)
- [ ] Custom domain (optional, deferred)

### Phase 6 — In-page editor (dev only, issue #136)
Specified in [section 1](1-stack.md) "Dev-only page editor" and [section 3](3-pages.md) "Edit mode". Keystatic stays for everything not listed here. "Editor phase N" in those sections: phase 1 = 6.1 + 6.2, phase 2 = 6.3, phase 3 = 6.4 + 6.5, phase 4 = 6.6.
- [ ] 6.1 Shared `workSchema`, `js-yaml` writer and the dev-only save endpoint (no UI)
- [ ] 6.2 Edit mode on `/work/<slug>`: title, What I did, description, Draft, Featured
- [ ] 6.3 Meta line in place (kind, context, status, team, started) and cover thumbnail in the edit bar
- [ ] 6.4 `ended` field: schema, Keystatic, year range display ([section 2](2-content-model.md) "End date"; display rule pending a user decision)
- [ ] 6.5 `ended` date input in edit mode
- [ ] 6.6 Lists in place (roles, tools, links) — not yet specified

### Later (optional)
- [ ] `buy` links to a storefront (Gumroad / Ko-fi / Lemon Squeezy / itch) for asset packs
- [x] Devlog / blog collection (`/blog/`, written in `/keystatic`)
