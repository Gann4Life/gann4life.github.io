import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classify, collect, frontmatterBlock, hostOf, isDraft } from '../scripts/check-urls.mjs';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'check-urls-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

const write = (rel, text) => {
  const abs = path.join(tmp, ...rel.split('/'));
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
};

test('classify marks transport errors as Broken', () => {
  assert.deepEqual(classify({ error: 'timeout' }, false), { state: 'Broken', detail: 'timeout' });
});

test('classify maps status codes', () => {
  assert.equal(classify({ status: 200, contentType: 'text/html' }, false).state, 'OK');
  assert.equal(classify({ status: 404, contentType: '' }, false).state, 'Broken');
  assert.equal(classify({ status: 500, contentType: '' }, false).state, 'Broken');
  for (const status of [401, 403, 429]) {
    assert.deepEqual(classify({ status, contentType: '' }, false), { state: 'Unverified', detail: String(status) });
  }
});

test('classify requires an image content type for appearance URLs', () => {
  assert.equal(classify({ status: 200, contentType: 'IMAGE/PNG' }, true).state, 'OK');
  const html = classify({ status: 200, contentType: 'text/html' }, true);
  assert.equal(html.state, 'Broken');
  assert.match(html.detail, /not an image/);
  assert.match(classify({ status: 200, contentType: '' }, true).detail, /no content-type/);
});

test('hostOf returns the host or an empty string', () => {
  assert.equal(hostOf('https://example.com/a?b=1'), 'example.com');
  assert.equal(hostOf('not a url'), '');
});

test('frontmatterBlock and isDraft read the frontmatter only', () => {
  assert.equal(frontmatterBlock('no frontmatter'), null);
  assert.equal(frontmatterBlock('---\ntitle: x\n'), null);
  assert.equal(isDraft(frontmatterBlock('---\ndraft: true\n---\nbody')), true);
  assert.equal(isDraft(frontmatterBlock('---\ndraft: true # keep out\n---\nbody')), true);
  assert.equal(isDraft(frontmatterBlock('---\ndraft: false\n---\nbody')), false);
  assert.equal(isDraft(frontmatterBlock('---\ntitle: x\n---\ndraft: true')), false);
});

test('collect gathers profile and published entry URLs without touching the network', () => {
  write(
    'src/data/profile.json',
    JSON.stringify(
      {
        hero: {
          banner: { upload: '', link: 'https://img.example/banner.png' },
          photo: { upload: 'uploaded.png', link: 'https://img.example/ignored.png' },
          reel: 'https://video.example/reel',
          links: [{ url: 'https://code.example/me' }, { url: 'mailto:me@example.com' }],
        },
      },
      null,
      2,
    ),
  );
  write(
    'src/content/work/published.md',
    '---\ntitle: Published\ndraft: false\nlinks:\n  - url: "https://code.example/me"\n  - url: https://play.example/game),\n---\nBody https://body.example/ignored\n',
  );
  write('src/content/work/hidden.md', '---\ntitle: Hidden\ndraft: true\nlinks:\n  - url: https://hidden.example/x\n---\n');
  write('src/content/blog/post.md', '---\ntitle: Post\nsource: https://blog.example/post\n---\n');

  const found = collect(tmp);
  const urls = found.map((f) => f.url).sort();
  assert.deepEqual(urls, [
    'https://blog.example/post',
    'https://code.example/me',
    'https://img.example/banner.png',
    'https://play.example/game',
    'https://video.example/reel',
  ]);

  const banner = found.find((f) => f.url === 'https://img.example/banner.png');
  assert.equal(banner.appearance, true);
  assert.deepEqual(banner.places[0], { file: 'src/data/profile.json', line: 5, field: 'hero.banner' });

  const shared = found.find((f) => f.url === 'https://code.example/me');
  assert.equal(shared.appearance, false);
  assert.deepEqual(
    shared.places.map((p) => p.file),
    ['src/data/profile.json', 'src/content/work/published.md'],
  );
});