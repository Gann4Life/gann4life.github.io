# Portfolio v3 — Plan

One site for everything: software, games, 2D, 3D, animation, music.
Static, git-based, no backend to maintain or patch.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro** | Static output, content collections with typed schemas |
| Interactive islands | None by default | Viewers/players are framework-agnostic web components (`<model-viewer>`, wavesurfer.js, Spine Web Player). Add an island only if a component genuinely needs one |
| Admin panel | **Keystatic** (local mode) | `npm run dev` → `localhost:4321/keystatic`, commits Markdown to the repo. Remote editing falls back to `github.dev` |
| Hosting | **GitHub Pages** | Free user site at `gann4life.github.io`, deployed from Actions on push |
| Images | In-repo, `astro:assets` + sharp | WebP/AVIF generated at build; stays inside the ~1 GB published-site budget, no CDN |
| Video | YouTube / Vimeo / itch.io | Embed only |

**Admin decision notes**
- Keystatic local mode needs no OAuth proxy and no server adapter, so the site stays fully static and free.
- Local mode means no browser editing away from the dev machine; `github.dev` covers that for free.
- The CMS is additive: plain Markdown files stay the source of truth, so the CMS can be swapped or removed without touching content.

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
- `/keystatic` — CMS (not linked publicly).

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
- [ ] Create the Astro project on the `portfolio-v3` branch, keeping v2 deployable until cutover
- [ ] Define `work` collection schema (Zod) matching section 2
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

- Single-page home vs separate sections
- Domain name (only worth it to decouple the URL from the repo name)
