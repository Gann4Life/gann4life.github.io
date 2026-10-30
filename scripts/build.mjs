import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = path.join(SITE, '.astro', 'content-assets.mjs');
const ASTRO = path.join(SITE, 'node_modules', 'astro', 'bin', 'astro.mjs');

const saved = existsSync(ASSETS) ? readFileSync(ASSETS) : null;

let restored = false;
const restore = () => {
  if (restored) return;
  restored = true;
  if (saved === null) return;
  try {
    writeFileSync(ASSETS, saved);
  } catch (err) {
    console.error(`build: could not restore .astro/content-assets.mjs: ${err.message}`);
  }
};

const child = spawn(process.execPath, [ASTRO, 'build', ...process.argv.slice(2)], {
  cwd: SITE,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('error', (err) => {
  console.error(`build: could not start astro: ${err.message}`);
  restore();
  process.exit(1);
});

child.on('close', (code, signal) => {
  restore();
  process.exit(code ?? (signal ? 1 : 0));
});

process.on('exit', restore);
