#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ROOT,
  backfillCovers,
  bandcampItem,
  decode,
  deviantartArt,
  get,
  githubRepo,
  isoDate,
  itchGame,
  knownUrls,
  normalizeUrl,
  writeDraft,
  youtubeVideo,
} from './platforms.mjs';

const profile = JSON.parse(await readFile(join(ROOT, 'src/data/profile.json'), 'utf8'));
const seen = await knownUrls();
const log = [];
let failed = 0;

async function each(items, read) {
  for (const item of items) {
    if (seen.urls.has(normalizeUrl(item.url))) continue;
    try {
      log.push(await writeDraft(await read(item), seen));
    } catch (err) {
      failed++;
      log.push(`fail  ${item.url}: ${err.message}`);
    }
  }
}

async function itchListing(profileUrl) {
  const html = await get(profileUrl);
  const ownHost = new URL(profileUrl).hostname;
  return html
    .split(/class="game_cell\b/)
    .slice(1)
    .map((cell) => {
      const anchor = cell.match(/<a[^>]*class="[^"]*\bgame_link\b[^"]*"[^>]*>[^<]*<\/a>/)?.[0] ?? '';
      const url = anchor.match(/href="([^"]+)"/)?.[1] ?? cell.match(/href="(https:\/\/[^"]+\.itch\.io\/[^"]+)"/)?.[1];
      return {
        url,
        title: decode(anchor.replace(/<[^>]+>/g, '')),
        description: decode(cell.match(/class="game_text"[^>]*>([^<]*)/)?.[1] ?? ''),
        image: cell.match(/data-lazy_src="([^"]+)"/)?.[1] ?? cell.match(/data-background_image="([^"]+)"/)?.[1],
      };
    })
    .filter((g) => g.url && new URL(g.url).hostname === ownHost);
}

async function bandcampListing(profileUrl) {
  const base = new URL(profileUrl).origin;
  const html = await get(`${base}/music`);
  const items = new Map();
  for (const m of html.matchAll(
    /data-item-id="(album|track)-(\d+)"[\s\S]*?href="(\/(?:album|track)\/[^"]+)"[\s\S]*?class="title"[^>]*>\s*([^<]+)/g,
  )) {
    items.set(m[3], { url: base + m[3], type: m[1], id: m[2], title: decode(m[4]) });
  }
  const json = html.match(/data-client-items="([^"]+)"/)?.[1];
  if (json) {
    for (const it of JSON.parse(decode(json))) {
      if (!items.has(it.page_url)) items.set(it.page_url, { url: base + it.page_url, type: it.type, id: it.id, title: it.title });
    }
  }
  return [...items.values()];
}

async function deviantartListing(profileUrl) {
  const user = new URL(profileUrl).hostname.split('.')[0] === 'www'
    ? new URL(profileUrl).pathname.split('/')[1]
    : new URL(profileUrl).hostname.split('.')[0];
  const items = [];
  for (let offset = 0; offset < 600; offset += 60) {
    const xml = await get(`https://backend.deviantart.com/rss.xml?q=gallery:${user}&offset=${offset}`);
    const page = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => ({
      url: it.match(/<link>([^<]+)<\/link>/)?.[1],
      title: decode(it.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''),
      started: isoDate(it.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]),
      image: it.match(/<media:content[^>]+url="([^"]+)"/)?.[1],
    }));
    items.push(...page.filter((i) => i.url));
    if (page.length < 60) break;
  }
  return items;
}

async function githubListing(profileUrl) {
  const user = new URL(profileUrl).pathname.split('/')[1];
  const repos = await get(`https://api.github.com/users/${user}/repos?per_page=100&type=owner`, 'json');
  const list = repos.filter((r) => r.name.toLowerCase() !== user.toLowerCase());
  return Promise.all(
    list.map(async (r) => ({ url: r.html_url, repo: r.fork ? await get(r.url, 'json') : r })),
  );
}

async function youtubeListing(profileUrl) {
  const html = await get(profileUrl);
  const channel = html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/)?.[1] ?? html.match(/channel\/(UC[\w-]{22})/)?.[1];
  if (!channel) throw new Error('channel id not found');
  const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel}`);
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    url: `https://www.youtube.com/watch?v=${e.match(/<yt:videoId>([^<]+)/)?.[1]}`,
    title: decode(e.match(/<title>([^<]*)/)?.[1] ?? ''),
    started: isoDate(e.match(/<published>([^<]+)/)?.[1]),
  }));
}

async function attachSource(repo) {
  if (!repo.homepage) return false;
  const target = normalizeUrl(repo.homepage);
  const { readdir } = await import('node:fs/promises');
  const dir = join(ROOT, 'src/content/work');
  for (const file of await readdir(dir)) {
    const path = join(dir, file);
    const text = await readFile(path, 'utf8');
    const urls = [...text.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => normalizeUrl(m[0]));
    if (!urls.includes(target)) continue;
    const link = `  - label: "Source code"\n    type: "source"\n    url: ${JSON.stringify(repo.html_url)}`;
    const next = /^links: \[\]$/m.test(text) ? text.replace(/^links: \[\]$/m, `links:\n${link}`) : text.replace(/^links:$/m, `links:\n${link}`);
    await writeFile(path, next);
    seen.urls.add(normalizeUrl(repo.html_url));
    log.push(`link  ${repo.name} -> ${file}`);
    return true;
  }
  return false;
}

const sources = [];
for (const { url } of profile.links) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host.endsWith('.itch.io')) sources.push(['itch', url]);
  else if (host.endsWith('.bandcamp.com')) sources.push(['bandcamp', url]);
  else if (host.endsWith('deviantart.com')) sources.push(['deviantart', url]);
  else if (host === 'github.com') sources.push(['github', url]);
  else if (host === 'youtube.com') sources.push(['youtube', url]);
  else if (host === 'soundcloud.com') log.push('note  SoundCloud has no public listing; add tracks with `npm run add -- <track url>`.');
}
sources.sort(([a], [b]) => (a === 'github') - (b === 'github'));

for (const [platform, url] of sources) {
  try {
    if (platform === 'itch') await each(await itchListing(url), (g) => itchGame(g.url, g));
    if (platform === 'bandcamp') await each(await bandcampListing(url), (b) => bandcampItem(b.url, b));
    if (platform === 'deviantart') await each(await deviantartListing(url), (d) => deviantartArt(d.url, d));
    if (platform === 'youtube') await each(await youtubeListing(url), (v) => youtubeVideo(v.url, v));
    if (platform === 'github') {
      for (const { url: repoUrl, repo } of await githubListing(url)) {
        if (seen.urls.has(normalizeUrl(repoUrl)) || (await attachSource(repo))) continue;
        try {
          log.push(await writeDraft(githubRepo(repo), seen));
        } catch (err) {
          failed++;
          log.push(`fail  ${repoUrl}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    failed++;
    log.push(`fail  ${platform} listing ${url}: ${err.message}`);
  }
}

try {
  log.push(...(await backfillCovers()));
} catch (err) {
  log.push(`fail  covers: ${err.message}`);
}

console.log(log.length ? log.join('\n') : 'Nothing new.');
console.log('\nReview drafts in /keystatic (or `npm run dev`): set contribution, roles, authorship, then untick Draft.');
process.exit(failed ? 1 : 0);
