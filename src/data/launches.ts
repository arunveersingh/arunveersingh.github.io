import entries from './launches.json';

/**
 * What the site is currently announcing.
 *
 * `npm run sync:course` appends a row when a lesson file appears for the
 * first time. Anything else (an essay, a talk, a build) is a row added here
 * by hand. A row shows for 21 days, until the visitor dismisses it. The id
 * is what dismissal remembers, so it must stay stable.
 */
const WINDOW_DAYS = 21;

export interface Launch {
  id: string;
  label: string;
  title: string;
  href: string;
  /** YYYY-MM-DD, the day it landed on the site. */
  published: string;
}

const KEYS = ['id', 'label', 'title', 'href', 'published'] as const;

function assertLaunch(value: unknown, index: number): Launch {
  if (!value || typeof value !== 'object') {
    throw new Error(`launches.json[${index}] is not an object.`);
  }
  const item = value as Record<string, unknown>;
  for (const key of KEYS) {
    if (typeof item[key] !== 'string' || item[key] === '') {
      throw new Error(`launches.json[${index}].${key} must be a non-empty string.`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.published as string)) {
    throw new Error(`launches.json[${index}].published must be YYYY-MM-DD.`);
  }
  return {
    id: item.id as string,
    label: item.label as string,
    title: item.title as string,
    href: item.href as string,
    published: item.published as string,
  };
}

function samePath(left: string, right: string): boolean {
  const normal = (path: string) => {
    if (/^https?:\/\//.test(path)) return path;
    const slashed = path.endsWith('/') ? path : `${path}/`;
    return slashed === '//' ? '/' : slashed;
  };
  return normal(left) === normal(right);
}

/** Launches still inside the window, except the page the visitor is already on. */
export function launchesForPath(pathname: string, now = new Date()): Launch[] {
  const seen = new Set<string>();
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const current = entries.map(assertLaunch).filter((item, index) => {
    if (seen.has(item.id)) {
      throw new Error(`launches.json has a duplicate id at [${index}]: ${item.id}`);
    }
    seen.add(item.id);
    const [year, month, day] = item.published.split('-').map(Number);
    const published = Date.UTC(year, month - 1, day);
    const ageDays = (local - published) / 86_400_000;
    return ageDays >= 0 && ageDays < WINDOW_DAYS && !samePath(item.href, pathname);
  });
  // The file appends new rows at the end. Show the latest first.
  return current.reverse();
}
