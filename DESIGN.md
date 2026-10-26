# Portfolio v3 — Plan

One site for everything: software, games, 2D, 3D, animation, music.
Static, git-based, no backend to maintain or patch.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro** | Static output, content collections with typed schemas, islands for interactive bits |
| Interactive islands | React or Svelte | Only for 3D viewer, audio player, filters |
| Admin panel | **Keystatic** or **Sveltia CMS** | Git-based: edits commit Markdown/JSON to the repo. Decide in Phase 1 |
| Hosting | Cloudflare Pages | Free, auto-deploy on push. Supports the server route Keystatic's GitHub mode needs |
| Images | Cloudflare R2 or Cloudinary | Keep binaries out of git; auto-resize / WebP |
| Video | YouTube / Vimeo / Bunny Stream | Embed only |

**Admin decision notes**
- Keystatic: tight Astro integration, nice UI. GitHub mode needs an Astro adapter (server route for OAuth).
- Sveltia CMS: framework-agnostic, Decap-compatible config, works on a fully static site.

---

## 2. Content model

One collection: `work`. One file per entry: `src/content/work/<slug>.md`.

```yaml
---
title: "Project name"
slug: project-name
kind: game            # software | game | art2d | art3d | animation | music
roles: [programmer, animator]   # what I did — drives the filters
                      # also: designer, spec-author, technical-direction, maintainer, musician
authorship: hand-made # hand-made | ai-assisted | ai-built — shown as a badge
origin: original      # original | fork
upstream: ""          # if fork: link to the original repo
team: team            # solo | team
credits:
  - name: "Collaborator"
    role: "Artist"
    url: "https://..."
contribution: >
  2–3 lines on exactly what I built/made.
status: released      # released | in-development | archived
started: 2025-06-01   # creation/start date — used for sorting and year filters
featured: true
tools: [Unity, C#, Spine]
cover: "https://<image-cdn>/cover.webp"
media:
  - type: image       # image | video | model3d | spine | audio | webgl
    src: "https://..."
    caption: ""
links:
  - type: source      # source | play | download | watch | listen | docs | buy
    url: "https://github.com/..."
  - type: play
    url: "https://..."
usedIn: []            # slugs of related entries (e.g. song -> game jam entry)
---

Long description / devlog in Markdown.
```

**Rules**
- Buttons render only for links that exist.
- Art/animation/music: the embedded media *is* the "view" — no button needed.
- Project files (Ableton, Krita, Spine) are never linked; list tools as tags instead.
- `usedIn` works both ways: a song shows "Used in X", the game shows "Music by…".
- `docs` links a spec/design doc (e.g. DESIGN.md, INSTALL.md) — evidence of design work.

**AI-built / AI-assisted projects**
- Badge + one line: "Designed and specified by me, implemented with Claude."
- Roles reflect real work: designer, spec author, technical direction, maintainer — not programmer.
- Their languages/frameworks go in that entry's `tools`, never in the site-wide skills list.
- Site-wide skills list is built only from `hand-made` entries.

**Forks**
- `origin: fork` + `upstream` link; credit original authors in `credits`.
- Keep the original license notice (e.g. MIT copyright).
- `contribution` lists exactly what I added or changed.
- Make sure the linked README/docs are current before publishing the entry.

---

## 3. Pages

- `/` — hero (who I am, roles), featured strip, filterable grid (by role and kind), contact/socials.
- `/work/<slug>` — detail page; layout adapts to `kind`.
- `/about` — optional, could live on home.
- `/admin` — CMS (not linked publicly).

---

## 4. Media rendering per kind

| Kind | Component |
|---|---|
| Images (2D, screenshots) | Gallery + lightbox |
| 3D | `<model-viewer>` with GLB |
| Spine | Spine Web Player (live, not GIF) |
| Music | SoundCloud/Bandcamp embed or own audio + wavesurfer.js |
| Video | YouTube/Vimeo embed |
| Playable | Unity WebGL build or itch.io embed |

---

## 5. Phases

### Phase 1 — Skeleton
- [ ] Create Astro project + repo
- [ ] Define `work` collection schema (Zod) matching section 2
- [ ] Pick admin (Keystatic vs Sveltia), configure `/admin`
- [ ] Deploy to Cloudflare Pages, auto-deploy on push

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
- [ ] Image CDN setup (R2 or Cloudinary)

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
- [ ] Custom domain

### Later (optional)
- [ ] `buy` links to a storefront (Gumroad / Ko-fi / Lemon Squeezy / itch) for asset packs
- [ ] Devlog / blog collection

---

## 6. Content rules

- Only show public or team-approved material. No unannounced assets, story, or specs.
- Work under NDA: generic description, no client names or logos, unless cleared.
- Collaborative work: describe my part only; credit others.
- Songs licensed to others: music entry + `usedIn`, no composer role on that game.
- Be honest about authorship: never claim a skill only shown in AI-built work.

---

## 7. Lessons from previous versions

- Don't depend on third-party APIs for core content (v2 broke risk).
- No server-side code to maintain (v1 PHP became a liability).
- No ads, no dead counters, no hotlinked media.
- Components instead of copy-pasted markup.
- Write a real README.

---

## 8. Open decisions

- Keystatic vs Sveltia CMS
- React vs Svelte for islands
- R2 vs Cloudinary for images
- Single-page home vs separate sections
- Domain name
