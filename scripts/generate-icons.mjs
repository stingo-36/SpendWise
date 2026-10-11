/**
 * Generate PWA PNG icons without any image dependency.
 * Draws a rounded-square accent tile with a white ascending-bar motif and a
 * rupee bar, then PNG-encodes an RGBA pixel buffer via zlib.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// CRC32 for PNG chunks.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // raw scanlines with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Colors
const ACCENT = [37, 99, 235];
const WHITE = [255, 255, 255];

function draw(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = maskable ? Math.round(size * 0.12) : 0; // maskable safe-zone padding
  const radius = maskable ? 0 : Math.round(size * 0.22);

  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };

  // Rounded-square background.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      if (radius > 0) {
        const cx = Math.min(Math.max(x, radius), size - radius);
        const cy = Math.min(Math.max(y, radius), size - radius);
        const dx = x - cx, dy = y - cy;
        inside = dx * dx + dy * dy <= radius * radius;
      }
      if (inside) set(x, y, ACCENT);
    }
  }

  // Ascending bar motif (three white bars) inside the content area.
  const area = size - pad * 2;
  const baseY = pad + Math.round(area * 0.74);
  const barW = Math.round(area * 0.16);
  const gap = Math.round(area * 0.09);
  const startX = pad + Math.round(area * 0.2);
  const heights = [0.22, 0.38, 0.54].map((h) => Math.round(area * h));
  heights.forEach((h, idx) => {
    const x0 = startX + idx * (barW + gap);
    for (let x = x0; x < x0 + barW; x++) for (let y = baseY - h; y < baseY; y++) set(x, y, WHITE);
  });

  return encodePng(size, size, buf);
}

writeFileSync(join(OUT, 'icon-192.png'), draw(192, false));
writeFileSync(join(OUT, 'icon-512.png'), draw(512, false));
writeFileSync(join(OUT, 'icon-512-maskable.png'), draw(512, true));
writeFileSync(join(OUT, 'apple-touch-icon.png'), draw(180, false));
console.log('Icons written to public/icons/');
