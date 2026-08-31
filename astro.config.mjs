// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// GitHub user site: https://arunveersingh.github.io/
export default defineConfig({
  site: 'https://arunveersingh.github.io',
  // Root, not a subpath: the repo is named `arunveersingh.github.io`, which
  // makes this a GitHub *user* site served from the domain root. A project site
  // (any other repo name) would serve from /<repo>/ and need `base` set to match.
  base: '/',
  integrations: [
    mdx(),
    sitemap({
      // `/atlas/` is a stub and `/404` is not content. Neither belongs in a
      // sitemap submitted to search engines.
      filter: (page) => !page.includes('/atlas/') && !page.includes('/404'),
    }),
  ],
});
