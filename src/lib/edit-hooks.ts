import type { CollectionName } from './content-fields.ts';

/** Dev-only attributes the in-site editor reads: entry marks a page root, field marks the elements that show those fields; both return {} outside `astro dev`. */
export const editHooks = {
  entry: (collection: CollectionName, id: string): Record<string, string> =>
    import.meta.env.DEV ? { 'data-edit-entry': `${collection}/${id}` } : {},
  field: (...names: string[]): Record<string, string> =>
    import.meta.env.DEV ? { 'data-edit-field': names.join(' ') } : {},
};
