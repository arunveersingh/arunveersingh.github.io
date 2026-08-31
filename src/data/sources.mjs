/**
 * Upstream sources of record.
 *
 * Plain `.mjs` on purpose: this is the one module imported by BOTH the Astro
 * app (`src/data/site.ts`) and the Node sync script (`scripts/sync.mjs`).
 * Keeping it out of TypeScript means the script needs no build step, and the
 * channel IDs / playlist IDs exist in exactly one place.
 */

/** @typedef {{ id: 'oopsfeedmecode' | 'developernoteshindi', name: string, href: string, channelId: string, language: string }} Channel */

/** @type {readonly Channel[]} */
export const channels = [
  {
    id: 'oopsfeedmecode',
    name: 'Oops! Feed Me Code',
    href: 'https://www.youtube.com/@oopsfeedmecode',
    channelId: 'UCnVym5w_jklmzFwaBcqy53w',
    language: 'English',
  },
  {
    id: 'developernoteshindi',
    name: 'Developer Notes Hindi',
    href: 'https://www.youtube.com/@developernoteshindi',
    channelId: 'UCiCr2n58IXBnAtPi4Je6rEA',
    language: 'Hindi',
  },
];

/**
 * Extra playlists to widen the pull. YouTube's RSS endpoint returns only the
 * most recent 15 entries per feed, so each playlist here buys up to 15 more
 * videos than the two channel feeds alone would surface.
 */
export const playlists = [
  'PL0rh0e_JogjkqC-xaXrOc1r04vk0fqKMF',
  'PL0rh0e_JogjkPBCZURSUETBb0UGNw3g30',
  'PL0rh0e_JogjlEKlwAp3hGD44hSOxIFQYD',
  'PL0rh0e_JogjlGDc0KUodpAbCVUtHIRZTO',
  'PL0rh0e_JogjlyXN24dVTYSug5fuha0bKM',
  'PL0rh0e_JogjkGfD3JVNAU2iTlxImMYyCa',
];

/** GitHub account that owns the repos rendered as builds. */
export const githubUser = 'arunveersingh';

/** Repo holding long-form articles that become essays. */
export const articlesRepo = {
  owner: 'arunveersingh',
  name: 'articles',
  branch: 'main',
};

/** Repos that are not public work worth listing as a build. */
export const skipRepos = ['arunveersingh', 'site', 'TechCreatorPortfolio'];

/**
 * Article paths already maintained by hand in `src/content/essays/`. Sync must
 * not clobber the hand-edited versions with the raw upstream markdown.
 */
export const handWrittenArticles = [
  '17112024/avoid-void-methods.md',
  '07122024/avoid-null-in-codebase-using-java-part-1.md',
  '09012025/SlownessVsLatency-right-terminology-matters.md',
];
