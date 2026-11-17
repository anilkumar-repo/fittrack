/**
 * Splits a strip of equal panels (one picture showing frame 1 → 2 → 3 side by side, black background) into frame
 * files for build-move-frames.mjs. Divider lines and anything that isn't the figure (the "→" arrows between panels,
 * labels) are painted out: in each panel only the largest connected shape (the body, with its glow) is kept, plus
 * any shape at least `keep` × its size.
 *
 * Usage: node scripts/split-strip.mjs <strip.png> <move-id> [panels=3] [out=design/stretches-incoming/frames]
 * Writes <out>/<move-id>-1.png … -N.png, all the same size, so the frames stay lined up.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const [file, id, panelArg = "3", out = "design/stretches-incoming/frames"] = process.argv.slice(2);
if (!file || !id) { console.error("Usage: node scripts/split-strip.mjs <strip.png> <move-id> [panels] [out]"); process.exit(1); }
const panels = Number(panelArg);
const KEEP = 0.25; // a second shape this big (e.g. a prop) is kept; arrows and lines are far smaller
const DARK = 26;   // same "background" brightness as build-stretches.mjs

const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, step = Math.floor(W / panels);
fs.mkdirSync(out, { recursive: true });

for (let p = 0; p < panels; p++) {
  const x0 = p * step, w = step, h = H;
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) data.copy(px, y * w * 3, (y * W + x0) * 3, (y * W + x0 + w) * 3);
  const bright = (i) => Math.max(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
  // Paint out a thin frame around the panel (border and divider lines sit there).
  const EDGE = 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < EDGE || x >= w - EDGE || y < EDGE || y >= h - EDGE) px.fill(0, (y * w + x) * 3, (y * w + x) * 3 + 3);
  // Label the connected shapes that aren't background.
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || bright(start) <= DARK) continue;
    const id2 = sizes.length, queue = [start];
    label[start] = id2;
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k], x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && label[j] === -1 && bright(j) > DARK) { label[j] = id2; queue.push(j); }
      }
    }
    sizes.push(queue.length);
  }
  const biggest = Math.max(...sizes);
  let removed = 0;
  for (let i = 0; i < w * h; i++) if (label[i] >= 0 && sizes[label[i]] < biggest * KEEP) { px.fill(0, i * 3, i * 3 + 3); removed++; }
  const target = path.join(out, `${id}-${p + 1}.png`);
  await sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toFile(target);
  console.log(`✓ ${target} (${w}×${h}; painted out ${sizes.filter((s) => s < biggest * KEEP).length} small shapes, ${removed} px)`);
}
