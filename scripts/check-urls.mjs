import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const TITLE = 'Broken remote URLs';
const LABELS = ['type:bug', 'scope:content', 'priority:medium', 'status:ready'];
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 30_000;
const MAX_PARALLEL = 4;
const APPEARANCE_FIELDS = [['hero', 'banner'], ['hero', 'photo'], ['background', 'image'], ['chrome', 'logo'], ['chrome', 'favicon']];

const posix = (p) => p.split(path.sep).join('/');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

const readText = (abs) => readFileSync(abs, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');

const frontmatterBlock = (text) => {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  return { lines, end };
};

const isDraft = (block) =>
  block.lines.slice(1, block.end).some((l) => /^draft:\s*(true|True|TRUE)\s*(#.*)?$/.test(l));

const listMarkdown = (dir) => {
  try {
    return readdirSync(dir, { recursive: true })
      .filter((rel) => rel.endsWith('.md'))
      .map((rel) => path.join(dir, rel))
      .sort();
  } catch {
    return [];
  }
};

const collect = (root = ROOT) => {
  const found = [];
  const add = (url, file, line, field, appearance) => found.push({ url, file, line, field, appearance });

  const profileAbs = path.join(root, 'src', 'data', 'profile.json');
  const profileRel = 'src/data/profile.json';
  let raw = null;
  try {
    raw = readText(profileAbs);
  } catch {
    raw = null;
  }
  if (raw !== null) {
    const profile = JSON.parse(raw);
    const rawLines = raw.split('\n');
    const lineOf = (url) => rawLines.findIndex((l) => l.includes(url)) + 1;
    for (const [section, name] of APPEARANCE_FIELDS) {
      const field = profile[section]?.[name];
      const upload = typeof field?.upload === 'string' ? field.upload.trim() : '';
      const link = typeof field?.link === 'string' ? field.link.trim() : '';
      if (upload === '' && link !== '') {
        add(link, profileRel, lineOf(field.link), `${section}.${name}`, true);
      }
    }
    const reel = profile.hero?.reel;
    if (typeof reel === 'string' && /^https?:\/\//.test(reel)) {
      add(reel, profileRel, lineOf(reel), 'hero.reel', false);
    }
    for (const link of profile.hero?.links ?? []) {
      if (typeof link.url === 'string' && /^https?:\/\//.test(link.url)) {
        add(link.url, profileRel, lineOf(link.url), 'hero.links', false);
      }
    }
  }

  for (const name of ['work', 'blog']) {
    for (const abs of listMarkdown(path.join(root, 'src', 'content', name))) {
      const block = frontmatterBlock(readText(abs));
      if (!block || isDraft(block)) continue;
      const rel = posix(path.relative(root, abs));
      let field = '';
      for (let i = 1; i < block.end; i++) {
        const line = block.lines[i];
        const key = line.match(/^([A-Za-z_][\w-]*):/);
        if (key) field = key[1];
        for (const m of line.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
          add(m[0].replace(/[,;)\]}]+$/, ''), rel, i + 1, field, false);
        }
      }
    }
  }

  const byUrl = new Map();
  for (const f of found) {
    let entry = byUrl.get(f.url);
    if (!entry) {
      entry = { url: f.url, host: hostOf(f.url), appearance: false, places: [] };
      byUrl.set(f.url, entry);
    }
    if (f.appearance) entry.appearance = true;
    entry.places.push({ file: f.file, line: f.line, field: f.field });
  }
  return [...byUrl.values()];
};

const attempt = async (url, method) => {
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const contentType = res.headers.get('content-type') ?? '';
    try {
      await res.body?.cancel();
    } catch {}
    return { status: res.status, contentType };
  } catch (err) {
    const code = err?.cause?.code ?? err?.code ?? err?.name ?? 'error';
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return { error: timeout ? 'timeout' : `${code}: ${err?.cause?.message ?? err?.message ?? ''}`.trim(), timeout };
  }
};

const request = async (url) => {
  const head = await attempt(url, 'HEAD');
  if (head.error || [403, 405, 501].includes(head.status)) return attempt(url, 'GET');
  return head;
};

const fetchWithRetry = async (url) => {
  let result = await request(url);
  if (result.timeout || result.status >= 500) {
    await sleep(RETRY_DELAY_MS);
    result = await request(url);
  }
  return result;
};

const classify = (result, appearance) => {
  if (result.error) return { state: 'Broken', detail: result.error };
  const { status, contentType } = result;
  if ([401, 403, 429].includes(status)) return { state: 'Unverified', detail: String(status) };
  if (status >= 200 && status < 300) {
    if (appearance && !contentType.toLowerCase().startsWith('image/')) {
      return { state: 'Broken', detail: `${status}, not an image (${contentType || 'no content-type'})` };
    }
    return { state: 'OK', detail: String(status) };
  }
  return { state: 'Broken', detail: String(status) };
};

const checkAll = async (items) => {
  const queue = [...items];
  const busy = new Set();
  let active = 0;
  const worker = async (item) => {
    if (item.host === '') {
      Object.assign(item, { state: 'Broken', detail: 'invalid URL' });
      return;
    }
    const result = await fetchWithRetry(item.url);
    Object.assign(item, classify(result, item.appearance));
  };
  await new Promise((resolve) => {
    const pump = () => {
      while (active < MAX_PARALLEL) {
        const i = queue.findIndex((it) => !busy.has(it.host));
        if (i === -1) break;
        const [item] = queue.splice(i, 1);
        busy.add(item.host);
        active++;
        worker(item)
          .catch((err) => Object.assign(item, { state: 'Broken', detail: String(err?.message ?? err) }))
          .finally(() => {
            busy.delete(item.host);
            active--;
            pump();
          });
      }
      if (active === 0 && queue.length === 0) resolve();
    };
    pump();
  });
};

const STATES = ['Broken', 'Unverified', 'OK'];

const printReport = (items) => {
  for (const state of STATES) {
    for (const item of items.filter((it) => it.state === state)) {
      console.log(`${state.padEnd(10)} ${item.detail}  ${item.url}`);
      for (const p of item.places) console.log(`             ${p.file}:${p.line}  ${p.field}`);
    }
  }
  const count = (state) => items.filter((it) => it.state === state).length;
  console.log(
    `\nURLs: ${items.length} unique | OK ${count('OK')} | Broken ${count('Broken')} | Unverified ${count('Unverified')}`,
  );
};

const gh = (args, input) =>
  execFileSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const table = (items) => {
  const rows = items.flatMap((it) =>
    it.places.map((p) => `| ${cell(it.url)} | ${cell(it.detail)} | ${cell(p.field)} | \`${p.file}:${p.line}\` |`),
  );
  return ['| URL | Status | Field | File:line |', '|---|---|---|---|', ...rows].join('\n');
};

const commitSha = () => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const runLabel = () => {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  }
  return 'a local run';
};

const report = (items) => {
  const broken = items.filter((it) => it.state === 'Broken');
  const unverified = items.filter((it) => it.state === 'Unverified');
  const open = JSON.parse(
    gh(['issue', 'list', '--state', 'open', '--search', `"${TITLE}" in:title`, '--json', 'number,title', '--limit', '100']),
  ).find((i) => i.title === TITLE);

  if (broken.length === 0) {
    if (open) {
      gh(
        ['issue', 'comment', String(open.number), '--body-file', '-'],
        `No broken remote URLs in ${runLabel()} (${new Date().toISOString()}). Closing.`,
      );
      gh(['issue', 'close', String(open.number)]);
      console.log(`closed issue #${open.number}`);
    } else {
      console.log('no broken URLs and no open issue');
    }
    return;
  }

  const body = [
    `Commit checked: \`${commitSha()}\``,
    `Run date: ${new Date().toISOString()}`,
    `Run: ${runLabel()}`,
    '',
    `## Broken (${broken.length})`,
    '',
    table(broken),
    '',
    ...(unverified.length > 0 ? [`## Unverified (${unverified.length})`, '', table(unverified), ''] : []),
  ].join('\n');

  if (open) {
    gh(['issue', 'edit', String(open.number), '--body-file', '-'], body);
    console.log(`updated issue #${open.number}`);
    return;
  }

  const existing = new Set(JSON.parse(gh(['label', 'list', '--limit', '200', '--json', 'name'])).map((l) => l.name));
  const labelArgs = [];
  for (const label of LABELS) {
    if (existing.has(label)) labelArgs.push('--label', label);
    else console.warn(`warning: label "${label}" does not exist, skipped`);
  }
  const url = gh(['issue', 'create', '--title', TITLE, '--body-file', '-', ...labelArgs], body).trim();
  console.log(`created issue ${url}`);
};

export { classify, collect, frontmatterBlock, hostOf, isDraft };

if (process.argv[1] && realpathSync.native(process.argv[1]) === realpathSync.native(fileURLToPath(import.meta.url))) {
  const items = collect();
  console.log(`${items.length} unique URLs${DRY_RUN ? ' (dry run, GitHub untouched)' : ''}`);
  await checkAll(items);
  printReport(items);
  if (!DRY_RUN) report(items);
}
