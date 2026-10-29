# 2. Content model

One collection: `work`. One file per entry: `src/content/work/<slug>.md`.
Any project fits: software, games, apps, web demos, art, models, animation,
music — personal, commissioned, client or job work. Every entry gets its own
page at `/work/<slug>` ([section 3](3-pages.md)).

```yaml
---
title: "Project name"
slug: project-name
kind: game            # software | game | app | web | art2d | art3d | animation | music | other
context: personal     # personal | commission | client | job | jam | study — who it was for
position: ""          # optional free text, e.g. "Unity Game Developer" on someone else's project
roles: [programmer, animator]   # what I did — drives the filters
                      # also: artist, director, designer, spec-author, technical-direction, maintainer, musician
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
draft: false          # true = dev server only, never published
tools: [Unity, C#, Spine]
cover: "../../assets/project-name/cover.png"   # thumbnail, in-repo, see section 1
gallery:              # any number of extra images, in-repo
  - image: "../../assets/project-name/shot-1.png"
    caption: ""
media:                # embeds and players, see section 4
  - type: video       # video | spine | audio | webgl
    src: "https://..."
    caption: ""
links:                # all optional, any mix, any order
  - label: "Play in browser"   # free text; falls back to the type's default label
    type: play        # source | play | store | download | watch | listen | docs | buy | other
    url: "https://..."
  - label: "Steam page"
    type: store
    url: "https://..."
usedIn: []            # slugs of related entries (e.g. song -> game jam entry)
---

Long description / devlog in Markdown.
```

**Adding work**
- The work itself is shown embedded or as images; links are secondary and sit below it.
- `npm run add -- <url>` (in `site/`) imports from itch.io, Bandcamp, SoundCloud, YouTube, DeviantArt or GitHub: title, date, cover downloaded into the repo, and the resolved embed. The platform is read once and snapshotted; the site never calls it at build time.
- Imported entries are `draft: true` with an empty `contribution`. Fill in contribution, roles and authorship in `/keystatic`, then untick Draft. Published entries must have a `contribution`.

**Rules**
- Buttons render only for links that exist. No link type is required: an entry may have only a demo, only a store page, only a download, or nothing.
- `type` picks the icon and the default label; `label` overrides the text.
- Art/animation/music: the embedded media *is* the "view" — no button needed. Downloadable assets go in as `download` links.
- Downloads are hosted where they are free and durable (itch.io, Bandcamp, GitHub Releases), not committed to this repo.
- Project files (Ableton, Krita, Spine) are never linked unless offered as a deliberate download; list tools as tags instead.
- `usedIn` works both ways: a song shows "Used in X", the game shows "Music by…".
- `docs` links a spec/design doc (e.g. DESIGN.md, INSTALL.md) — evidence of design work.
- `kind` is *what* it is; `context` is *who it was for*. Both drive filters.

**Other people's projects**
- `team: team`, `position` set to the title actually held, `contribution` describes only my part, others go in `credits`.
- `position` is a real title from that project, not an upgraded one.

**Authorship: which badge**

| `authorship` | Means | Implementation roles allowed |
|---|---|---|
| `hand-made` | I wrote the code / made the art or music myself. AI at most for lookups or line completion. | Yes (`programmer`, `animator`, `musician`) |
| `ai-assisted` | I wrote it and can explain every part; AI generated pieces that I reviewed, edited and own. | Yes |
| `ai-built` | Vibe-coded / generated: AI wrote the implementation (or produced the asset) from my direction, specs and review. | **No** |

- When unsure between `ai-assisted` and `ai-built`, pick `ai-built`.
- The same scale applies to art, animation and music: generated assets are `ai-built`.

**AI-built (vibe-coded) projects**
- Badge + one line on the page: "Directed, designed and specified by me, implemented with AI."
- Roles reflect real work: `director`, `designer`, `spec-author`, `technical-direction`, `maintainer` — never `programmer`, `animator` or `musician` for the generated part.
- `position` says the same, e.g. "Director / Designer", never "Developer" or "Programmer".
- `contribution` names what I actually did: the idea, the spec, the design decisions, review and testing.
- Link the spec as `type: docs` (e.g. DESIGN.md) — it is the evidence of the work.
- Their languages/frameworks go in that entry's `tools`, never in the site-wide skills list.
- Site-wide skills list is built only from `hand-made` and `ai-assisted` entries.

**Forks**
- `origin: fork` + `upstream` link; credit original authors in `credits`.
- Keep the original license notice (e.g. MIT copyright).
- `contribution` lists exactly what I added or changed.
- Make sure the linked README/docs are current before publishing the entry.

**Profile**
- One `profile` file (`src/data/profile.json`): name, tagline, bio and a list of profile links (label + url), edited from the panel and shown on the home page and footer.
