/*
 * Closed vocabularies for the `work` collection — docs/2-content-model.md.
 * Shared by the Zod schema (src/content.config.ts) and the Keystatic admin
 * (keystatic.config.ts) so both always offer the same values. Filtering by
 * kind, context and role depends on these lists staying closed.
 */

export const KINDS = [
  'software',
  'game',
  'app',
  'web',
  'art2d',
  'art3d',
  'animation',
  'music',
  'other',
] as const;

export const CONTEXTS = ['personal', 'commission', 'client', 'job', 'jam', 'study'] as const;

export const ROLES = [
  'programmer',
  'animator',
  'designer',
  'spec-author',
  'technical-direction',
  'maintainer',
  'musician',
] as const;

export const AUTHORSHIP = ['hand-made', 'ai-assisted', 'ai-built'] as const;

export const ORIGINS = ['original', 'fork'] as const;

export const TEAMS = ['solo', 'team'] as const;

export const STATUSES = ['released', 'in-development', 'archived'] as const;

export const MEDIA_TYPES = ['video', 'model3d', 'spine', 'audio', 'webgl'] as const;

export const LINK_TYPES = [
  'source',
  'play',
  'store',
  'download',
  'watch',
  'listen',
  'docs',
  'buy',
  'other',
] as const;

// Text shown when a link has no custom `label`.
export const LINK_LABELS: Record<(typeof LINK_TYPES)[number], string> = {
  source: 'Source code',
  play: 'Play',
  store: 'Store page',
  download: 'Download',
  watch: 'Watch',
  listen: 'Listen',
  docs: 'Docs',
  buy: 'Buy',
  other: 'Link',
};
