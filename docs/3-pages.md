# 3. Pages

- `/` — hero (who I am, roles), featured strip, filterable grid (by role, kind and context), contact/socials from the profile.
- `/work/<slug>` — one page per entry, reached by clicking its card; layout adapts to `kind`. Shows cover, gallery, media, links, contribution, credits and `usedIn`.
- Paths outside `/work/` stay free: other repos publish under this domain (e.g. `/ragassembler2d`), so v3 must not create routes that shadow them.
- `/about` — optional, could live on home.
- `/keystatic` — CMS (not linked publicly).
