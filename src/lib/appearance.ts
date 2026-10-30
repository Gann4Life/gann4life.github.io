import { posix } from 'node:path';
import type { ImageMetadata } from 'astro';
import { profile } from '../profile';

const images = import.meta.glob<ImageMetadata>('/src/assets/{site,shared}/**/*.{png,jpg,jpeg,webp,avif,gif,svg}', {
  eager: true,
  import: 'default',
});

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg'];

export type AppearanceSource = { kind: 'asset'; image: ImageMetadata } | { kind: 'url'; src: string } | null;

function resolve(field: string, file: string, url: string): AppearanceSource {
  if (file) {
    const path = posix.normalize(posix.join('/src/data', file));
    const extension = path.split('.').pop()?.toLowerCase() ?? '';
    if (!EXTENSIONS.includes(extension)) {
      throw new Error(`appearance.${field}.file "${file}": unsupported extension; use ${EXTENSIONS.join(', ')}.`);
    }
    if (field === 'favicon' && extension !== 'svg' && extension !== 'png') {
      throw new Error(`appearance.favicon.file "${file}": favicon uploads must be svg or png.`);
    }
    const image = images[path];
    if (!image) {
      throw new Error(`appearance.${field}.file "${file}": resolved to ${path}, which is not a file under src/assets/site/ or src/assets/shared/.`);
    }
    return { kind: 'asset', image };
  }
  return url ? { kind: 'url', src: url } : null;
}

const { appearance } = profile;

/** Resolved site appearance from the profile: per field an uploaded asset, a directly used https URL or null, plus background darken (0-100, default 70) and blur (px, default 12). Fails the build on a missing, misplaced or unsupported upload; never fetches a URL. */
export const siteAppearance = {
  photo: resolve('photo', appearance.photo.file, appearance.photo.url),
  logo: resolve('logo', appearance.logo.file, appearance.logo.url),
  favicon: resolve('favicon', appearance.favicon.file, appearance.favicon.url),
  banner: resolve('banner', appearance.banner.file, appearance.banner.url),
  background: resolve('background', appearance.background.file, appearance.background.url),
  darken: appearance.background.darken ?? 70,
  blur: appearance.background.blur ?? 12,
};
