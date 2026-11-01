/**
 * preview-source — see a repo on this machine rendered in the real site
 * design, before anything is public. Works for private drafts: the bundle is
 * built from the local folder (no network, no public check) and stays in
 * .reasonfrom/preview/ (gitignored). bundles/ and content.lock.json never change.
 *
 *   npm run preview:source -- <path-to-repo> [--repo owner/name] [--no-dev]
 *
 * Needs a reasonfrom.yml in the repo (publish: true), like publishing does.
 * Re-run after editing the repo to refresh the preview.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBundle } from 'reasonfrom-kit/source';
import { materialize } from './materialize.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--repo');
const repoFlag = args.includes('--repo') ? args[args.indexOf('--repo') + 1] : undefined;
if (!src) {
  console.error('usage: npm run preview:source -- <path-to-repo> [--repo owner/name] [--no-dev]');
  process.exit(2);
}

const out = join(root, '.reasonfrom', 'preview', 'bundle');
// A local folder may have no commits or no remote yet; a placeholder sha keeps the contract happy.
const res = await buildBundle({ root: resolve(src), out, repo: repoFlag, sha: undefined })
  .then((r) => (r.errors.some((e) => /commit sha|owner\/name/.test(e.message))
    ? buildBundle({ root: resolve(src), out, repo: repoFlag ?? 'local/preview', sha: '0'.repeat(40) })
    : r));
if (!res.ok) {
  console.error(`✗ preview bundle invalid (${res.errors.length} problems):`);
  for (const e of res.errors) console.error(`  ${e.file || '(source)'}${e.path ? ` [${e.path}]` : ''}: ${e.message}`);
  process.exit(1);
}
await materialize({ root, preview: out });

if (args.includes('--no-dev')) process.exit(0);
console.log('\nStarting the dev server. Local only — nothing is committed or published.\n');
const dev = spawn('npx', ['astro', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', REASONFROM_PREVIEW: out },
});
dev.on('exit', (code) => process.exit(code ?? 0));
