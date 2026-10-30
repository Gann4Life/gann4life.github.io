# 2. Content model

Two collections: `work` (below) and `blog` (see "Blog posts"). One file per
`work` entry: `src/content/work/<slug>.md`.
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

- One content folder, no drafts folder, no second repo: entries stay in `src/content/work/` and `src/content/blog/`, assets in `src/assets/` and `public/media/` (section 4), so Keystatic keeps working unchanged.
- Draft status is read exactly as the schema reads it: `draft: true` in frontmatter; a missing `draft` means published.
- **Frontmatter parsing** (no YAML library): the script reads only the leading `---` … `---` block (the first line of the file must be `---`; the block ends at the next line that is exactly `---`). Inside it, it reads only two top-level lines: `draft:` and `slug:` (key at column 0, value after the colon, surrounding whitespace and one pair of matching `'` or `"` quotes stripped, a trailing ` #` comment ignored). `draft` is true only when the value is `true` in any case (`true`, `True`, `TRUE`); anything else, or no `draft:` line, means published. `slug` falls back to the file name without `.md`. A file with no leading block counts as published. Nested, multi-line or flow-style values for these two keys are not supported; Keystatic writes both as plain scalars.
- **Exclude script** (`scripts/exclude-drafts.mjs`, Node, no new dependency): reads the frontmatter of every `.md` in `work` and `blog` and rewrites a marked block (begin/end marker lines) of the local `.git/info/exclude`. Lines outside the block are never touched. The block lists every draft entry file and every asset file excluded by the rule below, one root-anchored path per line (`/src/assets/x/a.png`), with gitignore special characters (`\`, `*`, `?`, `[`, `!` and `#` at the start, trailing spaces) backslash-escaped. The exclude file is located with `git rev-parse --git-path info/exclude` (works in worktrees); if there is no git repo (e.g. a tarball build), the script does nothing and exits 0.
- It runs automatically before `npm run dev` and `npm run build` (npm `predev` / `prebuild` scripts) and from the pre-commit hook. In CI it finds no drafts and is harmless.
- **Asset file rule** (per file, `work` and `blog` alike): every file under `src/assets/` and `public/media/` is judged on its own. It is excluded only when at least one draft entry references it and no published entry and no non-content source file does. It becomes committable as soon as any published entry or any file under `src/` that is not an entry (components, layouts, data, config) references it.
  - **Reference by text**: a file references an asset when its text contains the asset's path from the tree root — `assets/<path>` for `src/assets/<path>`, `media/<path>` for `public/media/<path>` (forward slashes) — preceded by `/`, a quote, `(` or whitespace, and not followed by a letter, digit, `.`, `_` or `-` (so `assets/x/a.png` does not match `assets/x/a.png.bak`).
  - **Reference by slug folder**: an entry also references every file under `src/assets/<slug>/` and `public/media/<slug>/` whose folder name equals its slug (file name, or explicit `slug:`), so images an import downloaded but no field lists yet stay with their draft. The folders `blog/`, `shared/` and `site/` are not slug folders: their files count only explicit text references.
  - So a file used only by drafts is excluded; a file used by a draft and a published entry is committed; other files in the same folder are judged separately. A file referenced by nothing is **not** excluded and **not** blocked by the hook: the script prints a `WARNING` line naming each unreferenced file (so it can be deleted or linked) and still exits 0.
  - Blog covers and body images may stay in the shared `src/assets/blog/`: draft-only images there are excluded file by file.
- **Pre-commit hook** (`.githooks/pre-commit`, committed; enabled per clone with `git config core.hooksPath .githooks`, documented in the README setup): first runs the duplicate resolver in fix mode (see "Duplicate media files"), then re-runs the script, then blocks the commit if any staged added/copied/modified/renamed file is a draft entry or an excluded asset file. This covers files already tracked and `git add -f`. Staged deletions are always allowed, so `git rm --cached` of a draft goes through. The error names each blocked file and how to unstage it.
- **Windows constraint**: the hook runs under Git for Windows `sh`. It is a POSIX `sh` script that only calls `git` and `node`, has LF line endings (pinned in `.gitattributes`) and the executable bit set in the index.
- **Publishing** = set `draft: false` (untick Draft). On the next commit the script drops the entry and the asset files it references from the exclude block, and they are committed together.
- **Unpublishing** a committed entry (back to `draft: true`) does not untrack it: `.git/info/exclude` never applies to tracked files. The hook then blocks further changes to it until it is removed with `git rm --cached`; the script reports tracked drafts.
- `git commit --no-verify` and clones without `core.hooksPath` bypass the hook. The build-time draft filter (drafts are dropped from production builds) stays as a second guard.

**Duplicate media files**

Byte-identical media files are merged into one copy so the same image, video, audio or PDF never sits in the repo twice.

- **Script** `scripts/dedupe-media.mjs` (Node built-ins only, `node:crypto` SHA-256, no new dependency). `npm run dupes` reports; `npm run dupes -- --fix` merges.
- **Scope**: every file, any type, under `src/assets/` and under `public/media/`, working tree, drafts included. Outside the scope: `public/webgl/` (WebGL builds load their own files by relative path), every other `public/` file, and empty (0-byte) files.
- **Match**: same SHA-256 of the full content. No perceptual or near-duplicate matching.
- **Groups stay within one tree**: `src/assets/` files are imported and processed by `astro:assets`; `public/media/` files are served as-is by URL, so one cannot stand in for the other. Identical files across the two trees are reported as a `WARNING` and never merged; they do not fail the check.
- **Shared folders**: `src/assets/shared/` and `public/media/shared/`. The kept copy is named `<first 16 hex chars of the SHA-256>.<ext>`, `ext` being the original extension in lower case (if the copies differ, that of the first path in byte order; none if it has none). If the group already has a copy in the shared folder, that copy is kept. If the target name exists with different content, the script fails and changes nothing.
- **Reference rewrite**: in every file under `src/` (frontmatter and bodies in `src/content/**`, components, layouts, data) and `keystatic.config.*`, each reference to a removed copy (same text match as the asset file rule) is replaced by the path to the kept copy in the same form: a relative path stays relative to the referencing file (`../../assets/shared/<hash>.png`), an aliased or root path keeps its prefix, a `public/media/` reference stays site-relative (`/media/shared/<hash>.mp3`, still passed through `withBase`). Then the other copies are deleted.
- **Safety**: the script plans every group before writing. A group whose copies are referenced in a way it cannot rewrite (a path built at runtime, a glob, a folder reference) is not merged: it is reported as `SKIPPED` and counts as a duplicate for the check. Order of writes: kept copy, references, deletions; a re-run finishes an interrupted merge.
- **Exit codes**: report mode exits 1 when any mergeable or `SKIPPED` group exists, else 0; fix mode exits 1 only when something is left unmerged.
- **Drafts**: the kept copy follows the asset file rule like any other file: if only draft entries reference it, it stays local; a draft reference adds no exposure, since a published entry already referenced the same bytes or the file stays excluded.
- **Pre-commit hook (fix mode)**: runs `--fix` on the working tree, then the exclude script, then stages the result: rewritten files and the kept copy with `git add` unless excluded, deleted tracked copies as deletions. If a file it must rewrite has unstaged or partially staged changes, it aborts the commit before writing anything and asks for `npm run dupes -- --fix` and a review, so unrelated local edits are never staged on the user's behalf. Draft files are rewritten locally and never staged.
- **CI (check only)**: the Pages workflow runs `npm run dupes` before every Astro build ([section 1](1-stack.md)); duplicates fail the run. CI never rewrites, commits or pushes and has no write token.

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

**Blog posts**

Collection `blog`: devlogs and posts, written in `/keystatic` (Blog). One file per post: `src/content/blog/<slug>.md`.

```yaml
---
title: "Post title"   # required; the file name is the slug: post-title.md -> /blog/post-title/
                      # Keystatic generates it from the title (editable); an explicit `slug:` is optional
date: 2026-10-29      # required; sorts the list, newest first; shown as "29 October 2026" (UTC)
summary: ""           # optional, one line: list subtitle, page subheading, meta description
cover: "../../assets/blog/cover.png"   # optional, in-repo image (rule 6)
work: []              # optional: slugs of related `work` entries
draft: false          # same semantics as `work`; see "Drafts stay out of git"
---

Post body in Markdown. Body images go in `src/assets/blog/`.
```

- Missing `summary` / `work` / `draft` default to `""` / `[]` / `false`; `cover` may be absent. There are no other fields; Keystatic edits exactly these plus the body.
- `cover`: list thumbnail, decorative cover at the top of the post (`alt=""`), and the post's Open Graph image (1200 px wide PNG). Keystatic stores covers and body images in the shared `src/assets/blog/`; draft-only images there stay local under the asset file rule.
- `work`: rendered as "Related work" links at the end of the post. A slug that matches no `work` entry at all fails the build; a slug of a draft `work` entry is skipped without an error (production drops drafts). Checked for every post the build includes (drafts are dropped first); the dev server only skips unknown slugs. Each `work` page lists the published posts that name it ([section 3](3-pages.md)).
- `draft`: identical to `work`. A missing `draft` means published; Keystatic starts new posts as drafts. Drafts show on the dev server (marked "Draft") and are dropped from production builds, images included. They stay out of git under the same exclude script and hook.
- Routes: `/blog/` (all published posts as tiles) and `/blog/<slug>/` ([section 3](3-pages.md)). The header "Blog" link and the sitemap's blog URLs appear only when at least one post is published.
- No contribution, role, authorship or credit fields. [Section 6](6-content-rules.md) binds post text: authorship claims follow the entry's `authorship`, and any work by someone else shown in a post is credited in the post itself (name, and link when there is one, next to the work).

**Profile**
- One `profile` file (`src/data/profile.json`), edited from the panel (Profile). The panel and the file are ordered by what stands out first on the site, images first in each section (user decision 2026-10-30):

```json
{
  "hero":       { "banner": <source>, "photo": <source>, "reel": "https://…", "name": "…", "tagline": "…", "bio": "…" },
  "background": { "image": <source>, "darken": 70, "blur": 12 },
  "header":     { "logo": <source> },
  "links":      [ { "label": "…", "url": "https://…" } ],
  "tab":        { "favicon": <source> }
}
```

- `<source>` is one choice: `{ "discriminant": "none" }`, `{ "discriminant": "upload", "value": "../assets/site/<field>/<name>.<ext>" }` or `{ "discriminant": "link", "value": "https://…" }`. The panel shows a None / Upload / Link selector and only the matching input.
- `name`, `tagline`, `bio`, `reel` (YouTube/Vimeo) and `links` are shown on the home page and footer as before.

**Site appearance** (the image sources above plus `background.darken` / `background.blur`)

| Field | Shown | Empty means |
|---|---|---|
| `photo` | Home hero, next to the name; round, 1:1 crop, decorative (`alt=""`, the name is beside it) | No photo (today's hero) |
| `logo` | Replaces the name text in the site header; `alt` = profile `name` | Name as text (today's header) |
| `favicon` | `<link rel="icon">` on every page | `withBase('/favicon.svg')` (today's icon) |
| `banner` | Full-bleed image behind the home hero (text and reel), with a fixed dark scrim that fades into the page background | Plain hero (today's) |
| `background.image` | Fixed full-viewport layer behind every page, blurred and darkened | Plain `--bg` colour (today's) |
| `background.darken` | Opacity, 0–100 %, of a `#08080b` overlay over the background image | 70 when a background image is set |
| `background.blur` | CSS blur radius, 0–40 px | 12 when a background image is set |

- Every image source and `darken`/`blur` are optional; each empty field renders exactly today's look. Adding the group is not a breaking change: no version bump, no migration.
- **Image source per field**: None, Upload or Link, one at a time (the selector); None = empty.
- **Uploads**: Keystatic stores each field's upload in its own folder, `src/assets/site/<field>/` (`photo`, `logo`, `favicon`, `banner`, `background`), and writes the path relative to `src/data/` (`../assets/site/<field>/<name>.<ext>`). The build resolves it to a local file under `src/assets/site/` or `src/assets/shared/` (the duplicate resolver may move it there and rewrite the path); any other location, a missing file, or an extension other than `png`, `jpg`, `jpeg`, `webp`, `avif`, `gif`, `svg` fails the build naming the field and path. Uploads go through `astro:assets` like other images. `favicon` uploads: `svg` or `png` only (`.ico` is not supported).
- **URLs are used directly** — the one exception to "no hotlinked media" (decision 2026-10-29 "Site appearance"). The URL is emitted as-is in `<img src>`, `<link href>` or CSS `url("…")`; it never goes through `astro:assets` (no `image.domains` / `remotePatterns`), and neither the build nor any script fetches it. Validation is syntax only: `https:` scheme, and none of `"`, `'`, `(`, `)`, `\`, `<`, `>` or whitespace (they could break out of the CSS string or attribute); an invalid URL fails the build. A URL that is unreachable, expired or not an image never fails the build; the page degrades as follows: `background` and `banner` (CSS backgrounds) show today's look under the overlay/scrim; `photo` leaves an empty round slot; `logo` falls back to the browser's alt text (the name); `favicon` falls back to the browser's default icon. No client-side JS is added for fallbacks.
- **Dark look**: when `background` or `banner` resolves to an image, the page uses the dark palette regardless of `prefers-color-scheme`, so the art shows blurred and darkened in its own colours and text stays on dark. No default background or banner image ships.
- `darken` and `blur` are integers; out of range fails the build; ignored when `background` has no image.
- **Drafts and duplicates**: files under `src/assets/site/` are referenced from `src/data/profile.json`, a non-entry source file, so the asset file rule always makes them committable ("Drafts stay out of git"); `site/` is not a slug folder and the `work` slug `site` is reserved. They are in the duplicate resolver's scope like any `src/assets/` file. A replaced upload left unreferenced gets the usual `WARNING`.
