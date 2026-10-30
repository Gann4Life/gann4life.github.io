#!/usr/bin/env node
/*
 * npm run add -- <url> [<url> ...]
 *
 * One-off import of specific works (any platform in scripts/platforms.mjs).
 * To pull everything from your profiles at once, use `npm run sync`.
 */
import { knownUrls, normalizeUrl, readerFor, writeDraft } from './platforms.mjs';

const urls = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (urls.length === 0) {
  console.log('Usage: npm run add -- <url> [<url> ...]');
  process.exit(1);
}

const seen = await knownUrls();
let failed = 0;
for (const url of urls) {
  if (seen.urls.has(normalizeUrl(url))) {
    console.log(`skip  ${url} (already in an entry)`);
    continue;
  }
  try {
    console.log(await writeDraft(await readerFor(url)(url), seen));
  } catch (err) {
    failed++;
    console.error(`fail  ${url}: ${err.message}`);
  }
}

console.log('\nReview drafts in /keystatic: set contribution, roles, authorship, then untick Draft.');
process.exit(failed ? 1 : 0);
