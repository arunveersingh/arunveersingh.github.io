/**
 * Per-course wording and behaviour that belong to the site, not the content.
 * Bundles say what a course is; this says how reasonfrom.com presents it.
 * A course with no entry here gets the defaults.
 */
export interface CoursePresentation {
  /** Sentence after "N lessons are written. The arc is N days." */
  blurb?: string;
  /**
   * A path this course used to live at (a retired reader). The site serves a
   * redirect page there that maps old links to the new pages.
   */
  legacyPath?: string;
}

export const coursePresentation: Record<string, CoursePresentation> = {
  'make-ai-fail-safely': { blurb: 'One failure mode a day.' },
  'design-out-loud': {
    blurb: 'One sitting is a day. Attempt before you read.',
    // The course's first home (a Docsify reader, under its old name).
    legacyPath: '/faang-system-design-90-days/',
  },
};
