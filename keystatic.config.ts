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

const options = (values: readonly string[]) => values.map((value) => ({ label: value, value }));

const entryImage = (label: string) =>
  fields.image({ label, directory: 'src/assets', publicPath: '../../assets/' });

const titleWithSlug = (description: string, reserved: string[]) =>
  fields.slug({
    name: { label: 'Title', validation: { isRequired: true } },
    slug: {
      label: 'Slug',
      description: `${description} Generated from the title; edit if needed.`,
      validation: {
        pattern: {
          regex: new RegExp(`^(?!(?:${reserved.join('|')})$)[a-z0-9]+(?:-[a-z0-9]+)*$`),
          message: `Lowercase letters, digits and hyphens (e.g. my-slug). Taken by site URLs: ${reserved.map((r) => `"${r}"`).join(', ')}.`,
        },
      },
    },
  });

const imageSource = (label: string, description: string, field: string) =>
  fields.object(
    {
      upload: fields.image({
        label: 'Upload',
        directory: `src/assets/site/${field}`,
        publicPath: `../assets/site/${field}/`,
      }),
      link: fields.url({ label: 'Or link (https)' }),
    },
    { label, description: `${description}. Upload or link; if both are set, the upload wins.`, layout: [6, 6] },
  );

export default config({
  storage: { kind: 'local' },
  ui: { brand: { name: 'Portfolio' } },
  collections: {
    work: collection({
      label: 'Work',
      path: 'src/content/work/*',
      slugField: 'title',
      format: { contentField: 'body' },
      columns: ['kind', 'draft', 'status'],
      schema: {
        title: titleWithSlug('URL of the page: /work/<slug>.', ['c', 't', 'site']),
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
      columns: ['date', 'pinned', 'featured', 'draft'],
      schema: {
        title: titleWithSlug('URL of the post: /blog/<slug>.', ['page']),
        date: fields.date({ label: 'Date', defaultValue: { kind: 'today' }, validation: { isRequired: true } }),
        summary: fields.text({ label: 'Summary', description: 'One line: home tile subtitle, post subheading and page description.' }),
        cover: fields.image({ label: 'Cover', directory: 'src/assets/blog', publicPath: '../../assets/blog/' }),
        work: fields.array(fields.text({ label: 'Work slug' }), {
          label: 'Related work',
          itemLabel: (props) => props.value || 'Slug',
        }),
        pinned: fields.checkbox({ label: 'Pinned', description: 'Listed above all other posts on the home page and the blog list, newest pinned first.' }),
        featured: fields.checkbox({
          label: 'Featured',
          description: 'The home page shows the newest featured post right after the pinned ones (one at a time); "Featured" marker on the blog list.',
        }),
        draft: fields.checkbox({ label: 'Draft', description: 'Shown on the dev server only. Untick to publish.', defaultValue: true }),
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
        hero: fields.object(
          {
            banner: imageSource('Banner', 'Behind the top of the home page. Wide, ≥1920 px', 'banner'),
            photo: imageSource('Photo', 'Beside your name. Square, ≥400 px; shown round', 'photo'),
            reel: fields.url({ label: 'Demo reel', description: 'YouTube or Vimeo. Empty = no reel' }),
            name: fields.text({ label: 'Name', description: 'Big title', validation: { isRequired: true } }),
            tagline: fields.text({ label: 'Tagline', description: 'Under the name' }),
            bio: fields.text({ label: 'Bio', description: 'Paragraph under the tagline', multiline: true }),
            links: fields.array(
              fields.object({
                label: fields.text({ label: 'Label', validation: { isRequired: true } }),
                url: fields.url({ label: 'URL', validation: { isRequired: true } }),
              }),
              {
                label: 'Links under the bio',
                itemLabel: (p) => `${p.fields.label.value || 'Link'} — ${p.fields.url.value ?? ''}`,
              },
            ),
          },
          { label: 'Top of the home page', layout: [12, 12, 12, 6, 6, 12, 12] },
        ),
        background: fields.object(
          {
            image: imageSource('Image', 'Behind the whole site, blurred and darkened. ≥1920 px', 'background'),
            darken: fields.integer({
              label: 'Darken (%)',
              description: '0–100. Empty = 70. Only with an image',
              validation: { min: 0, max: 100 },
            }),
            blur: fields.integer({
              label: 'Blur (px)',
              description: '0–40 px. Empty = 12. Only with an image',
              validation: { min: 0, max: 40 },
            }),
          },
          { label: 'Page background', layout: [12, 6, 6] },
        ),
        chrome: fields.object(
          {
            logo: imageSource('Logo', 'Top left of every page. svg or transparent png', 'logo'),
            favicon: imageSource('Favicon', 'Tab icon. Square svg or png (no .ico)', 'favicon'),
          },
          { label: 'Header and browser tab' },
        ),
      },
    }),
  },
});
