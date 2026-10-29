# 3. Pages

Full-width, image-first site. Text sits over thumbnails; tiles cascade in on load; pages cross-fade (CSS view transitions, no JS).

- `/` — name, tagline, bio, skills, then one full-size tile per category (Games, Music, Art, Software, Other) with the cover of its newest/featured work. Only categories with published work appear.
- `/work/c/<category>/` — every work in the category as a masonry of thumbnails at their own aspect ratio (fully visible), title and meta over the image.
- `/work/<slug>` — one page per entry: the work first (embed, or cover image), gallery, what I did, description, then links, fork block, credits, tools, related.
- `/keystatic` — CMS (dev server only, not linked publicly).
- Paths outside `/work/` stay free: other repos publish under this domain (e.g. `/RagAssembler2D/`), so v3 must not create routes that shadow them. The slug `c` is reserved.
