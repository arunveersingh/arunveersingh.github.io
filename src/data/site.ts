import { articlesRepo, channels, githubUser, playlists } from './sources.mjs';

export const site = {
  title: 'Arunveer Singh',
  tagline: 'AI should force you not to make mistakes.',
  description:
    'Public work on engineering judgment, agent accountability, and production AI — not a tutorial dump.',
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
