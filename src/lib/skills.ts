import { getCollection, type CollectionEntry } from 'astro:content';

export type Skill = CollectionEntry<'skills'>;
export type Resource = Skill['data']['resource'];

/**
 * The eight scarce resources, in reading order, plus the entry point.
 * Wording follows the ai repo's README so the two never disagree in tone.
 */
export const RESOURCES: { key: Resource; label: string; question: string }[] = [
  { key: 'meta', label: 'Start here', question: 'Not sure what is going wrong? Bring one real incident.' },
  { key: 'truth', label: 'Truth', question: 'Is it actually so?' },
  { key: 'ownership', label: 'Ownership', question: 'Do I understand what I have?' },
  { key: 'intent', label: 'Intent', question: 'Did I know what good was before I saw anything?' },
  { key: 'attention', label: 'Attention', question: 'Can I really review all of this?' },
  { key: 'authority', label: 'Authority', question: 'What is allowed to be irreversible?' },
  { key: 'capability', label: 'Capability', question: 'Can I still do it when the AI can’t?' },
  { key: 'originality', label: 'Originality', question: 'Is it different from the default answer?' },
  { key: 'self', label: 'Self', question: 'Who am I with, and what am I for?' },
];

export const resourceLabel = (key: Resource) => RESOURCES.find((r) => r.key === key)?.label ?? key;

/** "mirror-test" → "Mirror Test". The SKILL.md H1 is the human title when present. */
export function skillTitle(entry: Skill): string {
  const h1 = entry.body?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return h1 ?? entry.data.name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

export async function skillsByResource() {
  const all = await getCollection('skills');
  return RESOURCES.map((r) => ({
    ...r,
    skills: all.filter((s) => s.data.resource === r.key).sort((a, b) => a.data.name.localeCompare(b.data.name)),
  })).filter((g) => g.skills.length > 0);
}
