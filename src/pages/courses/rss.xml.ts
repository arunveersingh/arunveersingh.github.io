import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { site, withBase } from '../../data/site';
import { lessonSlug, outlines } from '../../lib/courses';

/**
 * Lessons feed, separate from the essay feed on purpose: /rss.xml stays
 * "canonical writing". A lesson appears here once it has a published date —
 * the day it reached the site, or its scheduled day.
 */
export async function GET(context: APIContext) {
  const titles = new Map(outlines.map((o) => [o.slug, o.title]));
  const lessons = (await getCollection('courses', ({ data }) => Boolean(data.published)))
    .sort((a, b) => b.data.published!.getTime() - a.data.published!.getTime() || b.data.day - a.data.day);

  return rss({
    title: `${site.title} — Lessons`,
    description: 'New lessons from the courses on reasonfrom.com.',
    site: context.site ?? 'https://reasonfrom.com',
    trailingSlash: true,
    items: lessons.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.published,
      link: withBase(`/courses/${entry.data.course}/${lessonSlug(entry.data.day)}/`),
      categories: [titles.get(entry.data.course) ?? entry.data.course, entry.data.phase],
    })),
    customData: '<language>en-us</language>',
  });
}
