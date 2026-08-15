export const site = {
  title: 'Arunveer Singh',
  tagline: 'AI should force you not to make mistakes.',
  description:
    'A studio for essays, videos, and builds about AI systems, from a Principal Architect who ships.',
  author: 'Arunveer Singh',
  github: 'https://github.com/arunveersingh',
  articles: 'https://github.com/arunveersingh/articles',
  ai: 'https://github.com/arunveersingh/ai',
  linkedin: 'https://www.linkedin.com/in/arunveersingh',
  x: 'https://x.com/oopsfeedmecode',
  email: 'oopsfeedmecode@gmail.com',
  youtube: [
    {
      name: 'Oops! Feed Me Code',
      href: 'https://www.youtube.com/@oopsfeedmecode',
    },
    {
      name: 'Developer Notes Hindi',
      href: 'https://www.youtube.com/@developernoteshindi',
    },
  ],
} as const;

export const nav = [
  { href: '/', label: 'Studio' },
  { href: '/essays/', label: 'Essays' },
  { href: '/watch/', label: 'Watch' },
  { href: '/builds/', label: 'Builds' },
  { href: '/atlas/', label: 'Atlas' },
  { href: '/about/', label: 'About' },
] as const;

export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const root = base.endsWith('/') ? base : `${base}/`;
  const trimmed = path.replace(/^\/+/, '');
  if (!trimmed) return root;
  return `${root}${trimmed}`;
}
