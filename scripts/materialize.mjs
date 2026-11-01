/**
 * materialize — offline, runs before dev/check/build.
 *
 * Turns committed bundles (bundles/<owner>/<repo>/, pinned by content.lock.json)
 * into the files the site's pages read. Outputs are gitignored and fully
 * regenerated every run:
 *
 *   src/content/courses/<course>/<lesson>.md     lessons (glob collection)
 *   src/content/skills/<name>.md                 skills (glob collection)
 *   src/content/course-pages/<course>/<slug>.md  supporting pages (glob collection)
 *   src/data/course-outlines/<course>.json       outline + written flags
 *   public/courses/<course>/…                    course assets
 *   public/assets/<owner>/<repo>/…               other assets
 *
 * Fails the build on: a bundle that doesn't validate, a bundle whose commit
 * doesn't match the lock, an id outside the repo's claims, or a link to an id
 * that no bundle publishes.
 *
 * The lesson file format is byte-compatible with the old sync-course.mjs so
 * existing pages render unchanged.
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBundle } from 'reasonfrom-kit/validate';
import { localToday, visibleOn } from './sync-bundles.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputs = (root) => ({
  courses: join(root, 'src/content/courses'),
  skills: join(root, 'src/content/skills'),
  pages: join(root, 'src/content/course-pages'),
  outlines: join(root, 'src/data/course-outlines'),
  publicCourses: join(root, 'public/courses'),
  publicAssets: join(root, 'public/assets'),
});

const yaml = (v) => JSON.stringify(v);
const claimed = (id, claims) => claims.some((c) => (c.endsWith('/') ? id.startsWith(c) : id === c));

/** A 3-column slide table becomes a grid the reading column can fit. Copied from sync-course.mjs. */
export function presentSlides(markdown) {
  return markdown.replace(/<table>([\s\S]*?)<\/table>/g, (full, inner) => {
    const tags = [...inner.matchAll(/<img\b[^>]*>/g)];
    if (tags.length < 2) return full;
    const slides = tags.map((tag) => {
      const src = tag[0].match(/\bsrc="([^"]+)"/)?.[1];
      const alt = tag[0].match(/\balt="([^"]*)"/)?.[1] ?? '';
      if (!src || !src.includes('/assets/')) return null;
      return `<a href="${src}"><img src="${src}" alt="${alt}"></a>`;
    });
    if (slides.some((slide) => slide == null)) return full;
    return `<div class="lesson-slides">\n${slides.join('\n')}\n</div>`;
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function materialize({ root = SITE_ROOT, today = localToday(), log = console.log, preview = process.env.REASONFROM_PREVIEW || null } = {}) {
  const OUT = outputs(root);
  const registry = await readJson(join(root, 'src/data/content-sources.json'));
  const lock = await readJson(join(root, 'content.lock.json'));

  /** id → { item, repo, firstSeen } across every bundle */
  const all = new Map();
  /** repo → { dir, items, courseSlugs } */
  const bundles = new Map();

  // Local preview (scripts/preview-source.mjs): one extra bundle built from a
  // folder on this machine, possibly private. It replaces the same repo's
  // published bundle for this run only; nothing in bundles/ or the lock moves.
  let sources = registry.sources;
  if (preview) {
    const pm = await readJson(join(preview, 'manifest.json'));
    sources = [
      ...sources.filter((s) => s.repo !== pm.source.repo),
      { repo: pm.source.repo, claims: ['course/', 'lesson/', 'skill/', 'page/'], previewDir: preview },
    ];
    log(`PREVIEW: ${pm.source.repo} from a local folder — local only, never published`);
  }

  for (const src of sources) {
    const entry = src.previewDir ? { sha: null, first_seen: {} } : lock.sources[src.repo];
    if (!entry) throw new Error(`${src.repo} is in the registry but not in content.lock.json; run npm run sync:bundles`);
    const dir = src.previewDir ?? join(root, 'bundles', src.repo);
    const res = await validateBundle(dir);
    if (!res.ok) throw new Error(`bundles/${src.repo} is invalid:\n${res.errors.map((e) => `  ${e.file}: ${e.message}`).join('\n')}`);
    if (res.manifest.source.repo !== src.repo) throw new Error(`bundles/${src.repo} claims to come from ${res.manifest.source.repo}`);
    if (!src.previewDir && res.manifest.source.sha !== entry.sha) throw new Error(`bundles/${src.repo} is from ${res.manifest.source.sha.slice(0, 7)} but the lock pins ${entry.sha.slice(0, 7)}`);
    for (const it of res.items) {
      if (!claimed(it.id, src.claims ?? [])) throw new Error(`${src.repo} publishes ${it.id} outside its claims`);
      if (all.has(it.id)) throw new Error(`${it.id} is published by both ${all.get(it.id).repo} and ${src.repo}`);
      all.set(it.id, { item: it, repo: src.repo, firstSeen: src.previewDir ? today : entry.first_seen?.[it.id] ?? null });
    }
    bundles.set(src.repo, { dir, items: res.items, courseSlugs: new Set(res.items.filter((i) => i.type === 'course').map((i) => i.id.slice('course/'.length))) });
  }

  // Scheduled lessons stay hidden until their day.
  const visible = (id) => {
    const rec = all.get(id);
    if (!rec || rec.item.type !== 'lesson') return Boolean(rec);
    const on = rec.item.publish_at ? visibleOn(rec.item, rec.firstSeen) : null;
    return !on || on <= today;
  };

  const urlOf = (id) => {
    const rec = all.get(id);
    if (!rec) return null;
    const [type, a, b] = id.split('/');
    if (type === 'course') return rec.item.external_url ?? `/courses/${a}/`;
    if (type === 'lesson') return visible(id) ? `/courses/${a}/${b}/` : `/courses/${a}/`;
    if (type === 'skill') return `/skills/${a}/`;
    if (type === 'page') return `/courses/${a}/${b}/`;
    return null;
  };
  const assetUrl = (repo, path) => {
    const first = path.split('/')[0];
    return bundles.get(repo).courseSlugs.has(first) ? `/courses/${path}` : `/assets/${repo}/${path}`;
  };

  /** Resolve rf: and rf-asset: links. An unknown id fails the build. */
  const rewrite = (md, repo, where) => {
    const resolve = (target) => {
      if (target.startsWith('rf-asset:')) {
        const [p, hash = ''] = target.slice('rf-asset:'.length).split(/(?=#)/);
        return `${assetUrl(repo, p)}${hash}`;
      }
      const [id, hash = ''] = target.slice('rf:'.length).split(/(?=#)/);
      const url = urlOf(id);
      if (!url) throw new Error(`${where}: links to ${id}, which no published bundle contains`);
      return hash ? `${url}${hash}` : url;
    };
    return md
      .replace(/(\]\(\s*<?)((?:rf|rf-asset):[^)\s>]+)/g, (_, pre, t) => `${pre}${resolve(t)}`)
      .replace(/^(\s*\[[^\]]+\]:\s*<?)((?:rf|rf-asset):\S+?)(?=>?(?:\s|$))/gm, (_, pre, t) => `${pre}${resolve(t)}`)
      .replace(/\b(src|href)(\s*=\s*")((?:rf|rf-asset):[^"]+)"/g, (_, a, eq, t) => `${a}${eq}${resolve(t)}"`)
      .replace(/\b(src|href)(\s*=\s*')((?:rf|rf-asset):[^']+)'/g, (_, a, eq, t) => `${a}${eq}${resolve(t)}'`);
  };

  for (const d of Object.values(OUT)) await rm(d, { recursive: true, force: true });
  const counts = { lessons: 0, hidden: 0, skills: 0, courses: 0, pages: 0, assets: 0 };
  let order = 0;
  const repoOrder = new Map(sources.map((s, i) => [s.repo, i]));

  for (const [repo, b] of bundles) {
    // Assets.
    const manifest = await readJson(join(b.dir, 'manifest.json'));
    for (const a of manifest.assets) {
      const dest = join(root, 'public', assetUrl(repo, a.path).slice(1));
      await mkdir(dirname(dest), { recursive: true });
      await cp(join(b.dir, 'assets', a.path), dest);
      counts.assets++;
    }

    for (const course of b.items.filter((i) => i.type === 'course')) {
      const slug = course.id.slice('course/'.length);
      counts.courses++;
      const lessons = b.items.filter((i) => i.type === 'lesson' && i.course === course.id);
      const shown = lessons.filter((l) => visible(l.id));
      counts.hidden += lessons.length - shown.length;
      const writtenNs = new Set(shown.map((l) => l.n));

      for (const l of shown) {
        const rec = all.get(l.id);
        const published = visibleOn(l, rec.firstSeen);
        const body = presentSlides(rewrite(l._body, repo, `bundles/${repo}/${l.body}`)).trim();
        const text = [
          '---',
          `title: ${yaml(l.title)}`,
          `description: ${yaml(l.description)}`,
          `course: ${yaml(slug)}`,
          `day: ${l.n}`,
          ...(l.time ? [`time: ${yaml(l.time)}`] : []),
          ...(published ? [`published: ${yaml(published)}`] : []),
          `phase: ${yaml(l.phase)}`,
          `failure: ${yaml(l.line ?? '')}`,
          'generated: true',
          '---',
          '',
          body,
          '',
        ].join('\n');
        const file = join(OUT.courses, slug, `${l.id.split('/')[2]}.md`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, text);
        counts.lessons++;
      }

      const pages = b.items.filter((i) => i.type === 'page' && i.course === course.id).sort((x, y) => x.order - y.order);
      for (const pg of pages) {
        const text = [
          '---',
          `title: ${yaml(pg.title)}`,
          ...(pg.description ? [`description: ${yaml(pg.description)}`] : []),
          `course: ${yaml(slug)}`,
          `section: ${yaml(pg.section)}`,
          `order: ${pg.order}`,
          'generated: true',
          '---',
          '',
          rewrite(pg._body, repo, `bundles/${repo}/${pg.body}`).trim(),
          '',
        ].join('\n');
        const file = join(OUT.pages, slug, `${pg.id.split('/')[2]}.md`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, text);
        counts.pages++;
      }

      // Core fields first, in the order the old sync-course.mjs wrote them.
      const outline = {
        slug,
        title: course.title,
        tagline: course.tagline,
        source: course.source_url,
        phases: course.outline.phases.map((p) => ({ label: p.label, range: `${p.from}–${p.to}`, question: p.question ?? '' })),
        days: course.outline.entries.map((e) => ({ day: e.n, title: e.title, failure: e.line ?? '', phase: e.phase, written: writtenNs.has(e.n) })),
        // Fields added for the generic course templates.
        order: repoOrder.get(repo) * 100 + order++,
        unit: course.outline.unit,
        lineLabel: course.outline.line_label ?? null,
        cover: course.cover ? assetUrl(repo, course.cover) : null,
        externalUrl: course.external_url ?? null,
        pages: pages.map((pg) => ({ slug: pg.id.split('/')[2], title: pg.title, section: pg.section, description: pg.description ?? null })),
        // Old source paths → new URLs, for redirecting a retired reader.
        aliases: Object.fromEntries([
          ...shown.filter((l) => l.source_path).map((l) => [l.source_path, `/courses/${slug}/${l.id.split('/')[2]}/`]),
          ...pages.filter((pg) => pg.source_path).map((pg) => [pg.source_path, `/courses/${slug}/${pg.id.split('/')[2]}/`]),
        ]),
      };
      await mkdir(OUT.outlines, { recursive: true });
      await writeFile(join(OUT.outlines, `${slug}.json`), `${JSON.stringify(outline, null, 2)}\n`);
    }

    for (const s of b.items.filter((i) => i.type === 'skill')) {
      const body = rewrite(s._body, repo, `bundles/${repo}/${s.body}`).trim();
      const text = [
        '---',
        `name: ${yaml(s.name)}`,
        `description: ${yaml(s.description)}`,
        `resource: ${yaml(s.resource)}`,
        `symptom: ${yaml(s.symptom)}`,
        `version: ${yaml(s.version)}`,
        `license: ${yaml(s.license)}`,
        `source: ${yaml(s.source_url)}`,
        ...(s.evals ? [`evalCases: ${s.evals.cases}`, `evalsUrl: ${yaml(s.evals.url)}`] : []),
        'generated: true',
        '---',
        '',
        body,
        '',
      ].join('\n');
      await mkdir(OUT.skills, { recursive: true });
      await writeFile(join(OUT.skills, `${s.name}.md`), text);
      counts.skills++;
    }
  }

  log(`materialized ${counts.courses} courses · ${counts.lessons} lessons${counts.hidden ? ` (+${counts.hidden} scheduled)` : ''} · ${counts.pages} pages · ${counts.skills} skills · ${counts.assets} assets from ${bundles.size} bundle${bundles.size === 1 ? '' : 's'}`);
  return counts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  materialize().catch((e) => { console.error(`materialize failed: ${e.message}`); process.exit(1); });
}
