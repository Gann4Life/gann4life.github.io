import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/dedupe-media.mjs', import.meta.url));
const tmp = mkdtempSync(path.join(os.tmpdir(), 'dedupe-media-'));
const BYTES = Buffer.from('identical bytes');

const abs = (rel) => path.join(tmp, ...rel.split('/'));
const write = (rel, data) => {
  mkdirSync(path.dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), data);
};
const run = (...args) =>
  spawnSync(process.execPath, [path.join(tmp, 'scripts', 'dedupe-media.mjs'), ...args], { cwd: tmp, encoding: 'utf8' });

before(() => {
  mkdirSync(abs('scripts'), { recursive: true });
  copyFileSync(SCRIPT, abs('scripts/dedupe-media.mjs'));
  write('public/media/a/one.png', BYTES);
  write('public/media/b/two.png', BYTES);
  write('public/media/c/unique.png', 'something else');
  write(
    'src/content/work/entry.md',
    '---\ntitle: Entry\ncover: /media/a/one.png\ngallery:\n  - /media/b/two.png\n  - /media/c/unique.png\n---\n',
  );
});

after(() => rmSync(tmp, { recursive: true, force: true }));

test('report mode lists the duplicate pair and exits 1 without changing anything', () => {
  const res = run();
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /DUPLICATE [0-9a-f]{16} keep public\/media\/shared\/[0-9a-f]{16}\.png remove public\/media\/a\/one\.png public\/media\/b\/two\.png/);
  assert.match(res.stdout, /dupes: 1 mergeable, 0 skipped/);
  assert.ok(existsSync(abs('public/media/a/one.png')));
  assert.ok(existsSync(abs('public/media/b/two.png')));
});

test('--fix merges the duplicates into shared/ and rewrites the references', () => {
  const res = run('--fix');
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /MERGED [0-9a-f]{16} -> public\/media\/shared\/[0-9a-f]{16}\.png \(removed 2, rewrote 1 files\)/);
  assert.ok(!existsSync(abs('public/media/a/one.png')));
  assert.ok(!existsSync(abs('public/media/b/two.png')));
  const h16 = createHash('sha256').update(BYTES).digest('hex').slice(0, 16);
  assert.ok(existsSync(abs(`public/media/shared/${h16}.png`)));
  const entry = readFileSync(abs('src/content/work/entry.md'), 'utf8');
  assert.ok(entry.includes(`/media/shared/${h16}.png`));
  assert.ok(!entry.includes('/media/a/one.png'));
  assert.ok(entry.includes('/media/c/unique.png'));
});

test('report mode is clean after the merge', () => {
  const res = run();
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /dupes: 0 mergeable, 0 skipped/);
});