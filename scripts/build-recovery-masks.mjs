// Recovery map masks: for every figure, side and muscle group, the exact muscle shape, cut from the difference
// between the highlighted picture (red muscle) and the plain picture. Output: white shape with soft alpha edges,
// public/figures/masks/v1/<figure>-<region>-<side>.webp (same 489 x 820 frame as the pictures).
// Usage: node scripts/build-recovery-masks.mjs
import { existsSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const SRC = "public/figures/v3";
const OUT = "public/figures/masks/v1";
mkdirSync(OUT, { recursive: true });
const FIGURES = ["male", "female", "neutral"];
const REGIONS = ["shoulders", "chest", "back", "arms", "forearms", "core", "glutes", "quads", "hamstrings", "calves"];

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

let made = 0;
for (const figure of FIGURES) {
  // "side" only exists for figures that have side pictures (build-figures.mjs); missing ones are skipped.
  for (const side of ["front", "back", "side"]) {
    const baseFile = `${SRC}/${figure}-base-${side}.webp`;
    if (!existsSync(baseFile)) continue;
    const base = await raw(baseFile);
    // The body outline, shrunk slightly so tints stop just inside the skin edge (no coloured halo outside).
    const { data: inside, info: insideInfo } = await sharp(baseFile).ensureAlpha().extractChannel(3).blur(1.2).raw().toBuffer({ resolveWithObject: true });
    const bodyInside = Buffer.alloc(insideInfo.width * insideInfo.height);
    for (let i = 0; i < bodyInside.length; i++) { const v = inside[i * insideInfo.channels]; bodyInside[i] = v < 200 ? 0 : Math.round(((v - 200) / 55) * 255); }
    for (const region of REGIONS) {
      const file = `${SRC}/${figure}-${region}-${side}.webp`;
      if (!existsSync(file)) continue;
      const hi = await raw(file);
      const { width, height } = hi.info;
      const alpha = Buffer.alloc(width * height);
      for (let i = 0; i < width * height; i++) {
        const p = i * 4;
        const redHi = hi.data[p] - (hi.data[p + 1] + hi.data[p + 2]) / 2;
        const redBase = base.data[p] - (base.data[p + 1] + base.data[p + 2]) / 2;
        // How much redder the highlighted picture is here: 0 (no change) … 255 (fully painted muscle).
        const lift = redHi - redBase;
        alpha[i] = hi.data[p + 3] < 10 ? 0 : Math.max(0, Math.min(255, Math.round((lift - 18) * 3.2)));
      }
      // Soft edge: a light blur, then keep only solid-ish shapes (removes stray single pixels).
      // (blur can hand back 3 colour channels, so read every `channels`-th byte).
      const { data: soft, info: softInfo } = await sharp(alpha, { raw: { width, height, channels: 1 } }).blur(0.8).raw().toBuffer({ resolveWithObject: true });
      const step = softInfo.channels;
      const rgba = Buffer.alloc(width * height * 4, 255);
      // Never colour outside the body: clip to the plain picture's own outline, pulled in by ~1 px (shrunk alpha).
      for (let i = 0; i < width * height; i++) {
        const a = soft[i * step];
        const body = bodyInside[i];
        rgba[i * 4 + 3] = a < 40 ? 0 : Math.min(a, body);
      }
      await sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ quality: 90, alphaQuality: 100, lossless: false }).toFile(`${OUT}/${figure}-${region}-${side}.webp`);
      made += 1;
    }
  }
}
console.log(`${made} masks in ${OUT}`);
