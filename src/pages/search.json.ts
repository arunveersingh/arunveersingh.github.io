import { getCollection } from 'astro:content';
import { withBase } from '../data/site';
import { lessonSlug, outlines } from '../lib/courses';
import { resourceLabel, skillTitle } from '../lib/skills';

/**
 * Static search index: every lesson, course page, skill and essay. Built at
 * deploy time, fetched by /search/ on first keystroke. No server, no tracking.
 */
const plain = (md = '') =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);

export async function GET() {
  const courseTitle = new Map(outlines.map((o) => [o.slug, o.title]));
  const [lessons, pages, skills, essays] = await Promise.all([
    getCollection('courses'),
    getCollection('coursePages'),
    getCollection('skills'),
    getCollection('essays', ({ data }) => !data.draft),
  ]);
  const docs = [
    ...lessons.map((e) => ({
      kind: 'Lesson',
      where: courseTitle.get(e.data.course) ?? e.data.course,
      title: e.data.title,
      summary: e.data.description,
      url: withBase(`/courses/${e.data.course}/${lessonSlug(e.data.day)}/`),
      text: plain(e.body),
    })),
    ...pages.map((e) => ({
      kind: e.data.section,
      where: courseTitle.get(e.data.course) ?? e.data.course,
      title: e.data.title,
      summary: e.data.description ?? '',
      url: withBase(`/courses/${e.data.course}/${e.id.split('/').at(-1)}/`),
      text: plain(e.body),
    })),
    ...skills.map((e) => ({
      kind: 'Skill',
      where: resourceLabel(e.data.resource),
      title: skillTitle(e),
      summary: e.data.symptom,
      url: withBase(`/skills/${e.data.name}/`),
      text: plain(e.body),
    })),
    ...essays.map((e) => ({
      kind: 'Essay',
      where: 'Essays',
      title: e.data.title,
      summary: e.data.description,
      url: withBase(`/essays/${e.id}/`),
      text: plain(e.body),
    })),
  ];
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json' } });
}
