import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const BEGIN = '# >>> drafts (scripts/exclude-drafts.mjs) >>>';
const END = '# <<< drafts <<<';
const CODE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.json', '.css', '.yaml', '.yml']);

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

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

const parse = (raw, fallbackSlug) => {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  let block = '';
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end !== -1) block = lines.slice(1, end).join('\n');
  }
  const draft = /^draft:\s*(true|True|TRUE)\s*(#.*)?$/m.test(block);
  const slugMatch = block.match(/^slug:\s*["']?([^"'#\s]+)["']?\s*(#.*)?$/m);
  return { text, draft, slug: slugMatch ? slugMatch[1] : fallbackSlug };
};

const listDir = (dir) => {
  try {
    return readdirSync(dir, { recursive: true });
  } catch {
    return [];
  }
};

const contentRoots = ['work', 'blog'].map((name) => path.join(SITE, 'src', 'content', name));

const entries = [];
for (const root of contentRoots) {
  for (const rel of listDir(root)) {
    if (!rel.endsWith('.md')) continue;
    const abs = path.join(root, rel);
    const parsed = parse(readFileSync(abs, 'utf8'), path.basename(rel, '.md'));
    entries.push({ file: repoPath(abs), ...parsed });
  }
}

const assetsDir = path.join(SITE, 'src', 'assets');
let folders = [];
try {
  folders = readdirSync(assetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
} catch {
  folders = [];
}

const srcDir = path.join(SITE, 'src');
const otherTexts = [];
for (const rel of listDir(srcDir)) {
  const abs = path.join(srcDir, rel);
  const norm = posix(rel);
  if (norm === 'assets' || norm.startsWith('assets/')) continue;
  if (contentRoots.some((root) => abs === root || abs.startsWith(root + path.sep))) continue;
  if (!CODE_EXTENSIONS.has(path.extname(rel).toLowerCase())) continue;
  try {
    otherTexts.push(readFileSync(abs, 'utf8'));
  } catch {
    continue;
  }
}

const draftEntries = entries.filter((e) => e.draft);
const excludedFolders = [];
const unreferenced = [];
for (const folder of folders) {
  const needle = `assets/${folder}/`;
  const refs = entries.filter((e) => e.slug === folder || e.text.includes(needle));
  const publishedRef =
    refs.some((e) => !e.draft) || otherTexts.some((t) => t.includes(needle));
  if (publishedRef) continue;
  if (refs.length > 0) excludedFolders.push(folder);
  else unreferenced.push(folder);
}

const escapeGlob = (s) => s.replace(/[\\*?[\]]/g, '\\$&');
const draftFiles = draftEntries.map((e) => e.file);
const folderPaths = excludedFolders.map((f) => `src/assets/${f}`);
const blockLines = [
  ...draftFiles.map((f) => `/${escapeGlob(f)}`),
  ...folderPaths.map((f) => `/${escapeGlob(f)}/`),
].sort((a, b) => a.localeCompare(b));

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

const tracked = git(['ls-files', '-z', '--', 'src/content', 'src/assets'], TOP)
  .split('\0')
  .filter(Boolean);
const draftFileSet = new Set(draftFiles);

console.log(`drafts: ${draftFiles.length} entries and ${excludedFolders.length} asset folders kept out of git`);
for (const f of unreferenced) {
  console.log(`warning: src/assets/${f}/ is referenced by no entry (committable; delete it or link it)`);
}
for (const t of tracked) {
  if (draftFileSet.has(t)) {
    console.log(`tracked draft: ${t} -> git rm --cached -- "${t}"`);
  }
}
for (const f of excludedFolders) {
  const prefix = `src/assets/${f}/`;
  if (tracked.some((t) => t.startsWith(prefix))) {
    console.log(`tracked draft assets: src/assets/${f}/ -> git rm -r --cached -- "src/assets/${f}"`);
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
    if (excludedFolders.some((f) => p.startsWith(`src/assets/${f}/`))) blocked.push(p);
  }
  if (blocked.length > 0) {
    const out = [
      `pre-commit: ${blocked.length} draft file(s) staged. Drafts stay out of git (docs/2-content-model.md, "Drafts stay out of git").`,
      ...blocked.map((p) => `  ${p}    unstage: git restore --staged -- "${p}"`),
      'To publish an entry, set draft: false; its asset folder becomes committable with it.',
    ];
    process.stderr.write(out.join('\n') + '\n');
    process.exit(1);
  }
}
