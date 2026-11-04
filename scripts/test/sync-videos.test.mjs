import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { after, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const TMP = join(dirname(fileURLToPath(import.meta.url)), '.tmp', 'videos');
process.env.REASONFROM_VIDEOS = join(TMP, 'videos');
process.env.REASONFROM_LAUNCHES = join(TMP, 'launches.json');
const { syncVideos, writeNote } = await import('../sync-videos.mjs');
after(() => rm(TMP, { recursive: true, force: true }));

const V = process.env.REASONFROM_VIDEOS;
const L = process.env.REASONFROM_LAUNCHES;
const quiet = console.log;

/** Fake YouTube: oembed per id, shorts per id. */
function fakeYouTube({ oembed = {}, shorts = new Set() } = {}) {
  return async (url) => {
    const id = decodeURIComponent(url).match(/(?:v=|shorts\/)([\w-]{6,})/)?.[1];
    if (url.includes('/oembed')) {
      const s = oembed[id] ?? 200;
      if (s === 'network') throw new Error('ECONNRESET');
      return { ok: s === 200, status: s };
    }
    if (url.includes('/shorts/')) return { ok: shorts.has(id), status: shorts.has(id) ? 200 : 303 };
    throw new Error(`unexpected ${url}`);
  };
}
const feed = (...items) => new Map(items.map((i) => [i.youtubeId, { channel: 'engineeringjudgment', description: `${i.title} explained in enough words to be a thesis line.`, ...i }]));
const note = (id, title, extra = {}) => writeNote({ title, thesis: `${title} thesis`, published: '2026-09-01', channel: 'engineeringjudgment', youtubeId: id, format: 'long', ...extra });

beforeEach(async () => {
  await rm(TMP, { recursive: true, force: true });
  await mkdir(V, { recursive: true });
  await writeFile(L, '[]\n');
});

describe('sync-videos', () => {
  test('a video that scrolled out of the feeds is kept while YouTube still has it', async () => {
    await writeFile(join(V, 'old-talk-aaaaaa.md'), note('aaaaaaaaaaa', 'Old talk'));
    const s = await syncVideos({ now: '2026-11-04', fetcher: fakeYouTube(), feedItems: feed() });
    assert.equal(s.removed, 0);
    assert.deepEqual(await readdir(V), ['old-talk-aaaaaa.md']);
  });

  test('a video YouTube reports gone (404/private) is removed, with its notice', async () => {
    await writeFile(join(V, 'gone-bbbbbb.md'), note('bbbbbbbbbbb', 'Gone'));
    await writeFile(L, JSON.stringify([{ id: 'video-bbbbbbbbbbb', label: 'New video', title: 'Gone', href: '/watch/gone-bbbbbb/', published: '2026-11-01' }]));
    const s = await syncVideos({ now: '2026-11-04', fetcher: fakeYouTube({ oembed: { bbbbbbbbbbb: 404 } }), feedItems: feed() });
    assert.equal(s.removed, 1);
    assert.deepEqual(await readdir(V), []);
    assert.deepEqual(JSON.parse(await readFile(L, 'utf8')), []);
  });

  test('network doubt never deletes', async () => {
    await writeFile(join(V, 'flaky-cccccc.md'), note('ccccccccccc', 'Flaky'));
    const s = await syncVideos({ now: '2026-11-04', fetcher: fakeYouTube({ oembed: { ccccccccccc: 'network' } }), feedItems: feed() });
    assert.equal(s.removed, 0);
    assert.equal(s.unsure, 1);
    assert.deepEqual(await readdir(V), ['flaky-cccccc.md']);
  });

  test('a renamed video keeps its file name, so its URL never changes', async () => {
    await writeFile(join(V, 'first-title-dddddd.md'), note('ddddddddddd', 'First title'));
    await syncVideos({ now: '2026-11-04', fetcher: fakeYouTube(), feedItems: feed({ youtubeId: 'ddddddddddd', title: 'Better title', published: '2026-09-01' }) });
    assert.deepEqual(await readdir(V), ['first-title-dddddd.md']);
    assert.match(await readFile(join(V, 'first-title-dddddd.md'), 'utf8'), /^title: "Better title"$/m);
  });

  test('a new long video is announced; a new Short and an old upload are not', async () => {
    const s = await syncVideos({
      now: '2026-11-04',
      fetcher: fakeYouTube({ shorts: new Set(['sssssssssss']) }),
      feedItems: feed(
        { youtubeId: 'eeeeeeeeeee', title: 'Fresh talk', published: '2026-11-03' },
        { youtubeId: 'sssssssssss', title: 'Fresh short #kafka', published: '2026-11-03' },
        { youtubeId: 'ooooooooooo', title: 'Old upload', published: '2026-08-01' },
      ),
    });
    assert.equal(s.added, 3);
    const launches = JSON.parse(await readFile(L, 'utf8'));
    assert.deepEqual(launches.map((l) => l.title), ['Fresh talk']);
    assert.equal(launches[0].label, 'New video');
    const short = (await readdir(V)).find((n) => n.startsWith('fresh-short'));
    assert.match(await readFile(join(V, short), 'utf8'), /^format: short$/m);
  });

  test('hand-written notes are never touched', async () => {
    const manual = '---\ntitle: "Mine"\ndescription: "x"\npublished: 2026-01-01\nchannel: engineeringjudgment\nyoutubeId: "mmmmmmmmmmm"\ntopics: ["youtube"]\nthesis: "x"\nmanual: true\n---\n\nhand\n';
    await writeFile(join(V, 'mine.md'), manual);
    await syncVideos({ now: '2026-11-04', fetcher: fakeYouTube({ oembed: { mmmmmmmmmmm: 404 } }), feedItems: feed({ youtubeId: 'mmmmmmmmmmm', title: 'Feed title', published: '2026-01-01' }) });
    assert.equal(await readFile(join(V, 'mine.md'), 'utf8'), manual);
  });
});
