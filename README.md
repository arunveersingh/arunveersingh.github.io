# Studio

Personal site for [Arunveer Singh](https://github.com/arunveersingh): essays, curated videos, and architecture notes about AI systems.

Built with Astro. Live at **https://reasonfrom.com**

Served by GitHub Pages from the `arunveersingh.github.io` repo, on the apex domain `reasonfrom.com`. Two things bind that together and both must agree:

- `public/CNAME` contains `reasonfrom.com`. GitHub reads it on every deploy; delete it and the site reverts to `arunveersingh.github.io`.
- `site` in `astro.config.mjs` is `https://reasonfrom.com`. It drives every canonical URL, `og:url`, sitemap entry and RSS link, so it must match the CNAME or social cards and canonicals point at the wrong origin.

DNS at the registrar (Hostinger):

```
A     @     185.199.108.153
A     @     185.199.109.153
A     @     185.199.110.153
A     @     185.199.111.153
AAAA  @     2606:50c0:8000::153
AAAA  @     2606:50c0:8001::153
AAAA  @     2606:50c0:8002::153
AAAA  @     2606:50c0:8003::153
CNAME www   arunveersingh.github.io.
```

## Commands

```sh
npm install
npm run dev      # local: http://localhost:4321/
npm run build
npm run preview

npm run sync     # pull live YouTube / GitHub / articles into src/content
npm run refresh  # sync, then build
npm run check    # astro check (types + content schemas)
npm run verify   # check, then build — run this before pushing
npm run og       # regenerate public/og.png
```

`dev` and `build` no longer run `sync`. Syncing rewrites files in `src/content`, so having it on the dev path meant starting a server churned the working tree. Pull content explicitly with `npm run sync` or `npm run refresh`.

A push to `main` publishes via `.github/workflows/pages.yml`, which runs check → build. Enable **Settings → Pages → GitHub Actions** once on the GitHub repo.

CI does not sync. Content is committed, so deploys are deterministic and need no network, no tokens, and no rate limit. Refreshing content is a deliberate local act:

```sh
npm run sync && npm run verify   # then commit the content diff
```

## Content

Markdown lives in `src/content/{essays,videos,builds}/`. That is the CMS. Publish is `git push`.

Every file carries one of two markers, and `npm run sync` respects them:

| Marker             | Behaviour                                       |
| ------------------ | ----------------------------------------------- |
| `manual: true`     | Never touched by sync.                          |
| `generated: true`  | Replaced on every sync.                         |
| neither            | Treated as hand-written and left alone.         |

Sync fetches and validates a whole collection before deleting anything, and aborts if the upstream result collapses (zero items, or under 60% of what is on disk). A transient YouTube outage or a GitHub rate limit fails the build instead of publishing an empty Watch page.

Running sync locally without `GITHUB_TOKEN` hits the unauthenticated 60 requests/hour limit. CI sets the token automatically; locally, export a personal access token with no scopes if you need a full run.

## Curation

`src/data/canon.ts` decides what leads. Ids and slug needles there are verified at build time — a typo fails the build with the offending value named, rather than silently dropping an item and quietly changing the counts on the homepage.

`src/data/sources.mjs` holds channel ids, playlist ids, and repo names. It is plain `.mjs` because both the Astro app and the Node sync script import it, so those values exist in exactly one place.

Quality gate after a slice: `/review-studio` (see `.grok/workflows/review-studio.rhai`).
