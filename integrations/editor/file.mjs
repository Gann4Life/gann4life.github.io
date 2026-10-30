import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dump, load } from 'js-yaml';

export const MAX_BODY_BYTES = 1024 * 1024;
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REMOVABLE_EMPTY = new Set(['text', 'url', 'longtext']);
const EMPTY_VALUES = { tags: () => [], refs: () => [], list: () => [], boolean: () => false };

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

const bad = (path, message) => new HttpError(400, `"${path}" ${message}`);

const optionValues = (field) => (field.options ?? []).map((option) => option.value);

function isRealDate(text) {
  if (!DATE_PATTERN.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function checkList(field, value, path) {
  if (!Array.isArray(value)) throw bad(path, 'must be an array.');
  const itemFields = field.fields ?? [];
  const names = new Set(itemFields.map((item) => item.name));
  return value.map((item, index) => {
    const at = `${path}[${index}]`;
    if (!isPlainObject(item)) throw bad(at, 'must be an object.');
    for (const key of Object.keys(item)) {
      if (!names.has(key)) throw bad(`${at}.${key}`, 'is not a field of this item.');
    }
    const checked = {};
    for (const itemField of itemFields) {
      if (!Object.hasOwn(item, itemField.name)) continue;
      const result = checkValue(itemField, item[itemField.name], `${at}.${itemField.name}`);
      if (result === null) continue;
      if (result === '' && REMOVABLE_EMPTY.has(itemField.type) && !itemField.required) continue;
      checked[itemField.name] = result;
    }
    return checked;
  });
}

export function checkValue(field, value, path = field.name) {
  if (value === null) {
    if (field.required) throw bad(path, 'is required and cannot be removed.');
    return null;
  }
  switch (field.type) {
    case 'text': {
      if (typeof value !== 'string') throw bad(path, 'must be a string.');
      const trimmed = value.trim();
      if (field.required && !trimmed) throw bad(path, 'cannot be empty.');
      return trimmed;
    }
    case 'longtext':
      if (typeof value !== 'string') throw bad(path, 'must be a string.');
      return toLf(value).trim();
    case 'boolean':
      if (typeof value !== 'boolean') throw bad(path, 'must be true or false.');
      return value;
    case 'enum':
      if (typeof value !== 'string' || !optionValues(field).includes(value)) throw bad(path, 'is not one of the options.');
      return value;
    case 'tags': {
      const allowed = optionValues(field);
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && allowed.includes(item))) {
        throw bad(path, 'must be an array of the options.');
      }
      return value;
    }
    case 'date':
      if (typeof value !== 'string' || !isRealDate(value)) throw bad(path, 'must be a real YYYY-MM-DD date.');
      return dateOnly(value);
    case 'url':
      if (typeof value !== 'string') throw bad(path, 'must be a string.');
      return value.trim();
    case 'refs':
      if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && ID_PATTERN.test(item))) {
        throw bad(path, 'must be an array of entry ids.');
      }
      return value;
    case 'list':
      return checkList(field, value, path);
    case 'image':
      if (typeof value === 'string') {
        if (!value.trim()) throw bad(path, 'cannot be empty.');
        return value;
      }
      if (isPlainObject(value) && typeof value.upload === 'string') throw new HttpError(400, 'Unknown upload token.');
      throw bad(path, 'must be an image path.');
    default:
      throw bad(path, 'cannot be edited here.');
  }
}

export function parseUpdate(payload, def) {
  if (!isPlainObject(payload)) throw new HttpError(400, 'Body must be a JSON object.');
  for (const key of Object.keys(payload)) {
    if (!['hash', 'set', 'body'].includes(key)) throw new HttpError(400, `Unknown property "${key}".`);
  }
  if (typeof payload.hash !== 'string' || !payload.hash) throw new HttpError(400, '"hash" must be a string.');
  if (!isPlainObject(payload.set)) throw new HttpError(400, '"set" must be an object.');
  const set = {};
  for (const [key, value] of Object.entries(payload.set)) {
    const field = def.fields.find((candidate) => candidate.name === key && candidate.type !== 'markdown');
    if (!field) throw new HttpError(400, `Field "${key}" is not editable here.`);
    set[key] = checkValue(field, value, key);
  }
  if (payload.body !== undefined && typeof payload.body !== 'string') throw new HttpError(400, '"body" must be a string.');
  return { hash: payload.hash, set, body: payload.body };
}

export function imagePaths(fields, values) {
  const found = [];
  for (const field of fields) {
    const value = values?.[field.name];
    if (field.type === 'image' && typeof value === 'string') found.push(value);
    else if (field.type === 'list' && Array.isArray(value)) {
      for (const item of value) if (isPlainObject(item)) found.push(...imagePaths(field.fields ?? [], item));
    }
  }
  return found;
}

export function checkImages(def, set, data) {
  const known = new Set(imagePaths(def.fields, data));
  for (const image of imagePaths(def.fields, set)) {
    if (!known.has(image)) throw new HttpError(400, `Image "${image}" is not referenced by this entry.`);
  }
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

export function mergeEntry(data, set, def) {
  const merged = { ...data };
  const typeOf = new Map(def.fields.map((field) => [field.name, field.type]));
  for (const [key, value] of Object.entries(set)) {
    if (value !== null) {
      merged[key] = value;
      continue;
    }
    const empty = EMPTY_VALUES[typeOf.get(key)];
    if (empty) merged[key] = empty();
    else delete merged[key];
  }
  for (const field of def.fields) {
    if (field.type === 'date' && isMidnightUtc(merged[field.name])) merged[field.name] = dateOnly(merged[field.name]);
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

export function fieldValues(def, data) {
  const values = {};
  for (const field of def.fields) {
    if (field.type === 'markdown' || !Object.hasOwn(data, field.name)) continue;
    const value = data[field.name];
    values[field.name] = field.type === 'date' && value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return values;
}

export async function refOptions(dir, skipId) {
  let names;
  let root;
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith('.md') && !name.startsWith('.')).sort();
    root = await realpath(dir);
  } catch {
    return [];
  }
  const options = [];
  for (const name of names) {
    try {
      const real = await realpath(path.join(dir, name));
      const rel = path.relative(root, real);
      if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel) || !(await stat(real)).isFile()) continue;
      const raw = await readFile(real, 'utf8');
      const parts = splitEntry(raw);
      if (!parts) continue;
      const data = load(parts.front);
      if (!isPlainObject(data)) continue;
      const id = explicitSlug(raw) || name.slice(0, -'.md'.length);
      if (id === skipId) continue;
      const label = typeof data.title === 'string' && data.title ? data.title : id;
      options.push(data.draft === true ? { value: id, label, draft: true } : { value: id, label });
    } catch {
      continue;
    }
  }
  return options.sort(
    (a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }) || a.value.localeCompare(b.value),
  );
}

async function formFields(fields, optionsFor) {
  const out = [];
  for (const field of fields) {
    const item = { name: field.name, type: field.type, label: field.label, help: field.help };
    if (field.type === 'refs') item.options = await optionsFor(field);
    else if (field.options !== undefined) item.options = field.options.map(({ value, label }) => ({ value, label }));
    if (field.collection !== undefined) item.collection = field.collection;
    if (field.fields !== undefined) item.fields = await formFields(field.fields, optionsFor);
    if (field.required !== undefined) item.required = field.required;
    if (field.default !== undefined) item.default = field.default;
    out.push(item);
  }
  return out;
}

export async function buildForm(def, optionsFor) {
  return { label: def.label, dir: def.dir, assets: def.assets, fields: await formFields(def.fields, optionsFor) };
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
    console.error('[editor]', err);
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

function parseTarget(rest) {
  const segments = rest.split('/');
  if (segments.length !== 2 || segments.some((segment) => !segment)) return null;
  try {
    return { collection: decodeURIComponent(segments[0]), id: decodeURIComponent(segments[1]) };
  } catch {
    return null;
  }
}

export async function handleRequest(req, { root, base, loadRegistry }) {
  const prefix = `${base}__editor/`;
  const pathname = String(req.url ?? '').split(/[?#]/)[0];
  if (!pathname.startsWith(prefix)) return null;
  const respond = (status, body, headers = {}) => ({ status, body, headers });
  try {
    const failed = checkRequest(req);
    if (failed) return respond(failed.status, { error: failed.error });
    const target = parseTarget(pathname.slice(prefix.length));
    const registry = await loadRegistry();
    if (!target || !Object.hasOwn(registry.collections, target.collection)) {
      return respond(404, { error: 'No such entry.' });
    }
    const { collection, id } = target;
    const def = registry.collections[collection];
    const entry = await resolveEntry(path.join(root, def.dir), id);
    if (!entry) return respond(404, { error: 'No such entry.' });

    if (req.method === 'GET') {
      const { hash, parts } = await readSplit(entry.file);
      if (!parts) throw new HttpError(422, 'The file has no leading --- block.');
      const data = readFrontmatter(parts.front);
      const form = await buildForm(def, (field) => {
        const targetDef = registry.collections[field.collection];
        if (!targetDef) return [];
        return refOptions(path.join(root, targetDef.dir), field.collection === collection ? id : null);
      });
      return respond(200, { id, hash, values: fieldValues(def, data), body: parts.body, form });
    }

    let payload;
    try {
      const raw = await req.readBody();
      payload = JSON.parse(raw);
    } catch (err) {
      if (err?.code === 'TOO_LARGE') return respond(413, { error: 'Body over 1 MB.' }, { connection: 'close' });
      return respond(400, { error: 'Malformed JSON.' });
    }
    const update = parseUpdate(payload, def);

    return await withLock(entry.file, async () => {
      const { hash, parts } = await readSplit(entry.file);
      if (hash !== update.hash) {
        return respond(409, { error: 'The file changed since the page loaded.' });
      }
      if (!parts) throw new HttpError(422, 'The file has no leading --- block.');
      const data = readFrontmatter(parts.front);
      checkImages(def, update.set, data);
      const merged = mergeEntry(data, update.set, def);
      const issues = schemaIssues(registry.schemaFor(collection), merged);
      if (issues.length) return respond(422, { error: 'The entry does not pass the schema.', issues });
      const text = serializeEntry(merged, normalizeBody(update.body ?? parts.body));
      await writeEntry(entry.file, text);
      return respond(200, { hash: sha256(Buffer.from(text, 'utf8')) });
    });
  } catch (err) {
    if (err instanceof HttpError) return respond(err.status, { error: err.message, ...err.extra });
    console.error('[editor]', err);
    return respond(500, { error: 'Unexpected error.' });
  }
}
