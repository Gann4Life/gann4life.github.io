import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
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

/*
 * `work` collection schema — docs/2-content-model.md, field-for-field.
 * Enums are closed (src/vocab.ts): filtering depends on a fixed vocabulary.
 */

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        // Optional: the file name is the slug (entry.id). Older files still carry it.
        // `c` is taken by the category pages at /work/c/<category>/.
        slug: z
          .string()
          .min(1)
          .refine((s) => s !== 'c', 'Slug "c" is reserved for category pages.')
          .optional(),
        kind: z.enum(KINDS),
        context: z.enum(CONTEXTS).default('personal'),
        // Free-text title actually held, e.g. on someone else's project.
        position: z.string().default(''),
        roles: z.array(z.enum(ROLES)).default([]),
        authorship: z.enum(AUTHORSHIP),
        origin: z.enum(ORIGINS),
        // Empty for original work; required for forks (enforced below).
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
        // Required once published; drafts from the importer start empty.
        contribution: z.string().default(''),
        status: z.enum(STATUSES),
        started: z.coerce.date(),
        featured: z.boolean(),
        // Drafts show on the dev server only and never ship.
        draft: z.boolean().default(false),
        tools: z.array(z.string()).default([]),
        // Local image only: docs/1-stack.md keeps images in the repo and
        // rule 6 forbids hotlinked media.
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
              // Embed URL or a local path in public/ (e.g. an MP4).
              src: z.string().min(1),
              caption: z.string().default(''),
            }),
          )
          .default([]),
        // All optional, any mix: `type` picks icon and default label,
        // `label` overrides the text.
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
        if (!entry.draft && !entry.contribution.trim()) {
          ctx.addIssue({
            code: 'custom',
            path: ['contribution'],
            message: 'Published entries need `contribution`: what I actually did.',
          });
        }
        // docs/2-content-model.md, "AI-built (vibe-coded) projects": the
        // generated part is never claimed as implementation work.
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
        // docs/2-content-model.md, "Forks": upstream link plus credit to the
        // original authors. Both are honesty requirements, not new fields.
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

/*
 * `blog` collection — devlogs and posts, written in /keystatic.
 * One file per post: src/content/blog/<slug>.md.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      // Optional: the file name is the slug (entry.id).
      slug: z.string().min(1).optional(),
      date: z.coerce.date(),
      summary: z.string().default(''),
      cover: image().optional(),
      // Slugs of related `work` entries, linked at the end of the post.
      work: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

export const collections = { work, blog };
