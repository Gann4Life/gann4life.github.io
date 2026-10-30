import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORK = path.join(ROOT, 'src', 'content', 'work');

const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');

const listed = () => {
  const source = readFileSync(path.join(ROOT, 'src', 'vocab.ts'), 'utf8');
  const block = source.match(/export const TOOLS = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
  return new Set([...block.matchAll(/'([^']+)'/g)].map((m) => m[1]));
};

const toolsOf = (text) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  const front = end === -1 ? [] : lines.slice(1, end);
  const at = front.findIndex((l) => l.startsWith('tools:'));
  if (at === -1) return [];
  const inline = front[at].match(/^tools:\s*\[(.*)\]\s*$/);
  if (inline) return inline[1].split(',').map(unquote).filter(Boolean);
  const items = [];
  for (const line of front.slice(at + 1)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (!item) break;
    items.push(unquote(item[1]));
  }
  return items;
};

test('every tool used by a work entry is offered in the Keystatic Tools picker', () => {
  const known = listed();
  assert.ok(known.size > 0, 'TOOLS not found in src/vocab.ts');
  const missing = [];
  for (const file of readdirSync(WORK).filter((f) => f.endsWith('.md'))) {
    for (const tool of toolsOf(readFileSync(path.join(WORK, file), 'utf8'))) {
      if (!known.has(tool)) missing.push(`${file}: "${tool}"`);
    }
  }
  assert.deepEqual(missing, [], 'add these to TOOLS in src/vocab.ts (Keystatic would drop them on save)');
});
