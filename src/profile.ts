import { z } from 'astro/zod';
import data from './data/profile.json';

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
});

/** Site profile from src/data/profile.json, validated at build time; reel is a YouTube/Vimeo URL shown as the home banner. */
export const profile = schema.parse(data);
