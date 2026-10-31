import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const editor = await import(pathToFileURL(path.join(ROOT, 'integrations', 'editor', 'file.mjs')).href);
const { COLLECTIONS } = await import('../src/lib/content-fields.ts');
const { load } = await import('js-yaml');
const { toolSlug } = await import('../src/lib/slug.ts');
const assets = await import(pathToFileURL(path.join(ROOT, 'integrations', 'editor', 'assets.mjs')).href);

const WORK = COLLECTIONS.work;
const BLOG = COLLECTIONS.blog;

const KEYSTATIC_ENTRY = `---
title: Sample entry
kind: software
context: personal
position: Director / Designer
roles:
  - director
  - designer
authorship: ai-built
origin: original
team: solo
credits: []
contribution: >
  Came up with the tool, wrote its product spec and the design decisions, and
  directed and reviewed the implementation, which was written with AI.
status: in-development
started: 2026-10-14
featured: true
draft: false
tools:
  - JavaScript
gallery: []
media:
  - type: video
    src: https://example.com/video
    caption: >-
      A caption that is long enough to be folded by the YAML writer when it is
      dumped.
links:
  - type: source
    url: https://example.com/source
usedIn: []
---
Body paragraph.

- one
- two
`;

const WORK_WITH_IMAGES = KEYSTATIC_ENTRY.replace('gallery: []', 'gallery:\n  - image: ../../assets/sample/gallery/0/image.png\n    caption: First\n  - image: ../../assets/sample/gallery/1/image.png').replace(
  'usedIn: []',
  'cover: ../../assets/sample/cover.png\nusedIn: []',
);

const ONLY_REQUIRED = `---
kind: software
started: 2026-10-14
status: released
team: solo
featured: false
title: Bare
authorship: hand-made
origin: original
---
`;

const BLOG_ENTRY = `---
date: 2026-10-20
pinned: false
featured: false
draft: true
title: A post
summary: One line.
work:
  - sample-entry
---
Post body.
`;

const workSchema = {
  safeParse(data) {
    const issues = [];
    if (typeof data.title !== 'string' || !data.title) issues.push({ path: ['title'], message: 'title required' });
    if (!(data.started instanceof Date)) issues.push({ path: ['started'], message: 'started must be a date' });
    if (data.authorship === 'ai-built' && (data.roles ?? []).includes('programmer')) {
      issues.push({ path: ['roles'], message: 'ai-built entries cannot claim programmer' });
    }
    return issues.length ? { success: false, error: { issues } } : { success: true, data };
  },
};

const blogSchema = {
  safeParse(data) {
    const issues = [];
    if (typeof data.title !== 'string' || !data.title) issues.push({ path: ['title'], message: 'title required' });
    if (!(data.date instanceof Date)) issues.push({ path: ['date'], message: 'date must be a date' });
    return issues.length ? { success: false, error: { issues } } : { success: true, data };
  },
};

const registry = { collections: COLLECTIONS, schemaFor: (name) => (name === 'blog' ? blogSchema : workSchema), toolSlug };

let dir;
let workDir;
let blogDir;
let emptyRoot;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'editor-'));
  workDir = path.join(dir, 'src', 'content', 'work');
  blogDir = path.join(dir, 'src', 'content', 'blog');
  mkdirSync(workDir, { recursive: true });
  mkdirSync(blogDir, { recursive: true });
  emptyRoot = path.join(dir, 'empty');
  mkdirSync(path.join(emptyRoot, 'src', 'content', 'work'), { recursive: true });
  mkdirSync(path.join(emptyRoot, 'src', 'content', 'blog'), { recursive: true });
});

after(() => rmSync(dir, { recursive: true, force: true }));

const put = (name, text) => writeFileSync(path.join(workDir, name), text);
const read = (name) => readFileSync(path.join(workDir, name), 'utf8');
const putPost = (name, text) => writeFileSync(path.join(blogDir, name), text);
const readPost = (name) => readFileSync(path.join(blogDir, name), 'utf8');
const noTemp = (folder) => readdirSync(folder).every((f) => !f.endsWith('.editor-tmp'));

const sameOrigin = { host: 'localhost:4321', origin: 'http://localhost:4321', 'content-type': 'application/json' };
const call = (method, url, { body, headers = {}, remoteAddress = '127.0.0.1', base = '/', root = dir } = {}) =>
  editor.handleRequest(
    {
      method,
      url,
      remoteAddress,
      headers: { host: 'localhost:4321', ...(method === 'PUT' ? sameOrigin : {}), ...headers },
      readBody: async () => {
        if (body instanceof Error) throw body;
        return typeof body === 'string' ? body : JSON.stringify(body);
      },
    },
    { root, base, loadRegistry: async () => registry },
  );

const save = async (name, set, extra = {}) => {
  const hash = (await call('GET', `/__editor/work/${name}`)).body.hash;
  return call('PUT', `/__editor/work/${name}`, { body: { hash, set, ...extra } });
};

test('ids resolve by file name or explicit slug, and nothing else', async (t) => {
  put('plain-name.md', KEYSTATIC_ENTRY);
  put('other-file.md', KEYSTATIC_ENTRY.replace('title: Sample entry\n', 'title: Sample entry\nslug: custom-slug\n'));
  put('quoted-file.md', KEYSTATIC_ENTRY.replace('title: Sample entry\n', 'title: Sample entry\nslug: "quoted-slug"\n'));
  put('.hidden.md', KEYSTATIC_ENTRY);
  put('not-markdown.txt', KEYSTATIC_ENTRY);
  mkdirSync(path.join(workDir, 'nested'), { recursive: true });
  put('nested/inner.md', KEYSTATIC_ENTRY);

  assert.equal((await editor.resolveEntry(workDir, 'plain-name'))?.name, 'plain-name.md');
  assert.equal((await editor.resolveEntry(workDir, 'custom-slug'))?.name, 'other-file.md');
  assert.equal(await editor.resolveEntry(workDir, 'other-file'), null, 'an explicit slug replaces the file name id');
  assert.equal((await editor.resolveEntry(workDir, 'quoted-slug'))?.name, 'quoted-file.md');
  for (const bad of ['../x', '..', 'a/b', 'Plain-Name', 'plain_name', '-plain', 'plain-', '', 'inner', 'hidden', 'not-markdown']) {
    assert.equal(await editor.resolveEntry(workDir, bad), null, `"${bad}" must not resolve`);
  }

  const outside = path.join(dir, 'outside.md');
  writeFileSync(outside, KEYSTATIC_ENTRY);
  try {
    symlinkSync(outside, path.join(workDir, 'escape.md'));
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EACCES') throw err;
    t.skip('symlink creation is not permitted here; the symlink-escape case was not checked');
    return;
  }
  assert.equal(await editor.resolveEntry(workDir, 'escape'), null, 'a symlink leaving the folder must not resolve');
});

test('explicit slugs follow the frontmatter value rule', async () => {
  const front = (line) => `---\ntitle: T\n${line}\n---\nbody\n`;
  assert.equal(editor.explicitSlug(front('slug: my-entry # renamed')), 'my-entry');
  assert.equal(editor.explicitSlug(front('slug: "my-entry"')), 'my-entry');
  assert.equal(editor.explicitSlug(front(`slug: 'foo"`)), `'foo"`);
  assert.equal(editor.explicitSlug(front('title2: x')), '');

  put('commented-file.md', front('slug: my-entry # renamed'));
  assert.equal((await editor.resolveEntry(workDir, 'my-entry'))?.name, 'commented-file.md');

  put('direct-id.md', front('slug: direct-id'));
  assert.equal((await editor.resolveEntry(workDir, 'direct-id'))?.name, 'direct-id.md');
  put('moved-away.md', front('slug: elsewhere'));
  assert.equal(await editor.resolveEntry(workDir, 'moved-away'), null, 'a file whose explicit slug differs is not found by its name');
  assert.equal((await editor.resolveEntry(workDir, 'elsewhere'))?.name, 'moved-away.md');
});

test('request checks', () => {
  const ok = { method: 'PUT', remoteAddress: '127.0.0.1', headers: { ...sameOrigin } };
  assert.equal(editor.checkRequest(ok), null);
  assert.equal(editor.checkRequest({ ...ok, method: 'GET', headers: { host: 'localhost:4321' } }), null);
  assert.equal(editor.checkRequest({ ...ok, remoteAddress: '::1' }), null);
  assert.equal(editor.checkRequest({ ...ok, remoteAddress: '::ffff:127.0.0.1' }), null);
  assert.equal(
    editor.checkRequest({ ...ok, headers: { ...sameOrigin, 'content-type': 'application/json; charset=utf-8' } }),
    null,
  );
  assert.equal(editor.checkRequest({ ...ok, headers: { ...sameOrigin, 'sec-fetch-site': 'same-origin' } }), null);

  const status = (patch) => editor.checkRequest({ ...ok, ...patch })?.status;
  assert.equal(status({ remoteAddress: '192.168.1.20' }), 403);
  assert.equal(status({ remoteAddress: undefined }), 403);
  assert.equal(status({ headers: { ...sameOrigin, host: 'evil.example' } }), 403);
  assert.equal(status({ headers: { ...sameOrigin, host: 'localhost.evil.example' } }), 403);
  assert.equal(status({ headers: { ...sameOrigin, origin: 'http://evil.example' } }), 403);
  assert.equal(status({ headers: { ...sameOrigin, origin: undefined } }), 403);
  assert.equal(status({ headers: { ...sameOrigin, 'content-type': 'text/plain' } }), 403);
  assert.equal(status({ headers: { ...sameOrigin, 'content-type': undefined } }), 403);
  assert.equal(status({ headers: { ...sameOrigin, 'sec-fetch-site': 'cross-site' } }), 403);
  assert.equal(status({ method: 'GET', headers: { host: 'evil.example' } }), 403);
  assert.equal(status({ method: 'DELETE' }), 405);
  assert.equal(status({ method: 'POST' }), 405);
  assert.equal(status({ method: 'OPTIONS' }), 405);
});

test('updates: unknown shapes, fields and properties are 400', () => {
  const bad = (payload, def = WORK, message) =>
    assert.throws(
      () => editor.parseUpdate(payload, def),
      (err) => err.status === 400 && (message === undefined || err.message.includes(message)),
      JSON.stringify(payload),
    );
  bad(null);
  bad([]);
  bad({ set: {} });
  bad({ hash: 'h' });
  bad({ hash: '', set: {} });
  bad({ hash: 'h', set: [] });
  bad({ hash: 'h', set: {}, extra: 1 }, WORK, 'Unknown property "extra".');
  bad({ hash: 'h', set: {}, uploads: 'x' }, WORK, '"uploads" must be an array.');
  bad({ hash: 'h', set: { slug: 'x' } }, WORK, 'Field "slug" is not editable here.');
  bad({ hash: 'h', set: { nope: 'x' } }, WORK, 'Field "nope" is not editable here.');
  bad({ hash: 'h', set: { body: 'x' } }, WORK, 'Field "body" is not editable here.');
  bad({ hash: 'h', set: { pinned: true } }, WORK, 'Field "pinned" is not editable here.');
  bad({ hash: 'h', set: {}, body: 5 });
  assert.equal(editor.parseUpdate({ hash: 'h', set: { pinned: true } }, BLOG).set.pinned, true);
});

test('updates: every type is checked from the registry', () => {
  const bad = (set, message) =>
    assert.throws(
      () => editor.parseUpdate({ hash: 'h', set }, WORK),
      (err) => err.status === 400 && (message === undefined || err.message.includes(message)),
      JSON.stringify(set),
    );
  bad({ position: 5 }, '"position"');
  bad({ title: '' }, '"title"');
  bad({ title: '   ' }, '"title"');
  bad({ title: 3 }, '"title"');
  bad({ title: null }, '"title"');
  bad({ started: null }, '"started"');
  bad({ contribution: 3 }, '"contribution"');
  bad({ draft: 'true' }, '"draft"');
  bad({ featured: 1 }, '"featured"');
  bad({ kind: 'nope' }, '"kind"');
  bad({ kind: 3 }, '"kind"');
  bad({ roles: ['nope'] }, '"roles"');
  bad({ roles: 'artist' }, '"roles"');
  bad({ tools: ['Not A Tool'] }, '"tools"');
  bad({ started: '2026-02-30' }, '"started"');
  bad({ started: '26-1-1' }, '"started"');
  bad({ started: '2026-13-01' }, '"started"');
  bad({ started: 20261001 }, '"started"');
  bad({ upstream: 5 }, '"upstream"');
  bad({ usedIn: ['Bad_Id'] }, '"usedIn"');
  bad({ usedIn: 'a' }, '"usedIn"');
  bad({ links: 'x' }, '"links"');
  bad({ links: ['x'] }, '"links[0]"');
  bad({ links: [{ type: 'play', url: 'https://x.example', extra: 1 }] }, '"links[0].extra"');
  bad({ links: [{ type: 5, url: 'https://x.example' }] }, '"links[0].type"');
  bad({ links: [{ type: 'play', url: null }] }, '"links[0].url"');
  bad({ media: [{ type: 'video', src: 3 }] }, '"media[0].src"');
  bad({ media: [{ type: 'video', src: '   ' }] }, '"media[0].src"');
  bad({ cover: { upload: 'x' } }, 'Unknown upload token.');
  bad({ cover: '' }, '"cover"');
  bad({ cover: 5 }, '"cover"');
  bad({ cover: { other: 'x' } }, '"cover"');
  bad({ gallery: [{ image: { upload: 'x' } }] }, 'Unknown upload token.');
  bad({ gallery: [{ caption: 'no image' , image: 7 }] }, '"gallery[0].image"');
});

test('updates: values are normalised per type', () => {
  const set = editor.parseUpdate(
    {
      hash: 'h',
      set: {
        title: '  New  ',
        contribution: ' a\r\nb \r\n',
        draft: false,
        featured: true,
        position: '  Lead ',
        upstream: ' https://example.com/up ',
        roles: ['artist'],
        usedIn: ['one-two'],
        kind: 'game',
      },
    },
    WORK,
  ).set;
  assert.deepEqual(set, {
    title: 'New',
    contribution: 'a\nb',
    draft: false,
    featured: true,
    position: 'Lead',
    upstream: 'https://example.com/up',
    roles: ['artist'],
    usedIn: ['one-two'],
    kind: 'game',
  });
  assert.equal(editor.parseUpdate({ hash: 'h', set: { contribution: '' } }, WORK).set.contribution, '');
  assert.deepEqual(editor.parseUpdate({ hash: 'h', set: { contribution: null, cover: null } }, WORK).set, {
    contribution: null,
    cover: null,
  });
  const started = editor.parseUpdate({ hash: 'h', set: { started: '2026-02-28' } }, WORK).set.started;
  assert.equal(started.toISOString(), '2026-02-28');
  assert.deepEqual(
    editor.parseUpdate(
      {
        hash: 'h',
        set: { links: [{ label: null, type: 'play', url: ' https://x.example ' }, { label: '  ', type: 'source', url: 'https://y.example' }] },
      },
      WORK,
    ).set.links,
    [
      { type: 'play', url: 'https://x.example' },
      { type: 'source', url: 'https://y.example' },
    ],
    'a null or empty item value is not written',
  );
  assert.equal(editor.normalizeBody('a\r\nb'), 'a\nb\n');
  assert.equal(editor.normalizeBody(''), '');
  assert.equal(editor.normalizeBody('a\n'), 'a\n');
});

test('mergeEntry: null removes text, url and image keys and empties list, tags and refs', () => {
  const data = {
    title: 'T',
    position: 'P',
    upstream: 'https://x.example',
    cover: '../a.png',
    roles: ['artist'],
    links: [{ type: 'play', url: 'https://x.example' }],
    usedIn: ['a'],
    draft: true,
    contribution: 'c',
  };
  const merged = editor.mergeEntry(
    data,
    { position: null, upstream: null, cover: null, roles: null, links: null, usedIn: null, draft: null, contribution: null },
    WORK,
  );
  assert.deepEqual(merged, { title: 'T', roles: [], links: [], usedIn: [], draft: false });
  assert.deepEqual(Object.keys(merged), ['title', 'roles', 'links', 'usedIn', 'draft']);
  assert.deepEqual(editor.mergeEntry({ a: 1, title: 'T' }, { title: 'U', position: 'new' }, WORK), { a: 1, title: 'U', position: 'new' });
  assert.deepEqual(Object.keys(editor.mergeEntry({ title: 'T', kind: 'game' }, { title: 'U', position: 'new' }, WORK)), ['title', 'kind', 'position']);
});

test('an unchanged Keystatic-written entry loads and dumps to identical bytes', () => {
  for (const [text, def] of [
    [KEYSTATIC_ENTRY, WORK],
    [WORK_WITH_IMAGES, WORK],
    [ONLY_REQUIRED, WORK],
    [BLOG_ENTRY, BLOG],
  ]) {
    const parts = editor.splitEntry(text);
    const merged = editor.mergeEntry(editor.readFrontmatter(parts.front), {}, def);
    assert.equal(editor.serializeEntry(merged, parts.body), text);
  }
  const parts = editor.splitEntry(KEYSTATIC_ENTRY);
  assert.equal(editor.splitEntry(KEYSTATIC_ENTRY.replace(/\n/g, '\r\n')).body, parts.body, 'CRLF is accepted on read');
  assert.equal(editor.splitEntry('no frontmatter\n'), null);
  assert.equal(editor.splitEntry('---\nunclosed: true\n'), null);
});

test('GET returns the values, the body, the hash of the bytes and the form', async () => {
  put('get-me.md', KEYSTATIC_ENTRY);
  const res = await call('GET', '/__editor/work/get-me');
  assert.equal(res.status, 200);
  assert.equal(res.body.id, 'get-me');
  assert.equal(res.body.hash, editor.sha256(Buffer.from(KEYSTATIC_ENTRY, 'utf8')));
  const { values } = res.body;
  assert.equal(values.title, 'Sample entry');
  assert.equal(values.draft, false);
  assert.equal(values.featured, true);
  assert.equal(values.started, '2026-10-14');
  assert.deepEqual(values.roles, ['director', 'designer']);
  assert.deepEqual(values.links, [{ type: 'source', url: 'https://example.com/source' }]);
  assert.deepEqual(values.gallery, []);
  assert.match(values.contribution, /^Came up with the tool/);
  assert.equal('body' in values, false);
  assert.equal('cover' in values, false);
  assert.equal(res.body.body, 'Body paragraph.\n\n- one\n- two\n');
  assert.deepEqual(Object.keys(values), WORK.fields.map((f) => f.name).filter((n) => n in values));
  assert.equal(noTemp(workDir), true);
});

test('GET form mirrors the registry without the editor-irrelevant keys', async () => {
  put('form-me.md', KEYSTATIC_ENTRY);
  put('opt-banana.md', ONLY_REQUIRED.replace('title: Bare', 'title: banana').replace('featured: false', 'featured: false\ndraft: true'));
  put('opt-apple.md', ONLY_REQUIRED.replace('title: Bare', 'title: Apple'));
  put('opt-broken.md', '---\ntitle: [unclosed\n---\n');
  put('opt-slugged.md', ONLY_REQUIRED.replace('title: Bare', 'title: Cherry\nslug: cherry-pie'));
  const res = await call('GET', '/__editor/work/form-me');
  const { form } = res.body;
  assert.deepEqual(Object.keys(form), ['label', 'dir', 'assets', 'fields']);
  assert.equal(form.label, 'Work');
  assert.equal(form.dir, 'src/content/work');
  assert.equal(form.assets, 'src/assets');
  assert.deepEqual(form.fields.map((f) => f.name), WORK.fields.map((f) => f.name));
  assert.deepEqual(form.fields.map((f) => f.type), WORK.fields.map((f) => f.type));
  const text = JSON.stringify(form);
  for (const gone of ['itemLabel', 'initial', 'refine', 'reserved', 'columns']) {
    assert.equal(text.includes(`"${gone}"`), false, `${gone} must not be sent`);
  }
  const kind = form.fields.find((f) => f.name === 'kind');
  assert.equal(kind.required, true);
  assert.deepEqual(kind.options[0], { value: 'software', label: WORK.fields[0].options[0].label });
  const links = form.fields.find((f) => f.name === 'links');
  assert.deepEqual(links.fields.map((f) => f.name), ['label', 'type', 'url']);
  assert.deepEqual(links.default, []);
  assert.equal(form.fields.find((f) => f.name === 'position').default, '');

  const options = form.fields.find((f) => f.name === 'usedIn').options;
  const values = options.map((o) => o.value);
  assert.equal(values.includes('form-me'), false, 'the entry itself is left out');
  assert.equal(values.includes('opt-broken'), false, 'files that fail to parse are skipped');
  assert.equal(values.includes('opt-slugged'), false, 'an explicit slug replaces the file name id');
  assert.deepEqual(options.find((o) => o.value === 'opt-banana'), { value: 'opt-banana', label: 'banana', draft: true });
  assert.deepEqual(options.find((o) => o.value === 'opt-apple'), { value: 'opt-apple', label: 'Apple' });
  assert.deepEqual(options.find((o) => o.value === 'cherry-pie'), { value: 'cherry-pie', label: 'Cherry' });
  const labels = options.map((o) => o.label.toLowerCase());
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
  assert.ok(labels.indexOf('apple') < labels.indexOf('banana'), 'sorted case-insensitively');

  const blog = await call('GET', '/__editor/blog/nope-post');
  assert.equal(blog.status, 404);
});

test('GET refs options: an empty target collection gives an empty list', async () => {
  writeFileSync(path.join(emptyRoot, 'src', 'content', 'blog', 'lonely.md'), BLOG_ENTRY);
  const res = await call('GET', '/__editor/blog/lonely', { root: emptyRoot });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.form.fields.find((f) => f.name === 'work').options, []);
});

test('an entry with only required keys: GET holds only those, an empty save keeps the bytes', async () => {
  put('bare.md', ONLY_REQUIRED);
  const res = await call('GET', '/__editor/work/bare');
  assert.deepEqual(Object.keys(res.body.values).sort(), ['authorship', 'featured', 'kind', 'origin', 'started', 'status', 'team', 'title']);
  assert.equal(res.body.body, '');
  const saved = await call('PUT', '/__editor/work/bare', { body: { hash: res.body.hash, set: {} } });
  assert.equal(saved.status, 200);
  assert.equal(read('bare.md'), ONLY_REQUIRED);
});

test('PUT writes the file the way Keystatic would, keeping key order and date format', async () => {
  put('save-me.md', KEYSTATIC_ENTRY);
  const hash = (await call('GET', '/__editor/work/save-me')).body.hash;
  const res = await call('PUT', '/__editor/work/save-me?x=1', {
    body: { hash, set: { title: 'Renamed entry', draft: true, contribution: 'Short line.\r\nSecond line.  ' }, body: 'New body\r\nwith CRLF' },
  });
  assert.equal(res.status, 200);
  const written = read('save-me.md');
  const expected = KEYSTATIC_ENTRY.replace('title: Sample entry', 'title: Renamed entry')
    .replace('draft: false', 'draft: true')
    .replace(/contribution: >\n {2}Came[^\n]*\n[^\n]*\n/, 'contribution: |-\n  Short line.\n  Second line.\n')
    .replace(/---\nBody paragraph[\s\S]*$/, '---\nNew body\nwith CRLF\n');
  assert.equal(written, expected);
  assert.match(written, /^started: 2026-10-14$/m, 'dates stay plain YYYY-MM-DD');
  assert.equal(res.body.hash, editor.sha256(Buffer.from(written, 'utf8')));
  assert.deepEqual(Object.keys(load(editor.splitEntry(written).front)), Object.keys(load(editor.splitEntry(KEYSTATIC_ENTRY).front)));
  assert.equal(noTemp(workDir), true);
  assert.equal(readdirSync(workDir).includes('save-me.md'), true, 'the file name does not change with the title');
});

test('PUT without body keeps the existing body, and an unchanged save keeps the bytes', async () => {
  put('keep-body.md', KEYSTATIC_ENTRY);
  const res = await save('keep-body', {});
  assert.equal(res.status, 200);
  assert.equal(read('keep-body.md'), KEYSTATIC_ENTRY);
});

test('PUT writes a changed date, kind, roles, links and usedIn as Keystatic would', async () => {
  put('typed.md', KEYSTATIC_ENTRY);
  const res = await save('typed', {
    started: '2026-11-02',
    kind: 'game',
    roles: ['artist', 'director'],
    links: [
      { label: 'Play now', type: 'play', url: 'https://example.com/play' },
      { type: 'source', url: 'https://example.com/source' },
    ],
    usedIn: ['other-thing'],
  });
  assert.equal(res.status, 200);
  const expected = KEYSTATIC_ENTRY.replace('started: 2026-10-14', 'started: 2026-11-02')
    .replace('kind: software', 'kind: game')
    .replace('  - director\n  - designer\n', '  - artist\n  - director\n')
    .replace(
      /links:\n {2}- type: source\n {4}url: https:\/\/example.com\/source\n/,
      'links:\n  - label: Play now\n    type: play\n    url: https://example.com/play\n  - type: source\n    url: https://example.com/source\n',
    )
    .replace('usedIn: []', 'usedIn:\n  - other-thing');
  assert.equal(read('typed.md'), expected);

  const again = await save('typed', {
    links: [
      { type: 'source', url: 'https://example.com/source' },
      { label: 'Play now', type: 'play', url: 'https://example.com/play' },
    ],
  });
  assert.equal(again.status, 200);
  assert.match(read('typed.md'), /links:\n {2}- type: source\n {4}url: https:\/\/example.com\/source\n {2}- label: Play now\n/);
});

test('PUT with null removes text, url and image keys and writes [] for list, tags and refs', async () => {
  put('nulls.md', WORK_WITH_IMAGES.replace('origin: original', 'origin: original\nupstream: https://example.com/up').replace('usedIn: []', 'usedIn:\n  - a'));
  const res = await save('nulls', { position: null, upstream: null, cover: null, contribution: null, roles: null, tools: null, links: null, usedIn: null, gallery: null });
  assert.equal(res.status, 200);
  const data = load(editor.splitEntry(read('nulls.md')).front);
  for (const key of ['position', 'upstream', 'cover', 'contribution']) assert.equal(key in data, false, `${key} is removed`);
  for (const key of ['roles', 'tools', 'links', 'usedIn', 'gallery']) assert.deepEqual(data[key], [], `${key} is []`);
  assert.equal(data.title, 'Sample entry');
  assert.match(read('nulls.md'), /^links: \[\]$/m);
  assert.equal(noTemp(workDir), true);
});

test('PUT with a list item value of null or empty text removes that key from the item', async () => {
  put('items.md', KEYSTATIC_ENTRY.replace('  - type: source\n    url: https://example.com/source\n', '  - label: Named\n    type: source\n    url: https://example.com/source\n'));
  const res = await save('items', { links: [{ label: null, type: 'source', url: 'https://example.com/source' }] });
  assert.equal(res.status, 200);
  assert.equal(read('items.md'), KEYSTATIC_ENTRY);
  const empty = await save('items', { links: [{ label: '', type: 'source', url: 'https://example.com/source' }] });
  assert.equal(empty.status, 200);
  assert.equal(read('items.md'), KEYSTATIC_ENTRY);
});

test('PUT keeps image paths the entry references and refuses any other', async () => {
  put('imaged.md', WORK_WITH_IMAGES);
  const gallery = '../../assets/sample/gallery/0/image.png';
  const other = '../../assets/sample/gallery/1/image.png';

  const same = await save('imaged', { cover: '../../assets/sample/cover.png' });
  assert.equal(same.status, 200);
  assert.equal(read('imaged.md'), WORK_WITH_IMAGES);

  const reordered = await save('imaged', { gallery: [{ image: other }, { image: gallery, caption: 'First' }] });
  assert.equal(reordered.status, 200);
  assert.match(read('imaged.md'), /gallery:\n {2}- image: \S+1\/image\.png\n {2}- image: \S+0\/image\.png\n {4}caption: First\n/);

  const moved = await save('imaged', { cover: gallery });
  assert.equal(moved.status, 200, 'a path referenced in any image field is allowed');

  const before = read('imaged.md');
  const foreign = await save('imaged', { cover: '../../assets/elsewhere/cover.png' });
  assert.equal(foreign.status, 400);
  assert.equal(foreign.body.error, 'Image "../../assets/elsewhere/cover.png" is not referenced by this entry.');
  const foreignItem = await save('imaged', { gallery: [{ image: '../../assets/elsewhere/x.png' }] });
  assert.equal(foreignItem.status, 400);
  const upload = await save('imaged', { cover: { upload: 'x' } });
  assert.equal(upload.status, 400);
  assert.equal(upload.body.error, 'Unknown upload token.');
  assert.equal(read('imaged.md'), before);

  const removed = await save('imaged', { cover: null });
  assert.equal(removed.status, 200);
  assert.doesNotMatch(read('imaged.md'), /^cover:/m);
  const readded = await save('imaged', { cover: '../../assets/sample/cover.png' });
  assert.equal(readded.status, 400, 'a removed image is no longer referenced');
});

test('blog posts resolve, GET and PUT like work entries', async () => {
  putPost('a-post.md', BLOG_ENTRY);
  const get = await call('GET', '/__editor/blog/a-post');
  assert.equal(get.status, 200);
  assert.equal(get.body.id, 'a-post');
  assert.equal(get.body.values.date, '2026-10-20');
  assert.equal(get.body.values.title, 'A post');
  assert.deepEqual(get.body.values.work, ['sample-entry']);
  assert.equal('cover' in get.body.values, false);
  assert.equal(get.body.body, 'Post body.\n');
  assert.equal(get.body.form.label, 'Blog');
  assert.equal(get.body.form.fields[0].name, 'date');
  assert.deepEqual(get.body.form.fields.map((f) => f.name), BLOG.fields.map((f) => f.name));
  const refs = get.body.form.fields.find((f) => f.name === 'work').options;
  assert.ok(refs.some((o) => o.value === 'get-me'), 'work options come from the work folder');
  assert.equal(refs.some((o) => o.value === 'a-post'), false);

  const res = await call('PUT', '/__editor/blog/a-post', {
    body: { hash: get.body.hash, set: { title: 'Renamed post', pinned: true, summary: null, date: '2026-11-01', work: [] }, body: 'New text' },
  });
  assert.equal(res.status, 200);
  assert.equal(
    readPost('a-post.md'),
    '---\ndate: 2026-11-01\npinned: true\nfeatured: false\ndraft: true\ntitle: Renamed post\nwork: []\n---\nNew text\n',
  );
  assert.equal(noTemp(blogDir), true);

  const cover = await call('PUT', '/__editor/blog/a-post', {
    body: { hash: res.body.hash, set: { cover: '../../assets/blog/a-post/cover.png' } },
  });
  assert.equal(cover.status, 400, 'a post without a cover references no image');
  const work = await call('PUT', '/__editor/blog/a-post', { body: { hash: res.body.hash, set: { kind: 'game' } } });
  assert.equal(work.status, 400, 'a work field is not a blog field');
});

test('unknown collections, wrong shapes and missing entries are 404', async () => {
  for (const url of [
    '/__editor/nope/x',
    '/__editor/work/a/b',
    '/__editor/work',
    '/__editor/work/',
    '/__editor/',
    '/__editor/__proto__/x',
    '/__editor/constructor/x',
    '/__editor/work/does-not-exist',
    '/__editor/work/..%2Fget-me',
    '/__editor/work%2Fget-me',
    '/__editor/work/%E0%A4%A',
  ]) {
    const res = await call('GET', url);
    assert.equal(res.status, 404, url);
    assert.deepEqual(res.body, { error: 'No such entry.' });
  }
});

test('PUT failures write nothing', async () => {
  put('guarded.md', KEYSTATIC_ENTRY);
  put('ai-entry.md', KEYSTATIC_ENTRY.replace('  - director\n', '  - programmer\n'));
  const hash = (await call('GET', '/__editor/work/guarded')).body.hash;

  const stale = await call('PUT', '/__editor/work/guarded', { body: { hash: '0'.repeat(64), set: { title: 'x' } } });
  assert.equal(stale.status, 409);
  const empty = await call('PUT', '/__editor/work/guarded', { body: { hash, set: { title: '' } } });
  assert.equal(empty.status, 400);
  const unknown = await call('PUT', '/__editor/work/guarded', { body: { hash, set: { kind: 'nope' } } });
  assert.equal(unknown.status, 400);
  const badDate = await call('PUT', '/__editor/work/guarded', { body: { hash, set: { started: '2026-13-01' } } });
  assert.equal(badDate.status, 400);
  const uploads = await call('PUT', '/__editor/work/guarded', { body: { hash, set: {}, uploads: 'x' } });
  assert.equal(uploads.status, 400);
  const malformed = await call('PUT', '/__editor/work/guarded', { body: '{' });
  assert.equal(malformed.status, 400);
  const tooLarge = await call('PUT', '/__editor/work/guarded', { body: Object.assign(new Error('big'), { code: 'TOO_LARGE' }) });
  assert.equal(tooLarge.status, 413);
  const missing = await call('PUT', '/__editor/work/does-not-exist', { body: { hash, set: {} } });
  assert.equal(missing.status, 404);
  const escape = await call('PUT', '/__editor/work/..%2Fguarded', { body: { hash, set: {} } });
  assert.equal(escape.status, 404);
  const evil = await call('PUT', '/__editor/work/guarded', {
    body: { hash, set: {} },
    headers: { origin: 'http://evil.example' },
  });
  assert.equal(evil.status, 403);
  const plain = await call('PUT', '/__editor/work/guarded', {
    body: { hash, set: {} },
    headers: { 'content-type': 'text/plain' },
  });
  assert.equal(plain.status, 403);
  const remote = await call('GET', '/__editor/work/guarded', { remoteAddress: '192.168.1.20' });
  assert.equal(remote.status, 403);
  assert.equal((await call('DELETE', '/__editor/work/guarded')).status, 405);
  assert.equal(read('guarded.md'), KEYSTATIC_ENTRY);

  const aiHash = (await call('GET', '/__editor/work/ai-entry')).body.hash;
  const ai = await call('PUT', '/__editor/work/ai-entry', { body: { hash: aiHash, set: { contribution: 'x' } } });
  assert.equal(ai.status, 422);
  assert.equal(ai.body.issues[0].path[0], 'roles');

  put('no-front.md', 'just text\n');
  const noFront = await call('GET', '/__editor/work/no-front');
  assert.equal(noFront.status, 422);
  assert.equal(read('no-front.md'), 'just text\n');
  assert.equal(noTemp(workDir), true);
});

test('only paths under the base are answered', async () => {
  assert.equal(await call('GET', '/other/path'), null);
  assert.equal(await call('GET', '/__editor/work/get-me', { base: '/dev/' }), null);
  assert.equal((await call('GET', '/dev/__editor/work/get-me', { base: '/dev/' })).status, 200);
});

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_SIG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const png = (tag) => Buffer.concat([PNG_SIG, Buffer.from(`png-${tag}`)]);
const jpg = (tag) => Buffer.concat([JPG_SIG, Buffer.from(`jpg-${tag}`)]);
const upload = (token, name, bytes) => ({ token, name, data: bytes.toString('base64') });

const assetsDir = () => path.join(dir, 'src', 'assets');
const files = (sub = '') => {
  const out = [];
  const walk = (folder, prefix) => {
    let names = [];
    try {
      names = readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of names) {
      if (entry.isDirectory()) {
        out.push(`${prefix}${entry.name}/`);
        walk(path.join(folder, entry.name), `${prefix}${entry.name}/`);
      } else out.push(`${prefix}${entry.name}`);
    }
  };
  walk(path.join(assetsDir(), sub), '');
  return out.sort();
};
const putAsset = (rel, bytes) => {
  const file = path.join(assetsDir(), rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
};
const readAsset = (rel) => readFileSync(path.join(assetsDir(), rel));
const withImages = (cover, gallery) => {
  let text = KEYSTATIC_ENTRY;
  if (gallery.length) text = text.replace('gallery: []', `gallery:\n${gallery.map((g) => `  - image: ${g}\n`).join('')}`);
  return cover ? text.replace('usedIn: []', `cover: ${cover}\nusedIn: []`) : text;
};
const saveWith = async (id, set, extra = {}, collection = 'work') => {
  const hash = (await call('GET', `/__editor/${collection}/${id}`)).body.hash;
  return call('PUT', `/__editor/${collection}/${id}`, { body: { hash, set, ...extra } });
};

test('sniffType recognises the five types and refuses SVG, text and empty bytes', () => {
  assert.equal(assets.sniffType(png('a')), 'png');
  assert.equal(assets.sniffType(jpg('a')), 'jpg');
  assert.equal(assets.sniffType(Buffer.from('GIF87a....')), 'gif');
  assert.equal(assets.sniffType(Buffer.from('GIF89a....')), 'gif');
  assert.equal(assets.sniffType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])), 'webp');
  assert.equal(assets.sniffType(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavif')])), 'avif');
  assert.equal(assets.sniffType(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypavis')])), 'avif');
  assert.equal(assets.sniffType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(assets.sniffType(Buffer.from('just text')), null);
  assert.equal(assets.sniffType(Buffer.alloc(0)), null);
});

test('body image stems follow the slug rule, cut at 40 characters, with an image fallback', () => {
  assert.equal(assets.bodyStem('My Cool Pic.PNG', toolSlug), 'my-cool-pic');
  assert.equal(assets.bodyStem(`${'x'.repeat(60)}.png`, toolSlug), 'x'.repeat(40));
  assert.equal(assets.bodyStem(`${'a'.repeat(39)} b.png`, toolSlug), 'a'.repeat(39));
  assert.equal(assets.bodyStem('日本.png', toolSlug), 'image');
});

test('uploads: type and size limits answer 415 and 413 and write nothing', async () => {
  put('limits.md', KEYSTATIC_ENTRY);
  const svg = await saveWith('limits', { cover: { upload: 'a' } }, { uploads: [upload('a', 'logo.svg', Buffer.from('<svg></svg>'))] });
  assert.equal(svg.status, 415);
  assert.match(svg.body.error, /logo\.svg.*PNG, JPEG, WebP, AVIF or GIF/);
  const big = Buffer.concat([PNG_SIG, Buffer.alloc(10 * 1024 * 1024 - 7)]);
  assert.equal(big.length, 10 * 1024 * 1024 + 1);
  const over = await saveWith('limits', { cover: { upload: 'a' } }, { uploads: [upload('a', 'big.png', big)] });
  assert.equal(over.status, 413);
  assert.match(over.body.error, /big\.png.*10 MB/);
  assert.equal(read('limits.md'), KEYSTATIC_ENTRY);
  assert.deepEqual(files('limits'), []);
});

test('uploads: unknown and unused tokens are 400, a schema failure writes no image', async () => {
  put('tokens.md', KEYSTATIC_ENTRY);
  const unknown = await saveWith('tokens', { cover: { upload: 'zz' } }, { uploads: [] });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error, 'Unknown upload token.');
  const unknownBody = await saveWith('tokens', {}, { body: '![](upload:zz)', uploads: [] });
  assert.equal(unknownBody.status, 400);
  const unused = await saveWith('tokens', {}, { uploads: [upload('u1', 'a.png', png('u'))] });
  assert.equal(unused.status, 400);
  assert.equal(unused.body.error, 'Unused upload "u1".');
  put('rejected.md', KEYSTATIC_ENTRY.replace('  - director\n', '  - programmer\n'));
  const invalid = await saveWith('rejected', { cover: { upload: 'c' } }, { uploads: [upload('c', 'a.png', png('c'))] });
  assert.equal(invalid.status, 422);
  assert.deepEqual(files('rejected'), []);
  assert.equal(read('tokens.md'), KEYSTATIC_ENTRY);
});

test('a cover upload lands as cover.<detected ext> in the entry folder and a replaced cover is deleted', async () => {
  put('cover-up.md', KEYSTATIC_ENTRY);
  const first = await saveWith('cover-up', { cover: { upload: 'c1' } }, { uploads: [upload('c1', 'Photo.JPEG', png('c'))] });
  assert.equal(first.status, 200);
  assert.match(read('cover-up.md'), /^cover: \.\.\/\.\.\/assets\/cover-up\/cover\.png$/m);
  assert.deepEqual(files('cover-up'), ['cover.png']);
  assert.deepEqual(readAsset('cover-up/cover.png'), png('c'));
  assert.equal(noTemp(path.join(assetsDir(), 'cover-up')), true);

  const same = await saveWith('cover-up', { title: 'Renamed' });
  assert.equal(same.status, 200);
  assert.deepEqual(files('cover-up'), ['cover.png']);

  const replaced = await saveWith('cover-up', { cover: { upload: 'c2' } }, { uploads: [upload('c2', 'x.png', jpg('c'))] });
  assert.equal(replaced.status, 200);
  assert.match(read('cover-up.md'), /^cover: \.\.\/\.\.\/assets\/cover-up\/cover\.jpg$/m);
  assert.deepEqual(files('cover-up'), ['cover.jpg']);

  const removed = await saveWith('cover-up', { cover: null });
  assert.equal(removed.status, 200);
  assert.doesNotMatch(read('cover-up.md'), /^cover:/m);
  assert.deepEqual(files('cover-up'), []);
});

test('gallery uploads land as gallery/<i>/image.<ext>', async () => {
  put('gal-up.md', KEYSTATIC_ENTRY);
  const res = await saveWith(
    'gal-up',
    { gallery: [{ image: { upload: 'g1' }, caption: 'One' }, { image: { upload: 'g2' } }] },
    { uploads: [upload('g1', 'a.png', png('1')), upload('g2', 'b.png', jpg('2'))] },
  );
  assert.equal(res.status, 200);
  assert.match(read('gal-up.md'), /gallery:\n {2}- image: \.\.\/\.\.\/assets\/gal-up\/gallery\/0\/image\.png\n {4}caption: One\n {2}- image: \.\.\/\.\.\/assets\/gal-up\/gallery\/1\/image\.jpg\n/);
  assert.deepEqual(files('gal-up'), ['gallery/', 'gallery/0/', 'gallery/0/image.png', 'gallery/1/', 'gallery/1/image.jpg']);
});

test('reordering [A,B] to [B,A] leaves gallery/0 = B and gallery/1 = A', async () => {
  const link = (i) => `../../assets/reorder/gallery/${i}/image.png`;
  putAsset('reorder/gallery/0/image.png', png('A'));
  putAsset('reorder/gallery/1/image.png', png('B'));
  put('reorder.md', withImages(null, [link(0), link(1)]));
  const res = await saveWith('reorder', { gallery: [{ image: link(1) }, { image: link(0) }] });
  assert.equal(res.status, 200);
  assert.deepEqual(readAsset('reorder/gallery/0/image.png'), png('B'));
  assert.deepEqual(readAsset('reorder/gallery/1/image.png'), png('A'));
  assert.match(read('reorder.md'), new RegExp(`- image: ${link(0).replace(/\./g, '\\.')}\\n {2}- image: ${link(1).replace(/\./g, '\\.')}\\n`));
  assert.deepEqual(files('reorder'), ['gallery/', 'gallery/0/', 'gallery/0/image.png', 'gallery/1/', 'gallery/1/image.png']);
});

test('removing item 0 of 3 leaves two folders and no gallery/2', async () => {
  const link = (i) => `../../assets/remove3/gallery/${i}/image.png`;
  ['A', 'B', 'C'].forEach((tag, i) => putAsset(`remove3/gallery/${i}/image.png`, png(tag)));
  put('remove3.md', withImages(null, [link(0), link(1), link(2)]));
  const res = await saveWith('remove3', { gallery: [{ image: link(1) }, { image: link(2) }] });
  assert.equal(res.status, 200);
  assert.deepEqual(readAsset('remove3/gallery/0/image.png'), png('B'));
  assert.deepEqual(readAsset('remove3/gallery/1/image.png'), png('C'));
  assert.deepEqual(files('remove3'), ['gallery/', 'gallery/0/', 'gallery/0/image.png', 'gallery/1/', 'gallery/1/image.png']);
});

test('a cover pointing at shared/ ends at <id>/cover.<ext> and shared/ keeps its file', async () => {
  putAsset('shared/x.png', png('S'));
  put('from-shared.md', withImages('../../assets/shared/x.png', []));
  const res = await saveWith('from-shared', { title: 'Moved' });
  assert.equal(res.status, 200);
  assert.match(read('from-shared.md'), /^cover: \.\.\/\.\.\/assets\/from-shared\/cover\.png$/m);
  assert.deepEqual(readAsset('from-shared/cover.png'), png('S'));
  assert.deepEqual(readAsset('shared/x.png'), png('S'));

  putAsset('shared/y.png', png('Y'));
  put('shared-cover.md', withImages('../../assets/shared/y.png', []));
  const replaced = await saveWith('shared-cover', { cover: { upload: 'n' } }, { uploads: [upload('n', 'n.png', png('N'))] });
  assert.equal(replaced.status, 200);
  assert.deepEqual(readAsset('shared/y.png'), png('Y'), 'a file in shared/ is never deleted');
  assert.deepEqual(readAsset('shared-cover/cover.png'), png('N'));
});

test('a save with no image change writes no image file', async () => {
  putAsset('no-img/cover.png', png('K'));
  putAsset('no-img/gallery/0/image.png', png('G'));
  put('no-img.md', withImages('../../assets/no-img/cover.png', ['../../assets/no-img/gallery/0/image.png']));
  const stamp = () => ['no-img/cover.png', 'no-img/gallery/0/image.png'].map((rel) => statSync(path.join(assetsDir(), rel)).mtimeMs);
  const before = stamp();
  const listing = files('no-img');
  const res = await saveWith('no-img', { title: 'Only the title' });
  assert.equal(res.status, 200);
  assert.deepEqual(stamp(), before);
  assert.deepEqual(files('no-img'), listing);
});

test('a replaced image is kept when another file references it', async () => {
  putAsset('kept/cover.png', png('K'));
  put('kept.md', withImages('../../assets/kept/cover.png', []));
  put('kept-ref.md', withImages('../../assets/kept/cover.png', []));
  const res = await saveWith('kept', { cover: { upload: 'k' } }, { uploads: [upload('k', 'k.png', jpg('K'))] });
  assert.equal(res.status, 200);
  assert.deepEqual(files('kept'), ['cover.jpg', 'cover.png']);
});

test('if the entry write fails every target gets its previous bytes back and new files are removed', async () => {
  putAsset('rollback/cover.png', png('before'));
  const original = withImages('../../assets/rollback/cover.png', []);
  put('rollback.md', original);
  const hash = (await call('GET', '/__editor/work/rollback')).body.hash;
  const res = await editor.handleRequest(
    {
      method: 'PUT',
      url: '/__editor/work/rollback',
      remoteAddress: '127.0.0.1',
      headers: { host: 'localhost:4321', ...sameOrigin },
      readBody: async () =>
        JSON.stringify({
          hash,
          set: { cover: { upload: 'a' }, gallery: [{ image: { upload: 'b' } }] },
          uploads: [upload('a', 'a.png', png('after')), upload('b', 'b.png', png('new'))],
        }),
    },
    {
      root: dir,
      base: '/',
      loadRegistry: async () => registry,
      write: async () => {
        throw new editor.HttpError(500, 'Could not write the file.');
      },
    },
  );
  assert.equal(res.status, 500);
  assert.deepEqual(readAsset('rollback/cover.png'), png('before'));
  assert.deepEqual(files('rollback'), ['cover.png']);
  assert.equal(read('rollback.md'), original);
});

test('a post: cover and body image land in src/assets/blog/<id>/, body names get -2 on a clash and reuse on equal bytes', async () => {
  putPost('post-img.md', BLOG_ENTRY);
  const first = await saveWith(
    'post-img',
    { cover: { upload: 'c' } },
    { body: 'Text\n\n![first](upload:b1)\n', uploads: [upload('c', 'c.png', png('cover')), upload('b1', 'Hello World.png', png('one'))] },
    'blog',
  );
  assert.equal(first.status, 200);
  assert.match(readPost('post-img.md'), /^cover: \.\.\/\.\.\/assets\/blog\/post-img\/cover\.png$/m);
  assert.match(readPost('post-img.md'), /!\[first\]\(\.\.\/\.\.\/assets\/blog\/post-img\/hello-world\.png\)/);
  assert.deepEqual(files('blog/post-img'), ['cover.png', 'hello-world.png']);

  const body = () => readPost('post-img.md').split('\n---\n')[1];
  const second = await saveWith(
    'post-img',
    {},
    { body: `${body()}\n![second](upload:b2)\n![cover](upload:b4)\n`, uploads: [upload('b2', 'Hello World.png', png('two')), upload('b4', 'cover.png', png('other'))] },
    'blog',
  );
  assert.equal(second.status, 200);
  assert.deepEqual(files('blog/post-img'), ['cover-2.png', 'cover.png', 'hello-world-2.png', 'hello-world.png']);

  const third = await saveWith('post-img', {}, { body: `${body()}\n![again](upload:b3)\n`, uploads: [upload('b3', 'Hello World.png', png('one'))] }, 'blog');
  assert.equal(third.status, 200);
  assert.deepEqual(files('blog/post-img'), ['cover-2.png', 'cover.png', 'hello-world-2.png', 'hello-world.png']);
  assert.match(body(), /!\[again\]\(\.\.\/\.\.\/assets\/blog\/post-img\/hello-world\.png\)/);

  const trimmed = body().replace(/!\[second\]\([^)]*\)\n?/, '');
  const fourth = await saveWith('post-img', {}, { body: trimmed }, 'blog');
  assert.equal(fourth.status, 200);
  assert.deepEqual(files('blog/post-img'), ['cover-2.png', 'cover.png', 'hello-world.png']);
  assert.equal(noTemp(path.join(assetsDir(), 'blog', 'post-img')), true);
});
