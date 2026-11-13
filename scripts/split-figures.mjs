/**
 * Rebuilds the single-view body pictures (public/figures/*-front.webp, *-back.webp and the
 * one-sided muscle pictures) so no hand or finger is cut off.
 *
 * Each source shows the front and back figure side by side, with the hands meeting in the middle.
 * Instead of a straight cut down the centre, the picture is split along the path through the gap
 * between the hands (a lowest-cost "seam"), then each figure is placed on the same-size canvas with
 * room on both sides.
 *
 * Usage: node scripts/split-figures.mjs public/figures/v2
 * (Reads the two-figure pictures in public/figures and design/figures-incoming.)
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const FIG = "public/figures";
const INCOMING = "design/figures-incoming";
const TWO_VIEW = ["base", "arms", "shoulders", "forearms", "calves"];
const SINGLE_FRONT = ["chest", "core", "quads"];
const SINGLE_BACK = ["back", "glutes", "hamstrings"];
const HEIGHT = 820;
const MARGIN = 10; // clear space left and right of each figure

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), w: info.width, h: info.height };
}

/** Black-background original → transparent figure pair, framed like the published pictures. */
async function keyedPair(file) {
  const src = await load(file);
  const { data, w, h } = src;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const max = Math.max(data[p], data[p + 1], data[p + 2]);
    const a = Math.max(0, Math.min(255, Math.round((max - 14) * 255 / 36)));
    if (a > 0 && a < 255) for (let k = 0; k < 3; k++) data[p + k] = Math.min(255, Math.round(data[p + k] * 255 / a));
    data[p + 3] = a;
  }
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const buf = await sharp(Buffer.from(data.buffer), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ height: HEIGHT - 2 })
    .extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(buf.data), w: buf.info.width, h: buf.info.height };
}

/** Lowest-opacity top-to-bottom path through the middle band: the gap between the two figures. */
function seam(img) {
  const { data, w, h } = img;
  const lo = Math.floor(w * 0.4), hi = Math.ceil(w * 0.6), bw = hi - lo;
  const cost = new Float64Array(bw * h), from = new Int8Array(bw * h);
  // Cheapest through empty space; where the hands touch, cheapest along an outline (a sharp change in
  // shading) rather than through the smooth inside of a thumb or finger.
  const lum = (x, y) => { const p = (y * w + x) * 4; return (data[p] * 0.3 + data[p + 1] * 0.59 + data[p + 2] * 0.11) * data[p + 3] / 255; };
  const px = (x, y) => {
    const alpha = data[(y * w + x) * 4 + 3];
    if (!alpha) return Math.abs(x - w / 2) * 0.02;
    const gx = Math.abs(lum(Math.min(w - 1, x + 1), y) - lum(Math.max(0, x - 1), y));
    const gy = Math.abs(lum(x, Math.min(h - 1, y + 1)) - lum(x, Math.max(0, y - 1)));
    return alpha * Math.max(0.12, 1 - (gx + gy) / 50) + Math.abs(x - w / 2) * 0.02;
  };
  for (let x = 0; x < bw; x++) cost[x] = px(lo + x, 0);
  for (let y = 1; y < h; y++) for (let x = 0; x < bw; x++) {
    let best = Infinity, step = 0;
    for (const d of [-1, 0, 1]) { const xx = x + d; if (xx < 0 || xx >= bw) continue; const c = cost[(y - 1) * bw + xx]; if (c < best) { best = c; step = d; } }
    cost[y * bw + x] = best + px(lo + x, y); from[y * bw + x] = step;
  }
  let x = 0; for (let i = 1; i < bw; i++) if (cost[(h - 1) * bw + i] < cost[(h - 1) * bw + x]) x = i;
  const out = new Int32Array(h);
  for (let y = h - 1; y >= 0; y--) { out[y] = lo + x; x += from[y * bw + x]; }
  return out;
}

/** Keeps only the figure itself (the largest connected shape) and its soft edge; drops stray bits such as the other figure's fingertip. */
function onlyFigure(data, w, h) {
  const solid = (i) => data[i * 4 + 3] > 24;
  const label = new Int32Array(w * h);
  let best = 0, bestSize = 0, next = 0;
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] || !solid(start)) continue;
    next++; let size = 0; stack.push(start); label[start] = next;
    while (stack.length) {
      const i = stack.pop(); size++;
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!label[j] && solid(j)) { label[j] = next; stack.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  // Keep pixels within 2 px of the figure so its soft outline stays.
  const near = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (label[i] === best) {
    const x = i % w, y = (i - x) / w;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) near[ny * w + nx] = 1;
    }
  }
  for (let i = 0; i < w * h; i++) if (!near[i]) data[i * 4 + 3] = 0;
}

/** One figure of the pair: the pixels on its side of the cut. */
function side(pair, cut, which) {
  const { data, w, h } = pair;
  const keep = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (which === "front" ? x >= cut[y] : x < cut[y]) continue;
    const p = (y * w + x) * 4;
    for (let k = 0; k < 4; k++) keep[p + k] = data[p + k];
  }
  return { data: keep, w, h };
}

/**
 * Where the cut had to pass through skin (the hands touch), re-decide ownership in a small window
 * around that spot: both figures grow outwards from their own side, crossing smooth skin easily
 * and outlines with difficulty, so they meet along the dark line between thumb and hand.
 * Returns how many rows touched (0 when the hands had a gap and nothing was changed).
 */
function settleTouch(pair, cut, front, back) {
  const { data, w, h } = pair;
  const touching = [];
  for (let y = 0; y < h; y++) if (data[(y * w + cut[y]) * 4 + 3] > 40) touching.push(y);
  if (!touching.length) return 0;
  const lum = (x, y) => { const p = (y * w + x) * 4; return (data[p] * 0.3 + data[p + 1] * 0.59 + data[p + 2] * 0.11) * data[p + 3] / 255; };
  const y0 = Math.max(1, touching[0] - 16), y1 = Math.min(h - 2, touching[touching.length - 1] + 16);
  const mid = Math.round(touching.reduce((a, y) => a + cut[y], 0) / touching.length);
  const x0 = Math.max(1, mid - 22), x1 = Math.min(w - 2, mid + 22);
  const ww = x1 - x0 + 1, wh = y1 - y0 + 1;
  const edge = new Uint8Array(ww * wh), owner = new Int8Array(ww * wh); // 1 front, 2 back
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const g = Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
    edge[(y - y0) * ww + (x - x0)] = Math.min(255, Math.round(g));
  }
  // Seeds: each figure's own pixels well away from the cut, and the window border on each side.
  const buckets = Array.from({ length: 256 }, () => []);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (data[(y * w + x) * 4 + 3] <= 40) continue;
    const i = (y - y0) * ww + (x - x0);
    const border = x === x0 || x === x1 || y === y0 || y === y1;
    if (x <= cut[y] - 9 || (border && x < cut[y])) owner[i] = 1;
    else if (x >= cut[y] + 9 || (border && x >= cut[y])) owner[i] = 2;
    if (owner[i]) buckets[0].push(i);
  }
  for (let level = 0; level < 256; level++) {
    const queue = buckets[level];
    while (queue.length) {
      const i = queue.pop();
      const x = i % ww, y = (i - x) / ww;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= ww || ny >= wh) continue;
        const j = ny * ww + nx; if (owner[j] || data[((ny + y0) * w + nx + x0) * 4 + 3] <= 40) continue;
        owner[j] = owner[i];
        buckets[Math.max(level, edge[j])].push(j);
      }
    }
  }
  // Apply: move each window pixel to the figure that claimed it.
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = owner[(y - y0) * ww + (x - x0)]; if (!o) continue;
    const p = (y * w + x) * 4;
    const [to, from] = o === 1 ? [front, back] : [back, front];
    for (let k = 0; k < 4; k++) to.data[p + k] = data[p + k];
    from.data[p + 3] = 0;
  }
  smoothWindow(front, x0, y0, x1, y1);
  smoothWindow(back, x0, y0, x1, y1);
  return touching.length;
}

/** Removes slivers thinner than about 5 px inside the window (leftovers of the other hand). */
function smoothWindow(piece, x0, y0, x1, y1) {
  const { data, w, h } = piece;
  const r = 2;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 40;
  const fits = new Uint8Array(w * h);
  // A pixel stays if some 5×5 square of solid pixels covers it.
  for (let y = y0 - r; y <= y1 + r; y++) for (let x = x0 - r; x <= x1 + r; x++) {
    let full = true;
    for (let dy = -r; dy <= r && full; dy++) for (let dx = -r; dx <= r; dx++) if (!solid(x + dx, y + dy)) { full = false; break; }
    if (full) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) fits[ny * w + nx] = 1; }
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = (y * w + x) * 4;
    if (data[p + 3] > 40 && !fits[y * w + x]) data[p + 3] = 0;
  }
}

/** Keeps only the figure, then trims it sideways. */
function finish(piece) {
  const { data, w, h } = piece;
  onlyFigure(data, w, h);
  let x0 = w, x1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  return { data, w, h, x0, x1 };
}

async function write(piece, width, file) {
  const cw = piece.x1 - piece.x0 + 1;
  const left = Math.round((width - cw) / 2);
  await sharp(Buffer.from(piece.data.buffer), { raw: { width: piece.w, height: piece.h, channels: 4 } })
    .extract({ left: piece.x0, top: 0, width: cw, height: piece.h })
    .extend({ left, right: width - cw - left, top: 0, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80, alphaQuality: 90, effort: 6 })
    .toFile(file);
}

/** Neutral pictures all share one outline: rebuild the full pair from the clean neutral body plus the region's colour. */
async function neutralPair(region, base, baseCut) {
  if (TWO_VIEW.includes(region)) return load(`${FIG}/neutral-${region}.webp`);
  const pair = { data: new Uint8ClampedArray(base.data), w: base.w, h: base.h };
  const front = await load(`${INCOMING}/neutral-sides/neutral-${region}-front.webp`);
  const back = await load(`${INCOMING}/neutral-sides/neutral-${region}-back.webp`);
  const backOffset = base.w - back.w;
  for (let y = 0; y < base.h; y++) for (let x = 0; x < base.w; x++) {
    const useFront = x < baseCut[y];
    const piece = useFront ? front : back;
    const sx = useFront ? x : x - backOffset;
    if (sx < 0 || sx >= piece.w) continue;
    const s = (y * piece.w + sx) * 4, d = (y * base.w + x) * 4;
    if (piece.data[s + 3] === 0) continue; // beyond the old cut: keep the clean body
    for (let k = 0; k < 4; k++) pair.data[d + k] = piece.data[s + k];
  }
  return pair;
}

(async () => {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("Give an output folder.");
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = [];
  const neutralBase = await load(`${FIG}/neutral-base.webp`);
  const neutralCut = seam(neutralBase);
  for (const figure of ["female", "male", "neutral"]) {
    for (const region of [...TWO_VIEW, ...SINGLE_FRONT, ...SINGLE_BACK]) {
      let pair;
      if (figure === "neutral") pair = await neutralPair(region, neutralBase, neutralCut);
      else if (TWO_VIEW.includes(region)) pair = await load(`${FIG}/${figure}-${region}.webp`);
      else pair = await keyedPair(`${INCOMING}/${figure}-${region === "core" && figure === "female" ? "core-option-b" : region}.webp`);
      const cut = figure === "neutral" ? neutralCut : seam(pair);
      const frontSide = side(pair, cut, "front"), backSide = side(pair, cut, "back");
      const touched = settleTouch(pair, cut, frontSide, backSide);
      if (touched) console.log(`  ${figure}-${region}: hands touched on ${touched} rows; split along the outline`);
      const front = finish(frontSide), back = finish(backSide);
      jobs.push({ figure, region, front, back });
    }
  }
  // One canvas width for every picture, so turning front ↔ back never shifts.
  const width = Math.max(...jobs.flatMap((job) => [job.front, job.back].map((piece) => piece.x1 - piece.x0 + 1))) + MARGIN * 2;
  for (const job of jobs) {
    await write(job.front, width, path.join(outDir, `${job.figure}-${job.region}-front.webp`));
    await write(job.back, width, path.join(outDir, `${job.figure}-${job.region}-back.webp`));
    if (SINGLE_FRONT.includes(job.region)) await write(job.front, width, path.join(outDir, `${job.figure}-${job.region}.webp`));
    if (SINGLE_BACK.includes(job.region)) await write(job.back, width, path.join(outDir, `${job.figure}-${job.region}.webp`));
  }
  console.log(`Wrote ${fs.readdirSync(outDir).length} pictures, ${width}×${HEIGHT}.`);
})();
