# 4. Media rendering

The work is the page: embeds and images come first, links after.

| Source | How it shows | `media` / field |
|---|---|---|
| itch.io HTML5 game | Playable in the page | `webgl`, `https://itch.io/embed-upload/<id>` (resolved by `npm run add`) |
| itch.io download-only game | Cover + link to the page | `cover`, `links` |
| Bandcamp album/track | Bandcamp player with tracklist | `audio`, `https://bandcamp.com/EmbeddedPlayer/...` (resolved by `npm run add`) |
| SoundCloud track | SoundCloud player | `audio`, track URL as-is |
| Own audio file | Native `<audio>` | `audio`, path in `public/` |
| YouTube / Vimeo | Video player (youtube-nocookie) | `video`, video URL as-is |
| DeviantArt / any 2D art | Image downloaded into the repo, gallery + lightbox | `cover`, `gallery` |
| 3D | Screenshots in `gallery` (textures, wireframe, rig, poses); turntables as `video`. No in-browser 3D viewer: it cannot show texturing, topology or rigging work | `gallery`, `video` |
| Spine | Rendered video (YouTube embed or own file). No live Spine player: anything a browser can play — skeleton, atlas, textures — can be downloaded and reused, so rigs are never published | `video` |
| Own WebGL build | Iframe | `webgl`, path in `public/` or URL |
| GitHub repo | Cover/description + source link | `links` |
