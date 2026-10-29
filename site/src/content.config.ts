import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  AUTHORSHIP,
  CONTEXTS,
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
        slug: z.string().min(1),
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
        contribution: z.string().min(1),
        status: z.enum(STATUSES),
        started: z.coerce.date(),
        featured: z.boolean(),
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
              // Embed URL or a local path (e.g. a GLB in public/).
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

export const collections = { work };
