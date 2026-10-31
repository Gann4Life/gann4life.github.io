import { getCollection, type CollectionEntry } from 'astro:content';
import { CONTEXT_LABELS, KIND_LABELS, LINK_LABELS } from '../vocab.ts';
export { KIND_LABELS, CONTEXT_LABELS, ROLE_LABELS, STATUS_LABELS } from '../vocab.ts';
import { toolSlug } from './slug.ts';
export { toolSlug } from './slug.ts';

export type Work = CollectionEntry<'work'>;
type Link = Work['data']['links'][number];

/** Work entries, newest first; drafts only on the dev server. */
export async function getWork(): Promise<Work[]> {
  const entries = (await getCollection('work', (e) => import.meta.env.DEV || !e.data.draft)).sort(
    (a, b) => b.data.started.getTime() - a.data.started.getTime(),
  );
  assertToolSlugs(entries);
  return entries;
}


function assertToolSlugs(entries: Work[]): void {
  const spellings = new Map<string, Map<string, string[]>>();
  for (const entry of entries) {
    for (const tool of entry.data.tools) {
      const slug = toolSlug(tool);
      const byName = spellings.get(slug) ?? new Map<string, string[]>();
      const ids = byName.get(tool) ?? [];
      if (!ids.includes(entry.id)) ids.push(entry.id);
      byName.set(tool, ids);
      spellings.set(slug, byName);
    }
  }
  const problems: string[] = [];
  for (const [slug, byName] of spellings) {
    if (slug === '') {
      for (const [name, ids] of byName) problems.push(`  "${name}" has no letters or digits: ${ids.join(', ')}`);
    } else if (byName.size > 1) {
      problems.push(`  "${slug}": ${[...byName].map(([name, ids]) => `"${name}" (${ids.join(', ')})`).join(', ')}`);
    }
  }
  if (problems.length > 0)
    throw new Error(
      `Tool names fail the slug rule (docs/2-content-model.md, "Tool pages"); fix the spelling in the entries:\n${problems.join('\n')}`,
    );
}

/** Tools that have entries, one group per slug, each with its entries (featured first); groups sorted by slug. */
export function toolGroups(entries: Work[]): { slug: string; name: string; entries: Work[] }[] {
  assertToolSlugs(entries);
  const groups = new Map<string, { slug: string; name: string; entries: Work[] }>();
  for (const entry of entries) {
    for (const tool of entry.data.tools) {
      const slug = toolSlug(tool);
      const group = groups.get(slug) ?? { slug, name: tool, entries: [] };
      if (!group.entries.includes(entry)) group.entries.push(entry);
      groups.set(slug, group);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, entries: g.entries.sort((a, b) => Number(b.data.featured) - Number(a.data.featured)) }))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** Home categories (docs/3-pages.md): each groups kinds and has a page at /work/c/<key>/; hobby categories are shown apart from professional work. */
export const CATEGORIES = [
  { key: 'games', label: 'Games', kinds: ['game'], hobby: false, noun: ['game', 'games'] },
  { key: 'animation', label: 'Animation', kinds: ['animation'], hobby: false, noun: ['animation', 'animations'] },
  { key: 'software', label: 'Software', kinds: ['software', 'app', 'web'], hobby: false, noun: ['project', 'projects'] },
  { key: 'music', label: 'Music', kinds: ['music'], hobby: true, noun: ['release', 'releases'] },
  { key: 'art', label: 'Art', kinds: ['art2d', 'art3d'], hobby: true, noun: ['piece', 'pieces'] },
  { key: 'other', label: 'Other', kinds: ['other'], hobby: false, noun: ['item', 'items'] },
] as const satisfies readonly { key: string; label: string; kinds: readonly Work['data']['kind'][]; hobby: boolean; noun: readonly [string, string] }[];

export type Category = (typeof CATEGORIES)[number];

export const categoryOf = (entry: Work): Category =>
  CATEGORIES.find((c) => (c.kinds as readonly string[]).includes(entry.data.kind)) ?? CATEGORIES[CATEGORIES.length - 1];

/** Categories that have entries, each with its entries, featured first. */
export function groupByCategory(entries: Work[]) {
  return CATEGORIES.map((category) => ({
    category,
    entries: entries
      .filter((e) => categoryOf(e).key === category.key)
      .sort((a, b) => Number(b.data.featured) - Number(a.data.featured)),
  })).filter((g) => g.entries.length > 0);
}

/** Line shown over a thumbnail; authorship appears only when AI was involved. */
export function tileMeta(entry: Work, { showKind = true } = {}) {
  const d = entry.data;
  return [
    showKind ? KIND_LABELS[d.kind] : null,
    d.context !== 'personal' ? CONTEXT_LABELS[d.context] : null,
    d.origin === 'fork' ? 'Fork' : null,
    d.authorship === 'ai-built' ? 'AI-built' : d.authorship === 'ai-assisted' ? 'AI-assisted' : null,
    year(entry),
  ]
    .filter(Boolean)
    .join(' · ');
}

export const linkText = (link: Link) => link.label || LINK_LABELS[link.type];

/** Start year, read in UTC (dates are stored as UTC midnight). */
export const year = (entry: Work) => entry.data.started.getUTCFullYear();

/** Site-wide skills: tools of hand-made and ai-assisted entries only, most used first. */
export function skills(entries: Work[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.data.authorship === 'ai-built') continue;
    for (const tool of entry.data.tools) counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tool]) => tool);
}

/** Embed URL for a media src, or null when it renders natively (local file) or only as a link (unknown host, itch.io page). */
export function embedUrl(type: string, src: string): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (type === 'video') {
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const id = url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${url.pathname.split('/').filter(Boolean).pop()}`;
    if (host === 'player.vimeo.com') return src;
  }
  if (type === 'audio') {
    if (host === 'soundcloud.com')
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(src)}&color=%23ff5500&visual=false`;
    if (host === 'w.soundcloud.com') return src;
    if (host === 'bandcamp.com' && url.pathname.startsWith('/EmbeddedPlayer')) return src;
  }
  if (type === 'webgl') {
    if (host.endsWith('.itch.io')) return null;
    return src;
  }
  return null;
}
