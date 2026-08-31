import { getCollection, type CollectionEntry } from 'astro:content';
import {
  featuredEssayIds,
  leadVideoNeedles,
  matchesNeedle,
  selectedBuildIds,
  videoNeedles,
} from '../data/canon';

/**
 * Curation lists in `src/data/canon.ts` are hand-maintained, so a typo used to
 * mean an item silently vanished from the site and every derived count was
 * quietly wrong. Resolution now throws, which fails the build instead.
 */
// Generic over the entry type rather than the collection name: `CollectionEntry<C>`
// with a union-constrained `C` distributes into a union that inference then
// resolves to the wrong branch.
function resolveCurated<T extends { id: string }>(
  ids: readonly string[],
  pool: T[],
  label: string,
): T[] {
  const byId = new Map(pool.map((entry) => [entry.id.toLowerCase(), entry]));
  const missing: string[] = [];
  const found: T[] = [];

  for (const id of ids) {
    const entry = byId.get(id.toLowerCase());
    if (entry) found.push(entry);
    else missing.push(id);
  }

  if (missing.length > 0) {
    throw new Error(
      `${label}: ${missing.length} curated id(s) match no content: ${missing.join(', ')}. ` +
        `Fix src/data/canon.ts or the content file name.`,
    );
  }
  return found;
}

function assertEveryNeedleMatches(
  needles: readonly string[],
  pool: CollectionEntry<'videos'>[],
  label: string,
): void {
  const dead = needles.filter((needle) => !pool.some((entry) => entry.id.toLowerCase().includes(needle)));
  if (dead.length > 0) {
    throw new Error(
      `${label}: ${dead.length} needle(s) match no video: ${dead.join(', ')}. ` +
        `Fix src/data/canon.ts or check that the video is still in the synced feed.`,
    );
  }
}

const byNewest = <T extends { data: { published: Date } }>(a: T, b: T) =>
  b.data.published.valueOf() - a.data.published.valueOf();

export async function publishedEssays(): Promise<CollectionEntry<'essays'>[]> {
  return (await getCollection('essays')).filter((entry) => !entry.data.draft).sort(byNewest);
}

export async function publishedVideos(): Promise<CollectionEntry<'videos'>[]> {
  return (await getCollection('videos')).sort(byNewest);
}

/**
 * Sorted by most recent activity. `updated` is the repo's last push and
 * `published` is when it was created — the old code sorted on a `published`
 * field that actually held `pushed_at`, so a README typo in a 2018 repo
 * presented as a brand-new publication.
 */
export async function publishedBuilds(): Promise<CollectionEntry<'builds'>[]> {
  return (await getCollection('builds')).sort((a, b) => {
    const activity = (entry: CollectionEntry<'builds'>) =>
      (entry.data.updated ?? entry.data.published).valueOf();
    return activity(b) - activity(a);
  });
}

export async function canonVideos(): Promise<CollectionEntry<'videos'>[]> {
  const all = await publishedVideos();
  assertEveryNeedleMatches(videoNeedles, all, 'videoNeedles');
  assertEveryNeedleMatches(leadVideoNeedles, all, 'leadVideoNeedles');
  return all.filter((entry) => matchesNeedle(entry.id, videoNeedles));
}

/**
 * The one video that leads the homepage and the watch theater, chosen by the
 * order of `leadVideoNeedles` rather than by publish date.
 */
export async function leadVideo(): Promise<CollectionEntry<'videos'> | undefined> {
  const selected = await canonVideos();
  for (const needle of leadVideoNeedles) {
    const match = selected.find(
      (entry) => entry.id.toLowerCase().includes(needle) && entry.data.youtubeId,
    );
    if (match) return match;
  }
  return selected.find((entry) => entry.data.youtubeId) ?? (await publishedVideos())[0];
}

export async function selectedBuilds(): Promise<CollectionEntry<'builds'>[]> {
  const selected = resolveCurated(selectedBuildIds, await publishedBuilds(), 'selectedBuildIds');

  // A selected build with no `problem` renders as a bare title with nothing
  // underneath, which undercuts every entry beside it. Two repos were sitting in
  // this list that way, one of them an entirely empty repository. Curation that
  // cannot say why an item is curated is not curation, so this is now fatal.
  const unexplained = selected.filter((entry) => !entry.data.problem?.trim());
  if (unexplained.length > 0) {
    throw new Error(
      `selectedBuildIds: ${unexplained.length} selected build(s) have no \`problem\`: ` +
        `${unexplained.map((entry) => entry.id).join(', ')}. ` +
        `Add a GitHub description and re-run \`npm run sync\`, write a manual note, ` +
        `or drop it from src/data/canon.ts.`,
    );
  }
  return selected;
}

/**
 * The build that leads the homepage and the builds index — position 0 of the
 * ordered curation list. Pages used to search for the 'ai-skills' id inline and
 * silently fall back, so the lead was set in two places at once.
 */
export async function leadBuild(): Promise<CollectionEntry<'builds'> | undefined> {
  return (await selectedBuilds())[0];
}

export async function archiveBuilds(): Promise<CollectionEntry<'builds'>[]> {
  const selected = new Set(selectedBuildIds.map((id) => id.toLowerCase()));
  return (await publishedBuilds()).filter((entry) => !selected.has(entry.id.toLowerCase()));
}

export async function featuredEssays(): Promise<CollectionEntry<'essays'>[]> {
  const all = await publishedEssays();
  if (featuredEssayIds.length === 0) return all.slice(0, 3);
  return resolveCurated(featuredEssayIds, all, 'featuredEssayIds');
}

/**
 * Returns `description` only when it actually adds information beyond `title`.
 *
 * Articles synced without frontmatter get `description: <title>`, so index
 * templates were rendering the same sentence twice — once as the heading and
 * once as the summary underneath it.
 */
export function summaryFor(title: string, description: string | undefined): string | null {
  if (!description) return null;
  const normalise = (value: string) =>
    value
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.。·—–-]+$/, '')
      .toLowerCase();
  return normalise(title) === normalise(description) ? null : description;
}
