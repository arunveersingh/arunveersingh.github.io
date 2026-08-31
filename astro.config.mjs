// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Project Pages until a custom domain exists: https://arunveersingh.github.io/studio/
export default defineConfig({
  site: 'https://arunveersingh.github.io',
  base: '/studio',
  integrations: [
    mdx(),
    sitemap({
      // `/atlas/` is a stub and `/404` is not content. Neither belongs in a
      // sitemap submitted to search engines.
      filter: (page) => !page.includes('/atlas/') && !page.includes('/404'),
    }),
  ],
});
