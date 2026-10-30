import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const BEGIN = '# >>> drafts (scripts/exclude-drafts.mjs) >>>';
const END = '# <<< drafts <<<';
const CODE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.json', '.css', '.yaml', '.yml']);
const NOT_SLUG_FOLDERS = new Set(['blog', 'shared', 'site']);

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });

let TOP;
let excludeFile;
try {
  TOP = git(['rev-parse', '--show-toplevel'], SITE).trim();
  excludeFile = path.resolve(TOP, git(['rev-parse', '--git-path', 'info/exclude'], TOP).trim());
} catch {
  process.exit(0);
}

const posix = (p) => p.split(path.sep).join('/');
const repoPath = (abs) => posix(path.relative(TOP, abs));

const readValue = (line) => {
  let value = line.slice(line.indexOf(':') + 1);
  const comment = value.indexOf(' #');
  if (comment !== -1) value = value.slice(0, comment);
  value = value.trim();
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'") && value[value.length - 1] === first) value = value.slice(1, -1);
  }
  return value;
};

const parse = (raw, fallbackSlug) => {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let draft = false;
  let slug = '';
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end !== -1) {
      for (const line of lines.slice(1, end)) {
        if (line.startsWith('draft:')) draft = readValue(line).toLowerCase() === 'true';
        else if (line.startsWith('slug:')) slug = readValue(line);
      }
    }
  }
  return { text, draft, slug: slug || fallbackSlug };
};

const listFiles = (dir) => {
  try {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => path.join(d.parentPath ?? d.path, d.name));
  } catch {
    return [];
  }
};

const contentRoots = ['work', 'blog'].map((name) => path.join(SITE, 'src', 'content', name));
const assetsRoot = path.join(SITE, 'src', 'assets');
const mediaRoot = path.join(SITE, 'public', 'media');
const srcDir = path.join(SITE, 'src');
const under = (abs, root) => abs.startsWith(root + path.sep);

const entries = [];
for (const root of contentRoots) {
  for (const abs of listFiles(root)) {
    if (!abs.endsWith('.md')) continue;
    const parsed = parse(readFileSync(abs, 'utf8'), path.basename(abs, '.md'));
    entries.push({ file: repoPath(abs), ...parsed });
  }
}

const assetFiles = [];
const addAssets = (root, prefix, repoPrefix) => {
  for (const abs of listFiles(root)) {
    const rel = posix(path.relative(root, abs));
    const slash = rel.indexOf('/');
    assetFiles.push({
      repo: `${repoPrefix}/${rel}`,
      needle: `${prefix}/${rel}`,
      folder: slash === -1 ? null : rel.slice(0, slash),
    });
  }
};
addAssets(assetsRoot, 'assets', 'src/assets');
addAssets(mediaRoot, 'media', 'public/media');

const otherTexts = [];
for (const abs of listFiles(srcDir)) {
  if (under(abs, assetsRoot) || contentRoots.some((root) => under(abs, root))) continue;
  if (!CODE_EXTENSIONS.has(path.extname(abs).toLowerCase())) continue;
  try {
    otherTexts.push(readFileSync(abs, 'utf8'));
  } catch {
    continue;
  }
}

const isBoundaryBefore = (c) => c === '/' || c === "'" || c === '"' || c === '(' || /\s/.test(c);
const references = (text, needle) => {
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i === -1) return false;
    const before = i > 0 ? text[i - 1] : '';
    const after = text[i + needle.length];
    if (before !== '' && isBoundaryBefore(before) && (after === undefined || !/[A-Za-z0-9._-]/.test(after))) {
      return true;
    }
    from = i + 1;
  }
};

const entryReferences = (e, f) =>
  references(e.text, f.needle) ||
  (f.folder !== null && f.folder === e.slug && !NOT_SLUG_FOLDERS.has(f.folder));

const draftEntries = entries.filter((e) => e.draft);
const publishedEntries = entries.filter((e) => !e.draft);
const excludedAssets = [];
const unreferenced = [];
for (const f of assetFiles) {
  const draftRef = draftEntries.some((e) => entryReferences(e, f));
  const publishedRef =
    publishedEntries.some((e) => entryReferences(e, f)) || otherTexts.some((t) => references(t, f.needle));
  if (draftRef && !publishedRef) excludedAssets.push(f.repo);
  else if (!draftRef && !publishedRef) unreferenced.push(f.repo);
}

const escapeGlob = (p) => {
  let s = p.replace(/[\\*?[]/g, '\\$&');
  if (s.startsWith('!') || s.startsWith('#')) s = '\\' + s;
  return s.replace(/ +$/, (m) => '\\ '.repeat(m.length));
};
const draftFiles = draftEntries.map((e) => e.file);
const blockLines = [...new Set([...draftFiles, ...excludedAssets].map((p) => `/${escapeGlob(p)}`))].sort((a, b) =>
  a.localeCompare(b),
);

const existing = existsSync(excludeFile) ? readFileSync(excludeFile, 'utf8') : '';
const existingLines = existing.split('\n');
if (existingLines[existingLines.length - 1] === '') existingLines.pop();
const begin = existingLines.indexOf(BEGIN);
const endIdx = begin === -1 ? -1 : existingLines.indexOf(END, begin);
const hadBlock = begin !== -1 && endIdx !== -1;
const kept = hadBlock
  ? [...existingLines.slice(0, begin), ...existingLines.slice(endIdx + 1)]
  : existingLines;

let next = existing;
if (hadBlock || blockLines.length > 0) {
  const outLines = blockLines.length > 0 ? [...kept, BEGIN, ...blockLines, END] : kept;
  next = outLines.length > 0 ? outLines.join('\n') + '\n' : '';
}
if (next !== existing) {
  mkdirSync(path.dirname(excludeFile), { recursive: true });
  writeFileSync(excludeFile, next);
}

const tracked = git(['ls-files', '-z', '--', 'src/content', 'src/assets', 'public/media'], TOP)
  .split('\0')
  .filter(Boolean);
const draftFileSet = new Set(draftFiles);
const excludedAssetSet = new Set(excludedAssets);

console.log(`drafts: ${draftFiles.length} entries and ${excludedAssets.length} asset files kept out of git`);
for (const f of unreferenced) {
  console.log(`WARNING: ${f} is referenced by nothing (committable; delete it or link it)`);
}
for (const t of tracked) {
  if (draftFileSet.has(t)) {
    console.log(`tracked draft: ${t} -> git rm --cached -- "${t}"`);
  }
}
for (const t of tracked) {
  if (excludedAssetSet.has(t)) {
    console.log(`tracked draft asset: ${t} -> git rm --cached -- "${t}"`);
  }
}

if (process.argv.includes('--staged')) {
  const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], TOP)
    .split('\0')
    .filter(Boolean);
  const blocked = [];
  for (const p of staged) {
    const isEntry =
      p.endsWith('.md') &&
      (p.startsWith('src/content/work/') || p.startsWith('src/content/blog/'));
    if (isEntry) {
      let content = '';
      try {
        content = git(['show', `:${p}`], TOP);
      } catch {
        content = '';
      }
      if (parse(content, path.posix.basename(p, '.md')).draft) {
        blocked.push(p);
        continue;
      }
    }
    if (excludedAssetSet.has(p)) blocked.push(p);
  }
  if (blocked.length > 0) {
    const out = [
      `pre-commit: ${blocked.length} draft file(s) staged. Drafts stay out of git (docs/2-content-model.md, "Drafts stay out of git").`,
      ...blocked.map((p) => `  ${p}    unstage: git restore --staged -- "${p}"`),
      'To publish an entry, set draft: false; the asset files it references become committable with it.',
    ];
    process.stderr.write(out.join('\n') + '\n');
    process.exit(1);
  }
}
