# 4. Media rendering

The work is the page: embeds and images come first, links after.

| Source | How it shows | `media` / field |
|---|---|---|
| itch.io HTML5 game | Playable in the page | `webgl`, `https://itch.io/embed-upload/<id>` (resolved by `npm run add`) |
| itch.io download-only game | Cover + link to the page | `cover`, `links` |
| Bandcamp album/track | Bandcamp player with tracklist | `audio`, `https://bandcamp.com/EmbeddedPlayer/...` (resolved by `npm run add`) |
| SoundCloud track | SoundCloud player | `audio`, track URL as-is |
| Own audio file | Native `<audio>` | `audio`, site-relative path in `public/media/<slug>/` |
| YouTube / Vimeo | Video player (youtube-nocookie) | `video`, video URL as-is |
| DeviantArt / any 2D art | Image downloaded into the repo, gallery + lightbox | `cover`, `gallery` |
| 3D | Screenshots in `gallery` (textures, wireframe, rig, poses); turntables as `video`. No in-browser 3D viewer: it cannot show texturing, topology or rigging work | `gallery`, `video` |
| Spine | Rendered video (YouTube embed or own file). No live Spine player: anything a browser can play — skeleton, atlas, textures — can be downloaded and reused, so rigs are never published | `video` |
| Own WebGL build | Iframe | `webgl`, path in `public/webgl/<slug>/` or URL |

**Where local media lives**
- Images: `src/assets/` (imported through `astro:assets`), one folder per entry: `src/assets/<slug>/` for work, `src/assets/blog/<slug>/` for posts. Keystatic and the in-site editor both upload there; the editor accepts PNG, JPEG, WebP, AVIF and GIF up to 10 MB, names files `<name>-<12 hex of SHA-256>.<ext>` and deletes a replaced or removed image only when it sits in that folder and nothing else references it ([section 1](1-stack.md) "In-site editor").
- Gallery captions double as the images' alt text; covers are decorative (`alt=""`).
- Files served as-is (own audio, video, PDFs): `public/media/<slug>/`, referenced as `/media/<slug>/<file>` through `withBase` ([section 3](3-pages.md)).
- WebGL builds: `public/webgl/<slug>/`, one folder per build, left untouched by the duplicate resolver.
- Site appearance uploads (photo, logo, favicon, banner, background): `src/assets/site/<field>/`. Appearance fields may instead hold an external `https://` URL, used directly and never downloaded: the only hotlinked media on the site ([section 2](2-content-model.md) "Site appearance"); reachability is reported by the remote URL check ([section 1](1-stack.md)).
- Files under `src/assets/` and `public/media/` follow the per-file draft rule and the duplicate resolver ([section 2](2-content-model.md) "Drafts stay out of git", "Duplicate media files"); identical files end up once in `src/assets/shared/` or `public/media/shared/`.
| GitHub repo | Cover/description + source link | `links` |
