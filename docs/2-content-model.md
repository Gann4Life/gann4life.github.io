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
cover: "../../assets/project-name/cover.png"   # thumbnail, in-repo, see section 1
gallery:              # any number of extra images, in-repo
  - image: "../../assets/project-name/shot-1.png"
    caption: ""
media:                # embeds and players, see section 4
  - type: video       # video | model3d | spine | audio | webgl
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

**Profile**
- One `profile` file (`src/data/profile.json`): name, tagline, bio and a list of profile links (label + url), edited from the panel and shown on the home page and footer.
