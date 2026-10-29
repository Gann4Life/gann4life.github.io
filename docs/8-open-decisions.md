# 8. Open decisions

## Open

- Single-page home vs separate sections
- Domain name (only worth it to decouple the URL from the repo name)

## Decided

### 2026-10-29 — Draft entries never enter git

- **Decision**: `draft: true` entries (`work` and `blog`) and their asset folders stay local until published. A Node script in `site/scripts/` writes them into a marked block of `.git/info/exclude`; it runs on `predev`, `prebuild` and from a committed pre-commit hook (`.githooks/pre-commit`, `core.hooksPath`) that blocks staging draft files. Publishing = `draft: false`, after which entry and assets are committed together. Asset folders are excluded unless a non-draft file references them; unreferenced folders are excluded and reported.
- **Reason**: the repo is public and the only thing to keep private is unpublished work. Drafts must not reach the public history, not only the built site.
- **Rejected**: a separate drafts folder (breaks the single Keystatic collection path); a second, private source repo (user rejected it for now).
- **Kept**: the build-time draft filter stays as a second guard for local builds.
- **Not part of the spec** (lead tasks): `git rm --cached` of the 12 draft entries already tracked on the unpushed `astro-rewrite`, and history cleanup before the first push.
- **Affects**: [section 2](2-content-model.md) "Drafts stay out of git" and the `draft` field; [section 1](1-stack.md) admin notes.
