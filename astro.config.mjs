// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// Project Pages until a custom domain exists: https://arunveersingh.github.io/studio/
export default defineConfig({
  site: 'https://arunveersingh.github.io',
  base: '/studio',
  integrations: [mdx()],
});
