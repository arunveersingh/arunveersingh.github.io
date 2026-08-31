import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Astro 7 deprecates re-exporting `z` from `astro:content`. Importing zod
// directly also makes it an explicit dependency instead of a phantom one.
import { z } from 'zod';

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
    /** Set by hand to stop `npm run sync` from overwriting the file. */
    manual: z.boolean().default(false),
    /** Set by `npm run sync`; marks the file as safe to replace. */
    generated: z.boolean().default(false),
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
    manual: z.boolean().default(false),
    generated: z.boolean().default(false),
  }),
});

const builds = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/builds' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Repo creation date. Genuinely when the work started existing. */
    published: z.coerce.date(),
    /** Last push. Drives ordering without pretending to be a publish date. */
    updated: z.coerce.date().optional(),
    repo: z.url(),
    topics,
    /**
     * What the repo is for, in the author's words. Optional: repos with no
     * GitHub description get nothing rather than filler like
     * "Public repository owner/name."
     */
    problem: z.string().optional(),
    manual: z.boolean().default(false),
    generated: z.boolean().default(false),
  }),
});

export const collections = { essays, videos, builds };
