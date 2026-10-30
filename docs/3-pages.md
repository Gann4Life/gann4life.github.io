# 3. Pages

Full-width, image-first site. On thumbnails the text only appears on hover/focus (always shown on touch screens, which cannot hover); elements cascade in on load; pages cross-fade (CSS view transitions, no JS).

- `/` — banner: name, headline (profile `tagline`), bio and profile links beside the demo reel (profile `reel`). Then category buttons in two bands — **Work** (Games, Animation, Software, Other) and **Hobbies** (Music, Art) — as plain typographic buttons: categories are collections, not items, so they carry no thumbnails. Then Featured, Latest (4:3 thumbnails) and Tools. Only categories with published work appear.
- `/work/c/<category>/` — every work in the category as 4:3 thumbnails with the text over the image. Music releases instead get a compact player each, playable in place.
- `/work/<slug>` — one page per entry: the work first (embed, or cover image), gallery, what I did, description, then links, fork block, credits, tools, related.
- `/blog/` and `/blog/<slug>/` — posts written in `/keystatic` (Blog); fields in [section 2](2-content-model.md) "Blog posts". The header links to the blog once a post is published.
- `/sitemap.xml`, `/robots.txt`, `/404.html`.
- `/service-worker.js` — self-unregistering worker that removes v2's; never registered by v3 ([section 1](1-stack.md) "Retired v2 service worker").
- `/keystatic` — CMS (dev server only, not linked publicly).
- No other top-level paths: other repos publish under this domain (e.g. `/RagAssembler2D/`), so v3 must not create routes that shadow them. The work slug `c` is reserved. `/dev/` is reserved for the staging build ([section 1](1-stack.md)), so no repo of this account may be named `dev` with Pages enabled.

**Base-path rule** (links and asset URLs)

The same build runs at `/` (production) and `/dev/` (staging), so no URL may assume the site sits at the domain root.

- Every internal link and every URL to a site file (pages, `public/` files such as `favicon.svg`, `sitemap.xml`, OG images) goes through one helper: `withBase(path)` in `src/lib/paths.ts`. It takes a site-relative path (`/work/x/`, `work/x/` or `/`) and returns it prefixed with `import.meta.env.BASE_URL`, with exactly one `/` between base and path and the trailing slash of `path` preserved. It is the only place in `src/` that reads `BASE_URL`.
- Absolute URLs (canonical, `og:url`, `og:image`, sitemap entries) are built as `new URL(withBase(path), Astro.site)`. A path taken from `Astro.url.pathname` already includes the base and is not passed through `withBase` again.
- Active-link checks compare `Astro.url.pathname` against `withBase(...)`, never against a bare `/…` literal.
- Images imported through `astro:assets` already get the base from Astro and need no helper.
- Markdown bodies in `work` and `blog` contain no root-absolute internal links (`](/…)`); related entries go through the `usedIn` (`work`) / `work` (`blog`) fields.
- External URLs (`https://…`) and protocol-relative URLs are untouched.
- **Check** (for `design-auditor`): in `src/**/*.{astro,ts,tsx,js,mjs,md,mdx}`, outside `src/lib/paths.ts`, no match for `(href|src|action|content)=["']/[^/]`, for a JSX/template expression whose string or template literal starts with a single `/` and is used as a URL (e.g. ``href={`/work/``, `href={'/blog/'}`, `new URL('/x', …)`), or for `](/` followed by a non-`/` character in Markdown. Any match is a blocking finding. Also: `npm run build` with `DEPLOY_TARGET=staging` and every `href`/`src` in `dist/` that starts with `/` starts with `/dev/`.
