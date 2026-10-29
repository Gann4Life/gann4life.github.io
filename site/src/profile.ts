import { z } from 'astro/zod';
import data from './data/profile.json';

/*
 * Site profile — docs/2-content-model.md, "Profile". Edited from the
 * Keystatic "Profile" singleton; validated here so a bad edit fails the build.
 */

const schema = z.object({
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
});

export const profile = schema.parse(data);
