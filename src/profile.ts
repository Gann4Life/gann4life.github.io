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

const imageSource = z.object({
  file: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  url: httpsUrl,
});

const percentage = (max: number) =>
  z
    .number()
    .int()
    .min(0)
    .max(max)
    .nullish()
    .transform((value) => value ?? null);

const appearance = z.object({
  photo: imageSource.prefault({}),
  logo: imageSource.prefault({}),
  favicon: imageSource.prefault({}),
  banner: imageSource.prefault({}),
  background: imageSource.extend({ darken: percentage(100), blur: percentage(40) }).prefault({}),
});

const schema = z.object({
  name: z.string().min(1),
  tagline: z.string().default(''),
  bio: z.string().default(''),
  reel: z.union([z.url(), z.literal('')]).default(''),
  links: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.url(),
      }),
    )
    .default([]),
  appearance: appearance.prefault({}),
});

/** Site profile from src/data/profile.json, validated at build time; reel is a YouTube/Vimeo URL shown as the home banner; appearance holds the optional photo, logo, favicon, banner and background sources (file path and https URL each). */
export const profile = schema.parse(data);
