import { config, collection, fields } from '@keystatic/core';

/*
 * Keystatic admin for the `work` collection — docs/1-stack.md (local mode).
 * Fields mirror src/content.config.ts; that Zod schema stays the source of
 * truth and still validates whatever Keystatic writes at build time.
 */

const options = (values: readonly string[]) => values.map((value) => ({ label: value, value }));

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
const MEDIA_TYPES = ['image', 'video', 'model3d', 'spine', 'audio', 'webgl'] as const;
const LINK_TYPES = ['source', 'play', 'download', 'watch', 'listen', 'docs', 'buy'] as const;

export default config({
  storage: { kind: 'local' },
  collections: {
    work: collection({
      label: 'Work',
      path: 'src/content/work/*',
      // `slug` is written to frontmatter and also names the file.
      slugField: 'slug',
      format: { contentField: 'body' },
      columns: ['title', 'kind', 'status'],
      schema: {
        title: fields.text({ label: 'Title', validation: { isRequired: true } }),
        slug: fields.text({
          label: 'Slug',
          validation: { isRequired: true, pattern: { regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'kebab-case' } },
        }),
        kind: fields.select({ label: 'Kind', options: options(KINDS), defaultValue: 'software' }),
        roles: fields.multiselect({ label: 'Roles', options: options(ROLES) }),
        authorship: fields.select({
          label: 'Authorship',
          description: 'docs/2-content-model.md: ai-built entries take designer/spec roles, not programmer.',
          options: options(['hand-made', 'ai-assisted', 'ai-built']),
          defaultValue: 'hand-made',
        }),
        origin: fields.select({ label: 'Origin', options: options(['original', 'fork']), defaultValue: 'original' }),
        upstream: fields.url({ label: 'Upstream', description: 'Required for forks.' }),
        team: fields.select({ label: 'Team', options: options(['solo', 'team']), defaultValue: 'solo' }),
        credits: fields.array(
          fields.object({
            name: fields.text({ label: 'Name', validation: { isRequired: true } }),
            role: fields.text({ label: 'Role', validation: { isRequired: true } }),
            url: fields.url({ label: 'URL' }),
          }),
          { label: 'Credits', itemLabel: (props) => props.fields.name.value || 'Credit' },
        ),
        contribution: fields.text({ label: 'Contribution', multiline: true, validation: { isRequired: true } }),
        status: fields.select({
          label: 'Status',
          options: options(['released', 'in-development', 'archived']),
          defaultValue: 'in-development',
        }),
        started: fields.date({ label: 'Started', validation: { isRequired: true } }),
        featured: fields.checkbox({ label: 'Featured' }),
        tools: fields.array(fields.text({ label: 'Tool' }), {
          label: 'Tools',
          itemLabel: (props) => props.value || 'Tool',
        }),
        // Stored as ../../assets/<slug>/cover.<ext>, the in-repo path astro:assets reads.
        cover: fields.image({ label: 'Cover', directory: 'src/assets', publicPath: '../../assets/' }),
        media: fields.array(
          fields.object({
            type: fields.select({ label: 'Type', options: options(MEDIA_TYPES), defaultValue: 'image' }),
            src: fields.text({
              label: 'Source',
              description: 'Images: in-repo path (../../assets/...). Embeds: URL. No hotlinked media.',
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: 'Caption' }),
          }),
          { label: 'Media', itemLabel: (props) => `${props.fields.type.value}: ${props.fields.src.value}` },
        ),
        links: fields.array(
          fields.object({
            type: fields.select({ label: 'Type', options: options(LINK_TYPES), defaultValue: 'source' }),
            url: fields.url({ label: 'URL', validation: { isRequired: true } }),
          }),
          { label: 'Links', itemLabel: (props) => `${props.fields.type.value}: ${props.fields.url.value ?? ''}` },
        ),
        usedIn: fields.array(fields.text({ label: 'Slug' }), {
          label: 'Used in',
          itemLabel: (props) => props.value || 'Slug',
        }),
        body: fields.markdoc({ label: 'Body', extension: 'md' }),
      },
    }),
  },
});
