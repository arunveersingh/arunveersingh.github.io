import { getCollection, type CollectionEntry } from 'astro:content';
import { topicLinks } from '../data/topic-links';

type Video = CollectionEntry<'videos'>;
const text = (v: Video) => `${v.data.title} ${v.data.thesis}`;

/** Skill names and course slugs a video relates to, de-duplicated, rule order kept. */
export function linksForVideo(v: Video): { skills: string[]; courses: string[] } {
  const skills: string[] = [];
  const courses: string[] = [];
  for (const rule of topicLinks) {
    if (!rule.match.test(text(v))) continue;
    for (const s of rule.skills ?? []) if (!skills.includes(s)) skills.push(s);
    for (const c of rule.courses ?? []) if (!courses.includes(c)) courses.push(c);
  }
  return { skills, courses };
}

const newest = (a: Video, b: Video) => b.data.published.getTime() - a.data.published.getTime();

/** Videos related to a skill or course, newest first; long talks before Shorts. */
export async function videosFor(kind: 'skill' | 'course', key: string, limit = 6): Promise<Video[]> {
  const all = (await getCollection('videos')).filter((v) => v.data.youtubeId);
  return all
    .filter((v) => (kind === 'skill' ? linksForVideo(v).skills : linksForVideo(v).courses).includes(key))
    .sort((a, b) => (a.data.format === 'short' ? 1 : 0) - (b.data.format === 'short' ? 1 : 0) || newest(a, b))
    .slice(0, limit);
}

/** New long videos: the newest few published in the last `days`, as of build time. */
export function latest(videos: Video[], { days = 30, limit = 3, now = new Date() } = {}): Video[] {
  const cutoff = now.getTime() - days * 86400000;
  return videos
    .filter((v) => v.data.youtubeId && v.data.format !== 'short' && v.data.published.getTime() >= cutoff)
    .sort(newest)
    .slice(0, limit);
}

/** Shorts grouped by series: the "| 03 #kafka" style suffix, else the first hashtag, else "Shorts". */
export function shortsBySeries(videos: Video[]): { series: string; items: Video[] }[] {
  const groups = new Map<string, Video[]>();
  for (const v of videos.filter((x) => x.data.format === 'short').sort(newest)) {
    const tag = v.data.title.match(/#([a-z][a-z0-9]+)/i)?.[1]?.toLowerCase();
    const series = !tag || tag === 'shorts' ? 'More shorts' : SERIES_NAMES[tag] ?? `#${tag}`;
    if (!groups.has(series)) groups.set(series, []);
    groups.get(series)!.push(v);
  }
  return [...groups].map(([series, items]) => ({ series, items })).sort((a, b) => (a.series === 'More shorts' ? 1 : b.series === 'More shorts' ? -1 : b.items.length - a.items.length));
}

const SERIES_NAMES: Record<string, string> = {
  kafka: 'Kafka internals',
  systemdesign: 'System design fundamentals',
  ai: 'AI concepts',
  aiconcepts: 'AI concepts',
  airevolution: 'AI concepts',
  java: 'Java',
  coding: 'Java',
  javaprogramming: 'Java',
  codewhisperer: 'AI tools',
};
