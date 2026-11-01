import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeBundle } from 'reasonfrom-kit/write';
import { materialize } from '../materialize.mjs';
import { visibleOn } from '../sync-bundles.mjs';

const TMP = join(dirname(fileURLToPath(import.meta.url)), '.tmp');
after(() => rm(TMP, { recursive: true, force: true }));
let n = 0;
const SHA = 'c'.repeat(40);
const REPO = 'arunveersingh/tiny';

function input({ day1Body = 'Next: [Day 2](rf:lesson/tiny/day-02).' } = {}) {
  return {
    source: { repo: REPO, sha: SHA, url: `https://github.com/${REPO}` },
    items: [
      { meta: { id: 'course/tiny', title: 'Tiny', tagline: 'Small.', source_url: `https://github.com/${REPO}`,
        outline: { unit: 'day', phases: [{ label: 'One', from: 1, to: 2 }],
          entries: [{ n: 1, title: 'A', line: 'a', phase: 'One' }, { n: 2, title: 'B', line: 'b', phase: 'One' }] } } },
      { meta: { id: 'lesson/tiny/day-01', course: 'course/tiny', n: 1, title: 'Day 1 — A', description: 'A.', phase: 'One', line: 'a', time: '~5 min', source_path: 'days/01-a.md' }, body: day1Body },
      { meta: { id: 'lesson/tiny/day-02', course: 'course/tiny', n: 2, title: 'Day 2 — B', description: 'B.', phase: 'One', line: 'b', publish_at: '2026-12-01' }, body: 'Two.' },
    ],
    assets: [],
  };
}

async function site({ claims = ['course/tiny', 'lesson/tiny/'], lockSha = SHA, bundle = input() } = {}) {
  const root = join(TMP, `site-${n++}`);
  await writeBundle(join(root, 'bundles', REPO), bundle);
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/content-sources.json'), JSON.stringify({ sources: [{ repo: REPO, branch: 'main', claims }] }));
  await writeFile(join(root, 'content.lock.json'), JSON.stringify({ schema: 1, sources: { [REPO]: { sha: lockSha, first_seen: { 'course/tiny': null, 'lesson/tiny/day-01': '2026-11-01', 'lesson/tiny/day-02': '2026-11-01' } } } }));
  return root;
}
const quiet = () => {};
const exists = (p) => readFile(p).then(() => true, () => false);

describe('materialize', () => {
  test('a scheduled lesson stays hidden before its day; links to it fall back to the course', async () => {
    const root = await site();
    const c = await materialize({ root, today: '2026-11-15', log: quiet });
    assert.equal(c.lessons, 1);
    assert.equal(c.hidden, 1);
    assert.equal(await exists(join(root, 'src/content/courses/tiny/day-02.md')), false);
    const d1 = await readFile(join(root, 'src/content/courses/tiny/day-01.md'), 'utf8');
    assert.match(d1, /\(\/courses\/tiny\/\)/, 'link to the hidden lesson points at the course page');
    const outline = JSON.parse(await readFile(join(root, 'src/data/course-outlines/tiny.json'), 'utf8'));
    assert.deepEqual(outline.days.map((d) => d.written), [true, false]);
    assert.deepEqual(outline.aliases, { 'days/01-a.md': '/courses/tiny/day-01/' });
  });

  test('on its day the scheduled lesson appears, dated by its schedule', async () => {
    const root = await site();
    const c = await materialize({ root, today: '2026-12-01', log: quiet });
    assert.equal(c.lessons, 2);
    const d2 = await readFile(join(root, 'src/content/courses/tiny/day-02.md'), 'utf8');
    assert.match(d2, /^published: "2026-12-01"$/m);
    assert.match(await readFile(join(root, 'src/content/courses/tiny/day-01.md'), 'utf8'), /\(\/courses\/tiny\/day-02\/\)/);
  });

  test('a link to an id no bundle publishes fails the build', async () => {
    const root = await site({ bundle: input({ day1Body: 'See [x](rf:skill/missing).' }) });
    await assert.rejects(materialize({ root, today: '2026-11-15', log: quiet }), /links to skill\/missing, which no published bundle contains/);
  });

  test('an id outside the repo’s claims fails the build', async () => {
    const root = await site({ claims: ['course/tiny'] });
    await assert.rejects(materialize({ root, today: '2026-11-15', log: quiet }), /outside its claims/);
  });

  test('a bundle from a different commit than the lock fails the build', async () => {
    const root = await site({ lockSha: 'd'.repeat(40) });
    await assert.rejects(materialize({ root, today: '2026-11-15', log: quiet }), /but the lock pins/);
  });
});

describe('visibleOn', () => {
  test('schedule wins when later than first sight; first sight otherwise', () => {
    assert.equal(visibleOn({ publish_at: '2026-12-01' }, '2026-11-01'), '2026-12-01');
    assert.equal(visibleOn({ publish_at: '2026-10-01' }, '2026-11-01'), '2026-11-01');
    assert.equal(visibleOn({}, '2026-11-01'), '2026-11-01');
    assert.equal(visibleOn({}, null), null);
  });
});
