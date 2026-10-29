import { getCollection, type CollectionEntry } from 'astro:content';
import { LINK_LABELS } from '../vocab';

export type Work = CollectionEntry<'work'>;
type Link = Work['data']['links'][number];

// Newest first; featured order follows the same rule.
export async function getWork(): Promise<Work[]> {
  return (await getCollection('work')).sort((a, b) => b.data.started.getTime() - a.data.started.getTime());
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
  if (type === 'webgl') return src;
  return null;
}
