# Studio

Personal site for [Arunveer Singh](https://github.com/arunveersingh): essays, curated videos, and architecture notes about AI systems.

Built with Astro. Hosted on GitHub Pages at `https://arunveersingh.github.io/studio/` until a custom domain exists.

## Commands

```sh
npm install
npm run dev      # local: http://localhost:4321/studio/
npm run build
npm run preview
```

A push to `main` publishes via `.github/workflows/pages.yml`. Enable **Settings → Pages → GitHub Actions** once on the GitHub repo.

## Content

Markdown lives in `src/content/{essays,videos,builds,signals}/`. That is the CMS. Publish is `git push`.

Quality gate after a slice: `/review-studio` (see `.grok/workflows/review-studio.rhai`).
