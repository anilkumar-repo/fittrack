/**
 * Moving stretch pictures (Phase 5). For each move with extra frames in design/stretches-incoming/frames:
 *   {id}-2.png, {id}-3.png (and {id}-4.png)  extra positions, made by editing the original picture
 *   {id}-1.png                               optional; otherwise the original design/stretches-incoming/{id}.png
 * every frame gets the same black-background cut as the still pictures, then ALL frames of a move are cropped
 * with one shared box (the union of the figures) so the body never jumps between frames. Writes
 * public/stretches/frames/v1/{id}-{n}.webp and the list the app reads, src/lib/move-frames.ts.
 *
 * Frames of one move must be the same picture size (edit the original; don't change the canvas).
 * Usage: node scripts/build-move-frames.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { cutOut, place } from "./build-stretches.mjs";

const STILLS = "design/stretches-incoming";
const FRAMES = "design/stretches-incoming/frames";
const OUT = "public/stretches/frames/v1";
const LIST = "src/lib/move-frames.ts";

/** Brings a frame to the first frame's size when only the scale differs; refuses a different shape. */
async function sameSize(file, width, height) {
  const meta = await sharp(file).metadata();
  if (meta.width === width && meta.height === height) return file;
  if (Math.abs(meta.width / meta.height - width / height) > 0.02) {
    throw new Error(`${path.basename(file)} is ${meta.width}×${meta.height}, but frame 1 is ${width}×${height}. Keep the same picture shape.`);
  }
  return sharp(file).resize(width, height, { fit: "fill" }).png().toBuffer();
}

const ids = new Map();
for (const name of fs.existsSync(FRAMES) ? fs.readdirSync(FRAMES) : []) {
  const match = /^(.+)-([1-4])\.png$/.exec(name);
  if (!match) continue;
  const [, id, n] = match;
  if (!ids.has(id)) ids.set(id, new Map());
  ids.get(id).set(Number(n), path.join(FRAMES, name));
}

fs.mkdirSync(OUT, { recursive: true });
const counts = {};
for (const [id, frames] of [...ids].sort()) {
  if (!frames.has(1)) frames.set(1, path.join(STILLS, `${id}.png`));
  const numbers = [...frames.keys()].sort();
  if (!fs.existsSync(frames.get(1))) { console.warn(`skip ${id}: no original picture`); continue; }
  if (numbers.length < 2 || numbers.some((n, i) => n !== i + 1)) { console.warn(`skip ${id}: frames must be 1, 2(, 3, 4) with no gaps`); continue; }
  const first = await sharp(frames.get(1)).metadata();
  const cuts = [];
  for (const n of numbers) {
    const input = await sameSize(frames.get(n), first.width, first.height);
    // cutOut reads a file path; a resized frame goes through a temporary file.
    const file = typeof input === "string" ? input : path.join(OUT, `.tmp-${id}-${n}.png`);
    if (typeof input !== "string") fs.writeFileSync(file, input);
    cuts.push(await cutOut(file));
    if (typeof input !== "string") fs.unlinkSync(file);
  }
  const box = {
    x0: Math.min(...cuts.map((c) => c.box.x0)), y0: Math.min(...cuts.map((c) => c.box.y0)),
    x1: Math.max(...cuts.map((c) => c.box.x1)), y1: Math.max(...cuts.map((c) => c.box.y1)),
  };
  for (const [i, cut] of cuts.entries()) await (await place(cut, box)).toFile(path.join(OUT, `${id}-${i + 1}.webp`));
  counts[id] = cuts.length;
  console.log(`✓ ${id}: ${cuts.length} frames`);
}

const body = Object.entries(counts).map(([id, n]) => `  "${id}": ${n},`).join("\n");
fs.writeFileSync(LIST, `// Made by scripts/build-move-frames.mjs. Don't edit by hand: add frames and run the script.
/** Moves with a moving picture: move id → number of frames in public/stretches/frames/v1/{id}-{n}.webp. */
export const MOVE_FRAMES: Record<string, number> = {${body ? `\n${body}\n` : ""}};
`);
console.log(`${Object.keys(counts).length} moving pictures; list written to ${LIST}.`);
