# 5. Phases

### Phase 1 — Skeleton
- [x] Create the Astro project (`site/`) on the `astro-rewrite` branch, keeping v2 deployable until cutover
- [x] Define `work` collection schema (Zod) matching [section 2](2-content-model.md)
- [ ] Configure Keystatic in local mode at `/keystatic`
- [ ] Deploy to GitHub Pages from Actions, auto-deploy on push to `main` after cutover

### Phase 2 — Core pages
- [ ] Home: hero, featured strip, grid
- [ ] Filters by role and kind
- [ ] Detail page with conditional sections (contribution, credits, links, usedIn)
- [ ] Authorship badge + fork/upstream block
- [ ] Skills list generated from `hand-made` entries only
- [ ] Responsive + dark/light

### Phase 3 — Media components
- [ ] Gallery/lightbox
- [ ] Audio player
- [ ] 3D viewer
- [ ] Spine player
- [ ] Video/WebGL embeds
- [ ] Image pipeline: `astro:assets` with WebP/AVIF output

### Phase 4 — Content migration
- [ ] Re-export original art (old site hotlinked expiring CDN URLs)
- [ ] Collect SoundCloud track IDs from old site
- [ ] Rebuild software entries from old project-card data
- [ ] Add game entries with roles and contribution text
- [ ] Add music entries + `usedIn` relations
- [ ] Add AI-built projects with authorship badge, design-focused roles and `docs` links
- [ ] Add forked projects with upstream credit and contribution list (update their READMEs first)

### Phase 5 — Polish
- [ ] SEO: meta tags, Open Graph images per entry, sitemap
- [ ] Privacy-friendly analytics (optional)
- [ ] Lighthouse pass (performance, accessibility)
- [ ] Custom domain (optional, deferred)

### Later (optional)
- [ ] `buy` links to a storefront (Gumroad / Ko-fi / Lemon Squeezy / itch) for asset packs
- [ ] Devlog / blog collection
