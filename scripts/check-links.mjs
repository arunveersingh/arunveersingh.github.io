/**
 * check-links — every internal href/src in dist/ must resolve to a built file.
 * A gate in the publish pipeline: a broken internal link fails the deploy.
 *
 *   node scripts/check-links.mjs [dist]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
/**
 * Paths served by a sibling GitHub Pages project under the same domain, so
 * they are never in this build. Remove an entry once the site serves it.
 */
const SIBLINGS = [];
const walk = async (d) => (await Promise.all((await readdir(d, { withFileTypes: true }))
  .map((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])))).flat();
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function resolves(url) {
  const path = decodeURIComponent(url.split('#')[0].split('?')[0]);
  if (path === '' || path === '/') return exists(join(dist, 'index.html'));
  const target = join(dist, path);
  if (path.endsWith('/')) return exists(join(target, 'index.html'));
  return (await exists(target)) && !(await stat(target)).isDirectory()
    ? true
    : exists(join(target, 'index.html'));
}

const pages = (await walk(dist)).filter((f) => f.endsWith('.html'));
const broken = [];
let checked = 0;
for (const page of pages) {
  const html = await readFile(page, 'utf8');
  for (const m of html.matchAll(/\b(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
    checked++;
    if (SIBLINGS.some((p) => m[1].startsWith(p))) continue;
    if (!(await resolves(m[1]))) broken.push(`${page.slice(dist.length)} → ${m[1]}`);
  }
}
const unique = [...new Set(broken)];
console.log(`checked ${checked} internal links on ${pages.length} pages: ${unique.length} broken`);
for (const b of unique.slice(0, 50)) console.log(`  ✗ ${b}`);
process.exit(unique.length ? 1 : 0);
