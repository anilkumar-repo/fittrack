/**
 * Turns a Rozi picture into public/rozi/{name}.webp (480×480, transparent). A transparent picture is used as it is;
 * one on a white background has the white removed.
 * Only white connected to the picture edge is removed; fur edges fade softly instead of keeping a white halo.
 * Usage: node scripts/cut-rozi.mjs design/rozi-incoming/mobility-source.webp mobility
 */
import sharp from "sharp";

const [source, name] = process.argv.slice(2);

/** Shared final step: trim, fit into 452 px and add a 14 px margin → 480×480. */
async function save(image) {
  await image
    .trim({ threshold: 1 })
    .resize({ width: 452, height: 452, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 14, bottom: 14, left: 14, right: 14, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, alphaQuality: 95, effort: 6 })
    .toFile(`public/rozi/${name}.webp`);
  console.log(`Wrote public/rozi/${name}.webp`);
}

// Already transparent (corner pixel see-through): use it as it is.
const meta = await sharp(source).metadata();
if (meta.hasAlpha) {
  const corner = await sharp(source).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  if (corner[3] < 10) { await save(sharp(source).ensureAlpha()); process.exit(0); }
}

const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
const whiteness = (i) => { const [r, g, b] = px(i); return Math.min(r, g, b); };
const nearWhite = (i) => { const [r, g, b] = px(i); return Math.min(r, g, b) >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 18; };
const bg = new Uint8Array(w * h);
const stack = [];
const seed = (i) => { if (!bg[i] && nearWhite(i)) { bg[i] = 1; stack.push(i); } };
for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
while (stack.length) {
  const i = stack.pop(), x = i % w, y = (i - x) / w;
  if (x > 0) seed(i - 1); if (x < w - 1) seed(i + 1); if (y > 0) seed(i - w); if (y < h - 1) seed(i + w);
}
// Distance (in pixels, up to 3) from the background, for a soft edge band.
const near = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) if (bg[i]) {
  const x = i % w, y = (i - x) / w;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) near[ny * w + nx] = 1; }
}
const out = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const [r, g, b] = px(i);
  let a = 255;
  if (bg[i]) a = 0;
  else if (near[i]) a = Math.max(0, Math.min(255, Math.round((255 - whiteness(i)) * 255 / 70)));
  // Un-mix the white background from soft edge pixels.
  const k = a / 255;
  const un = (c) => (k > 0 && k < 1 ? Math.max(0, Math.min(255, Math.round((c - 255 * (1 - k)) / k))) : c);
  out[i * 4] = un(r); out[i * 4 + 1] = un(g); out[i * 4 + 2] = un(b); out[i * 4 + 3] = a;
}
await save(sharp(out, { raw: { width: w, height: h, channels: 4 } }));
