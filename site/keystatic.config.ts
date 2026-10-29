import { config, collection, fields, singleton } from '@keystatic/core';
import {
  AUTHORSHIP,
  CONTEXTS,
  KINDS,
  LINK_LABELS,
  LINK_TYPES,
  MEDIA_TYPES,
  ORIGINS,
  ROLES,
  STATUSES,
  TEAMS,
} from './src/vocab';

/*
 * Keystatic admin — docs/1-stack.md (local mode).
 * `work` fields mirror src/content.config.ts; that Zod schema stays the source
 * of truth and still validates whatever Keystatic writes at build time.
 */

const options = (values: readonly string[]) => values.map((value) => ({ label: value, value }));

// Images land in src/assets/<slug>/... and are stored as paths relative to the
// entry file, which is what astro:assets reads.
const entryImage = (label: string) =>
  fields.image({ label, directory: 'src/assets', publicPath: '../../assets/' });

// Title plus a slug generated from it while typing; the slug stays editable.
// `c` is reserved for the category pages (/work/c/<category>/).
const titleWithSlug = (description: string) =>
  fields.slug({
    name: { label: 'Title', validation: { isRequired: true } },
    slug: {
      label: 'Slug',
      description: `${description} Generated from the title; edit if needed.`,
      validation: { pattern: { regex: /^(?!c$)[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Lowercase words joined by hyphens ("c" is reserved).' } },
    },
  });

export default config({
  storage: { kind: 'local' },
  ui: { brand: { name: 'Portfolio' } },
  collections: {
    work: collection({
      label: 'Work',
      path: 'src/content/work/*',
      // `slug` is written to frontmatter and also names the file.
      // The slug is generated from the title (editable) and becomes the file name.
      slugField: 'title',
      format: { contentField: 'body' },
      columns: ['kind', 'draft', 'status'],
      schema: {
        title: titleWithSlug('URL of the page: /work/<slug>.'),
        kind: fields.select({ label: 'Kind', description: 'What it is.', options: options(KINDS), defaultValue: 'software' }),
        context: fields.select({
          label: 'Context',
          description: 'Who it was for.',
          options: options(CONTEXTS),
          defaultValue: 'personal',
        }),
        position: fields.text({
          label: 'Position',
          description: 'Optional. Title actually held, e.g. "Unity Game Developer" on someone else\'s project.',
        }),
        roles: fields.multiselect({ label: 'Roles', description: 'Drives the filters.', options: options(ROLES) }),
        authorship: fields.select({
          label: 'Authorship',
          description: 'ai-built entries take designer/spec roles, not programmer (docs/2-content-model.md).',
          options: options(AUTHORSHIP),
          defaultValue: 'hand-made',
        }),
        origin: fields.select({ label: 'Origin', options: options(ORIGINS), defaultValue: 'original' }),
        upstream: fields.url({ label: 'Upstream', description: 'Required for forks.' }),
        team: fields.select({ label: 'Team', options: options(TEAMS), defaultValue: 'solo' }),
        credits: fields.array(
          fields.object({
            name: fields.text({ label: 'Name', validation: { isRequired: true } }),
            role: fields.text({ label: 'Role', validation: { isRequired: true } }),
            url: fields.url({ label: 'URL' }),
          }),
          { label: 'Credits', itemLabel: (props) => props.fields.name.value || 'Credit' },
        ),
        contribution: fields.text({
          label: 'Contribution',
          description: 'Exactly what I built/made. On team projects, only my part. Required to publish.',
          multiline: true,
        }),
        status: fields.select({ label: 'Status', options: options(STATUSES), defaultValue: 'in-development' }),
        started: fields.date({ label: 'Started', validation: { isRequired: true } }),
        featured: fields.checkbox({ label: 'Featured' }),
        draft: fields.checkbox({
          label: 'Draft',
          description: 'Shown on the dev server only. Untick to publish.',
          defaultValue: true,
        }),
        tools: fields.array(fields.text({ label: 'Tool' }), {
          label: 'Tools',
          itemLabel: (props) => props.value || 'Tool',
        }),
        cover: entryImage('Cover (thumbnail)'),
        gallery: fields.array(
          fields.object({
            image: entryImage('Image'),
            caption: fields.text({ label: 'Caption' }),
          }),
          { label: 'Gallery', itemLabel: (props) => props.fields.caption.value || 'Image' },
        ),
        media: fields.array(
          fields.object({
            type: fields.select({ label: 'Type', options: options(MEDIA_TYPES), defaultValue: 'video' }),
            src: fields.text({
              label: 'Source',
              description:
                'YouTube / Vimeo / SoundCloud URL works as-is. itch.io and Bandcamp need their embed URL: use `npm run add <url>`. Local files: path in public/.',
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: 'Caption' }),
          }),
          { label: 'Media (embeds)', itemLabel: (props) => `${props.fields.type.value}: ${props.fields.src.value}` },
        ),
        links: fields.array(
          fields.object({
            label: fields.text({ label: 'Label', description: 'Button text. Empty uses the type default.' }),
            type: fields.select({
              label: 'Type',
              description: 'Icon and default label.',
              options: LINK_TYPES.map((value) => ({ label: `${value} (${LINK_LABELS[value]})`, value })),
              defaultValue: 'other',
            }),
            url: fields.url({ label: 'URL', validation: { isRequired: true } }),
          }),
          {
            label: 'Links',
            itemLabel: (props) =>
              `${props.fields.label.value || LINK_LABELS[props.fields.type.value]}: ${props.fields.url.value ?? ''}`,
          },
        ),
        usedIn: fields.array(fields.text({ label: 'Slug' }), {
          label: 'Used in',
          itemLabel: (props) => props.value || 'Slug',
        }),
        body: fields.markdoc({ label: 'Body', extension: 'md' }),
      },
    }),
    blog: collection({
      label: 'Blog',
      path: 'src/content/blog/*',
      slugField: 'title',
      format: { contentField: 'body' },
      columns: ['date', 'draft'],
      schema: {
        title: titleWithSlug('URL of the post: /blog/<slug>.'),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        summary: fields.text({ label: 'Summary', description: 'One line, shown on the blog list.' }),
        cover: fields.image({ label: 'Cover', directory: 'src/assets/blog', publicPath: '../../assets/blog/' }),
        work: fields.array(fields.text({ label: 'Work slug' }), {
          label: 'Related work',
          itemLabel: (props) => props.value || 'Slug',
        }),
        draft: fields.checkbox({ label: 'Draft', description: 'Untick to publish.', defaultValue: true }),
        body: fields.markdoc({
          label: 'Post',
          extension: 'md',
          options: { image: { directory: 'src/assets/blog', publicPath: '../../assets/blog/' } },
        }),
      },
    }),
  },
  singletons: {
    profile: singleton({
      label: 'Profile',
      path: 'src/data/profile',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Name', validation: { isRequired: true } }),
        tagline: fields.text({ label: 'Tagline' }),
        bio: fields.text({ label: 'Bio', multiline: true }),
        reel: fields.url({ label: 'Demo reel', description: 'YouTube or Vimeo URL, shown as the home page banner.' }),
        links: fields.array(
          fields.object({
            label: fields.text({ label: 'Label', validation: { isRequired: true } }),
            url: fields.url({ label: 'URL', validation: { isRequired: true } }),
          }),
          { label: 'Profile links', itemLabel: (props) => props.fields.label.value || 'Link' },
        ),
      },
    }),
  },
});
