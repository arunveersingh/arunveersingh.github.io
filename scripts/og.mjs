/**
 * Generates `public/og.png` — the 1200x630 card social platforms render when a
 * page from this site is shared. Committed as a static asset; re-run with
 * `npm run og` after changing the title or tagline.
 *
 * Uses the `sharp` that Astro already depends on, so this adds no dependency.
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public/og.png');

const WIDTH = 1200;
const HEIGHT = 630;

const name = 'Arunveer Singh';
const tagline = 'AI should force you not to make mistakes.';
const kicker = 'ENGINEERING JUDGMENT · PUBLIC WORK';
const domain = 'arunveersingh.github.io/studio';

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="warm" cx="12%" cy="112%" r="78%">
      <stop offset="0%" stop-color="#ff7a17" stop-opacity="0.32"/>
      <stop offset="60%" stop-color="#ff7a17" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cool" cx="90%" cy="-10%" r="70%">
      <stop offset="0%" stop-color="#302216" stop-opacity="0.9"/>
      <stop offset="65%" stop-color="#302216" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0b0a09"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#cool)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#warm)"/>
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="#ff7a17"/>

  <text x="80" y="150"
        font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="22"
        letter-spacing="3.4" fill="#9a9184">${escape(kicker)}</text>

  <text x="80" y="286"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="88" font-weight="400" letter-spacing="-1.5"
        fill="#f6f3ee">${escape(name)}</text>

  <text x="80" y="386"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="46" font-weight="400" letter-spacing="-0.8"
        fill="#e4e0d8">${escape(tagline)}</text>

  <rect x="80" y="452" width="132" height="2" fill="#ff7a17"/>

  <text x="80" y="544"
        font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="24"
        letter-spacing="1.4" fill="#9a9184">${escape(domain)}</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
await writeFile(out, png);

const meta = await sharp(png).metadata();
if (meta.width !== WIDTH || meta.height !== HEIGHT) {
  throw new Error(`og.png is ${meta.width}x${meta.height}, expected ${WIDTH}x${HEIGHT}`);
}
console.log(`wrote public/og.png ${meta.width}x${meta.height} (${(png.length / 1024).toFixed(1)} kB)`);
