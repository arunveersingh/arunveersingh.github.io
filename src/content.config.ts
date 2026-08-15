import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const topics = z.array(z.string()).default([]);

const essays = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/essays' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    topics,
    draft: z.boolean().default(false),
  }),
});

const videos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/videos' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    channel: z.enum(['oopsfeedmecode', 'developernoteshindi']),
    youtubeId: z.string().optional(),
    topics,
    thesis: z.string(),
  }),
});

const builds = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/builds' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    repo: z.string().url(),
    topics,
    problem: z.string(),
  }),
});

const signals = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/signals' }),
  schema: z.object({
    title: z.string(),
    published: z.coerce.date(),
    href: z.string().url().optional(),
    topics,
  }),
});

export const collections = { essays, videos, builds, signals };
