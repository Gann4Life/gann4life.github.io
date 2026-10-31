import type { CollectionName } from './content-fields.ts';

export const editHooks = {
  entry: (collection: CollectionName, id: string): Record<string, string> =>
    import.meta.env.DEV ? { 'data-edit-entry': `${collection}/${id}` } : {},
  field: (...names: string[]): Record<string, string> =>
    import.meta.env.DEV ? { 'data-edit-field': names.join(' ') } : {},
};
