import { getCollection, type CollectionEntry } from 'astro:content';
import { LINK_LABELS } from '../vocab';

export type Work = CollectionEntry<'work'>;
type Link = Work['data']['links'][number];

// Newest first; featured order follows the same rule. Drafts only on the dev server.
export async function getWork(): Promise<Work[]> {
  return (await getCollection('work', (e) => import.meta.env.DEV || !e.data.draft)).sort(
    (a, b) => b.data.started.getTime() - a.data.started.getTime(),
  );
}

/*
 * Home categories (docs/3-pages.md): each groups one or more kinds and has a
 * page at /work/c/<key>/. Only categories with entries are shown.
 */
// `hobby` categories are shown apart from professional work on the home page.
export const CATEGORIES = [
  { key: 'games', label: 'Games', kinds: ['game'], hobby: false },
  { key: 'animation', label: 'Animation', kinds: ['animation'], hobby: false },
  { key: 'software', label: 'Software', kinds: ['software', 'app', 'web'], hobby: false },
  { key: 'music', label: 'Music', kinds: ['music'], hobby: true },
  { key: 'art', label: 'Art', kinds: ['art2d', 'art3d'], hobby: true },
  { key: 'other', label: 'Other', kinds: ['other'], hobby: false },
] as const satisfies readonly { key: string; label: string; kinds: readonly Work['data']['kind'][]; hobby: boolean }[];

export type Category = (typeof CATEGORIES)[number];

export const categoryOf = (entry: Work): Category =>
  CATEGORIES.find((c) => (c.kinds as readonly string[]).includes(entry.data.kind)) ?? CATEGORIES[CATEGORIES.length - 1];

// Categories that have entries, each with its entries (newest first, featured first).
export function groupByCategory(entries: Work[]) {
  return CATEGORIES.map((category) => ({
    category,
    entries: entries
      .filter((e) => categoryOf(e).key === category.key)
      .sort((a, b) => Number(b.data.featured) - Number(a.data.featured)),
  })).filter((g) => g.entries.length > 0);
}

// Line shown over a thumbnail. Authorship is flagged only when AI was involved.
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

// Dates are stored as UTC midnight, so read the year in UTC.
export const year = (entry: Work) => entry.data.started.getUTCFullYear();

export const KIND_LABELS: Record<Work['data']['kind'], string> = {
  software: 'Software',
  game: 'Game',
  app: 'App',
  web: 'Web',
  art2d: '2D art',
  art3d: '3D',
  animation: 'Animation',
  music: 'Music',
  other: 'Other',
};

export const CONTEXT_LABELS: Record<Work['data']['context'], string> = {
  personal: 'Personal',
  commission: 'Commission',
  client: 'Client',
  job: 'Job',
  jam: 'Game jam',
  study: 'Study',
};

export const ROLE_LABELS: Record<Work['data']['roles'][number], string> = {
  programmer: 'Programmer',
  animator: 'Animator',
  artist: 'Artist',
  director: 'Director',
  designer: 'Designer',
  'spec-author': 'Spec author',
  'technical-direction': 'Technical direction',
  maintainer: 'Maintainer',
  musician: 'Musician',
};

export const STATUS_LABELS: Record<Work['data']['status'], string> = {
  released: 'Released',
  'in-development': 'In development',
  archived: 'Archived',
};

/*
 * Site-wide skills: tools from hand-made and ai-assisted entries only
 * (docs/2-content-model.md). ai-built tools never count. Most used first.
 */
export function skills(entries: Work[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.data.authorship === 'ai-built') continue;
    for (const tool of entry.data.tools) counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tool]) => tool);
}

/*
 * Embed URL for a media src, or null when it should render natively
 * (local file) or only as a link (unknown host).
 */
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
    // Bandcamp only embeds through its EmbeddedPlayer URL ("Share/Embed" on the album page).
    if (host === 'bandcamp.com' && url.pathname.startsWith('/EmbeddedPlayer')) return src;
  }
  if (type === 'webgl') {
    // itch.io pages cannot be framed; `npm run add` stores the embed-upload URL.
    if (host.endsWith('.itch.io')) return null;
    return src;
  }
  return null;
}
