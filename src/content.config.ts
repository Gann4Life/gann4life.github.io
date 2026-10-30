import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { workSchema } from './lib/work-schema';

const keepDrafts = import.meta.env.DEV;
function withoutDrafts(loader: Loader, { needsContribution = false } = {}): Loader {
  return {
    ...loader,
    name: `${loader.name}-without-drafts`,
    load: async (context) => {
      await loader.load(context);
      if (keepDrafts) return;
      for (const [id, entry] of context.store.entries()) {
        if (entry.data.draft === true) {
          context.store.delete(id);
        } else if (needsContribution && !String(entry.data.contribution ?? '').trim()) {
          context.logger.warn(`${id}: published without "What I did" (contribution); left out of the build until it is filled in.`);
          context.store.delete(id);
        }
      }
    },
  };
}

const work = defineCollection({
  loader: withoutDrafts(glob({ pattern: '**/*.md', base: './src/content/work' }), { needsContribution: true }),
  schema: ({ image }) => workSchema(image),
});

const blog = defineCollection({
  loader: withoutDrafts(glob({ pattern: '**/*.md', base: './src/content/blog' })),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      slug: z.string().min(1).refine((s) => s !== 'page', 'Slug "page" is reserved (blog pagination).').optional(),
      date: z.coerce.date(),
      summary: z.string().default(''),
      cover: image().optional(),
      work: z.array(z.string()).default([]),
      pinned: z.boolean().default(false),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

export const collections = { work, blog };
