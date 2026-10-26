// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // User site: https://gann4life.github.io, so no `base` path prefix is needed.
  site: 'https://gann4life.github.io',
  // Static output only. No SSR adapter, no framework integrations.
  output: 'static',
});
