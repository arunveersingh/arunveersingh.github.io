import { site } from './site';

/**
 * The agent skills published at github.com/arunveersingh/ai.
 *
 * Single source of truth for both the homepage terminal strip and the skill
 * count rendered in the stats band. Previously the strip was a hardcoded array
 * in `index.astro` and the count was a hand-typed "11" — the two could drift
 * from the repo and from each other without anything failing.
 */
export interface Skill {
  /** Directory name under `skills/` in the repo. */
  name: string;
  /** Short refusal the skill enforces. Used in the homepage strip. */
  note: string;
  /** Shown in the homepage terminal window. */
  featured: boolean;
}

export const skills: readonly Skill[] = [
  { name: 'adversarial-collaborator', note: 'requires a real update', featured: true },
  { name: 'pre-mortem-oracle', note: 'will say do not proceed', featured: true },
  { name: 'editor-not-writer', note: 'not ready is allowed', featured: true },
  { name: 'recontextualizer', note: 'prove you own the code', featured: true },
  { name: 'assumption-surfacer', note: 'contradictions block', featured: true },
  { name: 'learning-partner', note: '"I get it" is not enough', featured: true },
  { name: 'decision-pressure-tester', note: 'stops at critical failures', featured: false },
  { name: 'first-principles-decomposer', note: 'will not derive from a guess', featured: false },
  { name: 'concept-synthesizer', note: 'needs a falsifiable prediction', featured: false },
  { name: 'bayesian-belief-tracker', note: 'blocks motivated reasoning', featured: false },
  { name: 'bug-hypothesis-generator', note: '"be more careful" is not a fix', featured: false },
];

export const featuredSkills = skills.filter((skill) => skill.featured);

export const skillCount = skills.length;

export function skillUrl(name: string): string {
  return `${site.ai}/tree/main/skills/${name}`;
}
