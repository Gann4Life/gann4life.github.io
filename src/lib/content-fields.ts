import {
  AUTHORSHIP,
  AUTHORSHIP_LABELS,
  CONTEXT_LABELS,
  CONTEXTS,
  IMPLEMENTATION_ROLES,
  KIND_LABELS,
  KINDS,
  LINK_LABELS,
  LINK_TYPES,
  MEDIA_TYPE_LABELS,
  MEDIA_TYPES,
  ORIGIN_LABELS,
  ORIGINS,
  ROLE_LABELS,
  ROLES,
  STATUS_LABELS,
  STATUSES,
  TEAM_LABELS,
  TEAMS,
  TOOLS,
} from '../vocab.ts';

export type FieldType =
  | 'text'
  | 'longtext'
  | 'markdown'
  | 'boolean'
  | 'enum'
  | 'date'
  | 'url'
  | 'tags'
  | 'refs'
  | 'list'
  | 'image';

export type Option = { value: string; label: string };

export type Field = {
  name: string;
  type: FieldType;
  label: string;
  help: string;
  options?: readonly Option[];
  collection?: string;
  fields?: readonly Field[];
  required?: boolean;
  default?: unknown;
  initial?: unknown;
  itemLabel?: (item: Record<string, unknown>) => string;
};

export type CollectionDef = {
  label: string;
  dir: string;
  assets: string;
  reserved: readonly string[];
  columns: readonly string[];
  fields: readonly Field[];
  refine?: (entry: any, issue: (path: string, message: string) => void) => void;
};

const opts = <V extends readonly string[]>(values: V, label: (value: V[number]) => string) =>
  values.map((value) => ({ value, label: label(value) })) as unknown as {
    [K in keyof V]: { readonly value: V[K]; readonly label: string };
  };

const text = (value: unknown) => String(value ?? '');

const work = {
  label: 'Work',
  dir: 'src/content/work',
  assets: 'src/assets',
  reserved: ['c', 't', 'site', 'all'],
  columns: ['kind', 'draft', 'status'],
  refine: (entry: any, issue: (path: string, message: string) => void) => {
    if (entry.authorship === 'ai-built') {
      const claimed = entry.roles.filter((role: any) => (IMPLEMENTATION_ROLES as readonly string[]).includes(role));
      if (claimed.length > 0) {
        issue(
          'roles',
          `ai-built entries cannot claim ${claimed.join(', ')}; use director, designer, spec-author, technical-direction or maintainer.`,
        );
      }
      if (/develop|programm|coder|engineer/i.test(entry.position)) {
        issue('position', 'ai-built entries describe direction/design, e.g. "Director / Designer", not a developer title.');
      }
    }
    if (entry.origin === 'fork') {
      if (!entry.upstream) {
        issue('upstream', 'Forks must set `upstream` to the original repository URL.');
      }
      if (entry.credits.length === 0) {
        issue('credits', 'Forks must credit the original authors in `credits`.');
      }
    }
  },
  fields: [
    {
      name: 'kind',
      type: 'enum',
      label: 'Kind',
      help: 'What it is.',
      options: opts(KINDS, (v) => KIND_LABELS[v]),
      required: true,
      initial: 'software',
    },
    {
      name: 'context',
      type: 'enum',
      label: 'Context',
      help: 'Who it was for.',
      options: opts(CONTEXTS, (v) => CONTEXT_LABELS[v]),
      default: 'personal',
      initial: 'personal',
    },
    {
      name: 'started',
      type: 'date',
      label: 'Started',
      help: 'When work began. Its year is shown on the page and it sets the sort order.',
      required: true,
    },
    {
      name: 'status',
      type: 'enum',
      label: 'Status',
      help: 'Where the project stands today.',
      options: opts(STATUSES, (v) => STATUS_LABELS[v]),
      required: true,
      initial: 'in-development',
    },
    {
      name: 'team',
      type: 'enum',
      label: 'Team',
      help: 'Whether you made it alone or with others.',
      options: opts(TEAMS, (v) => TEAM_LABELS[v]),
      required: true,
      initial: 'solo',
    },
    {
      name: 'draft',
      type: 'boolean',
      label: 'Draft',
      help: 'Shown on the dev server only. Untick to publish.',
      default: false,
      initial: true,
    },
    {
      name: 'featured',
      type: 'boolean',
      label: 'Featured',
      help: 'Shown in the Featured band at the top of the home page.',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      help: 'Name shown on the page and in lists. Once the entry exists, changing the title does not change its URL.',
      required: true,
    },
    {
      name: 'position',
      type: 'text',
      label: 'Position',
      help: 'Optional. Title actually held, e.g. "Unity Game Developer" on someone else\'s project.',
      default: '',
    },
    {
      name: 'authorship',
      type: 'enum',
      label: 'Authorship',
      help: 'ai-built entries take designer/spec roles, not programmer (docs/2-content-model.md).',
      options: opts(AUTHORSHIP, (v) => AUTHORSHIP_LABELS[v]),
      required: true,
      initial: 'hand-made',
    },
    {
      name: 'media',
      type: 'list',
      label: 'Media (embeds)',
      help: 'Videos, players and WebGL builds shown at the top of the page.',
      default: [],
      itemLabel: (item) => `${text(item.type)}: ${text(item.src)}`,
      fields: [
        {
          name: 'type',
          type: 'enum',
          label: 'Type',
          help: 'What the embed plays.',
          options: opts(MEDIA_TYPES, (v) => MEDIA_TYPE_LABELS[v]),
          required: true,
          initial: 'video',
        },
        {
          name: 'src',
          type: 'text',
          label: 'Source',
          help: 'YouTube / Vimeo / SoundCloud URL works as-is. itch.io and Bandcamp need their embed URL: use `npm run add <url>`. Local files: path in public/.',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Caption',
          help: 'Shown under the embed.',
          default: '',
        },
      ],
    },
    {
      name: 'cover',
      type: 'image',
      label: 'Cover (thumbnail)',
      help: 'Thumbnail on tiles and in link previews; shown at the top of the page when there are no media.',
    },
    {
      name: 'contribution',
      type: 'longtext',
      label: 'What I did',
      help: 'One or two sentences on what you made yourself (not the game description, not the roles). On team projects, only your part. Required to publish.',
      default: '',
    },
    {
      name: 'roles',
      type: 'tags',
      label: 'Roles',
      help: 'Your roles on the project, listed under What I did.',
      options: opts(ROLES, (v) => ROLE_LABELS[v]),
      default: [],
    },
    {
      name: 'body',
      type: 'markdown',
      label: 'Description',
      help: 'The text under What I did on the project page.',
    },
    {
      name: 'origin',
      type: 'enum',
      label: 'Origin',
      help: "Fork: someone else's project you changed; it needs Upstream and Credits.",
      options: opts(ORIGINS, (v) => ORIGIN_LABELS[v]),
      required: true,
      initial: 'original',
    },
    {
      name: 'upstream',
      type: 'url',
      label: 'Upstream',
      help: 'Required for forks.',
      default: '',
    },
    {
      name: 'links',
      type: 'list',
      label: 'Links',
      help: 'Buttons in the Links section.',
      default: [],
      itemLabel: (item) =>
        `${text(item.label) || LINK_LABELS[item.type as (typeof LINK_TYPES)[number]]}: ${text(item.url)}`,
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Label',
          help: 'Button text. Empty uses the type default.',
          default: '',
        },
        {
          name: 'type',
          type: 'enum',
          label: 'Type',
          help: 'Icon and default label.',
          options: opts(LINK_TYPES, (v) => LINK_LABELS[v]),
          default: 'other',
          initial: 'other',
        },
        {
          name: 'url',
          type: 'url',
          label: 'URL',
          help: 'Where the button goes.',
          required: true,
        },
      ],
    },
    {
      name: 'tools',
      type: 'tags',
      label: 'Tools',
      help: 'Engines, programs, languages and libraries you used. Each one gets a page listing its projects. Missing one? Ask Claude to add it.',
      options: opts(TOOLS, (v) => v),
      default: [],
    },
    {
      name: 'credits',
      type: 'list',
      label: 'Credits',
      help: 'People and projects to credit; forks must credit the original authors.',
      default: [],
      itemLabel: (item) => text(item.name) || 'Credit',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Name',
          help: 'Person, group or project.',
          required: true,
        },
        {
          name: 'role',
          type: 'text',
          label: 'Role',
          help: 'What they did.',
          required: true,
        },
        {
          name: 'url',
          type: 'url',
          label: 'URL',
          help: 'Optional link to them.',
        },
      ],
    },
    {
      name: 'usedIn',
      type: 'refs',
      label: 'Used in',
      help: 'Other projects this one was used in, e.g. a song used in a game. Both pages link to each other.',
      collection: 'work',
      default: [],
    },
    {
      name: 'gallery',
      type: 'list',
      label: 'Gallery',
      help: 'Images shown in the gallery; each opens full size.',
      default: [],
      itemLabel: (item) => text(item.caption) || 'Image',
      fields: [
        {
          name: 'image',
          type: 'image',
          label: 'Image',
          help: 'The picture.',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Caption',
          help: 'Alt text and caption of the image.',
          default: '',
        },
      ],
    },
  ],
} as const satisfies CollectionDef;

const blog = {
  label: 'Blog',
  dir: 'src/content/blog',
  assets: 'src/assets/blog',
  reserved: ['page'],
  columns: ['date', 'pinned', 'featured', 'draft'],
  fields: [
    {
      name: 'date',
      type: 'date',
      label: 'Date',
      help: 'Publication date; it sets the order.',
      required: true,
      initial: 'today',
    },
    {
      name: 'pinned',
      type: 'boolean',
      label: 'Pinned',
      help: 'Listed above all other posts on the home page and the blog list, newest pinned first.',
      default: false,
    },
    {
      name: 'featured',
      type: 'boolean',
      label: 'Featured',
      help: 'Adds a "Featured" marker on the blog list. Does not change the order or the home page.',
      default: false,
    },
    {
      name: 'draft',
      type: 'boolean',
      label: 'Draft',
      help: 'Shown on the dev server only. Untick to publish.',
      default: false,
      initial: true,
    },
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      help: 'Name of the post. Changing it does not change its URL.',
      required: true,
    },
    {
      name: 'summary',
      type: 'text',
      label: 'Summary',
      help: 'One line: post subheading and page description.',
      default: '',
    },
    {
      name: 'cover',
      type: 'image',
      label: 'Cover',
      help: 'Decorative image above the post and its link preview.',
    },
    {
      name: 'body',
      type: 'markdown',
      label: 'Post',
      help: 'The text of the post.',
    },
    {
      name: 'work',
      type: 'refs',
      label: 'Related work',
      help: 'Projects this post is about; the post is listed on their pages.',
      collection: 'work',
      default: [],
    },
  ],
} as const satisfies CollectionDef;

export const COLLECTIONS = { work, blog } as const satisfies Record<string, CollectionDef>;

export type CollectionName = keyof typeof COLLECTIONS;
