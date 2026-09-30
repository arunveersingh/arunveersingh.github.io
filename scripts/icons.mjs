/**
 * Renders the raster icons from `public/favicon.svg`, so every icon is the same
 * mark and none of them can drift:
 *
 *   public/favicon.ico          32x32, the legacy fallback browsers request by
 *                               path whether or not it is linked
 *   public/apple-touch-icon.png 180x180, home-screen and pinned-tab icon
 *
 * Re-run with `npm run icons` after changing the mark.
 *
 * The .ico is written by hand: ICO is a 6-byte header, a 16-byte directory
 * entry per image, then the image data — and since Vista that data may be a
 * PNG verbatim. That keeps this dependency-free; `sharp` is already here via
 * Astro.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public/favicon.svg');

const svg = await readFile(source);

/** Rasterise the SVG at an exact square size. */
const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/** Wrap one PNG as a single-image ICO. */
function ico(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width  (256 is encoded as 0)
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // palette size: none
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image size
  entry.writeUInt32LE(header.length + entry.length, 12); // image offset

  return Buffer.concat([header, entry, png]);
}

const [favicon, touch] = await Promise.all([render(32), render(180)]);

await writeFile(join(root, 'public/favicon.ico'), ico(favicon, 32));
await writeFile(join(root, 'public/apple-touch-icon.png'), touch);

for (const [file, buffer, size] of [
  ['favicon.ico', favicon, 32],
  ['apple-touch-icon.png', touch, 180],
]) {
  const meta = await sharp(buffer).metadata();
  if (meta.width !== size || meta.height !== size) {
    throw new Error(`${file} rendered ${meta.width}x${meta.height}, expected ${size}x${size}`);
  }
  console.log(`wrote public/${file} ${size}x${size}`);
}
