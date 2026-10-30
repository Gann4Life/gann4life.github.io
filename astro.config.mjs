// @ts-check
import { rmSync } from 'node:fs';
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';

const isDev = process.argv.includes('dev');
const isStaging = process.env.DEPLOY_TARGET === 'staging';

export default defineConfig({
  site: 'https://gann4life.github.io',
  base: isStaging ? '/dev/' : '/',
  output: 'static',
  env: {
    schema: {
      DEPLOY_TARGET: envField.enum({
        context: 'server',
        access: 'public',
        values: ['production', 'staging'],
        default: 'production',
      }),
    },
  },
  integrations: [
    ...(isDev ? [react(), keystatic()] : []),
    ...(isStaging
      ? [
          {
            name: 'staging-not-indexed',
            hooks: {
              'astro:build:done': ({ dir }) => {
                for (const file of ['sitemap.xml', 'robots.txt']) rmSync(new URL(file, dir), { force: true });
              },
            },
          },
        ]
      : []),
  ],
});
