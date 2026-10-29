// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

// Keystatic (docs/1-stack.md) runs only under `astro dev`: its /keystatic and
// /api/keystatic routes are on-demand, so loading it at build time would need
// a server adapter. The published site stays fully static and ships no React.
const isDev = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  // User site: https://gann4life.github.io, so no `base` path prefix is needed.
  site: 'https://gann4life.github.io',
  // Static output only. No SSR adapter; React is loaded for the dev-only admin.
  output: 'static',
  integrations: isDev ? [react(), keystatic()] : [],
});
