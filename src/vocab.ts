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
  'artist',
  'director',
  'designer',
  'spec-author',
  'technical-direction',
  'maintainer',
  'musician',
] as const;

/** Roles that claim hands-on implementation; never allowed on ai-built entries. */
export const IMPLEMENTATION_ROLES: readonly (typeof ROLES)[number][] = ['programmer', 'animator', 'artist', 'musician'];

export const AUTHORSHIP =['hand-made', 'ai-assisted', 'ai-built'] as const;

export const ORIGINS = ['original', 'fork'] as const;

export const TEAMS = ['solo', 'team'] as const;

export const STATUSES = ['released', 'in-development', 'archived'] as const;

export const MEDIA_TYPES = ['video', 'audio', 'webgl'] as const;

/** Tool names offered in Keystatic's Tools picker, written exactly as on the site. Every name used in an entry must be here (test/vocab.test.mjs); add new tools to this list. */
export const TOOLS = [
  'Adobe Photoshop',
  'Aseprite',
  'Astro',
  'Audacity',
  'bitsy',
  'Blender',
  'C#',
  'C++',
  'Clip Studio Paint',
  'DAZ 3D',
  'GameMaker',
  'GDScript',
  'HTML',
  'Iray',
  'Java',
  'JavaScript',
  'LiquidFun',
  'LMMS',
  'Lua',
  'Node.js',
  'PHP',
  'PIXI.js',
  'PowerShell',
  'Python',
  'Shell',
  'Spine',
  'Unity',
  'Wollok',
] as const;

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

/** Text shown when a link has no custom label. */
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

export const KIND_LABELS: Record<(typeof KINDS)[number], string> = {
  software: 'Software',
  game: 'Game',
  app: 'App',
  web: 'Web',
  art2d: '2D art',
  art3d: '3D',
  animation: 'Animation',
  music: 'Music',
  other: 'Other',
};

export const CONTEXT_LABELS: Record<(typeof CONTEXTS)[number], string> = {
  personal: 'Personal',
  commission: 'Commission',
  client: 'Client',
  job: 'Job',
  jam: 'Game jam',
  study: 'Study',
};

export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  programmer: 'Programmer',
  animator: 'Animator',
  artist: 'Artist',
  director: 'Director',
  designer: 'Designer',
  'spec-author': 'Spec author',
  'technical-direction': 'Technical direction',
  maintainer: 'Maintainer',
  musician: 'Musician',
};

export const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  released: 'Released',
  'in-development': 'In development',
  archived: 'Archived',
};

export const TEAM_LABELS: Record<(typeof TEAMS)[number], string> = { solo: 'Solo', team: 'Team' };

export const AUTHORSHIP_LABELS: Record<(typeof AUTHORSHIP)[number], string> = {
  'hand-made': 'Hand-made',
  'ai-assisted': 'AI-assisted',
  'ai-built': 'AI-built',
};

export const ORIGIN_LABELS: Record<(typeof ORIGINS)[number], string> = { original: 'Original', fork: 'Fork' };

export const MEDIA_TYPE_LABELS: Record<(typeof MEDIA_TYPES)[number], string> = {
  video: 'Video',
  audio: 'Audio',
  webgl: 'WebGL',
};