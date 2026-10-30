import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

function scalar(value: string): string {
  let result = value.replace(/\s#.*$/, '').trim();
  const quote = result[0];
  if (result.length >= 2 && (quote === '"' || quote === "'") && result.endsWith(quote)) {
    result = result.slice(1, -1);
  }
  return result;
}

function draftWorkSlugs(): Set<string> {
  const dir = path.join(process.cwd(), 'src', 'content', 'work');
  const slugs = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(dir, { recursive: true }) as string[];
  } catch {
    return slugs;
  }
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const lines = readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/);
    if (lines[0] !== '---') continue;
    let draft = '';
    let slug = '';
    for (const line of lines.slice(1)) {
      if (line === '---') break;
      if (line.startsWith('draft:')) draft = scalar(line.slice('draft:'.length));
      else if (line.startsWith('slug:')) slug = scalar(line.slice('slug:'.length));
    }
    if (draft.toLowerCase() === 'true') slugs.add(slug || path.basename(file, '.md'));
  }
  return slugs;
}

async function assertWorkSlugs(posts: Post[]): Promise<void> {
  const known = new Set<string>((await getCollection('work')).map((w) => w.id));
  for (const slug of draftWorkSlugs()) known.add(slug);
  const unknown: string[] = [];
  for (const post of posts) {
    for (const slug of post.data.work) {
      if (!known.has(slug)) unknown.push(`  ${post.id}: "${slug}"`);
    }
  }
  if (unknown.length > 0) {
    throw new Error(
      `Blog posts name work slugs that match no work entry (docs/2-content-model.md, "Blog posts"):\n${unknown.join('\n')}`,
    );
  }
}

function byDateThenSlug(a: Post, b: Post): number {
  const diff = b.data.date.getTime() - a.data.date.getTime();
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Blog posts, newest first; drafts only on the dev server.
 * Throws in production when a post names an unknown work slug.
 */
export async function getPosts(): Promise<Post[]> {
  const posts = (await getCollection('blog', (p) => import.meta.env.DEV || !p.data.draft)).sort(byDateThenSlug);
  if (posts.some((p) => p.id === 'page')) {
    throw new Error('Post slug "page" is reserved for blog pagination (docs/3-pages.md); rename the post.');
  }
  if (!import.meta.env.DEV) await assertWorkSlugs(posts);
  return posts;
}

/**
 * List order (docs/2-content-model.md "Post order"): pinned newest first, then the rest newest first; ties by slug.
 * Does not mutate the input.
 */
export function listOrder(posts: Post[]): Post[] {
  const sorted = [...posts].sort(byDateThenSlug);
  return [...sorted.filter((p) => p.data.pinned), ...sorted.filter((p) => !p.data.pinned)];
}

/**
 * Home order (docs/2-content-model.md "Post order"): pinned newest first, then the newest non-pinned featured post, then the rest newest first; no duplicates.
 * Does not mutate the input.
 */
export function homeOrder(posts: Post[]): Post[] {
  const sorted = [...posts].sort(byDateThenSlug);
  const pinned = sorted.filter((p) => p.data.pinned);
  const featured = sorted.find((p) => p.data.featured && !p.data.pinned);
  const rest = sorted.filter((p) => !p.data.pinned && p !== featured);
  return [...pinned, ...(featured ? [featured] : []), ...rest];
}

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
