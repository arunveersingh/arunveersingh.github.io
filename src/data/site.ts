import { articlesRepo, channels, githubUser, playlists } from './sources.mjs';

/**
 * The brand is the domain. Reason From is the publication; Arunveer Singh is
 * its author. Chrome, titles, and social metadata carry the publication name,
 * and the author is stated as a byline rather than used as the masthead.
 */
export const brand = {
  name: 'Reason From',
  /** Rendered form of the wordmark: lowercase, like the domain. */
  wordmark: 'reason from',
  domain: 'reasonfrom.com',
  /** One line under the name wherever the brand is introduced. */
  strap: 'Engineering judgment, in public',
} as const;

export const site = {
  title: brand.name,
  tagline: 'AI should force you not to make mistakes.',
  description:
    'Arunveer Singh’s public work on engineering judgment, agent accountability, and production AI — not a tutorial dump.',
  author: 'Arunveer Singh',
  /**
   * Year the production-systems clock started. The "years shipping" stat is
   * derived from this so it can never go stale on the page.
   */
  careerStart: 2009,
  github: `https://github.com/${githubUser}`,
  articles: `https://github.com/${articlesRepo.owner}/${articlesRepo.name}`,
  ai: `https://github.com/${githubUser}/ai`,
  linkedin: 'https://www.linkedin.com/in/arunveersingh',
  x: 'https://x.com/oopsfeedmecode',
  email: 'oopsfeedmecode@gmail.com',
  youtube: channels,
  playlists,
} as const;

/** Whole years since `site.careerStart`, evaluated at build time. */
export const yearsShipping = new Date().getFullYear() - site.careerStart;

export type ChannelId = (typeof channels)[number]['id'];

/** Resolve a channel record from the id stored in video frontmatter. */
export function channelById(id: ChannelId) {
  const match = channels.find((channel) => channel.id === id);
  if (!match) throw new Error(`Unknown channel id: ${id}`);
  return match;
}

/**
 * Primary nav. `/atlas/` is deliberately absent: it stays out of the nav until
 * it has real topic pages rather than a promise of them.
 */
/**
 * Completions for the "Reason from ___" line, which exists to make the domain
 * mean something on the page.
 *
 * Each one maps to actual work rather than being filler: first-principles-decomposer
 * and the First Principles talk, assumption-surfacer and bayesian-belief-tracker,
 * pre-mortem-oracle, recontextualizer, and "Why Experts Solve the Wrong Problems".
 *
 * The count is load-bearing. The CSS reel keyframes are written for exactly this
 * many words, so `src/pages/index.astro` fails the build if it changes.
 */
export const reasonFrom = [
  'first principles',
  'evidence',
  'constraints',
  'the failure mode',
  'what you verified',
  'the problem itself',
] as const;

export const REASON_FROM_COUNT = 6;

export const nav = [
  { href: '/', label: 'Studio' },
  { href: '/essays/', label: 'Essays' },
  { href: '/watch/', label: 'Watch' },
  { href: '/builds/', label: 'Builds' },
  { href: '/about/', label: 'About' },
] as const;

export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const root = base.endsWith('/') ? base : `${base}/`;
  const trimmed = path.replace(/^\/+/, '');
  if (!trimmed) return root;
  return `${root}${trimmed}`;
}

/** Absolute, canonical URL for a site-relative path. Needs `site` in astro.config. */
export function absoluteUrl(path: string, origin: URL | undefined): string {
  const relative = withBase(path);
  return origin ? new URL(relative, origin).href : relative;
}
