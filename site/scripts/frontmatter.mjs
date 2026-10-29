/*
 * Draft `work` entry as Markdown — the shape in docs/2-content-model.md.
 * Strings are JSON-quoted, which is valid YAML for any content.
 */

const q = (s) => JSON.stringify(s ?? '');
const list = (items) => `[${items.map(q).join(', ')}]`;

const block = (name, items, fields) =>
  items.length === 0
    ? `${name}: []`
    : `${name}:\n${items
        .map((it) =>
          fields
            .filter((f) => it[f] !== undefined && it[f] !== '')
            .map((f, i) => `${i === 0 ? '  - ' : '    '}${f}: ${q(it[f])}`)
            .join('\n'),
        )
        .join('\n')}`;

export function frontmatter(e) {
  return `---
title: ${q(e.title)}
slug: ${e.slug}
kind: ${e.kind}
context: ${e.context ?? 'personal'}
position: ""
roles: [${e.roles.join(', ')}]
authorship: hand-made
origin: ${e.origin ?? 'original'}
upstream: ${q(e.upstream)}
team: solo
${block('credits', e.credits ?? [], ['name', 'role', 'url'])}
contribution: ""
status: released
started: ${e.started}
featured: false
draft: true
tools: ${list(e.tools ?? [])}
${e.cover ? `cover: ${e.cover}\n` : ''}gallery: []
${block('media', e.media, ['type', 'src'])}
${block('links', e.links, ['label', 'type', 'url'])}
usedIn: []
---

${e.description ? `${e.description.trim()}\n` : ''}`;
}
