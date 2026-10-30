import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const editor = await import(pathToFileURL(path.join(ROOT, 'integrations', 'work-editor', 'file.mjs')).href);
const { load } = await import('js-yaml');

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

const standInSchema = {
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

let dir;
let workDir;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'work-editor-'));
  workDir = path.join(dir, 'work');
  mkdirSync(workDir);
});

after(() => rmSync(dir, { recursive: true, force: true }));

const put = (name, text) => writeFileSync(path.join(workDir, name), text);
const read = (name) => readFileSync(path.join(workDir, name), 'utf8');

const loopback = { remoteAddress: '127.0.0.1' };
const sameOrigin = { host: 'localhost:4321', origin: 'http://localhost:4321', 'content-type': 'application/json' };
const call = (method, url, { body, headers = {}, remoteAddress = '127.0.0.1', base = '/', schema = standInSchema } = {}) =>
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
    { workDir, base, loadSchema: async () => schema },
  );

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

test('updates: allow-list and types', () => {
  const bad = (payload) => assert.throws(() => editor.parseUpdate(payload), (err) => err.status === 400);
  bad(null);
  bad([]);
  bad({ set: {} });
  bad({ hash: 'h' });
  bad({ hash: 'h', set: [] });
  bad({ hash: 'h', set: {}, extra: 1 });
  bad({ hash: 'h', set: { kind: 'game' } });
  bad({ hash: 'h', set: { roles: ['artist'] } });
  bad({ hash: 'h', set: { slug: 'x' } });
  bad({ hash: 'h', set: { title: '' } });
  bad({ hash: 'h', set: { title: '   ' } });
  bad({ hash: 'h', set: { title: 3 } });
  bad({ hash: 'h', set: { contribution: null } });
  bad({ hash: 'h', set: { draft: 'true' } });
  bad({ hash: 'h', set: { featured: 1 } });
  bad({ hash: 'h', set: {}, body: 5 });

  assert.deepEqual(editor.parseUpdate({ hash: 'h', set: { title: '  New  ', contribution: ' a\r\nb \r\n', draft: false, featured: true } }), {
    hash: 'h',
    set: { title: 'New', contribution: 'a\nb', draft: false, featured: true },
    body: undefined,
  });
  assert.equal(editor.parseUpdate({ hash: 'h', set: { contribution: '' } }).set.contribution, '');
  assert.equal(editor.normalizeBody('a\r\nb'), 'a\nb\n');
  assert.equal(editor.normalizeBody(''), '');
  assert.equal(editor.normalizeBody('a\n'), 'a\n');
});

test('an unchanged Keystatic-written entry loads and dumps to identical bytes', () => {
  const parts = editor.splitEntry(KEYSTATIC_ENTRY);
  const merged = editor.mergeEntry(editor.readFrontmatter(parts.front), {});
  assert.equal(editor.serializeEntry(merged, parts.body), KEYSTATIC_ENTRY);
  assert.equal(editor.splitEntry(KEYSTATIC_ENTRY.replace(/\n/g, '\r\n')).body, parts.body, 'CRLF is accepted on read');
  assert.equal(editor.splitEntry('no frontmatter\n'), null);
  assert.equal(editor.splitEntry('---\nunclosed: true\n'), null);
});

test('GET returns the editable fields, the body and the hash of the bytes', async () => {
  put('get-me.md', KEYSTATIC_ENTRY);
  const res = await call('GET', '/__editor/work/get-me');
  assert.equal(res.status, 200);
  assert.equal(res.body.id, 'get-me');
  assert.equal(res.body.hash, editor.sha256(Buffer.from(KEYSTATIC_ENTRY, 'utf8')));
  assert.equal(res.body.fields.title, 'Sample entry');
  assert.equal(res.body.fields.draft, false);
  assert.equal(res.body.fields.featured, true);
  assert.deepEqual(Object.keys(res.body.fields).sort(), ['contribution', 'draft', 'featured', 'title']);
  assert.match(res.body.fields.contribution, /^Came up with the tool/);
  assert.equal(res.body.body, 'Body paragraph.\n\n- one\n- two\n');
  assert.equal(readdirSync(workDir).some((f) => f.endsWith('.editor-tmp')), false);
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
  assert.equal(readdirSync(workDir).some((f) => f.endsWith('.editor-tmp')), false);
  assert.equal(readdirSync(workDir).includes('save-me.md'), true, 'the file name does not change with the title');
});

test('PUT without body keeps the existing body, and an unchanged save keeps the bytes', async () => {
  put('keep-body.md', KEYSTATIC_ENTRY);
  const hash = (await call('GET', '/__editor/work/keep-body')).body.hash;
  const res = await call('PUT', '/__editor/work/keep-body', { body: { hash, set: {} } });
  assert.equal(res.status, 200);
  assert.equal(read('keep-body.md'), KEYSTATIC_ENTRY);
});

test('PUT failures write nothing', async () => {
  put('guarded.md', KEYSTATIC_ENTRY);
  put('ai-entry.md', KEYSTATIC_ENTRY.replace('  - director\n', '  - programmer\n'));
  const hash = (await call('GET', '/__editor/work/guarded')).body.hash;

  const stale = await call('PUT', '/__editor/work/guarded', { body: { hash: '0'.repeat(64), set: { title: 'x' } } });
  assert.equal(stale.status, 409);
  const empty = await call('PUT', '/__editor/work/guarded', { body: { hash, set: { title: '' } } });
  assert.equal(empty.status, 400);
  const unknown = await call('PUT', '/__editor/work/guarded', { body: { hash, set: { kind: 'game' } } });
  assert.equal(unknown.status, 400);
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
  assert.equal(readdirSync(workDir).some((f) => f.endsWith('.editor-tmp')), false);
});

test('only paths under the base are answered', async () => {
  assert.equal(await call('GET', '/other/path'), null);
  assert.equal(await call('GET', '/__editor/work/get-me', { base: '/dev/' }), null);
  assert.equal((await call('GET', '/dev/__editor/work/get-me', { base: '/dev/' })).status, 200);
});
