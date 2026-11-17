/**
 * Builds the stretch & mobility pictures in public/stretches/v1 from design/stretches-incoming/{id}.png
 * (black background, 2:1). The background is removed only where it touches the picture edge, so dark
 * props (chairs, benches, boxes, foam rollers) stay solid. Every picture is trimmed and centred on the
 * same 840×420 canvas.
 *
 * Usage: node scripts/build-stretches.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = "design/stretches-incoming";
const OUT = "public/stretches/v1";
export const W = 840, H = 420, PAD = 14;

/**
 * Removes the black background from one picture. Returns the RGBA pixels and the box around the figure,
 * so the frame script (build-move-frames.mjs) can crop every frame of a move with one shared box.
 */
export async function cutOut(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bright = (i) => Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  // Background = near-black pixels connected to the edge.
  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (i) => { if (!bg[i] && bright(i) <= 26) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i - x) / w;
    if (x > 0) seed(i - 1); if (x < w - 1) seed(i + 1); if (y > 0) seed(i - w); if (y < h - 1) seed(i + w);
  }
  // Pockets of pure black enclosed by the figure and a prop (gaps between legs and a chair) are background
  // too. Props are dark grey, never pure black, so they are kept.
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (bg[start] || seen[start] || bright(start) > 10) continue;
    const region = [start]; seen[start] = 1;
    for (let k = 0; k < region.length; k++) {
      const i = region[k], x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && !bg[j] && bright(j) <= 10) { seen[j] = 1; region.push(j); }
      }
    }
    if (region.length >= 150) for (const i of region) bg[i] = 1;
  }
  const rgba = Buffer.alloc(w * h * 4);
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    let a = 255;
    if (bg[i]) a = 0;
    else {
      // Soft outline: a pixel next to the background fades by its brightness.
      const x = i % w, y = (i - x) / w;
      const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
      if (edge) a = Math.max(0, Math.min(255, Math.round((bright(i) - 14) * 255 / 46)));
    }
    const k = a > 0 && a < 255 ? 255 / a : 1;
    rgba[i * 4] = Math.min(255, Math.round(r * k)); rgba[i * 4 + 1] = Math.min(255, Math.round(g * k)); rgba[i * 4 + 2] = Math.min(255, Math.round(b * k)); rgba[i * 4 + 3] = a;
    if (a > 10) { const x = i % w, y = (i - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return { rgba, w, h, box: { x0, y0, x1, y1 } };
}

/** Crops to the box, fits it in the 840×420 canvas (centred) and returns a WebP pipeline. */
export async function place({ rgba, w, h }, { x0, y0, x1, y1 }) {
  const trimmed = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: W - PAD * 2, height: H - PAD * 2, fit: "inside" })
    .png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const left = Math.round((W - meta.width) / 2), top = Math.round((H - meta.height) / 2);
  return sharp(trimmed).extend({ left, right: W - meta.width - left, top, bottom: H - meta.height - top, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 78, alphaQuality: 85, effort: 6 });
}

async function build(file) {
  const cut = await cutOut(file);
  return place(cut, cut.box);
}

// Runs only when called directly (node scripts/build-stretches.mjs), not when imported.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SOURCE).filter((name) => name.endsWith(".png"));
  for (const name of files) await (await build(path.join(SOURCE, name))).toFile(path.join(OUT, name.replace(/\.png$/, ".webp")));
  console.log(`Wrote ${files.length} pictures (${W}×${H}) to ${OUT}.`);
}
