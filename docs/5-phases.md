# 5. Phases

### Phase 1 — Skeleton
- [x] Create the Astro project (`site/`) on the `astro-rewrite` branch, keeping v2 deployable until cutover
- [x] Define `work` collection schema (Zod) matching [section 2](2-content-model.md)
- [x] Configure Keystatic in local mode at `/keystatic`
- [ ] Deploy to GitHub Pages from Actions, auto-deploy on push to `main` after cutover

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

### Later (optional)
- [ ] `buy` links to a storefront (Gumroad / Ko-fi / Lemon Squeezy / itch) for asset packs
- [x] Devlog / blog collection (`/blog/`, written in `/keystatic`)
