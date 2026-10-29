# 2. Content model

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
cover: "../../assets/project-name/cover.png"   # in-repo, see section 1
media:
  - type: image       # image | video | model3d | spine | audio | webgl
    src: "../../assets/project-name/shot-1.png"   # images in-repo; embeds may be URLs
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
