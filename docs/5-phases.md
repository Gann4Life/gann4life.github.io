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

### Phase 6 — In-site editor (dev only, issue #136; re-planned 2026-10-30)
Specified in [section 1](1-stack.md) "In-site editor" and [section 3](3-pages.md) "Edit mode". Goal: on the dev server, "Edit" edits any work entry or post completely on its own page; Keystatic is the secondary path. Each step is usable on its own; until 6.5 lands, images are changed through "Edit in Keystatic". Replaces the earlier plan and its issues #139 (in progress, not merged: close it; its control styling can be reused in 6.3), #140, #142 and #143; #141 is unaffected (6.6).
- [x] 6.1 `js-yaml` writer and the dev-only save endpoint for `work` (no UI) — built (#138); generalised in 6.3
- [ ] 6.2 Field registry: `src/lib/content-fields.ts` + `schemaFor`; `src/content.config.ts` and `keystatic.config.ts` built from it; label maps move to `src/vocab.ts`; `FIELD_HELP` and `src/lib/work-schema.ts` removed. Usable result: Keystatic's form follows the page's reading order. Checks: every entry parses to the same data as before; a Keystatic save of an unchanged entry gives identical bytes; record how Keystatic writes cleared fields and where it stores gallery images (needed by 6.3 and 6.5)
- [ ] 6.3 Edit work entries in place, every field except images: generic endpoint `__editor/<collection>/<id>`, module renamed to `integrations/editor/`, generic client and field panel, `editHooks` on the work page, one "Edit" (in place on the page; `?edit` links from tiles and category players), "Edit in Keystatic" in the bar
- [ ] 6.4 Edit blog posts in place: `blog` hooks in `PostArticle` (`editable` on `/blog/<slug>/`), "Edit" links from the home feed and the `/blog/` reader. No editor code change expected: a registry and hooks step
- [ ] 6.5 Images in both collections: uploads in the save, cover, gallery (add, replace, remove, reorder, captions), images in list items, "Insert image" in the body, deletion of replaced files
- [ ] 6.6 `ended` field (#141): one registry field after 6.2, plus `yearSpan` display ([section 2](2-content-model.md) "End date"; display rule pending a user decision)
- Later, only if wanted: create a work entry or a post from the site (today Keystatic, or `npm run sync` / `npm run add`); edit the Profile in the site

### Later (optional)
- [ ] `buy` links to a storefront (Gumroad / Ko-fi / Lemon Squeezy / itch) for asset packs
- [x] Devlog / blog collection (`/blog/`, written in `/keystatic`)
