#!/usr/bin/env node
/*
 * npm run add -- <url> [<url> ...] [--force]
 *
 * Creates a draft `work` entry per URL from itch.io, Bandcamp, SoundCloud,
 * YouTube, DeviantArt or GitHub: title, date, cover image (downloaded into
 * src/assets/<slug>/), and the resolved embed. docs/2-content-model.md,
 * docs/4-media.md.
 *
 * The platforms are read once, here, and snapshotted into the repo; the site
 * never calls them at build time (AGENTS.md rule 4). Everything is a draft
 * with an empty `contribution`: review it in /keystatic before publishing.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontmatter } from './frontmatter.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORK_DIR = join(ROOT, 'src/content/work');
const ASSETS_DIR = join(ROOT, 'src/assets');
const UA = { 'user-agent': 'Mozilla/5.0 (portfolio importer)' };

const args = process.argv.slice(2);
const force = args.includes('--force');
const urls = args.filter((a) => !a.startsWith('--'));

if (urls.length === 0) {
  console.log('Usage: npm run add -- <url> [<url> ...] [--force]');
  process.exit(1);
}

const slugify = (s) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

const decode = (s = '') =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const meta = (html, name) =>
  decode(
    html.match(new RegExp(`<meta[^>]+(?:property|name)="${name}"[^>]+content="([^"]*)"`, 'i'))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${name}"`, 'i'))?.[1] ??
      '',
  );

const isoDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return as === 'json' ? res.json() : as === 'raw' ? res : res.text();
}

/* ---------- platforms: each returns a partial entry ---------- */

async function itch(url) {
  const html = await get(url);
  const upload = html.match(/(?:html-classic\.itch\.zone|hwcdn\.net|itch\.zone)\/html\/(\d+)/)?.[1];
  const published = html.match(/Published<\/td>\s*<td><abbr title="([^"@]+)/)?.[1];
  return {
    title: meta(html, 'og:title').replace(/ by .+$/, ''),
    description: meta(html, 'og:description'),
    image: meta(html, 'og:image'),
    started: isoDate(published),
    kind: 'game',
    roles: ['programmer'],
    media: upload ? [{ type: 'webgl', src: `https://itch.io/embed-upload/${upload}?color=000000` }] : [],
    links: [{ label: 'itch.io page', type: upload ? 'play' : 'download', url }],
  };
}

async function bandcamp(url) {
  const html = await get(url);
  const props = JSON.parse(meta(html, 'bc-page-properties') || '{}');
  const isAlbum = props.item_type === 'a';
  const date = html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1];
  const media = props.item_id
    ? [
        {
          type: 'audio',
          src: `https://bandcamp.com/EmbeddedPlayer/${isAlbum ? 'album' : 'track'}=${props.item_id}/size=large/bgcol=333333/linkcol=0f91ff/tracklist=${isAlbum}/artwork=small/transparent=true/`,
        },
      ]
    : [];
  return {
    title: meta(html, 'og:title').replace(/, by .+$/, ''),
    description: meta(html, 'og:description'),
    image: meta(html, 'og:image'),
    started: isoDate(date),
    kind: 'music',
    roles: ['musician'],
    media,
    links: [{ label: 'Bandcamp', type: 'listen', url }],
  };
}

async function soundcloud(url) {
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

async function youtube(url) {
  const o = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, 'json');
  return {
    title: o.title ?? '',
    image: o.thumbnail_url,
    kind: 'other',
    roles: [],
    media: [{ type: 'video', src: url }],
    links: [{ label: 'YouTube', type: 'watch', url }],
  };
}

async function deviantart(url) {
  const o = await get(`https://backend.deviantart.com/oembed?url=${encodeURIComponent(url)}`, 'json');
  return {
    title: o.title ?? '',
    image: o.url ?? o.thumbnail_url,
    started: isoDate(o.pubdate),
    kind: 'art2d',
    roles: ['artist'],
    context: /commission|comission/i.test(o.title ?? '') ? 'commission' : 'personal',
    media: [],
    links: [{ label: 'DeviantArt', type: 'other', url }],
  };
}

async function github(url) {
  const [, owner, repo] = new URL(url).pathname.split('/');
  const r = await get(`https://api.github.com/repos/${owner}/${repo}`, 'json');
  const links = [{ type: 'source', url: r.html_url }];
  if (r.homepage) links.unshift({ label: 'Website / demo', type: 'play', url: r.homepage });
  return {
    title: r.name,
    description: r.description ?? '',
    started: isoDate(r.created_at),
    kind: 'software',
    roles: ['programmer'],
    tools: r.language ? [r.language] : [],
    origin: r.fork ? 'fork' : 'original',
    upstream: r.fork ? r.parent?.html_url ?? '' : '',
    credits: r.fork && r.parent ? [{ name: r.parent.owner.login, role: 'Original author', url: r.parent.owner.html_url }] : [],
    media: [],
    links,
  };
}

async function generic(url) {
  const html = await get(url);
  return {
    title: meta(html, 'og:title') || decode(html.match(/<title>([^<]*)/)?.[1] ?? ''),
    description: meta(html, 'og:description'),
    image: meta(html, 'og:image'),
    kind: 'other',
    roles: [],
    media: [],
    links: [{ type: 'other', url }],
  };
}

function platform(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host.endsWith('itch.io')) return itch;
  if (host.endsWith('bandcamp.com')) return bandcamp;
  if (host === 'soundcloud.com') return soundcloud;
  if (host === 'youtube.com' || host === 'youtu.be') return youtube;
  if (host.endsWith('deviantart.com')) return deviantart;
  if (host === 'github.com') return github;
  return generic;
}

/* ---------- output ---------- */

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

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

let failed = 0;
for (const url of urls) {
  try {
    const data = await platform(url)(url);
    if (!data.title) throw new Error('no title found');
    const slug = slugify(data.title);
    const file = join(WORK_DIR, `${slug}.md`);
    if (!force && (await exists(file))) {
      console.log(`skip  ${slug} (exists; --force to overwrite)`);
      continue;
    }
    const cover = await downloadCover(data.image, slug).catch(() => null);
    const missing = [];
    if (!data.started) missing.push('date');
    if (!cover) missing.push('cover');
    if (data.media.length === 0 && ['game', 'music'].includes(data.kind)) missing.push('embed');
    await writeFile(
      file,
      frontmatter({ ...data, slug, cover, started: data.started ?? new Date().toISOString().slice(0, 10) }),
    );
    console.log(`draft ${slug}${missing.length ? `  (missing: ${missing.join(', ')})` : ''}`);
  } catch (err) {
    failed++;
    console.error(`fail  ${url}: ${err.message}`);
  }
}

console.log('\nReview drafts in /keystatic: set contribution, roles, authorship, then untick Draft.');
process.exit(failed ? 1 : 0);
