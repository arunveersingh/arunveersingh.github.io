/**
 * Copies Make AI Fail Safely from arunveersingh/ai into this site.
 *
 * The ai repo stays the draft. This script writes a generated snapshot:
 *   - lesson markdown under src/content/courses/make-ai-fail-safely/
 *   - diagrams under public/courses/make-ai-fail-safely/
 *   - the 30-day arc under src/data/course-outlines/make-ai-fail-safely.json
 *
 * CI does not run this. Deploy builds the committed snapshot, same as videos.
 * Files marked `manual: true` are left alone. Only `generated: true` lessons
 * are replaced. A fetch that returns far fewer lessons than are already on
 * disk aborts before writing.
 */
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLUG = 'make-ai-fail-safely';
const REPO = 'arunveersingh/ai';
const COURSE_PATH = `courses/${SLUG}`;
const API = `https://api.github.com/repos/${REPO}/contents/${COURSE_PATH}`;
const RAW = `https://raw.githubusercontent.com/${REPO}/main/${COURSE_PATH}`;
const BLOB = `https://github.com/${REPO}/blob/main`;
const SITE_PREFIX = `/courses/${SLUG}`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = join(root, 'src/content/courses', SLUG);
const diagramsDir = join(root, 'public/courses', SLUG);
const outlinePath = join(root, 'src/data/course-outlines', `${SLUG}.json`);

const COLLAPSE_FLOOR = 0.6;

function yaml(value) {
  return JSON.stringify(value);
}

function marker(text, key) {
  return new RegExp(`^${key}:\\s*true\\s*$`, 'm').test(text);
}

function clamp(text, max = 220) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 80 ? cut.slice(0, space) : cut).trim()}…`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'reasonfrom-course-sync',
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

/**
 * Point lesson assets at this site and everything else at the source repo.
 * Practice workouts are markdown skills, not pages, so they stay on GitHub.
 */
function rewriteHref(href, writtenDays) {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|#)/.test(trimmed)) return href;

  const titled = trimmed.match(/^(\S+?)(?:\s+(".*"|'.*'))?$/);
  if (!titled) return href;
  const [pathAndHash, title] = [titled[1], titled[2]];
  const hashIndex = pathAndHash.indexOf('#');
  const rawPath = hashIndex === -1 ? pathAndHash : pathAndHash.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : pathAndHash.slice(hashIndex);
  if (!rawPath.startsWith('.')) return href;

  const resolved = new URL(rawPath, `https://example.com/${COURSE_PATH}/`);
  const repoPath = decodeURIComponent(resolved.pathname.replace(/^\/+/, ''));
  const suffix = `${hash}${title ? ` ${title}` : ''}`;

  const diagram = repoPath.match(/^courses\/make-ai-fail-safely\/(day-\d{2}\.svg)$/);
  if (diagram) return `${SITE_PREFIX}/${diagram[1]}${suffix}`;

  const lesson = repoPath.match(/^courses\/make-ai-fail-safely\/(day-(\d{2}))\.md$/);
  if (lesson && writtenDays.has(Number(lesson[2]))) {
    return `${SITE_PREFIX}/${lesson[1]}/${suffix}`;
  }

  return `${BLOB}/${repoPath}${suffix}`;
}

function rewriteBody(markdown, writtenDays) {
  return markdown.replace(/\]\(([^)]+)\)/g, (_full, href) => `](${rewriteHref(href, writtenDays)})`);
}

function parseOutline(readme) {
  const title = readme.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const tagline = readme.match(/^\*\*(.+)\*\*$/m)?.[1]?.trim();
  if (!title || !tagline) {
    throw new Error('Course README is missing its title or tagline.');
  }

  const phases = [...readme.matchAll(/^\|\s*(\d+)\s*[–-]\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm)]
    .filter((match) => match[3].trim() !== 'Focus')
    .map((match) => ({
      label: match[3].trim(),
      range: `${match[1]}–${match[2]}`,
      question: match[4].trim(),
    }));

  if (phases.length !== 5) {
    throw new Error(`Expected 5 course phases in the README table, found ${phases.length}.`);
  }

  const heading = /^### Day (\d+) — (.+?)(?:\s+→\s+\[lesson\]\([^)]+\))?\s*$/gm;
  const days = [];
  for (const match of readme.matchAll(heading)) {
    const day = Number(match[1]);
    const start = match.index + match[0].length;
    const rest = readme.slice(start);
    const next = rest.search(/\n### |\n## /);
    const block = next === -1 ? rest : rest.slice(0, next);
    const failure = block.match(/\|\s*\*\*Failure\*\*\s*\|\s*(.+?)\s*\|/)?.[1]?.trim() ?? '';
    if (!failure) throw new Error(`Day ${day} is missing its Failure line in the README.`);

    const before = readme.slice(0, match.index);
    const section = [...before.matchAll(/^## Days\s+\d+\s*[–-]\s*\d+\s+·\s+(.+)$/gm)].at(-1);
    const phase = section?.[1]?.trim();
    if (!phase || !phases.some((item) => item.label === phase)) {
      throw new Error(`Day ${day} is outside a known phase section.`);
    }

    days.push({
      day,
      title: match[2].trim(),
      failure,
      phase,
      written: false,
    });
  }

  if (days.length !== 30) {
    throw new Error(`Expected 30 days in the README, found ${days.length}.`);
  }
  const numbers = days.map((day) => day.day);
  if (numbers.some((day, index) => day !== index + 1)) {
    throw new Error(`Day numbers are not 1–30 in order: ${numbers.join(', ')}`);
  }
  return { title, tagline, phases, days };
}

function lessonFile(day) {
  return `day-${String(day).padStart(2, '0')}.md`;
}

function buildLesson(markdown, meta) {
  const heading = markdown.match(/^#\s+(.+)\s*$/m);
  if (!heading) throw new Error(`${lessonFile(meta.day)} has no title.`);
  const title = heading[1].trim();
  const time = markdown.match(/^\*\*Time:\*\*\s*(.+)\s*$/m)?.[1]?.trim();
  if (!time) throw new Error(`${lessonFile(meta.day)} has no **Time:** line.`);

  const learn = markdown.match(/## What you'll learn\s*\n+([\s\S]*?)(?:\n## |\n$)/);
  const paragraph = learn?.[1]?.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim();
  if (!paragraph) throw new Error(`${lessonFile(meta.day)} has no "What you'll learn" paragraph.`);

  let body = markdown.replace(/^#\s+.+\s*\n+/, '');
  body = body.replace(/^\*\*Time:\*\*\s*.+\s*\n+/, '');
  body = rewriteBody(body, meta.writtenDays).trim();

  const frontmatter = [
    '---',
    `title: ${yaml(title)}`,
    `description: ${yaml(clamp(paragraph))}`,
    `course: ${yaml(SLUG)}`,
    `day: ${meta.day}`,
    `time: ${yaml(time)}`,
    `phase: ${yaml(meta.phase)}`,
    `failure: ${yaml(meta.failure)}`,
    'generated: true',
    '---',
    '',
    body,
    '',
  ].join('\n');

  return { title, time, markdown: frontmatter };
}

async function preservedLessons() {
  let names = [];
  try {
    names = await readdir(lessonsDir);
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
  const kept = new Set();
  for (const name of names) {
    if (!name.endsWith('.md')) continue;
    const text = await readFile(join(lessonsDir, name), 'utf8');
    if (marker(text, 'manual') || !marker(text, 'generated')) kept.add(name);
  }
  return kept;
}

async function generatedLessonNames() {
  let names = [];
  try {
    names = await readdir(lessonsDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const generated = [];
  for (const name of names) {
    if (!/^day-\d{2}\.md$/.test(name)) continue;
    const text = await readFile(join(lessonsDir, name), 'utf8');
    if (marker(text, 'generated') && !marker(text, 'manual')) generated.push(name);
  }
  return generated;
}

async function main() {
  const listing = JSON.parse(await fetchText(API));
  if (!Array.isArray(listing)) throw new Error('GitHub contents API did not return a file list.');
  const names = new Set(listing.filter((entry) => entry.type === 'file').map((entry) => entry.name));
  if (!names.has('README.md')) throw new Error('Course README.md is missing upstream.');

  const readme = await fetchText(`${RAW}/README.md`);
  const outline = parseOutline(readme);

  const lessonNames = [...names].filter((name) => /^day-\d{2}\.md$/.test(name)).sort();
  const linked = new Set(
    [...readme.matchAll(/\]\(\.\/(day-\d{2})\.md\)/g)].map((match) => `${match[1]}.md`),
  );
  for (const name of linked) {
    if (!names.has(name)) throw new Error(`README links ${name}, but that file is not in the repo.`);
  }

  const upstream = new Map();
  await Promise.all(
    lessonNames.map(async (name) => {
      const day = Number(name.slice(4, 6));
      const [markdown, diagram] = await Promise.all([
        fetchText(`${RAW}/${name}`),
        names.has(name.replace(/\.md$/, '.svg')) ? fetchText(`${RAW}/${name.replace(/\.md$/, '.svg')}`) : Promise.resolve(null),
      ]);
      upstream.set(day, { name, markdown, diagram });
    }),
  );

  const preserved = await preservedLessons();
  const existingGenerated = await generatedLessonNames();
  const incoming = lessonNames.filter((name) => !preserved.has(name)).length;
  if (existingGenerated.length > 0 && incoming < existingGenerated.length * COLLAPSE_FLOOR) {
    throw new Error(
      `Refusing to replace ${existingGenerated.length} lessons with ${incoming}. ` +
        `The upstream list looks partial.`,
    );
  }

  const writtenDays = new Set([...upstream.keys()]);
  const lessons = new Map();
  for (const [day, file] of upstream) {
    if (preserved.has(file.name)) continue;
    if (file.markdown.startsWith('---\n')) {
      throw new Error(`${file.name} gained frontmatter upstream. The sync would double-wrap it.`);
    }
    const meta = outline.days.find((item) => item.day === day);
    lessons.set(day, {
      ...buildLesson(file.markdown, { ...meta, writtenDays }),
      diagram: file.diagram,
      name: file.name,
    });
  }

  for (const day of outline.days) {
    day.written = upstream.has(day.day) || preserved.has(lessonFile(day.day));
  }
  if (![...upstream.keys()].every((day) => outline.days.some((item) => item.day === day))) {
    throw new Error('A lesson file has no matching day in the README.');
  }
  if (!upstream.get(1)?.diagram) {
    throw new Error('day-01.svg is missing. The course card uses it as the cover.');
  }

  await mkdir(lessonsDir, { recursive: true });
  await mkdir(diagramsDir, { recursive: true });
  await mkdir(dirname(outlinePath), { recursive: true });

  const stale = existingGenerated.filter((name) => !lessons.has(Number(name.slice(4, 6))));
  await Promise.all(stale.map((name) => unlink(join(lessonsDir, name))));

  let diagramsOnDisk = [];
  try {
    diagramsOnDisk = await readdir(diagramsDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const diagramsWritten = new Set();

  for (const [day, file] of upstream) {
    const svgName = `day-${String(day).padStart(2, '0')}.svg`;
    if (file.diagram == null) continue;
    if (!file.diagram.includes('<svg')) throw new Error(`${svgName} is not an SVG.`);
    await writeFile(join(diagramsDir, svgName), file.diagram);
    diagramsWritten.add(svgName);
  }
  await Promise.all(
    diagramsOnDisk
      .filter((name) => /^day-\d{2}\.svg$/.test(name) && !diagramsWritten.has(name))
      .map((name) => unlink(join(diagramsDir, name))),
  );

  for (const [day, lesson] of lessons) {
    await writeFile(join(lessonsDir, lessonFile(day)), lesson.markdown);
  }

  const payload = {
    slug: SLUG,
    title: outline.title,
    tagline: outline.tagline,
    source: `https://github.com/${REPO}/tree/main/${COURSE_PATH}`,
    phases: outline.phases,
    days: outline.days,
  };
  await writeFile(outlinePath, `${JSON.stringify(payload, null, 2)}\n`);

  const written = outline.days.filter((day) => day.written).map((day) => day.day);
  console.log(
    `${SLUG}: wrote ${lessons.size} lessons, kept ${preserved.size} manual, ${diagramsWritten.size} diagrams. ` +
      `Written days: ${written.join(', ') || 'none'}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
