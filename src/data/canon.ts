/**
 * Work that carries expert signal. Everything else is library, not the argument.
 *
 * Every id and needle below is verified at build time by `src/lib/content.ts`.
 * A typo here fails the build instead of silently dropping an item from the cut.
 */

/**
 * Substrings that mark a video as judgment rather than syntax. Matched against
 * the generated slug, which is `<title-slug>-<youtubeId prefix>`.
 */
export const videoNeedles = [
  'why-ai-fails',
  'first-principles',
  'experts-solve',
  'scalable-llm',
  'llm-inference',
  'reskilling',
  'sycophancy',
  // Slug is "your-daily-meetings-are-making-you-dumber-…"; the needle used to
  // read "meetings-making" and matched nothing.
  'meetings-are-making',
  'older-juniors',
  'architecture-vs-design',
  'architectural-dimensions',
  'should-developers-still-learn',
];

/**
 * Ordered preference for the single video that leads the homepage and the watch
 * theater. First match wins, so this list expresses intent directly. It used to
 * be an `||` inside `.find()` over a date-sorted array, which meant whichever
 * candidate was newest silently won regardless of the order written here.
 */
export const leadVideoNeedles = ['why-ai-fails', 'first-principles'];

/**
 * Ordered. Position 0 leads the builds index and the homepage.
 *
 * The bar for this list is that the repo contains real work AND can say what
 * problem it solves. `src/lib/content.ts` enforces the second half at build
 * time: a selected entry with no `problem` fails the build, because a curated
 * item that cannot explain itself renders as a bare name and quietly weakens
 * every other entry beside it.
 *
 * Removed after checking the repos rather than trusting the list:
 *   systemdesignlab              — GitHub reports "This repository is empty"
 *   microservice-design-patterns — 4 KB: a LICENSE and a two-line README
 *   httpcraftsman                — 1.35 MB of real TypeScript, but no
 *                                  description and no README, so nothing here
 *                                  can say why it belongs. Worth promoting back
 *                                  the moment it has one sentence describing it.
 *
 * Note that size alone is a bad proxy: the largest repo on the account
 * (microserviceswithspring, 9 MB) is a learning-samples dump and belongs in the
 * archive, not here.
 */
export const selectedBuildIds = [
  'ai-skills',
  'code-intel-mcp',
  'sbom-parser',
  'json-vs-protobuf',
];

/** Ordered. All of these render on the homepage; position 0 leads the essays index. */
export const featuredEssayIds = [
  'slowness-vs-latency',
  'eliminating-null-in-java',
  'testing-void-methods',
  'avoid-null-in-spring-app-part-2',
];

export function matchesNeedle(id: string, needles: readonly string[]): boolean {
  const hay = id.toLowerCase();
  return needles.some((needle) => hay.includes(needle));
}
