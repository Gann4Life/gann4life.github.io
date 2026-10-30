import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dump, load } from 'js-yaml';

export const MAX_BODY_BYTES = 1024 * 1024;
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const EDITABLE_FIELDS = ['title', 'contribution', 'draft', 'featured'];
export const DATE_FIELDS = ['started', 'ended'];

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const HOST_PATTERN = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const toLf = (text) => text.replace(/\r\n?/g, '\n');

export function checkRequest({ method, remoteAddress, headers }) {
  if (!LOOPBACK.has(remoteAddress ?? '')) return { status: 403, error: 'Only loopback clients are allowed.' };
  const host = String(headers.host ?? '');
  if (!HOST_PATTERN.test(host)) return { status: 403, error: 'Unexpected Host header.' };
  if (method !== 'GET' && method !== 'PUT') return { status: 405, error: 'Method not allowed.' };
  if (method === 'PUT') {
    if (headers.origin !== `http://${host}`) return { status: 403, error: 'Origin does not match Host.' };
    const type = String(headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/json') return { status: 403, error: 'Content-Type must be application/json.' };
    const site = headers['sec-fetch-site'];
    if (site !== undefined && site !== 'same-origin') return { status: 403, error: 'Cross-site request.' };
  }
  return null;
}

export function splitEntry(raw) {
  const lines = toLf(raw.replace(/^﻿/, '')).split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;
  const front = lines.slice(1, end);
  return { front: front.length ? `${front.join('\n')}\n` : '', body: lines.slice(end + 1).join('\n') };
}

export function explicitSlug(raw) {
  const parts = splitEntry(raw);
  if (!parts) return '';
  const line = parts.front.split('\n').find((l) => l.startsWith('slug:'));
  return line ? readValue(line) : '';
}

function readValue(line) {
  let value = line.slice(line.indexOf(':') + 1);
  const comment = value.indexOf(' #');
  if (comment !== -1) value = value.slice(0, comment);
  value = value.trim();
  if (value.length >= 2) {
    const first = value[0];
    if ((first === '"' || first === "'") && value[value.length - 1] === first) value = value.slice(1, -1);
  }
  return value;
}

export async function resolveEntry(workDir, id) {
  if (!ID_PATTERN.test(id)) return null;
  let names;
  let root;
  try {
    names = (await readdir(workDir)).sort();
    root = await realpath(workDir);
  } catch {
    return null;
  }
  const open = async (name) => {
    if (!name.endsWith('.md') || name.startsWith('.')) return null;
    try {
      const real = await realpath(path.join(workDir, name));
      if (!(await stat(real)).isFile()) return null;
      const rel = path.relative(root, real);
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
      return { file: real, name, slug: explicitSlug(await readFile(real, 'utf8')) };
    } catch {
      return null;
    }
  };
  const direct = names.includes(`${id}.md`) ? await open(`${id}.md`) : null;
  if (direct && (!direct.slug || direct.slug === id)) return { file: direct.file, name: direct.name };
  for (const name of names) {
    const entry = await open(name);
    if (entry && (entry.slug || name.slice(0, -'.md'.length)) === id) return { file: entry.file, name: entry.name };
  }
  return null;
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseUpdate(payload) {
  if (!isPlainObject(payload)) throw new HttpError(400, 'Body must be a JSON object.');
  for (const key of Object.keys(payload)) {
    if (!['hash', 'set', 'body'].includes(key)) throw new HttpError(400, `Unknown property "${key}".`);
  }
  if (typeof payload.hash !== 'string' || !payload.hash) throw new HttpError(400, '"hash" must be a string.');
  if (!isPlainObject(payload.set)) throw new HttpError(400, '"set" must be an object.');
  const set = {};
  for (const [key, value] of Object.entries(payload.set)) {
    if (!EDITABLE_FIELDS.includes(key)) throw new HttpError(400, `Field "${key}" is not editable here.`);
    if (key === 'title') {
      if (typeof value !== 'string') throw new HttpError(400, '"title" must be a string.');
      if (!value.trim()) throw new HttpError(400, '"title" cannot be empty.');
      set.title = value.trim();
    } else if (key === 'contribution') {
      if (typeof value !== 'string') throw new HttpError(400, '"contribution" must be a string.');
      set.contribution = toLf(value).trim();
    } else {
      if (typeof value !== 'boolean') throw new HttpError(400, `"${key}" must be true or false.`);
      set[key] = value;
    }
  }
  if (payload.body !== undefined && typeof payload.body !== 'string') throw new HttpError(400, '"body" must be a string.');
  return { hash: payload.hash, set, body: payload.body };
}

export function normalizeBody(body) {
  const text = toLf(body);
  return text !== '' && !text.endsWith('\n') ? `${text}\n` : text;
}

const isMidnightUtc = (value) =>
  value instanceof Date && !Number.isNaN(value.getTime()) && value.getTime() % 86_400_000 === 0;

export function dateOnly(value) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  const date = new Date(`${text}T00:00:00.000Z`);
  date.toISOString = () => text;
  return date;
}

export function mergeEntry(data, set) {
  const merged = { ...data };
  for (const [key, value] of Object.entries(set)) merged[key] = value;
  for (const key of DATE_FIELDS) {
    if (isMidnightUtc(merged[key])) merged[key] = dateOnly(merged[key]);
  }
  return merged;
}

export function serializeEntry(data, body) {
  return `---\n${dump(data)}---\n${body}`;
}

export function readFrontmatter(front) {
  let data;
  try {
    data = load(front);
  } catch (err) {
    throw new HttpError(422, `The frontmatter is not valid YAML: ${err.reason ?? err.message}`);
  }
  if (!isPlainObject(data)) throw new HttpError(422, 'The frontmatter is not a mapping.');
  return data;
}

export function rawFields(data) {
  const fields = {};
  for (const key of EDITABLE_FIELDS) if (key in data) fields[key] = data[key];
  return fields;
}

export function schemaIssues(schema, data) {
  const result = schema.safeParse(data);
  return result.success ? [] : result.error.issues.map((i) => ({ path: i.path, message: i.message }));
}

const RENAME_RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_ATTEMPTS = 5;
const RENAME_STEP_MS = 50;

async function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (err) {
      if (!RENAME_RETRYABLE.has(err?.code) || attempt >= RENAME_ATTEMPTS) throw err;
      await new Promise((resolve) => setTimeout(resolve, RENAME_STEP_MS * attempt));
    }
  }
}

export async function writeEntry(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.editor-tmp`);
  try {
    await writeFile(tmp, text, { encoding: 'utf8', flag: 'wx' });
    await renameWithRetry(tmp, file);
  } catch (err) {
    console.error('[work-editor]', err);
    await unlink(tmp).catch(() => {});
    throw new HttpError(500, 'Could not write the file.');
  }
}

const locks = new Map();
async function withLock(key, task) {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  try {
    return await run;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}

async function readSplit(file) {
  let bytes;
  try {
    bytes = await readFile(file);
  } catch {
    throw new HttpError(500, 'Could not read the file.');
  }
  const parts = splitEntry(bytes.toString('utf8'));
  return { hash: sha256(bytes), parts };
}

export async function handleRequest(req, { workDir, base, loadSchema }) {
  const prefix = `${base}__editor/work/`;
  const pathname = String(req.url ?? '').split(/[?#]/)[0];
  if (!pathname.startsWith(prefix)) return null;
  const respond = (status, body, headers = {}) => ({ status, body, headers });
  try {
    const failed = checkRequest(req);
    if (failed) return respond(failed.status, { error: failed.error });
    let id;
    try {
      id = decodeURIComponent(pathname.slice(prefix.length));
    } catch {
      return respond(404, { error: 'No such entry.' });
    }
    const entry = await resolveEntry(workDir, id);
    if (!entry) return respond(404, { error: 'No such entry.' });

    if (req.method === 'GET') {
      const { hash, parts } = await readSplit(entry.file);
      if (!parts) throw new HttpError(422, 'The file has no leading --- block.');
      const data = readFrontmatter(parts.front);
      return respond(200, { id, hash, fields: rawFields(data), body: parts.body });
    }

    let payload;
    try {
      const raw = await req.readBody();
      payload = JSON.parse(raw);
    } catch (err) {
      if (err?.code === 'TOO_LARGE') return respond(413, { error: 'Body over 1 MB.' }, { connection: 'close' });
      return respond(400, { error: 'Malformed JSON.' });
    }
    const update = parseUpdate(payload);

    return await withLock(entry.file, async () => {
      const { hash, parts } = await readSplit(entry.file);
      if (hash !== update.hash) {
        return respond(409, { error: 'The file changed since the page loaded.' });
      }
      if (!parts) throw new HttpError(422, 'The file has no leading --- block.');
      const merged = mergeEntry(readFrontmatter(parts.front), update.set);
      const issues = schemaIssues(await loadSchema(), merged);
      if (issues.length) return respond(422, { error: 'The entry does not pass the schema.', issues });
      const text = serializeEntry(merged, normalizeBody(update.body ?? parts.body));
      await writeEntry(entry.file, text);
      return respond(200, { hash: sha256(Buffer.from(text, 'utf8')) });
    });
  } catch (err) {
    if (err instanceof HttpError) return respond(err.status, { error: err.message, ...err.extra });
    console.error('[work-editor]', err);
    return respond(500, { error: 'Unexpected error.' });
  }
}
