# 4. Media rendering per kind

| Kind | Component |
|---|---|
| Images (2D, screenshots) | `cover` + `gallery` → gallery + lightbox |
| 3D | Screenshots in `gallery` (textures, wireframe, rig, poses); turntables as `video`. No in-browser 3D viewer: it cannot show texturing, topology or rigging work |
| Spine | Spine Web Player (live, not GIF). `src` = skeleton `.json` in `public/`, with the `.atlas` of the same name beside it |
| Music | SoundCloud embed (track URL), Bandcamp `EmbeddedPlayer` URL, or own file with native `<audio>` |
| Video | YouTube/Vimeo embed |
| Playable | Unity WebGL build or itch.io embed |
