import { z } from 'astro/zod';
import data from './data/profile.json';

const UNSAFE_URL = /["'()\\<>\s]/;

const httpsUrl = z
  .string()
  .nullish()
  .transform((value) => value ?? '')
  .refine((value) => {
    if (value === '') return true;
    if (UNSAFE_URL.test(value)) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be an https: URL without quotes, parentheses, backslashes, angle brackets or spaces');

const imageSource = z
  .object({
    upload: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    link: httpsUrl,
  })
  .prefault({});

const percentage = (max: number) =>
  z
    .number()
    .int()
    .min(0)
    .max(max)
    .nullish()
    .transform((value) => value ?? null);

const schema = z.object({
  hero: z.object({
    banner: imageSource,
    photo: imageSource,
    reel: z.union([z.url(), z.literal('')]).default(''),
    name: z.string().min(1),
    tagline: z.string().default(''),
    bio: z.string().default(''),
    links: z
      .array(
        z.object({
          label: z.string().min(1),
          url: z.url(),
        }),
      )
      .default([]),
  }),
  background: z
    .object({ image: imageSource, darken: percentage(100), blur: percentage(40) })
    .prefault({}),
  chrome: z.object({ logo: imageSource, favicon: imageSource }).prefault({}),
});

const parsed = schema.parse(data);

/** Site profile from src/data/profile.json, validated at build time; name, tagline, bio, reel (a YouTube/Vimeo URL shown as the home banner) and links are top-level, and appearance holds the optional banner, photo, logo, favicon and background image sources (upload path and/or https link; the upload wins) with background darken and blur. */
export const profile = {
  name: parsed.hero.name,
  tagline: parsed.hero.tagline,
  bio: parsed.hero.bio,
  reel: parsed.hero.reel,
  links: parsed.hero.links,
  appearance: {
    banner: parsed.hero.banner,
    photo: parsed.hero.photo,
    logo: parsed.chrome.logo,
    favicon: parsed.chrome.favicon,
    background: parsed.background.image,
    darken: parsed.background.darken,
    blur: parsed.background.blur,
  },
};