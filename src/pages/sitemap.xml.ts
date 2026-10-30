import type { APIRoute } from 'astro';
import { getWork, groupByCategory } from '../lib/work';
import { getPosts } from '../lib/blog';
import { withBase } from '../lib/paths';

export const GET: APIRoute = async ({ site }) => {
  const work = await getWork();
  const posts = await getPosts();
  const paths = [
    '/',
    ...groupByCategory(work).map((g) => `/work/c/${g.category.key}/`),
    ...work.map((e) => `/work/${e.id}/`),
    ...(posts.length > 0 ? ['/blog/', ...posts.map((p) => `/blog/${p.id}/`)] : []),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${new URL(withBase(p), site)}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
