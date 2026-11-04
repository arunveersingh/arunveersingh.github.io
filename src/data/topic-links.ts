/**
 * How videos connect to skills and courses. A rule matches a video's title or
 * thesis; matched videos show their related skills/courses, and each skill or
 * course page shows its related videos. New uploads are linked automatically
 * when they use these words — no per-video editing.
 *
 * Keep patterns specific: a wrong link is worse than none.
 */
export interface TopicLink {
  label: string;
  match: RegExp;
  skills?: string[];
  courses?: string[];
}

export const topicLinks: TopicLink[] = [
  { label: 'Sycophancy', match: /sycophan|hallucinat/i, skills: ['mirror-test', 'commit-then-consult'], courses: ['make-ai-fail-safely'] },
  { label: 'First principles', match: /first.principle/i, skills: ['first-principles-decomposer'] },
  { label: 'Solving the wrong problem', match: /wrong problem/i, skills: ['assumption-surfacer', 'first-principles-decomposer'] },
  { label: 'AI coding workflows', match: /ai (coding|fails)|spec-driven|ai pipelines|tests all pass|between tasks|coded java by voice|missing step in your ai/i, skills: ['recontextualizer', 'define-good-first'], courses: ['make-ai-fail-safely'] },
  { label: 'Agents and delegation', match: /sub.?agent|prompt, skill|agent which builds|agent tests all pass/i, skills: ['delegation-contract'] },
  { label: 'Careers and skills', match: /reskilling|transformation is|still learn programming|older juniors/i, skills: ['value-relocator', 'capability-reserve'] },
  { label: 'Attention', match: /meetings are making/i, skills: ['attention-treasurer'] },
  { label: 'System design', match: /#?system ?design|latency and throughput|percentiles|requests per second|memory, disk and network|scalable llm|#kafka/i, courses: ['design-out-loud'] },
];
