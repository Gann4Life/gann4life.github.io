# 3. Pages

Full-width, image-first site. Text sits over thumbnails; elements cascade in on load; pages cross-fade (CSS view transitions, no JS).

- `/` — banner: name, headline (profile `tagline`), bio and profile links beside the demo reel (profile `reel`). Then category buttons in two bands — **Work** (Games, Animation, Software, Other) and **Hobbies** (Music, Art) — as plain typographic buttons: categories are collections, not items, so they carry no thumbnails. Then Featured, Latest (4:3 thumbnails) and Tools. Only categories with published work appear.
- `/work/c/<category>/` — every work in the category as 4:3 thumbnails with the text over the image. Music releases instead get a compact player each, playable in place.
- `/work/<slug>` — one page per entry: the work first (embed, or cover image), gallery, what I did, description, then links, fork block, credits, tools, related.
- `/blog/` and `/blog/<slug>/` — posts written in `/keystatic` (Blog). The header links to the blog once a post is published.
- `/sitemap.xml`, `/robots.txt`, `/404.html`.
- `/keystatic` — CMS (dev server only, not linked publicly).
- No other top-level paths: other repos publish under this domain (e.g. `/RagAssembler2D/`), so v3 must not create routes that shadow them. The work slug `c` is reserved.
