import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = path.join(ROOT, 'dist');

const build = (target) => {
  const env = { ...process.env };
  delete env.DEPLOY_TARGET;
  if (target) env.DEPLOY_TARGET = target;
  return spawnSync('npm run build', { cwd: ROOT, env, shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
};

const htmlFiles = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((rel) => rel.endsWith('.html'))
    .map((rel) => path.join(dir, rel));

const TEXT_OUTPUTS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.webmanifest']);

const editorTraces = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && TEXT_OUTPUTS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => /data-edit-|data-editor|__editor|work-editor|js-yaml/.test(readFileSync(file).toString('latin1')))
    .map((file) => path.relative(dir, file));

test('staging build exits 0 and every root-absolute href and src sits under /dev/', () => {
  const res = build('staging');
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.ok(existsSync(path.join(DIST, 'index.html')));
  const outside = [];
  let checked = 0;
  for (const file of htmlFiles(DIST)) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/\b(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      checked++;
      if (!m[1].startsWith('/dev/')) outside.push(`${path.relative(DIST, file)}: ${m[1]}`);
    }
  }
  assert.ok(checked > 0, 'no root-absolute href or src found, the check proves nothing');
  assert.deepEqual(outside, []);
  assert.deepEqual(editorTraces(DIST), [], 'the page editor must leave no trace in the staging build');
});

test('production build exits 0', () => {
  const res = build(null);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.ok(existsSync(path.join(DIST, 'index.html')));
  assert.deepEqual(editorTraces(DIST), [], 'the page editor must leave no trace in the production build');
});