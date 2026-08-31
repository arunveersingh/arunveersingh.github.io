import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site, withBase } from '../data/site';
import { publishedEssays, summaryFor } from '../lib/content';

/**
 * Essay feed. The footer has always claimed "canonical writing · not a feed";
 * this makes the canonical part subscribable without turning it into one.
 */
export async function GET(context: APIContext) {
  const essays = await publishedEssays();

  return rss({
    title: `${site.title} — Essays`,
    description: site.description,
    // Absolute origin from astro.config.mjs; item links are resolved against it.
    site: context.site ?? 'https://arunveersingh.github.io',
    trailingSlash: true,
    items: essays.map((entry) => ({
      title: entry.data.title,
      // Fall back to the title when the synced description is just the title.
      description: summaryFor(entry.data.title, entry.data.description) ?? entry.data.title,
      pubDate: entry.data.published,
      link: withBase(`/essays/${entry.id}/`),
      categories: entry.data.topics,
    })),
    customData: [
      '<language>en-us</language>',
      `<managingEditor>${site.email} (${site.author})</managingEditor>`,
    ].join(''),
  });
}
