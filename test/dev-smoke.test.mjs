import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASTRO = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const ORIGIN = 'http://localhost:4321';
const REQUEST_TIMEOUT_MS = 120_000;
const START_TIMEOUT_MS = 120_000;
const MAX_PARALLEL = 6;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const readText = (abs) => readFileSync(abs, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

const entriesOf = (name) =>
  readdirSync(path.join(ROOT, 'src', 'content', name))
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const lines = readText(path.join(ROOT, 'src', 'content', name, file)).split('\n');
      const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
      const front = end === -1 ? [] : lines.slice(1, end);
      const value = (key) => front.find((l) => l.startsWith(`${key}:`))?.slice(key.length + 1).trim() ?? '';
      return {
        file,
        slug: value('slug').replace(/^["']|["']$/g, '') || file.slice(0, -3),
        draft: /^true\b/i.test(value('draft')),
        cover: value('cover') !== '',
      };
    });

const status = async (route) => {
  try {
    const res = await fetch(`${ORIGIN}${route}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    await res.body?.cancel();
    return res.status;
  } catch (err) {
    return `${err?.name ?? 'error'}: ${err?.message ?? ''}`;
  }
};

const failures = async (routes) => {
  const bad = [];
  const queue = [...routes];
  const worker = async () => {
    for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
      const code = await status(route);
      if (code !== 200) bad.push(`${route} -> ${code}`);
    }
  };
  await Promise.all(Array.from({ length: MAX_PARALLEL }, worker));
  return bad.sort();
};

let server = null;

before(async () => {
  if (process.env.CI) return;
  const probe = async () => {
    try {
      const res = await fetch(`${ORIGIN}/`, { signal: AbortSignal.timeout(3000) });
      await res.body?.cancel();
      return res.status;
    } catch {
      return null;
    }
  };
  const running = await probe();
  if (running === 200) return;
  assert.equal(running, null, `a server on localhost:4321 answers / with ${running}; stop it or run it without DEPLOY_TARGET`);
  const env = { ...process.env };
  delete env.DEPLOY_TARGET;
  server = spawn(process.execPath, [ASTRO, 'dev', '--port', '4321'], { cwd: ROOT, env, stdio: 'ignore' });
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline && (await probe()) !== 200) await sleep(1000);
  assert.equal(await probe(), 200,'astro dev did not answer 200 on localhost:4321');
});

after(() => {
  if (server) server.kill();
});

const skip = Boolean(process.env.CI);

test('dev server serves the home, the blog and every work entry, drafts included', { skip }, async () => {
  const work = entriesOf('work');
  const blog = entriesOf('blog');
  const routes = ['/', '/blog/', ...blog.map((p) => `/blog/${p.slug}/`), ...work.map((e) => `/work/${e.slug}/`)];
  assert.deepEqual(await failures(routes), []);
});

test('npm run build does not break draft covers on the running dev server', { skip }, async () => {
  const env = { ...process.env };
  delete env.DEPLOY_TARGET;
  const res = spawnSync('npm run build', { cwd: ROOT, env, shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const routes = entriesOf('work')
    .filter((e) => e.draft && e.cover)
    .map((e) => `/work/${e.slug}/`);
  assert.ok(routes.length > 0, 'no draft entry with a cover to re-request');
  assert.deepEqual(await failures(routes), []);
});

test('the editor endpoint saves through the real schema', { skip }, async () => {
  const source = entriesOf('work').find((entry) => !entry.draft);
  assert.ok(source, 'no published work entry to copy');
  const id = `editor-smoke-${randomBytes(4).toString('hex')}`;
  const target = path.join(ROOT, 'src', 'content', 'work', `${id}.md`);
  const lines = readText(path.join(ROOT, 'src', 'content', 'work', source.file)).split('\n');
  const end = lines.indexOf('---', 1);
  const front = lines.slice(1, end).filter((line) => !line.startsWith('slug:'));
  const drafted = front.some((line) => line.startsWith('draft:'))
    ? front.map((line) => (line.startsWith('draft:') ? 'draft: true' : line))
    : [...front, 'draft: true'];
  const json = { Origin: ORIGIN, 'Content-Type': 'application/json' };
  const url = `${ORIGIN}/__editor/work/${id}`;
  try {
    writeFileSync(target, ['---', ...drafted, '---', ...lines.slice(end + 1)].join('\n'));
    let got = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.status === 200) {
        got = await res.json();
        break;
      }
      await res.body?.cancel();
      await sleep(500);
    }
    assert.ok(got, `GET ${url} did not answer 200 within 30 s`);

    const title = `Editor smoke ${id.slice(-8)}`;
    const renamed = await fetch(url, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify({ hash: got.hash, set: { title } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    assert.equal(renamed.status, 200, await renamed.clone().text());
    const saved = await renamed.json();
    assert.ok(readText(target).includes(title), 'the file holds the new title');

    const refused = await fetch(url, {
      method: 'PUT',
      headers: json,
      body: JSON.stringify({ hash: saved.hash, set: { authorship: 'ai-built', roles: ['programmer'] } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const refusal = await refused.json();
    assert.equal(refused.status, 422, JSON.stringify(refusal));
    assert.ok(refusal.issues.some((issue) => issue.path[0] === 'roles'), JSON.stringify(refusal.issues));
  } finally {
    rmSync(target, { force: true });
    rmSync(path.join(ROOT, 'src', 'assets', id), { recursive: true, force: true });
  }
});
