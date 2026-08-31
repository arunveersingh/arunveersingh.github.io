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

/** Ordered. Position 0 leads the builds index. */
export const selectedBuildIds = [
  'ai-skills',
  'code-intel-mcp',
  'sbom-parser',
  'json-vs-protobuf',
  'httpcraftsman',
  'systemdesignlab',
  'microservice-design-patterns',
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
