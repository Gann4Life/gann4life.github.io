import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { schemaFor } from './lib/content-schema.ts';

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
  schema: ({ image }) => schemaFor('work', image),
});

const blog = defineCollection({
  loader: withoutDrafts(glob({ pattern: '**/*.md', base: './src/content/blog' })),
  schema: ({ image }) => schemaFor('blog', image),
});

export const collections = { work, blog };
