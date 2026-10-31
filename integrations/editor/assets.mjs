import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, realpath, rename, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CODE_EXTENSIONS, references } from '../../scripts/exclude-drafts.mjs';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 64 * 1024 * 1024;
export const TOKEN_PATTERN = /^[a-z0-9]{1,16}$/;

const UPLOAD_LINK = /\]\(upload:([a-z0-9]{1,16})\)/g;
const BODY_LINK = /!\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g;
const NAME_LIMIT = 40;
const RENAME_RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const posix = (p) => p.split(path.sep).join('/');
const inside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

export function sniffType(bytes) {
  const b = Buffer.from(bytes);
  const at = (offset, text) => b.length >= offset + text.length && b.toString('latin1', offset, offset + text.length) === text;
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (at(0, 'GIF87a') || at(0, 'GIF89a')) return 'gif';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (at(4, 'ftyp') && (at(8, 'avif') || at(8, 'avis'))) return 'avif';
  return null;
}

export function bodyStem(givenName, slug) {
  const base = String(givenName).split(/[\\/]/).pop();
  const dot = base.lastIndexOf('.');
  const bare = dot > 0 ? base.slice(0, dot) : base;
  return slug(bare).slice(0, NAME_LIMIT).replace(/-+$/, '') || 'image';
}

export function decodeUploads(uploads) {
  if (!Array.isArray(uploads)) throw new HttpError(400, '"uploads" must be an array.');
  const files = new Map();
  for (const upload of uploads) {
    if (
      !isPlainObject(upload) ||
      typeof upload.token !== 'string' ||
      !TOKEN_PATTERN.test(upload.token) ||
      typeof upload.name !== 'string' ||
      typeof upload.data !== 'string'
    ) {
      throw new HttpError(400, 'Each upload needs a token, a name and base64 data.');
    }
    if (files.has(upload.token)) throw new HttpError(400, `Duplicate upload token "${upload.token}".`);
    const bytes = Buffer.from(upload.data, 'base64');
    const name = upload.name.slice(0, 200);
    if (bytes.length > MAX_FILE_BYTES) throw new HttpError(413, `"${name}" is over 10 MB.`);
    const ext = sniffType(bytes);
    if (!ext) throw new HttpError(415, `"${name}" is not a PNG, JPEG, WebP, AVIF or GIF image.`);
    files.set(upload.token, { name, bytes, ext });
  }
  return files;
}

export function uploadTokens(set) {
  const found = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (isPlainObject(value)) {
      if (typeof value.upload === 'string' && Object.keys(value).length === 1) found.push(value.upload);
      else Object.values(value).forEach(walk);
    }
  };
  walk(set);
  return found;
}

export function bodyImageLinks(body) {
  const found = [];
  for (const match of String(body).matchAll(BODY_LINK)) {
    const target = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
    let decoded = target;
    try {
      decoded = decodeURI(target);
    } catch {
      decoded = target;
    }
    found.push(decoded);
  }
  return found;
}

function slotsOf(def, data) {
  const slots = [];
  for (const field of def.fields) {
    if (field.type === 'image') {
      slots.push({ obj: data, key: field.name, rel: (ext) => `${field.name}.${ext}` });
    } else if (field.type === 'list' && Array.isArray(data[field.name])) {
      const images = (field.fields ?? []).filter((sub) => sub.type === 'image');
      data[field.name].forEach((item, index) => {
        if (!isPlainObject(item)) return;
        for (const sub of images) {
          slots.push({ obj: item, key: sub.name, rel: (ext) => `${field.name}/${index}/${sub.name}.${ext}` });
        }
      });
    }
  }
  return slots.filter((slot) => slot.obj[slot.key] !== undefined && slot.obj[slot.key] !== null);
}

export function imagePaths(data, body, def) {
  const paths = [];
  for (const slot of slotsOf(def, data)) {
    if (typeof slot.obj[slot.key] === 'string') paths.push(slot.obj[slot.key]);
  }
  return [...paths, ...bodyImageLinks(body ?? '')];
}

async function readIfExists(file) {
  try {
    return await readFile(file);
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') return null;
    throw err;
  }
}

async function realOrNull(file) {
  try {
    return await realpath(file);
  } catch {
    return null;
  }
}

export async function planImages({ root, def, id, entryFile, before, merged, body, uploads, slug }) {
  const entryDir = path.join(root, def.dir);
  const assetsRoot = path.join(root, def.assets);
  const sourceRoot = path.join(root, 'src', 'assets');
  const folder = path.join(assetsRoot, id);
  const linkTo = (abs) => posix(path.relative(entryDir, abs));
  const realSources = await realOrNull(sourceRoot);
  const used = new Set();
  const writes = [];
  const fieldTargets = new Set();
  const resolveLink = (value) => path.resolve(entryDir, value);
  const beforePaths = imagePaths(before.data, before.body, def).map(resolveLink);
  const reservedStems = new Set(
    def.fields
      .filter((field) => field.type === 'image' || (field.type === 'list' && (field.fields ?? []).some((sub) => sub.type === 'image')))
      .map((field) => field.name),
  );

  const resolveSource = async (value) => {
    const abs = path.resolve(entryDir, value);
    const real = await realOrNull(abs);
    if (real === null) return null;
    if (realSources === null || !inside(real, realSources) || !(await stat(real)).isFile()) {
      throw new HttpError(400, `Image "${value}" is outside src/assets.`);
    }
    return { abs, real };
  };

  const slots = slotsOf(def, merged);
  for (const slot of slots) {
    const value = slot.obj[slot.key];
    let bytes;
    let ext;
    let source = null;
    if (isPlainObject(value)) {
      const upload = uploads.get(value.upload);
      if (!upload) throw new HttpError(400, 'Unknown upload token.');
      used.add(value.upload);
      bytes = upload.bytes;
      ext = upload.ext;
    } else {
      source = await resolveSource(value);
      if (!source) continue;
      bytes = await readFile(source.real);
      ext = path.extname(source.abs).slice(1) || sniffType(bytes) || 'png';
    }
    const target = path.join(folder, slot.rel(ext));
    fieldTargets.add(target);
    slot.target = target;
    slot.bytes = bytes;
    slot.keep = source !== null && path.resolve(source.abs) === path.resolve(target);
  }
  for (const slot of slots) {
    if (!slot.target) continue;
    if (!slot.keep) {
      const prior = await readIfExists(slot.target);
      if (!(prior && prior.equals(slot.bytes))) writes.push({ target: slot.target, bytes: slot.bytes, prior });
    }
    slot.obj[slot.key] = linkTo(slot.target);
  }

  const assigned = new Map();
  const tokens = [...new Set([...String(body).matchAll(UPLOAD_LINK)].map((m) => m[1]))];
  const bodyLinks = new Map();
  for (const token of tokens) {
    const upload = uploads.get(token);
    if (!upload) throw new HttpError(400, 'Unknown upload token.');
    used.add(token);
    const stem = bodyStem(upload.name, slug);
    for (let n = 1; ; n++) {
      const candidateStem = n === 1 ? stem : `${stem}-${n}`;
      const candidate = path.join(folder, `${candidateStem}.${upload.ext}`);
      if (reservedStems.has(candidateStem) || fieldTargets.has(candidate)) continue;
      const taken = assigned.get(candidate);
      if (taken) {
        if (!taken.equals(upload.bytes)) continue;
        bodyLinks.set(token, linkTo(candidate));
        break;
      }
      const prior = await readIfExists(candidate);
      if (prior && !prior.equals(upload.bytes)) continue;
      assigned.set(candidate, upload.bytes);
      if (!prior) writes.push({ target: candidate, bytes: upload.bytes, prior: null });
      bodyLinks.set(token, linkTo(candidate));
      break;
    }
  }
  for (const upload of uploads.keys()) {
    if (!used.has(upload)) throw new HttpError(400, `Unused upload "${upload}".`);
  }
  const finalBody = String(body).replace(UPLOAD_LINK, (_, token) => `](${bodyLinks.get(token)})`);

  const afterSet = new Set(imagePaths(merged, finalBody, def).map(resolveLink));
  const candidates = [...new Set(beforePaths)].filter((abs) => !afterSet.has(abs));

  return { merged, body: finalBody, writes, candidates, folder, assetsRoot, sourceRoot, entryFile };
}

async function writeAtomic(file, bytes) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.editor-tmp`);
  try {
    await writeFile(tmp, bytes, { flag: 'wx' });
    for (let attempt = 1; ; attempt++) {
      try {
        await rename(tmp, file);
        return;
      } catch (err) {
        if (!RENAME_RETRYABLE.has(err?.code) || attempt >= 5) throw err;
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      }
    }
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

async function makeDirs(dir, created) {
  if (await realOrNull(dir)) return;
  await makeDirs(path.dirname(dir), created);
  await mkdir(dir);
  created.push(dir);
}

export async function rollbackImages(undo) {
  for (const { target, prior } of undo.overwritten) await writeAtomic(target, prior).catch(() => {});
  for (const file of undo.created) await unlink(file).catch(() => {});
  for (const dir of [...undo.dirs].reverse()) await rmdir(dir).catch(() => {});
}

export async function writeImages(plan) {
  const undo = { overwritten: [], created: [], dirs: [] };
  if (plan.writes.length === 0) return undo;
  try {
    await makeDirs(plan.assetsRoot, undo.dirs);
    const realAssets = await realpath(plan.assetsRoot);
    await makeDirs(plan.folder, undo.dirs);
    const realFolder = await realpath(plan.folder);
    if (!inside(realFolder, realAssets)) throw new Error('Asset folder escapes src/assets.');
    for (const { target, bytes, prior } of plan.writes) {
      await makeDirs(path.dirname(target), undo.dirs);
      if (!inside(await realpath(path.dirname(target)), realFolder) && path.dirname(target) !== plan.folder) {
        throw new Error('Image target escapes the entry folder.');
      }
      if (prior) undo.overwritten.push({ target, prior });
      else undo.created.push(target);
      await writeAtomic(target, bytes);
    }
    return undo;
  } catch (err) {
    console.error('[editor]', err);
    await rollbackImages(undo);
    throw new HttpError(500, 'Could not write the images.');
  }
}

async function referencingTexts(plan) {
  const root = path.dirname(plan.sourceRoot);
  const texts = [];
  const entry = await realOrNull(plan.entryFile);
  let files = [];
  try {
    files = (await readdir(root, { recursive: true, withFileTypes: true }))
      .filter((d) => d.isFile())
      .map((d) => path.join(d.parentPath ?? d.path, d.name));
  } catch {
    files = [];
  }
  const candidates = [...files, path.join(path.dirname(root), 'keystatic.config.ts')];
  for (const file of candidates) {
    if (inside(file, plan.sourceRoot)) continue;
    if (!CODE_EXTENSIONS.has(path.extname(file).toLowerCase()) && path.basename(file) !== 'keystatic.config.ts') continue;
    if ((await realOrNull(file)) === entry) continue;
    const text = await readIfExists(file);
    if (text) texts.push(text.toString('utf8'));
  }
  return texts;
}

export async function deleteReplaced(plan) {
  if (plan.candidates.length === 0) return [];
  const realFolder = await realOrNull(plan.folder);
  const realSources = await realOrNull(plan.sourceRoot);
  if (!realFolder || !realSources) return [];
  const deleted = [];
  let texts = null;
  for (const abs of plan.candidates) {
    const real = await realOrNull(abs);
    if (!real || !inside(real, realFolder)) continue;
    texts ??= await referencingTexts(plan);
    const needle = `assets/${posix(path.relative(realSources, real))}`;
    if (texts.some((text) => references(text, needle))) continue;
    await unlink(real).catch(() => {});
    deleted.push(real);
    for (let dir = path.dirname(real); inside(dir, realFolder); dir = path.dirname(dir)) {
      try {
        await rmdir(dir);
      } catch {
        break;
      }
    }
  }
  return deleted;
}
