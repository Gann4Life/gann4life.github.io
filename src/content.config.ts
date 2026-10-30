import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  AUTHORSHIP,
  CONTEXTS,
  IMPLEMENTATION_ROLES,
  KINDS,
  LINK_TYPES,
  MEDIA_TYPES,
  ORIGINS,
  ROLES,
  STATUSES,
  TEAMS,
} from './vocab';

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
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        slug: z
          .string()
          .min(1)
          .refine(
            (s) => s !== 'c' && s !== 't' && s !== 'site',
            'Slugs "c" (category pages), "t" (tool pages) and "site" (appearance images) are reserved.',
          )
          .optional(),
        kind: z.enum(KINDS),
        context: z.enum(CONTEXTS).default('personal'),
        position: z.string().default(''),
        roles: z.array(z.enum(ROLES)).default([]),
        authorship: z.enum(AUTHORSHIP),
        origin: z.enum(ORIGINS),
        upstream: z.union([z.url(), z.literal('')]).default(''),
        team: z.enum(TEAMS),
        credits: z
          .array(
            z.object({
              name: z.string().min(1),
              role: z.string().min(1),
              url: z.url().optional(),
            }),
          )
          .default([]),
        contribution: z.string().default(''),
        status: z.enum(STATUSES),
        started: z.coerce.date(),
        featured: z.boolean(),
        draft: z.boolean().default(false),
        tools: z.array(z.string()).default([]),
        cover: image().optional(),
        gallery: z
          .array(
            z.object({
              image: image(),
              caption: z.string().default(''),
            }),
          )
          .default([]),
        media: z
          .array(
            z.object({
              type: z.enum(MEDIA_TYPES),
              src: z.string().min(1),
              caption: z.string().default(''),
            }),
          )
          .default([]),
        links: z
          .array(
            z.object({
              label: z.string().default(''),
              type: z.enum(LINK_TYPES).default('other'),
              url: z.url(),
            }),
          )
          .default([]),
        usedIn: z.array(z.string()).default([]),
      })
      .superRefine((entry, ctx) => {
        if (entry.authorship === 'ai-built') {
          const claimed = entry.roles.filter((role) => IMPLEMENTATION_ROLES.includes(role));
          if (claimed.length > 0) {
            ctx.addIssue({
              code: 'custom',
              path: ['roles'],
              message: `ai-built entries cannot claim ${claimed.join(', ')}; use director, designer, spec-author, technical-direction or maintainer.`,
            });
          }
          if (/develop|programm|coder|engineer/i.test(entry.position)) {
            ctx.addIssue({
              code: 'custom',
              path: ['position'],
              message: 'ai-built entries describe direction/design, e.g. "Director / Designer", not a developer title.',
            });
          }
        }
        if (entry.origin === 'fork') {
          if (!entry.upstream) {
            ctx.addIssue({
              code: 'custom',
              path: ['upstream'],
              message: 'Forks must set `upstream` to the original repository URL.',
            });
          }
          if (entry.credits.length === 0) {
            ctx.addIssue({
              code: 'custom',
              path: ['credits'],
              message: 'Forks must credit the original authors in `credits`.',
            });
          }
        }
      }),
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
