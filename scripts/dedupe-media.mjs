import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIX = process.argv.includes('--fix');
const HOOK = process.argv.includes('--hook');
if (HOOK && !FIX) {
  console.log('--hook requires --fix');
  process.exit(2);
}
const TREES = [
  { root: 'src/assets', needle: 'assets' },
  { root: 'public/media', needle: 'media' },
];
const TEXT_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.md', '.mdx', '.json', '.css', '.yaml', '.yml']);
const BEFORE_OK = new Set(['/', "'", '"', '(']);
const NAME_CHAR = /[A-Za-z0-9._-]/;

const posix = (p) => p.split(path.sep).join('/');
const byteCompare = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const abs = (repo) => path.join(ROOT, ...repo.split('/'));

const listFiles = (repoDir) => {
  try {
    return readdirSync(abs(repoDir), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => posix(path.relative(ROOT, path.join(d.parentPath ?? d.path, d.name))));
  } catch {
    return [];
  }
};

const sha = (repo) => createHash('sha256').update(readFileSync(abs(repo))).digest('hex');

const scanned = [];
for (const tree of TREES) {
  for (const file of listFiles(tree.root)) {
    if (statSync(abs(file)).size === 0) continue;
    scanned.push({ file, tree, rel: file.slice(tree.root.length + 1), hash: sha(file) });
  }
}

const textPaths = listFiles('src').filter((f) => !f.startsWith('src/assets/') && TEXT_EXTENSIONS.has(path.extname(f)));
for (const name of readdirSync(ROOT)) {
  if (/^keystatic\.config\./.test(name) && statSync(path.join(ROOT, name)).isFile()) textPaths.push(name);
}
const texts = new Map(textPaths.map((f) => [f, readFileSync(abs(f), 'utf8')]));

const isRefStart = (text, i) => {
  if (i === 0) return true;
  const c = text[i - 1];
  return BEFORE_OK.has(c) || /\s/.test(c);
};
const isRefEnd = (text, end) => end >= text.length || !NAME_CHAR.test(text[end]);

const matches = (text, needle) => {
  const found = [];
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i === -1) break;
    if (isRefStart(text, i) && isRefEnd(text, i + needle.length)) found.push(i);
    from = i + 1;
  }
  return found;
};

const refNeedle = (item) => `${item.tree.needle}/${item.rel}`;

const matchedRanges = new Map();
for (const [file, text] of texts) {
  const ranges = [];
  for (const item of scanned) {
    const needle = refNeedle(item);
    for (const i of matches(text, needle)) ranges.push([i, i + needle.length]);
  }
  matchedRanges.set(file, ranges);
}

const wordHits = (text, name) => {
  const found = [];
  let from = 0;
  for (;;) {
    const i = text.indexOf(name, from);
    if (i === -1) break;
    const before = i === 0 || !NAME_CHAR.test(text[i - 1]);
    if (before && isRefEnd(text, i + name.length)) found.push(i);
    from = i + 1;
  }
  return found;
};

const skipReason = (removed) => {
  for (const item of removed) {
    const name = path.posix.basename(item.rel);
    for (const [file, text] of texts) {
      const ranges = matchedRanges.get(file);
      for (const i of wordHits(text, name)) {
        if (!ranges.some(([s, e]) => i >= s && i < e)) return `"${name}" in ${file} is not a full path`;
      }
    }
    const parts = path.posix.dirname(item.rel).split('/');
    if (parts[0] === '.') continue;
    for (let n = 1; n <= parts.length; n++) {
      const dir = parts.slice(0, n).join('/');
      for (const [file, text] of texts) {
        const prefix = `${item.tree.needle}/${dir}/`;
        let from = 0;
        for (;;) {
          const i = text.indexOf(prefix, from);
          if (i === -1) break;
          const next = text[i + prefix.length];
          if (next === '*' || next === '{') return `glob over ${prefix} in ${file}`;
          from = i + 1;
        }
      }
    }
  }
  return null;
};

const byTree = TREES.map((tree) => {
  const groups = new Map();
  for (const item of scanned.filter((s) => s.tree === tree)) {
    if (!groups.has(item.hash)) groups.set(item.hash, []);
    groups.get(item.hash).push(item);
  }
  return { tree, groups };
});

const warnings = [];
const hashesPerTree = TREES.map((tree) => new Map());
scanned.forEach((item) => {
  const map = hashesPerTree[TREES.indexOf(item.tree)];
  if (!map.has(item.hash)) map.set(item.hash, []);
  map.get(item.hash).push(item.file);
});
for (const [hash, files] of hashesPerTree[0]) {
  const other = hashesPerTree[1].get(hash);
  if (other) warnings.push([...files, ...other].sort(byteCompare));
}

const plans = [];
for (const { tree, groups } of byTree) {
  for (const [hash, items] of groups) {
    if (items.length < 2) continue;
    items.sort((a, b) => byteCompare(a.file, b.file));
    const sharedPrefix = `${tree.root}/shared/`;
    const inShared = items.filter((i) => i.file.startsWith(sharedPrefix));
    let kept;
    let needsCopy = false;
    if (inShared.length > 0) {
      kept = inShared[0].file;
    } else {
      const ext = path.posix.extname(items[0].file).toLowerCase();
      kept = `${sharedPrefix}${hash.slice(0, 16)}${ext}`;
      if (existsSync(abs(kept))) {
        if (sha(kept) !== hash) {
          console.log(`ERROR: ${kept} exists with different content; nothing changed`);
          process.exit(1);
        }
      } else {
        needsCopy = true;
      }
    }
    const removed = items.filter((i) => i.file !== kept);
    const reason = skipReason(removed);
    plans.push({ tree, hash, h16: hash.slice(0, 16), items, kept, needsCopy, removed, reason });
  }
}
plans.sort((a, b) => byteCompare(a.items[0].file, b.items[0].file));

for (const w of warnings) {
  console.log(`WARNING: identical files in src/assets/ and public/media/ (not merged): ${w.join(' ')}`);
}

const mergeable = plans.filter((p) => !p.reason);
const skipped = plans.filter((p) => p.reason);
const skipLine = (p) => `SKIPPED ${p.h16} ${p.items.map((i) => i.file).join(' ')} : ${p.reason}`;

if (!FIX) {
  for (const p of mergeable) {
    console.log(`DUPLICATE ${p.h16} keep ${p.kept} remove ${p.removed.map((i) => i.file).join(' ')}`);
  }
  for (const p of skipped) console.log(skipLine(p));
  console.log(`dupes: ${mergeable.length} mergeable, ${skipped.length} skipped`);
  process.exit(mergeable.length + skipped.length > 0 ? 1 : 0);
}

const writtenCopies = [];
const rewrittenFiles = new Set();

if (HOOK && mergeable.length > 0) {
  const touched = new Set();
  for (const p of mergeable) {
    if (p.needsCopy) touched.add(p.kept);
    for (const item of p.removed) touched.add(item.file);
    for (const [file, text] of texts) {
      const found = p.removed.some((item) => matches(text, refNeedle(item)).length > 0);
      if (found) touched.add(file);
    }
  }
  const gitList = (args) =>
    execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);
  const dirty = new Set([
    ...gitList(['diff', '--name-only', '-z']),
    ...gitList(['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  const blocked = [...touched].filter((f) => dirty.has(f)).sort(byteCompare);
  if (blocked.length > 0) {
    process.stderr.write('pre-commit: duplicate media need merging, but these files have unstaged changes:\n');
    for (const f of blocked) process.stderr.write(`  ${f}\n`);
    process.stderr.write('Run npm run dupes -- --fix, review the result, stage it and commit again.\n');
    process.exit(1);
  }
}

for (const p of mergeable) {
  if (p.needsCopy) {
    mkdirSync(path.dirname(abs(p.kept)), { recursive: true });
    copyFileSync(abs(p.items[0].file), abs(p.kept));
    writtenCopies.push(p.kept);
  }
  const keptNeedle = `${p.tree.needle}/${p.kept.slice(p.tree.root.length + 1)}`;
  let rewrote = 0;
  for (const [file, text] of texts) {
    const hits = [];
    for (const item of p.removed) {
      const needle = refNeedle(item);
      for (const i of matches(text, needle)) hits.push([i, needle.length]);
    }
    if (hits.length === 0) continue;
    hits.sort((a, b) => b[0] - a[0]);
    let next = text;
    for (const [i, len] of hits) next = next.slice(0, i) + keptNeedle + next.slice(i + len);
    if (next === text) continue;
    writeFileSync(abs(file), next);
    texts.set(file, next);
    rewrittenFiles.add(file);
    rewrote++;
  }
  for (const item of p.removed) unlinkSync(abs(item.file));
  console.log(`MERGED ${p.h16} -> ${p.kept} (removed ${p.removed.length}, rewrote ${rewrote} files)`);
}
for (const p of skipped) console.log(skipLine(p));
if (!HOOK || mergeable.length + skipped.length > 0) {
  console.log(`dupes: ${mergeable.length} merged, ${skipped.length} skipped`);
}

if (HOOK && mergeable.length > 0) {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'exclude-drafts.mjs')], { cwd: ROOT, stdio: 'inherit' });
  const git = (args) => spawnSync('git', args, { cwd: ROOT, stdio: 'inherit' });
  const tracked = new Set(
    execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean),
  );
  for (const f of [...rewrittenFiles, ...writtenCopies]) {
    const ignored = spawnSync('git', ['check-ignore', '-q', '--no-index', '--', f], { cwd: ROOT }).status === 0;
    if (!ignored) git(['add', '--', f]);
  }
  for (const p of mergeable) {
    for (const item of p.removed) {
      if (tracked.has(item.file)) git(['rm', '--cached', '--quiet', '--', item.file]);
    }
  }
}
process.exit(skipped.length > 0 ? 1 : 0);
