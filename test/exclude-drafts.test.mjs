import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/exclude-drafts.mjs', import.meta.url));
const tmp = mkdtempSync(path.join(os.tmpdir(), 'exclude-drafts-'));

const abs = (rel) => path.join(tmp, ...rel.split('/'));
const write = (rel, text) => {
  mkdirSync(path.dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};
const git = (...args) => execFileSync('git', args, { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const run = (...args) =>
  spawnSync(process.execPath, [path.join(tmp, 'scripts', 'exclude-drafts.mjs'), ...args], { cwd: tmp, encoding: 'utf8' });
const exclude = () => readFileSync(abs('.git/info/exclude'), 'utf8');

before(() => {
  git('init', '-q');
  mkdirSync(abs('scripts'), { recursive: true });
  copyFileSync(SCRIPT, abs('scripts/exclude-drafts.mjs'));
  write('src/content/work/shown.md', '---\ntitle: Shown\ndraft: false\ncover: ../../assets/shown/cover.jpg\n---\n');
  write('src/content/work/hidden.md', '---\ntitle: Hidden\ndraft: true\ncover: ../../assets/hidden/cover.png\n---\n');
  write('src/assets/shown/cover.jpg', 'shown cover');
  write('src/assets/hidden/cover.png', 'hidden cover');
});

after(() => rmSync(tmp, { recursive: true, force: true }));

test('writes draft entries and their exclusive assets to the git exclude file', () => {
  const res = run();
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /drafts: 1 entries and 1 asset files kept out of git/);
  const text = exclude();
  assert.ok(text.includes('# >>> drafts (scripts/exclude-drafts.mjs) >>>'));
  assert.ok(text.includes('/src/content/work/hidden.md'));
  assert.ok(text.includes('/src/assets/hidden/cover.png'));
  assert.ok(!text.includes('shown'));
  assert.equal(git('status', '--porcelain', '--untracked-files=all').includes('hidden'), false);
});

test('is idempotent', () => {
  const before = exclude();
  assert.equal(run().status, 0);
  assert.equal(exclude(), before);
});

test('--staged blocks a staged draft entry and its asset', () => {
  git('add', '-f', '--', 'src/content/work/hidden.md', 'src/assets/hidden/cover.png');
  const res = run('--staged');
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stderr, /2 draft file\(s\) staged/);
  assert.match(res.stderr, /src\/content\/work\/hidden\.md/);
  assert.match(res.stderr, /src\/assets\/hidden\/cover\.png/);
  git('reset', '-q');
});

test('--staged lets a published entry through', () => {
  git('add', '--', 'src/content/work/shown.md', 'src/assets/shown/cover.jpg');
  const res = run('--staged');
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.equal(res.stderr, '');
});

test('publishing the draft removes its exclusions', () => {
  write('src/content/work/hidden.md', '---\ntitle: Hidden\ndraft: false\ncover: ../../assets/hidden/cover.png\n---\n');
  const res = run();
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /drafts: 0 entries and 0 asset files/);
  assert.ok(!exclude().includes('hidden'));
  assert.ok(existsSync(abs('src/content/work/hidden.md')));
});