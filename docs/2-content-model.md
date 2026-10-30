# 2. Content model

One collection: `work`. One file per entry: `src/content/work/<slug>.md`.
Any project fits: software, games, apps, web demos, art, models, animation,
music — personal, commissioned, client or job work. Every entry gets its own
page at `/work/<slug>` ([section 3](3-pages.md)).

```yaml
---
title: "Project name"  # the file name is the slug: project-name.md -> /work/project-name/
                      # Keystatic generates it from the title (editable); an explicit `slug:` is optional
kind: game            # software | game | app | web | art2d | art3d | animation | music | other
context: personal     # personal | commission | client | job | jam | study — who it was for
position: ""          # optional free text, e.g. "Unity Game Developer" on someone else's project
roles: [programmer, animator]   # what I did — drives the filters
                      # also: artist, director, designer, spec-author, technical-direction, maintainer, musician
authorship: hand-made # hand-made | ai-assisted | ai-built — AI badge shown; hand-made (the default) gets no label
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
draft: false          # true = local only: dev server, never committed, never published (see "Drafts stay out of git")
tools: [Unity, C#, Spine]
cover: "../../assets/project-name/cover.png"   # thumbnail, in-repo, see section 1
gallery:              # any number of extra images, in-repo
  - image: "../../assets/project-name/shot-1.png"
    caption: ""
media:                # embeds and players, see section 4
  - type: video       # video | audio | webgl
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
- `npm run sync` (at the repository root) pulls every work from the profiles in `src/data/profile.json` (itch.io, Bandcamp, DeviantArt, GitHub, YouTube) as drafts. Re-running only adds what is new; edited entries are never touched. A GitHub repo whose homepage is an itch.io game becomes that game's source link.
- `npm run add -- <url>` imports a single work, e.g. a SoundCloud track (SoundCloud has no public listing). It imports from itch.io, Bandcamp, SoundCloud, YouTube, DeviantArt or GitHub: title, date, cover downloaded into the repo, and the resolved embed. The platform is read once and snapshotted; the site never calls it at build time.
- Imported entries are `draft: true` with an empty `contribution`. Fill in contribution, roles and authorship in `/keystatic`, then untick Draft. Published entries must have a `contribution`.

**Drafts stay out of git**

A `draft: true` entry and its assets live only on the dev machine until published. They are never committed, so they never reach the public repo or the Pages build.

- One content folder, no drafts folder, no second repo: entries stay in `src/content/work/` and `src/content/blog/`, assets in `src/assets/<folder>/`, so Keystatic keeps working unchanged.
- Draft status is read exactly as the schema reads it: `draft: true` in frontmatter; a missing `draft` means published.
- **Frontmatter parsing** (no YAML library): the script reads only the leading `---` … `---` block (the first line of the file must be `---`; the block ends at the next line that is exactly `---`). Inside it, it reads only two top-level lines: `draft:` and `slug:` (key at column 0, value after the colon, surrounding whitespace and one pair of matching `'` or `"` quotes stripped, a trailing ` #` comment ignored). `draft` is true only when the value is `true` in any case (`true`, `True`, `TRUE`); anything else, or no `draft:` line, means published. `slug` falls back to the file name without `.md`. A file with no leading block counts as published. Nested, multi-line or flow-style values for these two keys are not supported; Keystatic writes both as plain scalars.
- **Exclude script** (`scripts/exclude-drafts.mjs`, Node, no new dependency): reads the frontmatter of every `.md` in `work` and `blog` and rewrites a marked block (begin/end marker lines) of the local `.git/info/exclude`. Lines outside the block are never touched. The block lists every draft entry file and every asset folder excluded by the rule below. The exclude file is located with `git rev-parse --git-path info/exclude` (works in worktrees); if there is no git repo (e.g. a tarball build), the script does nothing and exits 0.
- It runs automatically before `npm run dev` and `npm run build` (npm `predev` / `prebuild` scripts) and from the pre-commit hook. In CI it finds no drafts and is harmless.
- **Asset folder rule**: a folder `src/assets/<folder>/` is excluded only when a draft references it and nothing non-draft does. An entry references a folder when the folder name equals its slug (file name, or explicit `slug:`) or when its file text contains `assets/<folder>/`. Any file under `src/` that is not a draft entry (published entries, components, layouts, data) and contains `assets/<folder>/` also counts. So:
  - a folder used only by drafts is excluded;
  - a folder shared by a draft and a published entry is committed (the published entry needs it);
  - a folder referenced by nothing is **not** excluded and **not** blocked by the hook: the script prints a `WARNING` line naming each unreferenced folder (so it can be deleted or linked) and still exits 0.
  - Loose files directly in `src/assets/` are outside the rule and are committed normally.
- **Pre-commit hook** (`.githooks/pre-commit`, committed; enabled per clone with `git config core.hooksPath .githooks`, documented in the README setup): re-runs the script, then blocks the commit if any staged added/copied/modified/renamed file is a draft entry or lies inside an excluded asset folder. This covers files already tracked and `git add -f`. Staged deletions are always allowed, so `git rm --cached` of a draft goes through. The error names each blocked file and how to unstage it.
- **Windows constraint**: the hook runs under Git for Windows `sh`. It is a POSIX `sh` script that only calls `git` and `node`, has LF line endings (pinned in `.gitattributes`) and the executable bit set in the index.
- **Publishing** = set `draft: false` (untick Draft). On the next commit the script drops the entry and its folder from the exclude block, and they are committed together.
- **Unpublishing** a committed entry (back to `draft: true`) does not untrack it: `.git/info/exclude` never applies to tracked files. The hook then blocks further changes to it until it is removed with `git rm --cached`; the script reports tracked drafts.
- `git commit --no-verify` and clones without `core.hooksPath` bypass the hook. The build-time draft filter (drafts are dropped from production builds) stays as a second guard.

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
