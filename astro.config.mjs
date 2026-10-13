// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Custom apex domain, served by GitHub Pages from the arunveersingh.github.io repo.
// The domain is repo configuration, not public/CNAME: Pages builds here via
// GitHub Actions, and in that mode a CNAME file in the artifact is ignored.
export default defineConfig({
  // Drives every canonical URL, og:url, sitemap entry and RSS link.
  site: 'https://reasonfrom.com',
  // Apex domain, so the site serves from the root. This stays '/' even if the
  // repo is renamed, because the custom domain no longer depends on the repo
  // name the way a project-Pages subpath did.
  base: '/',
  // Dev serves public files by exact path. `/recontextualizer/` would 404
  // even though `public/recontextualizer/index.html` exists. GitHub Pages
  // resolves that index on its own; this only rewrites the dev request.
  vite: {
    plugins: [
      {
        name: 'recontextualizer-directory-index',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            const path = req.url?.split('?')[0];
            if (path === '/recontextualizer' || path === '/recontextualizer/') {
              req.url = '/recontextualizer/index.html';
            }
            next();
          });
        },
      },
    ],
  },
  integrations: [
    mdx(),
    sitemap({
      // `/atlas/` is a stub and `/404` is not content. Neither belongs in a
      // sitemap submitted to search engines.
      filter: (page) => !page.includes('/atlas/') && !page.includes('/404'),
    }),
  ],
});
