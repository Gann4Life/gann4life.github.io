/*
 * Platform readers shared by `npm run add` and `npm run sync`.
 * docs/2-content-model.md ("Adding work"), docs/4-media.md.
 *
 * Platforms are read once and snapshotted into the repo (AGENTS.md rule 4).
 * Every entry written here is a draft with an empty `contribution`.
 */
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontmatter } from './frontmatter.mjs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORK_DIR = join(ROOT, 'src/content/work');
const ASSETS_DIR = join(ROOT, 'src/assets');

// Some platforms serve a stripped page to unknown clients.
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'accept-language': 'en',
};

/* ---------- helpers ---------- */

export const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

export const decode = (s = '') =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

export const meta = (html, name) =>
  decode(
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)`, 'i'))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i'))?.[1] ??
      '',
  );

const titleTag = (html) => decode(html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '');

export const isoDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

export async function get(url, as = 'text') {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return as === 'json' ? res.json() : as === 'raw' ? res : res.text();
}

/* ---------- single items: URL -> partial entry ---------- */

export async function itchGame(url, known = {}) {
  const html = await get(url);
  const upload = html.match(/(?:html-classic\.itch\.zone|hwcdn\.net|itch\.zone)\/html\/(\d+)/)?.[1];
  const published = html.match(/Published<\/td>\s*<td[^>]*>\s*<abbr title=["']([^"'@]+)/)?.[1];
  return {
    title: known.title || meta(html, 'og:title') || titleTag(html).replace(/ by [^|]+$/, ''),
    description: known.description || meta(html, 'og:description'),
    image: known.image || meta(html, 'og:image'),
    started: isoDate(published),
    kind: 'game',
    roles: ['programmer'],
    media: upload ? [{ type: 'webgl', src: `https://itch.io/embed-upload/${upload}?color=000000` }] : [],
    links: [{ label: 'itch.io page', type: upload ? 'play' : 'download', url }],
  };
}

export async function bandcampItem(url, known = {}) {
  const html = await get(url);
  const props = JSON.parse(decode(meta(html, 'bc-page-properties')) || '{}');
  const type = known.type ?? (props.item_type === 'a' ? 'album' : 'track');
  const id = known.id ?? props.item_id;
  const date = html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1];
  const isAlbum = type === 'album';
  return {
    title: known.title || meta(html, 'og:title').replace(/, by .+$/, ''),
    description: meta(html, 'og:description'),
    image: meta(html, 'og:image') || known.image,
    started: isoDate(date),
    kind: 'music',
    roles: ['musician'],
    media: id
      ? [
          {
            type: 'audio',
            src: `https://bandcamp.com/EmbeddedPlayer/${type}=${id}/size=large/bgcol=333333/linkcol=0f91ff/tracklist=${isAlbum}/artwork=small/transparent=true/`,
          },
        ]
      : [],
    links: [{ label: 'Bandcamp', type: 'listen', url }],
  };
}

export async function soundcloudTrack(url) {
  const o = await get(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`, 'json');
  return {
    title: o.title?.replace(/ by .+$/, '') ?? '',
    description: o.description ?? '',
    image: o.thumbnail_url,
    kind: 'music',
    roles: ['musician'],
    media: [{ type: 'audio', src: url }],
    links: [{ label: 'SoundCloud', type: 'listen', url }],
  };
}

export async function youtubeVideo(url, known = {}) {
  const o = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, 'json');
  return {
    title: o.title ?? known.title ?? '',
    image: o.thumbnail_url?.replace('hqdefault', 'maxresdefault'),
    fallbackImage: o.thumbnail_url,
    started: known.started ?? null,
    kind: 'other',
    roles: [],
    media: [{ type: 'video', src: url }],
    links: [{ label: 'YouTube', type: 'watch', url }],
  };
}

export async function deviantartArt(url, known = {}) {
  const o = await get(`https://backend.deviantart.com/oembed?url=${encodeURIComponent(url)}`, 'json');
  const title = o.title ?? known.title ?? '';
  return {
    title,
    image: o.url ?? known.image ?? o.thumbnail_url,
    started: isoDate(o.pubdate) ?? known.started ?? null,
    kind: 'art2d',
    roles: ['artist'],
    context: /commission|comission/i.test(title) ? 'commission' : 'personal',
    media: [],
    links: [{ label: 'DeviantArt', type: 'other', url }],
  };
}

export function githubRepo(r) {
  const links = [{ type: 'source', url: r.html_url }];
  if (r.homepage) links.unshift({ label: 'Website / demo', type: 'play', url: r.homepage });
  return {
    title: r.name,
    description: r.description ?? '',
    image: `https://opengraph.githubassets.com/1/${r.full_name}`,
    started: isoDate(r.created_at),
    kind: 'software',
    roles: ['programmer'],
    tools: r.language ? [r.language] : [],
    origin: r.fork ? 'fork' : 'original',
    upstream: r.fork ? (r.parent?.html_url ?? '') : '',
    credits:
      r.fork && r.parent ? [{ name: r.parent.owner.login, role: 'Original author', url: r.parent.owner.html_url }] : [],
    media: [],
    links,
  };
}

export async function githubRepoByUrl(url) {
  const [, owner, repo] = new URL(url).pathname.split('/');
  return githubRepo(await get(`https://api.github.com/repos/${owner}/${repo}`, 'json'));
}

export async function genericPage(url) {
  const html = await get(url);
  return {
    title: meta(html, 'og:title') || titleTag(html),
    description: meta(html, 'og:description'),
    image: meta(html, 'og:image'),
    kind: 'other',
    roles: [],
    media: [],
    links: [{ type: 'other', url }],
  };
}

export function readerFor(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host.endsWith('itch.io')) return itchGame;
  if (host.endsWith('bandcamp.com')) return bandcampItem;
  if (host === 'soundcloud.com') return soundcloudTrack;
  if (host === 'youtube.com' || host === 'youtu.be') return youtubeVideo;
  if (host.endsWith('deviantart.com')) return deviantartArt;
  if (host === 'github.com') return githubRepoByUrl;
  return genericPage;
}

/* ---------- writing ---------- */

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

async function downloadCover(src, slug) {
  if (!src) return null;
  const res = await get(src, 'raw');
  const ext = EXT[(res.headers.get('content-type') ?? '').split(';')[0]];
  if (!ext) return null;
  await mkdir(join(ASSETS_DIR, slug), { recursive: true });
  await writeFile(join(ASSETS_DIR, slug, `cover.${ext}`), Buffer.from(await res.arrayBuffer()));
  return `../../assets/${slug}/cover.${ext}`;
}

// Every URL already referenced by an entry, so re-running never duplicates work.
export async function knownUrls() {
  const urls = new Set();
  const slugs = new Set();
  for (const file of await readdir(WORK_DIR)) {
    if (!file.endsWith('.md')) continue;
    slugs.add(file.slice(0, -3));
    const text = await readFile(join(WORK_DIR, file), 'utf8');
    for (const m of text.matchAll(/https?:\/\/[^\s"')]+/g)) urls.add(normalizeUrl(m[0]));
  }
  return { urls, slugs };
}

export const normalizeUrl = (u) => u.replace(/^http:/, 'https:').replace(/\/+$/, '').toLowerCase();

/*
 * Write one draft. Returns a status line. `seen` comes from knownUrls() and is
 * updated so a batch never writes the same work twice.
 */
export async function writeDraft(data, seen, { force = false } = {}) {
  if (!data.title) throw new Error('no title found');
  let slug = slugify(data.title);
  if (seen.slugs.has(slug) && !force) {
    // Same title from another platform (e.g. a game and its repo): keep both, distinct slugs.
    const base = slug;
    for (let n = 2; seen.slugs.has(slug); n++) slug = `${base}-${n}`;
  }
  let cover = await downloadCover(data.image, slug).catch(() => null);
  if (!cover && data.fallbackImage) cover = await downloadCover(data.fallbackImage, slug).catch(() => null);
  const missing = [];
  if (!data.started) missing.push('date');
  if (!cover) missing.push('cover');
  if (data.media.length === 0 && ['game', 'music'].includes(data.kind)) missing.push('embed');
  await writeFile(
    join(WORK_DIR, `${slug}.md`),
    frontmatter({ ...data, slug, cover, started: data.started ?? new Date().toISOString().slice(0, 10) }),
  );
  seen.slugs.add(slug);
  for (const l of data.links) seen.urls.add(normalizeUrl(l.url));
  return `draft ${slug}${missing.length ? `  (missing: ${missing.join(', ')})` : ''}`;
}
