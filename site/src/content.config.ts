import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
 * `work` collection schema — docs/2-content-model.md, field-for-field.
 * Enums are closed: filtering by role and kind depends on a fixed vocabulary.
 */

const KINDS = ['software', 'game', 'art2d', 'art3d', 'animation', 'music'] as const;

const ROLES = [
  'programmer',
  'animator',
  'designer',
  'spec-author',
  'technical-direction',
  'maintainer',
  'musician',
] as const;

const AUTHORSHIP = ['hand-made', 'ai-assisted', 'ai-built'] as const;

const ORIGINS = ['original', 'fork'] as const;

const TEAMS = ['solo', 'team'] as const;

const STATUSES = ['released', 'in-development', 'archived'] as const;

const MEDIA_TYPES = ['video', 'model3d', 'spine', 'audio', 'webgl'] as const;

const LINK_TYPES = ['source', 'play', 'download', 'watch', 'listen', 'docs', 'buy'] as const;

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        slug: z.string().min(1),
        kind: z.enum(KINDS),
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
        media: z
          .array(
            z.union([
              z.object({
                type: z.literal('image'),
                src: image(),
                caption: z.string().default(''),
              }),
              z.object({
                type: z.enum(MEDIA_TYPES),
                // Embed URL or a local path (e.g. a GLB in public/).
                src: z.string().min(1),
                caption: z.string().default(''),
              }),
            ]),
          )
          .default([]),
        links: z
          .array(
            z.object({
              type: z.enum(LINK_TYPES),
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
