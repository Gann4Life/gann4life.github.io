import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import { COLLECTIONS } from '../src/lib/content-fields.ts';
import { schemaFor } from '../src/lib/content-schema.ts';
import keystatic from '../keystatic.config.ts';

const image = () => z.string();

const minimalWork = {
  title: 'Probe',
  kind: 'game',
  authorship: 'hand-made',
  origin: 'original',
  team: 'solo',
  status: 'released',
  started: '2024-01-01',
  featured: false,
};

const issuePaths = (result) => result.error.issues.map((issue) => issue.path.join('.'));

const walk = (fields, visit) => {
  for (const field of fields) {
    visit(field);
    if (field.fields) walk(field.fields, visit);
  }
};

test('registry field names match the Keystatic schema keys, body excepted', () => {
  for (const name of Object.keys(COLLECTIONS)) {
    const registry = COLLECTIONS[name].fields.map((field) => field.name).filter((key) => key !== 'body');
    const form = Object.keys(keystatic.collections[name].schema).filter((key) => key !== 'body');
    assert.deepEqual(form, registry, `${name}: Keystatic form order differs from the registry`);
  }
});

test('Keystatic reads each collection from the registry folder', () => {
  for (const [name, def] of Object.entries(COLLECTIONS)) {
    assert.equal(keystatic.collections[name].path, `${def.dir}/*`);
    assert.equal(keystatic.collections[name].label, def.label);
    assert.deepEqual(keystatic.collections[name].columns, [...def.columns]);
  }
});

test('every enum and tags field has options; every refs field targets a collection', () => {
  for (const [name, def] of Object.entries(COLLECTIONS)) {
    walk(def.fields, (field) => {
      if (field.type === 'enum' || field.type === 'tags') {
        assert.ok(field.options?.length > 0, `${name}.${field.name} has no options`);
      }
      if (field.type === 'refs') {
        assert.ok(field.collection in COLLECTIONS, `${name}.${field.name} targets unknown collection ${field.collection}`);
      }
    });
  }
});

test('reserved slugs per collection', () => {
  assert.deepEqual([...COLLECTIONS.work.reserved], ['c', 't', 'site', 'all', 'blog', 'shared']);
  assert.deepEqual([...COLLECTIONS.blog.reserved], ['page']);
});

test('the work schema rejects reserved slugs and accepts a minimal entry', () => {
  const schema = schemaFor('work', image);
  for (const slug of ['all', 'c', 't', 'site', 'blog', 'shared']) {
    const result = schema.safeParse({ ...minimalWork, slug });
    assert.equal(result.success, false, `slug "${slug}" must be rejected`);
    assert.ok(issuePaths(result).includes('slug'));
  }
  const ok = schema.safeParse({ ...minimalWork, slug: 'probe' });
  assert.equal(ok.success, true, ok.error?.message);
  assert.equal(ok.data.context, 'personal');
  assert.equal(ok.data.upstream, '');
  assert.equal(ok.data.draft, false);
  assert.deepEqual(ok.data.links, []);
  assert.equal('cover' in ok.data, false);
});

test('the blog schema rejects "page" and fills defaults', () => {
  const schema = schemaFor('blog', image);
  assert.equal(schema.safeParse({ title: 'Post', date: '2024-01-01', slug: 'page' }).success, false);
  const ok = schema.safeParse({ title: 'Post', date: '2024-01-01' });
  assert.equal(ok.success, true, ok.error?.message);
  assert.equal(ok.data.summary, '');
  assert.deepEqual(ok.data.work, []);
  assert.equal(ok.data.pinned, false);
  assert.equal(ok.data.featured, false);
  assert.equal(ok.data.draft, false);
});

test('the honesty rules report at the right paths', () => {
  const schema = schemaFor('work', image);
  const aiBuilt = schema.safeParse({ ...minimalWork, authorship: 'ai-built', roles: ['programmer'] });
  assert.equal(aiBuilt.success, false);
  assert.ok(issuePaths(aiBuilt).includes('roles'));
  const fork = schema.safeParse({
    ...minimalWork,
    origin: 'fork',
    credits: [{ name: 'Someone', role: 'Original author' }],
  });
  assert.equal(fork.success, false);
  assert.ok(issuePaths(fork).includes('upstream'));
});
