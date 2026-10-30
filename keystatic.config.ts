import { config, collection, fields, singleton } from '@keystatic/core';
import { COLLECTIONS, type CollectionDef, type CollectionName, type Field } from './src/lib/content-fields.ts';

const required = (field: Field) => (field.required ? { isRequired: true } : undefined);

const plainValues = (props: { fields: Record<string, { value: unknown }> }) =>
  Object.fromEntries(Object.entries(props.fields).map(([key, field]) => [key, field.value]));

const titleWithSlug = (collectionName: string, reserved: readonly string[], nameHelp: string) =>
  fields.slug({
    name: { label: 'Title', description: nameHelp, validation: { isRequired: true } },
    slug: {
      label: 'Slug',
      description: `URL: /${collectionName}/<slug>. Generated from the title; edit if needed.`,
      validation: {
        pattern: {
          regex: new RegExp(`^(?!(?:${reserved.join('|')})$)[a-z0-9]+(?:-[a-z0-9]+)*$`),
          message: `Lowercase letters, digits and hyphens (e.g. my-slug). Taken by site URLs: ${reserved.map((r) => `"${r}"`).join(', ')}.`,
        },
      },
    },
  });

const toField = (field: Field, assets: string, publicPath: string): any => {
  const { label, help: description, options } = field;
  switch (field.type) {
    case 'text':
      return fields.text({ label, description, validation: required(field) });
    case 'longtext':
      return fields.text({ label, description, validation: required(field), multiline: true });
    case 'markdown':
      return fields.markdoc({ label, description, extension: 'md', options: { image: { directory: assets, publicPath } } });
    case 'boolean':
      return fields.checkbox({ label, description, defaultValue: (field.initial ?? field.default ?? false) as boolean });
    case 'enum':
      return fields.select({
        label,
        description,
        options: [...options!],
        defaultValue: (field.initial ?? field.default ?? options![0].value) as string,
      });
    case 'date':
      return fields.date({
        label,
        description,
        validation: required(field),
        defaultValue: field.initial === 'today' ? { kind: 'today' } : undefined,
      });
    case 'url':
      return fields.url({ label, description, validation: required(field) });
    case 'tags':
      return fields.multiselect({ label, description, options: [...options!] });
    case 'refs':
      return fields.array(fields.relationship({ label: 'Project', collection: field.collection!, validation: { isRequired: true } }), {
        label,
        description,
        itemLabel: (props) => props.value ?? 'Choose a project',
      });
    case 'list':
      return fields.array(
        fields.object(Object.fromEntries(field.fields!.map((item) => [item.name, toField(item, assets, publicPath)]))),
        {
          label,
          description,
          itemLabel: (props: any) => (field.itemLabel ? field.itemLabel(plainValues(props)) : label),
        },
      );
    case 'image':
      return fields.image({ label, description, directory: assets, publicPath });
    default:
      throw new Error(`Field "${field.name}" has an unknown type.`);
  }
};

const toKeystatic = (name: CollectionName, def: CollectionDef) => {
  const publicPath = `../../${def.assets.replace(/^src\//, '')}/`;
  return collection({
    label: def.label,
    path: `${def.dir}/*`,
    slugField: 'title',
    format: { contentField: 'body' },
    columns: [...def.columns],
    schema: Object.fromEntries(
      def.fields.map((field) => [
        field.name,
        field.name === 'title'
          ? titleWithSlug(name, def.reserved, field.help)
          : toField(field, def.assets, publicPath),
      ]),
    ),
  });
};
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
    work: toKeystatic('work', COLLECTIONS.work),
    blog: toKeystatic('blog', COLLECTIONS.blog),
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
