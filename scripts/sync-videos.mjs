/**
 * sync-videos — keeps src/content/videos/ in step with YouTube, unattended.
 *
 * The old sync rebuilt the library from YouTube's RSS feeds, which return
 * only the latest 15 videos per feed. Every new upload pushed an older video
 * out of that window, and the rebuild deleted it from the site. This version
 * remembers instead:
 *
 *   - A video seen once stays. Its file name (and so its URL) never changes,
 *     even if the title is edited on YouTube.
 *   - A video still in a feed is refreshed (title, thesis).
 *   - A video no longer in any feed is checked against YouTube's public
 *     oEmbed endpoint. Removed only on a definite "gone" (401/403/404:
 *     deleted or private). Any network doubt keeps it.
 *   - Shorts are detected once (youtube.com/shorts/<id> serves a Short and
 *     redirects anything else) and stored as `format: short | long`.
 *   - A new long video gets a "New video" notice in src/data/launches.json
 *     for the site's 21-day window.
 *
 * Hand-written notes (`manual: true`, or no `generated: true`) are never touched.
 *
 *   node scripts/sync-videos.mjs
 */
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { channels, playlists } from '../src/data/sources.mjs';
import { parseFeed, thesisFrom } from './sync.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS = process.env.REASONFROM_VIDEOS ?? join(root, 'src/content/videos');
const LAUNCHES = process.env.REASONFROM_LAUNCHES ?? join(root, 'src/data/launches.json');
const NOTICE_WINDOW_DAYS = 21;
const UA = 'reasonfrom-video-sync';

const yaml = (v) => JSON.stringify(v);
const slug = (value, fallback) =>
  value.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 72).replace(/-$/, '') || fallback;

/** Local calendar date, matching the rest of the site's syncs. */
const today = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

async function get(url, { redirect = 'follow', attempts = 3 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { redirect, headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw last;
}

/** 'present' | 'gone' | 'unknown'. Only 'gone' may delete anything. */
export async function existence(youtubeId, fetcher = get) {
  try {
    const res = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`);
    if (res.ok) return 'present';
    if ([401, 403, 404].includes(res.status)) return 'gone';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** 'short' | 'long' | undefined (undecided: try again next run). */
export async function formatOf(youtubeId, fetcher = get) {
  try {
    const res = await fetcher(`https://www.youtube.com/shorts/${youtubeId}`, { redirect: 'manual' });
    if (res.status === 200) return 'short';
    if (res.status >= 300 && res.status < 400) return 'long';
    return undefined;
  } catch {
    return undefined;
  }
}

/** Minimal frontmatter reader for the notes this script writes. */
export function readNote(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    try { data[k] = JSON.parse(raw); } catch { data[k] = raw; }
  }
  return data;
}

export function writeNote({ title, thesis, published, channel, youtubeId, format }) {
  return [
    '---',
    `title: ${yaml(title)}`,
    `description: ${yaml(thesis)}`,
    `published: ${published || '2020-01-01'}`,
    `channel: ${channel}`,
    `youtubeId: ${yaml(youtubeId)}`,
    ...(format ? [`format: ${format}`] : []),
    'topics: ["youtube"]',
    `thesis: ${yaml(thesis)}`,
    'generated: true',
    '---',
    '',
    thesis,
    '',
  ].join('\n');
}

async function feeds() {
  const sources = [
    ...channels.map((c) => ({ url: `https://www.youtube.com/feeds/videos.xml?channel_id=${c.channelId}`, channel: c.id })),
    ...playlists.map((id) => ({ url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`, channel: channels[0].id })),
  ];
  const byId = new Map();
  let failed = 0;
  for (const s of sources) {
    try {
      const res = await get(s.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const item of parseFeed(await res.text(), s.channel)) {
        // Channel feeds are authoritative for channel; a playlist must not relabel a Hindi video.
        if (!byId.has(item.youtubeId) || s.url.includes('channel_id')) byId.set(item.youtubeId, item);
      }
    } catch (e) {
      failed++;
      console.warn(`  ! feed failed: ${s.url}: ${e.message}`);
    }
  }
  if (failed === sources.length) throw new Error('every YouTube feed failed; changing nothing');
  return { byId, failed, total: sources.length };
}

export async function syncVideos({ now = today(), fetcher = get, feedItems } = {}) {
  const { byId, failed, total } = feedItems ? { byId: feedItems, failed: 0, total: 1 } : await feeds();

  // Memory: every generated note on disk, keyed by YouTube id.
  const known = new Map();
  const manualIds = new Set();
  for (const name of (await readdir(VIDEOS)).filter((n) => /\.mdx?$/.test(n))) {
    const text = await readFile(join(VIDEOS, name), 'utf8');
    const note = readNote(text);
    if (!note?.youtubeId) continue;
    if (note.generated === true && note.manual !== true) known.set(note.youtubeId, { name, note });
    else manualIds.add(note.youtubeId);
  }

  const stats = { added: 0, refreshed: 0, kept: 0, removed: 0, unsure: 0 };
  const removedIds = [];
  const added = [];

  // 1. Everything in a feed: add or refresh, keeping existing file names.
  for (const item of byId.values()) {
    if (manualIds.has(item.youtubeId)) continue;
    const prev = known.get(item.youtubeId);
    const format = prev?.note.format ?? (await formatOf(item.youtubeId, fetcher));
    const name = prev?.name ?? `${slug(item.title, item.youtubeId)}-${item.youtubeId.slice(0, 6).toLowerCase()}.md`;
    const body = writeNote({ ...item, thesis: thesisFrom(item.description, item.title), format });
    const before = prev ? await readFile(join(VIDEOS, prev.name), 'utf8') : null;
    if (before !== body) await writeFile(join(VIDEOS, name), body);
    if (prev) stats.refreshed += before !== body ? 1 : 0;
    else { stats.added++; added.push({ ...item, name, format }); }
    known.delete(item.youtubeId);
  }

  // 2. Known but not in any feed: keep unless YouTube says it is gone.
  for (const [youtubeId, { name, note }] of known) {
    const state = await existence(youtubeId, fetcher);
    if (state === 'gone') {
      await unlink(join(VIDEOS, name));
      removedIds.push(youtubeId);
      stats.removed++;
      console.log(`  removed (deleted or private on YouTube): ${note.title}`);
    } else {
      if (state === 'unknown') stats.unsure++;
      stats.kept++;
      if (!note.format) {
        const format = await formatOf(youtubeId, fetcher);
        if (format) await writeFile(join(VIDEOS, name), writeNote({ ...note, thesis: note.thesis, format }));
      }
    }
  }

  await recordVideoLaunches({ added, removedIds, now });
  console.log(`videos  added=${stats.added} refreshed=${stats.refreshed} kept-outside-feeds=${stats.kept} removed=${stats.removed} unsure=${stats.unsure} failedFeeds=${failed}/${total}`);
  return stats;
}

/** "New video" notices for new long videos inside the 21-day window; drop notices for removed ones. */
async function recordVideoLaunches({ added, removedIds, now }) {
  let current = [];
  try { current = JSON.parse(await readFile(LAUNCHES, 'utf8')); } catch { /* none yet */ }
  const gone = new Set(removedIds.map((id) => `video-${id}`));
  const kept = current.filter((item) => !gone.has(item.id));
  const ids = new Set(kept.map((i) => i.id));
  for (const v of added) {
    if (v.format === 'short' || !v.published || daysBetween(v.published, now) > NOTICE_WINDOW_DAYS || daysBetween(v.published, now) < 0) continue;
    const id = `video-${v.youtubeId}`;
    if (ids.has(id)) continue;
    kept.push({ id, label: 'New video', title: v.title, href: `/watch/${v.name.replace(/\.mdx?$/, '')}/`, published: v.published });
    ids.add(id);
    console.log(`  announced: ${v.title}`);
  }
  if (JSON.stringify(kept) !== JSON.stringify(current)) await writeFile(LAUNCHES, `${JSON.stringify(kept, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncVideos().catch((e) => { console.error(`video sync failed: ${e.message}`); process.exit(1); });
}
