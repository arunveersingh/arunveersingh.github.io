/**
 * Pulls live YouTube, GitHub, and articles into `src/content`.
 *
 * Contract:
 *   - Files with `manual: true` are never touched.
 *   - Files with neither `manual: true` nor `generated: true` are also left
 *     alone; an unmarked file is assumed to be hand-written.
 *   - Only files marked `generated: true` are replaced.
 *
 * Safety: every collection is fetched and validated in full BEFORE anything is
 * deleted. A previous version deleted first and swallowed fetch errors, so a
 * transient YouTube outage during CI would publish a site with an empty Watch
 * page and still exit 0. Now a collapsed result set fails the build.
 */
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  articlesRepo,
  channels,
  githubUser,
  handWrittenArticles,
  playlists,
  skipRepos,
} from '../src/data/sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const videosDir = join(root, 'src/content/videos');
const buildsDir = join(root, 'src/content/builds');
const essaysDir = join(root, 'src/content/essays');

const skipRepoSet = new Set(skipRepos);
const handWrittenSet = new Set(handWrittenArticles);

/**
 * If a sync produces fewer than this fraction of what is already on disk, treat
 * it as an upstream failure rather than a real deletion and abort.
 */
const COLLAPSE_FLOOR = 0.6;

/* ---------------------------------------------------------------- utilities */

function decode(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function pick(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decode(match[1]) : '';
}

/** JSON is a valid YAML subset for scalars, so this quotes and escapes safely. */
function yaml(value) {
  return JSON.stringify(value);
}

function slug(value, fallback) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return base || fallback;
}

function clamp(text, max = 220) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, { attempts = 3 } = {}) {
  const headers = {
    'User-Agent': 'arunveersingh-studio-sync',
    Accept: 'application/xml, application/json, text/plain',
  };
  if (process.env.GITHUB_TOKEN && url.includes('api.github.com')) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(url, { headers });
      // 4xx other than rate limiting will not fix themselves; fail fast.
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        let detail = `${url} → ${res.status}`;
        // GitHub signals an exhausted quota with 403, not 429. Retrying inside
        // the same hour cannot help, so say what actually unblocks it.
        if (res.status === 403 && url.includes('api.github.com') && !process.env.GITHUB_TOKEN) {
          const reset = Number(res.headers.get('x-ratelimit-reset'));
          const minutes = reset ? Math.max(0, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
          detail +=
            ` (unauthenticated GitHub limit is 60 requests/hour` +
            `${minutes === null ? '' : `, resets in ~${minutes} min`}). ` +
            `Set GITHUB_TOKEN to raise it to 5000/hour. CI already does.`;
        }
        const error = new Error(detail);
        if (!retryable) throw error;
        lastError = error;
      } else {
        return res.text();
      }
    } catch (error) {
      lastError = error;
      if (error.message?.includes('→ 4')) throw error;
    }
    if (attempt < attempts) await sleep(attempt * 750);
  }
  throw lastError ?? new Error(`${url} → failed`);
}

/** Frontmatter marker read without pulling in a YAML parser. */
function marker(text, key) {
  return new RegExp(`^${key}:\\s*true\\s*$`, 'm').test(text);
}

/**
 * Files this script is allowed to replace, and the ones it must preserve.
 * Anything not explicitly `generated: true` is preserved.
 */
async function partitionDir(dir) {
  await mkdir(dir, { recursive: true });
  const generated = [];
  const preserved = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.md') && !name.endsWith('.mdx')) continue;
    const text = await readFile(join(dir, name), 'utf8');
    if (marker(text, 'generated') && !marker(text, 'manual')) generated.push(name);
    else preserved.push({ name, text });
  }
  return { generated, preserved };
}

function assertNotCollapsed(label, incoming, existing) {
  if (incoming === 0) {
    throw new Error(
      `${label}: upstream returned 0 items. Refusing to wipe ${existing} existing file(s). ` +
        `This is almost certainly a network or rate-limit failure, not a real deletion.`,
    );
  }
  if (existing > 0 && incoming < existing * COLLAPSE_FLOOR) {
    throw new Error(
      `${label}: upstream returned ${incoming} items but ${existing} exist on disk ` +
        `(floor is ${Math.ceil(existing * COLLAPSE_FLOOR)}). Refusing a partial overwrite. ` +
        `Re-run, or lower COLLAPSE_FLOOR in scripts/sync.mjs if the drop is genuine.`,
    );
  }
}

/** Deletes the previous generated set, then writes the new one. */
async function commit(dir, staleNames, files) {
  await Promise.all(staleNames.map((name) => unlink(join(dir, name))));
  await Promise.all(files.map(({ name, body }) => writeFile(join(dir, name), body)));
}

/* ------------------------------------------------------------------- videos */

function parseFeed(xml, fallbackChannel) {
  const items = [];
  for (const block of xml.split('<entry>').slice(1)) {
    const youtubeId = pick(block, 'yt:videoId');
    const title = pick(block, 'title');
    const published = pick(block, 'published').slice(0, 10);
    const description = pick(block, 'media:description') || pick(block, 'content');
    const author = pick(block, 'name').toLowerCase();
    if (!youtubeId || !title) continue;
    const channel = author.includes('hindi') ? 'developernoteshindi' : fallbackChannel;
    items.push({ youtubeId, title, published, description, channel });
  }
  return items;
}

function thesisFrom(description, title) {
  const first = description
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 40 && !line.startsWith('http') && !line.startsWith('#'));
  return clamp(first || title);
}

/** Frontmatter + body for one video. Exported for fixture-based verification. */
export function videoNote(item) {
  const id = `${slug(item.title, item.youtubeId)}-${item.youtubeId.slice(0, 6)}`;
  const thesis = thesisFrom(item.description, item.title);
  return {
    id,
    name: `${id}.md`,
    body: `---
title: ${yaml(item.title)}
description: ${yaml(thesis)}
published: ${item.published || '2020-01-01'}
channel: ${item.channel}
youtubeId: ${yaml(item.youtubeId)}
topics: ["youtube"]
thesis: ${yaml(thesis)}
generated: true
---

${thesis}
`,
  };
}

async function syncVideos() {
  const { generated, preserved } = await partitionDir(videosDir);

  const sources = [
    ...channels.map((channel) => ({
      url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`,
      channel: channel.id,
    })),
    ...playlists.map((id) => ({
      url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`,
      channel: channels[0].id,
    })),
  ];

  const byId = new Map();
  const failures = [];
  for (const source of sources) {
    try {
      for (const item of parseFeed(await fetchText(source.url), source.channel)) {
        byId.set(item.youtubeId, item);
      }
    } catch (error) {
      failures.push(`${source.url}: ${error.message}`);
    }
  }

  // Partial feed loss silently shrinks the library, so surface it loudly.
  if (failures.length > 0) {
    console.warn(`  ! ${failures.length}/${sources.length} feed(s) failed:`);
    for (const failure of failures) console.warn(`    - ${failure}`);
  }
  if (failures.length === sources.length) {
    throw new Error('videos: every YouTube feed failed. Aborting before any file is removed.');
  }

  const preservedIds = new Set(
    preserved.map(({ name }) => name.replace(/\.mdx?$/, '').toLowerCase()),
  );

  const files = [];
  for (const item of byId.values()) {
    const note = videoNote(item);
    if (preservedIds.has(note.id.toLowerCase())) continue;
    files.push(note);
  }

  assertNotCollapsed('videos', files.length, generated.length);
  await commit(videosDir, generated, files);
  return { written: files.length, preserved: preserved.length, failures: failures.length };
}

/* ------------------------------------------------------------------- builds */

/**
 * Meta description for a repo GitHub has no description for.
 *
 * `description` feeds <meta name="description"> and og:description, so it
 * cannot be omitted. It used to be the literal string
 * "Public repository owner/name.", which is useless in a search result and on a
 * social card. This composes something from what is actually known.
 */
export function describeRepo({ name, language, topics }) {
  const subject = language ? `${language} repository` : 'repository';
  const real = (topics || []).filter((topic) => topic !== 'github');
  const tail = real.length > 0 ? ` Topics: ${real.join(', ')}.` : '';
  // Deliberately domain-free. This text lands in `description`, which feeds
  // <meta name="description"> and og:description, so baking a hostname in here
  // means every generated note goes stale the moment the URL changes.
  return `${name} — ${subject} in the public lab.${tail}`;
}

/**
 * Frontmatter + body for one repo. Exported so it can be exercised against
 * fixtures without hitting the GitHub API.
 */
export function buildNote(repo) {
  // `published` is creation. `updated` is last push. The old script stored
  // pushed_at as `published`, so a README fix made a 2018 repo look new.
  const created = (repo.created_at || '').slice(0, 10) || '2020-01-01';
  const pushed = (repo.pushed_at || '').slice(0, 10);

  // Repos with no GitHub description get no `problem` at all — the templates
  // render nothing rather than "Public repository owner/name."
  const described = repo.description?.trim();
  const front = [
    `title: ${yaml(repo.name)}`,
    `description: ${yaml(described || describeRepo(repo))}`,
    `published: ${created}`,
    pushed && `updated: ${pushed}`,
    `repo: ${yaml(repo.html_url)}`,
    `topics: ${yaml(repo.topics?.length ? repo.topics : ['github'])}`,
    described && `problem: ${yaml(described)}`,
    'generated: true',
  ].filter(Boolean);

  // The body deliberately omits the description: `problem` already renders it
  // as the lede, and repeating it printed the same sentence twice per page.
  const meta = [repo.language, repo.license?.spdx_id].filter(Boolean).join(' · ');
  return {
    name: `${repo.name}.md`,
    body: `---
${front.join('\n')}
---

Source: [${repo.full_name}](${repo.html_url})${meta ? ` · ${meta}` : ''}.
`,
  };
}

async function syncBuilds() {
  const { generated, preserved } = await partitionDir(buildsDir);

  // Repos claimed by a hand-written note must not get a generated duplicate.
  const claimedRepos = new Set();
  for (const { text } of preserved) {
    const repo = text.match(/^repo:\s*"([^"]+)"/m);
    if (repo) claimedRepos.add(repo[1]);
  }

  const repos = [];
  for (let page = 1; page <= 4; page += 1) {
    const batch = JSON.parse(
      await fetchText(
        `https://api.github.com/users/${githubUser}/repos?per_page=100&page=${page}&sort=updated`,
      ),
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  const files = [];
  let empty = 0;
  for (const repo of repos) {
    if (repo.fork || repo.archived || skipRepoSet.has(repo.name)) continue;
    if (claimedRepos.has(repo.html_url)) continue;
    // A repo with no content does not get a page. `size` is 0 both for repos
    // with no commits at all and for single-file stubs, which is exactly the set
    // that should not appear as public work.
    if (repo.size === 0) {
      empty += 1;
      continue;
    }
    files.push(buildNote(repo));
  }
  if (empty > 0) console.log(`  skipped ${empty} empty repo(s)`);

  assertNotCollapsed('builds', files.length, generated.length);
  await commit(buildsDir, generated, files);
  return { written: files.length, preserved: preserved.length };
}

/* ------------------------------------------------------------------- essays */

/** First real paragraph, used as the description instead of repeating the title. */
function descriptionFrom(markdown, title) {
  const body = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const paragraph = body
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .find((part) => part.length > 60 && !part.startsWith('|') && !part.startsWith('>'));

  return clamp(paragraph || title, 200);
}

async function syncEssays() {
  const { generated, preserved } = await partitionDir(essaysDir);

  const tree = JSON.parse(
    await fetchText(
      `https://api.github.com/repos/${articlesRepo.owner}/${articlesRepo.name}/git/trees/${articlesRepo.branch}?recursive=1`,
    ),
  );

  const paths = (tree.tree || [])
    .filter(
      (item) =>
        item.type === 'blob' &&
        item.path.endsWith('.md') &&
        item.path !== 'README.md' &&
        !handWrittenSet.has(item.path),
    )
    .map((item) => item.path);

  const preservedIds = new Set(
    preserved.map(({ name }) => name.replace(/\.mdx?$/, '').toLowerCase()),
  );

  const files = [];
  let refreshed = 0;
  for (const path of paths) {
    const id = slug(path.replace(/\.md$/, '').split('/').pop(), `essay-${files.length}`);
    // A hand-written essay wins over the upstream copy of the same article.
    if (preservedIds.has(id.toLowerCase())) continue;

    // Unlike before, generated essays are re-fetched every run. Previously any
    // existing file was skipped, so an upstream correction never reached the site.
    const raw = await fetchText(
      `https://raw.githubusercontent.com/${articlesRepo.owner}/${articlesRepo.name}/${articlesRepo.branch}/${path}`,
    );
    refreshed += 1;

    if (raw.startsWith('---')) {
      // Upstream frontmatter wins, but it still needs the generated marker so
      // the next run knows it may replace this file.
      const body = marker(raw, 'generated') ? raw : raw.replace(/^---\n/, '---\ngenerated: true\n');
      files.push({ name: `${id}.md`, body });
      continue;
    }

    const titleMatch = raw.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].replace(/`/g, '').trim() : id;
    const dateMatch = path.match(/(\d{2})(\d{2})(\d{4})/);
    const published = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : '2024-01-01';

    files.push({
      name: `${id}.md`,
      body: `---
title: ${yaml(title)}
description: ${yaml(descriptionFrom(raw, title))}
published: ${published}
topics: ["article"]
generated: true
---

${raw}
`,
    });
  }

  assertNotCollapsed('essays', files.length, generated.length);
  await commit(essaysDir, generated, files);
  return { written: files.length, preserved: preserved.length, refreshed };
}

/* --------------------------------------------------------------------- main */

export { assertNotCollapsed, descriptionFrom, parseFeed, thesisFrom };

// Only sync when executed directly. Importing this module (to test the note
// builders against fixtures) must not touch the network or the filesystem.
if (import.meta.filename === process.argv[1]) {
  const videos = await syncVideos();
  console.log(
    `videos  written=${videos.written} preserved=${videos.preserved} failedFeeds=${videos.failures}`,
  );

  const builds = await syncBuilds();
  console.log(`builds  written=${builds.written} preserved=${builds.preserved}`);

  const essays = await syncEssays();
  console.log(`essays  written=${essays.written} preserved=${essays.preserved} refreshed=${essays.refreshed}`);

  console.log('sync ok');
}
