/**
 * sync-bundles — the bot's step. Network on purpose; the deploy stays offline.
 *
 * For every source in src/data/content-sources.json:
 *   1. Prove the repo is public: an anonymous `git ls-remote` (no credentials,
 *      no prompt) only succeeds for public repos. Same call gives the branch head.
 *   2. Pick the commit: the locked sha, or with --update the branch head.
 *   3. Fetch exactly that commit into .reasonfrom/cache/ (gitignored).
 *   4. Build + validate its bundle with reasonfrom-kit. No reasonfrom.yml, or
 *      publish ≠ true, means no bundle — key 2 of 3.
 *   5. Enforce claims (which ids this repo may publish) and a collapse floor.
 *   6. Replace bundles/<owner>/<repo>/, update content.lock.json, and add
 *      "New lesson" notices to src/data/launches.json.
 *
 * Anything fails → exit 1 and nothing for that source is replaced.
 *
 *   node scripts/sync-bundles.mjs            rebuild every source at its locked sha
 *   node scripts/sync-bundles.mjs --update   move every source to its branch head
 *   node scripts/sync-bundles.mjs --update --source owner/name
 *   node scripts/sync-bundles.mjs --update --source owner/name --adopt
 *       Onboard a source whose content is already public elsewhere: its
 *       existing items are recorded as pre-existing (no "New lesson" flood).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle } from 'reasonfrom-kit/source';
import { stableJson } from 'reasonfrom-kit/write';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = process.env.REASONFROM_REGISTRY ?? join(root, 'src/data/content-sources.json');
const LOCK = process.env.REASONFROM_LOCK ?? join(root, 'content.lock.json');
const LAUNCHES = process.env.REASONFROM_LAUNCHES ?? join(root, 'src/data/launches.json');
const BUNDLES = process.env.REASONFROM_BUNDLES ?? join(root, 'bundles');
const WORK = join(root, '.reasonfrom');
const COLLAPSE_FLOOR = 0.6;
/** Same window as src/data/launches.ts. */
const NOTICE_WINDOW_DAYS = 21;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

const args = process.argv.slice(2);
const update = args.includes('--update');
const only = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
const adopt = args.includes('--adopt');
if (adopt && !only) throw new Error('--adopt needs --source owner/name');

/** Local calendar date, matching the old sync-course.mjs. */
export function localToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * git with no credentials and no prompts: private repos fail instead of
 * authenticating. GIT_CEILING_DIRECTORIES stops git from walking up into the
 * site repo that contains the cache — an earlier draft found the site's own
 * .git that way and nearly ran `checkout --force` / `clean -fdx` against it.
 */
function anonGit(argv, { ceiling } = {}) {
  return execFileSync('git', ['-c', 'credential.helper=', '-c', 'core.askPass=', ...argv], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', SSH_ASKPASS: '',
      ...(ceiling ? { GIT_CEILING_DIRECTORIES: ceiling } : {}),
    },
  }).trim();
}

function publicHead(repo, branch) {
  let out;
  try {
    out = anonGit(['ls-remote', `https://github.com/${repo}.git`, `refs/heads/${branch}`]);
  } catch {
    throw new Error(`${repo}: not reachable anonymously — private, renamed, or deleted. Refusing to publish.`);
  }
  const sha = out.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error(`${repo}: branch ${branch} not found`);
  return sha;
}

async function checkout(repo, sha) {
  const dir = join(WORK, 'cache', repo.replace('/', '__'));
  const gitDir = join(dir, '.git');
  await mkdir(dir, { recursive: true });
  const ceiling = dirname(dir);
  // Every command names its git dir and work tree explicitly. Nothing is discovered.
  const g = (...argv) => anonGit([`--git-dir=${gitDir}`, `--work-tree=${dir}`, ...argv], { ceiling });
  if (!existsSync(gitDir)) {
    anonGit(['init', '-q', dir], { ceiling });
    g('remote', 'add', 'origin', `https://github.com/${repo}.git`);
  }
  const actual = realpathSync(g('rev-parse', '--absolute-git-dir'));
  if (actual !== realpathSync(gitDir)) throw new Error(`cache git dir resolved to ${actual}, expected ${gitDir}; refusing`);
  const remote = g('remote', 'get-url', 'origin');
  if (remote !== `https://github.com/${repo}.git`) throw new Error(`cache remote is ${remote}, expected ${repo}; refusing`);
  g('fetch', '-q', '--depth', '1', 'origin', sha);
  g('checkout', '-q', '--force', '--detach', sha);
  g('clean', '-qfdx');
  return dir;
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}

const claimed = (id, claims) => claims.some((c) => (c.endsWith('/') ? id.startsWith(c) : id === c));

/** The date a lesson becomes visible: its schedule if it has one, else when it first reached the site. */
export function visibleOn(item, firstSeen) {
  if (item.publish_at && firstSeen) return item.publish_at > firstSeen ? item.publish_at : firstSeen;
  return item.publish_at ?? firstSeen ?? null;
}

async function main() {
  const registry = await readJson(REGISTRY, null);
  if (!registry?.sources?.length) throw new Error('src/data/content-sources.json lists no sources');
  const lock = await readJson(LOCK, { schema: 1, sources: {} });
  const today = localToday();
  const seenIds = new Map(); // id → repo, across sources
  let failures = 0;

  for (const src of registry.sources) {
    if (only && src.repo !== only) {
      for (const id of Object.keys(lock.sources[src.repo]?.first_seen ?? {})) seenIds.set(id, src.repo);
      continue;
    }
    const tag = `[${src.repo}]`;
    try {
      const head = publicHead(src.repo, src.branch ?? 'main');
      const locked = lock.sources[src.repo]?.sha;
      const sha = update || !locked ? head : locked;
      const dir = await checkout(src.repo, sha);

      const staging = join(WORK, 'staging', src.repo);
      const res = await buildBundle({ root: dir, out: staging, repo: src.repo, sha });
      if (!res.ok) {
        throw new Error(`bundle invalid:\n${res.errors.map((e) => `    ${e.file || '(source)'}${e.path ? ` [${e.path}]` : ''}: ${e.message}`).join('\n')}`);
      }
      const ids = res.manifest.items.map((i) => i.id);
      const outside = ids.filter((id) => !claimed(id, src.claims ?? []));
      if (outside.length) throw new Error(`publishes ids it has not been granted: ${outside.join(', ')}`);
      for (const id of ids) {
        if (seenIds.has(id)) throw new Error(`id ${id} is also published by ${seenIds.get(id)}`);
        seenIds.set(id, src.repo);
      }
      const dest = join(BUNDLES, src.repo);
      const previous = await readJson(join(dest, 'manifest.json'), null);
      if (previous && ids.length < previous.items.length * COLLAPSE_FLOOR) {
        throw new Error(`would shrink from ${previous.items.length} to ${ids.length} items; refusing (collapse floor ${COLLAPSE_FLOOR})`);
      }

      await rm(dest, { recursive: true, force: true });
      await mkdir(dirname(dest), { recursive: true });
      await rename(staging, dest);

      const prior = lock.sources[src.repo]?.first_seen ?? {};
      const first_seen = {};
      for (const id of [...ids].sort()) first_seen[id] = id in prior ? prior[id] : adopt ? null : today;
      lock.sources[src.repo] = { sha, first_seen };
      const counts = ['course', 'lesson', 'skill'].map((t) => `${ids.filter((i) => i.startsWith(`${t}/`)).length} ${t}`).join(' · ');
      console.log(`${tag} ${sha.slice(0, 7)}${sha === locked ? ' (locked)' : locked ? ` (was ${locked.slice(0, 7)})` : ' (new)'} · ${counts}`);
    } catch (e) {
      failures++;
      console.error(`${tag} FAILED: ${e.message}`);
    }
  }

  // Drop lock entries for sources no longer in the registry.
  for (const repo of Object.keys(lock.sources)) {
    if (!registry.sources.some((s) => s.repo === repo)) {
      delete lock.sources[repo];
      await rm(join(BUNDLES, repo), { recursive: true, force: true });
      console.log(`[${repo}] removed (no longer in registry)`);
    }
  }
  await writeFile(LOCK, stableJson(lock));
  await recordLaunches(lock, today);
  if (failures) process.exit(1);
}

/**
 * Lessons that became visible get a "New lesson" notice, once. Notices for
 * lessons that no longer exist are dropped. Other notices are left alone.
 * Same id scheme as the old sync-course.mjs: <course>-<lesson>.
 */
async function recordLaunches(lock, today) {
  const current = await readJson(LAUNCHES, []);
  const lessons = new Map();
  for (const [repo, entry] of Object.entries(lock.sources)) {
    for (const id of Object.keys(entry.first_seen)) {
      if (!id.startsWith('lesson/')) continue;
      const meta = await readJson(join(BUNDLES, repo, 'items', `${id}.json`), null);
      if (!meta) continue;
      const [, course, slug] = id.split('/');
      lessons.set(`${course}-${slug}`, { meta, course, slug, on: visibleOn(meta, entry.first_seen[id]) });
    }
  }
  const coursePrefixes = [...new Set([...lessons.values()].map((l) => `${l.course}-`))];
  const isLessonNotice = (item) => item?.label === 'New lesson' && coursePrefixes.some((p) => item.id?.startsWith(p));
  const kept = current.filter((item) => !isLessonNotice(item) || lessons.has(item.id));
  const ids = new Set(kept.map((i) => i.id));
  for (const [nid, l] of [...lessons].sort(([a], [b]) => a.localeCompare(b))) {
    // Visible, not yet announced, and still inside the site's 21-day notice window.
    if (ids.has(nid) || !l.on || l.on > today || daysBetween(l.on, today) > NOTICE_WINDOW_DAYS) continue;
    kept.push({ id: nid, label: 'New lesson', title: l.meta.title, href: `/courses/${l.course}/${l.slug}/`, published: l.on });
    ids.add(nid);
    console.log(`  announced: ${l.meta.title}`);
  }
  await writeFile(LAUNCHES, `${JSON.stringify(kept, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
