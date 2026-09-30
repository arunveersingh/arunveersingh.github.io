/**
 * Builds a `view-transition-name` from a content id.
 *
 * Two constraints make this necessary rather than just interpolating the id:
 *
 *   1. The value is a CSS custom-ident, so it cannot start with a digit. Several
 *      video ids do — `1-basics-to-advanced-spring-validation-series-yv4Lbz` —
 *      which the prefix fixes.
 *   2. Only [a-zA-Z0-9_-] is safe here, and ids are slugs derived from titles,
 *      so anything else gets folded to a hyphen.
 *
 * A name must also be unique within a document. Callers rely on the fact that
 * selected and library videos are disjoint sets, and that a build or essay
 * appears once per index page.
 */
export function transitionName(prefix: 'talk' | 'build' | 'essay', id: string): string {
  const safe = id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${safe}`;
}
