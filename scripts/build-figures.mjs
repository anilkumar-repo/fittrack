/**
 * Builds the body pictures in public/figures/v3 from the one-figure originals in
 * design/figures-incoming/singles ({figure}-{muscle}-{front|back}.png, black background).
 *
 * Every picture: background removed, trimmed to the figure, scaled to the same height and centred
 * on the same canvas, so switching muscle or turning front ↔ back never jumps.
 * Also writes the side-by-side front + back pictures and the one-sided muscle pictures.
 * Side view (recovery map): {figure}-{muscle}-side.png for "base" and every muscle; built only for figures that have
 * them. Side pictures never change the canvas width set by front/back (a wider side figure is scaled down to fit),
 * so adding them can't move the existing pictures.
 *
 * Usage: node scripts/build-figures.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SOURCE = "design/figures-incoming/singles";
const OUT = process.env.FIGURES_OUT || "public/figures/v3";
const HEIGHT = 820;
const PAD_Y = 12;
const PAD_X = 14;
const FIGURES = ["female", "male", "neutral"];
const TWO_VIEW = ["base", "shoulders", "arms", "forearms", "calves"];
const FRONT_ONLY = ["chest", "core", "quads"];
const BACK_ONLY = ["back", "glutes", "hamstrings"];
const SIDE = ["base", "shoulders", "chest", "back", "arms", "forearms", "core", "glutes", "quads", "hamstrings", "calves"];

/** Black background → transparent; colours un-darkened at the soft edge. */
async function cutOut(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const rgba = Buffer.alloc(w * h * 4);
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const a = Math.max(0, Math.min(255, Math.round((Math.max(r, g, b) - 14) * 255 / 36)));
    const k = a > 0 && a < 255 ? 255 / a : 1;
    rgba[i * 4] = Math.min(255, Math.round(r * k)); rgba[i * 4 + 1] = Math.min(255, Math.round(g * k)); rgba[i * 4 + 2] = Math.min(255, Math.round(b * k)); rgba[i * 4 + 3] = a;
    if (a > 8) { const x = i % w, y = (i - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const trimmed = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ height: HEIGHT - PAD_Y * 2 })
    .png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  return { buffer: trimmed, width: meta.width };
}

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const webp = { quality: 80, alphaQuality: 90, effort: 6 };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pieces = {};
  for (const figure of FIGURES) {
    for (const name of [...TWO_VIEW, ...FRONT_ONLY, ...BACK_ONLY]) {
      for (const side of ["front", "back"]) {
        const file = path.join(SOURCE, `${figure}-${name}-${side}.png`);
        if (fs.existsSync(file)) pieces[`${figure}-${name}-${side}`] = await cutOut(file);
      }
    }
  }
  const width = Math.max(...Object.values(pieces).map((piece) => piece.width)) + PAD_X * 2;
  for (const figure of FIGURES) {
    for (const name of SIDE) {
      const file = path.join(SOURCE, `${figure}-${name}-side.png`);
      if (!fs.existsSync(file)) continue;
      const piece = await cutOut(file);
      if (piece.width > width - PAD_X * 2) {
        // Keep the shared canvas: scale this side figure down to fit (rare; side views are usually narrower).
        const buffer = await sharp(piece.buffer).resize({ width: width - PAD_X * 2 }).png().toBuffer();
        pieces[`${figure}-${name}-side`] = { buffer, width: width - PAD_X * 2, scaled: true };
      } else pieces[`${figure}-${name}-side`] = piece;
    }
  }
  const single = async (piece) => {
    const left = Math.round((width - piece.width) / 2);
    const meta = await sharp(piece.buffer).metadata();
    // A scaled-down side figure is shorter than the others: stand it on the same floor line.
    const extraTop = HEIGHT - PAD_Y * 2 - meta.height;
    return sharp(piece.buffer).extend({ top: PAD_Y + extraTop, bottom: PAD_Y, left, right: width - piece.width - left, background: clear }).png().toBuffer();
  };
  let written = 0;
  for (const [name, piece] of Object.entries(pieces)) {
    const img = await single(piece);
    await sharp(img).webp(webp).toFile(path.join(OUT, `${name}.webp`)); written++;
  }
  for (const figure of FIGURES) {
    // Front and back side by side, for the two-view muscle groups.
    for (const name of TWO_VIEW) {
      const front = await single(pieces[`${figure}-${name}-front`]);
      const back = await single(pieces[`${figure}-${name}-back`]);
      await sharp({ create: { width: width * 2, height: HEIGHT, channels: 4, background: clear } })
        .composite([{ input: front, left: 0, top: 0 }, { input: back, left: width, top: 0 }])
        .webp(webp).toFile(path.join(OUT, `${figure}-${name}.webp`)); written++;
    }
    // One-sided muscle groups: the side where the muscle shows.
    for (const name of FRONT_ONLY) { fs.copyFileSync(path.join(OUT, `${figure}-${name}-front.webp`), path.join(OUT, `${figure}-${name}.webp`)); written++; }
    for (const name of BACK_ONLY) { fs.copyFileSync(path.join(OUT, `${figure}-${name}-back.webp`), path.join(OUT, `${figure}-${name}.webp`)); written++; }
  }
  console.log(`Wrote ${written} pictures. One figure: ${width}×${HEIGHT}; front + back: ${width * 2}×${HEIGHT}.`);
})();
