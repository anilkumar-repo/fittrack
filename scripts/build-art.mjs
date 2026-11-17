// Phase 1–4 artwork (2026-11-17): equipment, gym photos, Rozi moments, intro slides.
// Sources: design/art-incoming/<folder>/<original file name>.png (kept as delivered).
// Usage: node scripts/build-art.mjs
//   cut   = transparent result: keep real transparency, or flood-fill a painted white / checkerboard background from the edges
//   photo = full-bleed scene photo, cropped to the card shape
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const IN = "design/art-incoming";
const JOBS = [
  // Equipment → public/equipment/v1/<key>.webp (square, transparent)
  ...[
    ["Chest Press Gym Machine 3D Illustration", "gym_machines"], ["Coral-Accented Cable Machine Render", "cable_machine"],
    ["Coral-Accented Flat Weight Bench", "bench"], ["Coral-Accented Hyperextension Bench", "back_extension"],
    ["Coral-Accented Lying Leg Curl Machine", "leg_curl_machine"], ["Coral-accented aerobic step platform", "step"],
    ["Detailed Black and Orange Smith Machine", "smith_machine"], ["Heavy-Duty Black Multi-Grip Pull-Up Bar", "pullup_bar"],
    ["Hexagonal Dumbbells with Coral Accents", "dumbbells"], ["Industrial Coral-Accent Power Rack", "rack"],
    ["Mint Green Rolled Yoga Mat", "mat"], ["Modern Black and Orange Cardio Equipment Set", "cardio_machine"],
    ["Olympic and EZ Curl Bars Set", "barbell"], ["Professional 45-Degree Leg Press Machine", "leg_press"],
    ["Realistic Wooden Ladder-Back Dining Chair", "chair"],
  ].map(([src, name]) => ({ src: `equipment/${src}.png`, out: `public/equipment/v1/${name}.webp`, mode: "cut", w: 384, h: 384, pockets: true })),
  // Where you train → public/gyms/v1/<key>.webp (photo cards)
  { src: "gyms/Modern Orange-Accented Gym Interior.png", out: "public/gyms/v1/large_gym.webp", mode: "photo", w: 960, h: 600 },
  { src: "gyms/Modern Home Gym with Orange Accents.png", out: "public/gyms/v1/small_gym.webp", mode: "photo", w: 960, h: 600 },
  { src: "gyms/Sunny Peach Home Workout Nook.png", out: "public/gyms/v1/home.webp", mode: "photo", w: 960, h: 600 },
  { src: "gyms/Sunny Park Yoga Essentials.png", out: "public/gyms/v1/bodyweight.webp", mode: "photo", w: 960, h: 600 },
  { src: "gyms/Pastel Isometric Gym Corner Diorama.png", out: "public/gyms/v1/program.webp", mode: "cut", w: 960, h: 640 },
  // Rozi moments → public/rozi/<mood>.webp (same 480 px square as the other Rozi pictures)
  ...[
    ["mascot/Sleepy Rozi with Steaming Heart Mug", "rest-morning"], ["mascot/Rozi the Fluffy Hydration Mascot", "rest-afternoon"],
    ["mascot/Fluffy Bookworm on a Peach Cushion", "rest-evening"], ["mascot/Cheerful Fuzzy Orange Warm-Up Mascot", "train-morning"],
    ["mascot/Fluffy Coral Fitness Mascot", "train-afternoon"], ["mascot/Cheerful Fluffy Gym Mascot", "train-evening"],
    ["mascot/Rozi’s Confetti Medal Celebration", "done-day"], ["mascot/Sleepy Champion with Gold Medal", "done-night"],
    ["rozi/Coral Fluffy Mascot Waving Cheerfully", "chat-hello"], ["rozi/Rozi’s Fluffy Thinking Pose", "chat-thinking"],
    ["rozi/Cheerful Furball with Lightbulb", "chat-idea"], ["rozi/Relaxed Coral Mascot on Mint Roller", "recovery-roller"],
    ["rozi/Brave Pom-Pom with Ice Pack", "recovery-ice"], ["rozi/Cheerful Coral Mascot with Clipboard", "report-card"],
  ].map(([src, name]) => ({ src: `${src}.png`, out: `public/rozi/${name}.webp`, mode: "cut", w: 480, h: 480 })),
  // Intro slides → public/rozi/slides/v1/<name>.webp (wide, transparent)
  { src: "rozi/Rozi’s Cheerful Fitness Check-In.png", out: "public/rozi/slides/v1/slide-log.webp", mode: "cut", w: 900, h: 600 },
  { src: "rozi/Cheerful Coral Mascot Growth Chart.png", out: "public/rozi/slides/v1/slide-progress.webp", mode: "cut", w: 900, h: 600 },
  { src: "rozi/Fluffy Mascots High-Five Celebration.png", out: "public/rozi/slides/v1/slide-friends.webp", mode: "cut", w: 900, h: 600 },
];

/** A light, grey-ish pixel: painted white or the two checkerboard greys. */
function isBackdrop(r, g, b) {
  return Math.min(r, g, b) >= 196 && Math.max(r, g, b) - Math.min(r, g, b) <= 16;
}

async function cut(file, pockets = false) {
  const image = sharp(file).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Already transparent around the edges? Use it as it is.
  let clear = 0, edge = 0;
  for (let x = 0; x < width; x += 7) for (const y of [0, height - 1]) { edge++; if (data[(y * width + x) * 4 + 3] < 20) clear++; }
  if (clear / edge > 0.8) return sharp(data, { raw: info });
  // Flood-fill the painted backdrop from every edge pixel.
  const gone = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => { const i = y * width + x; if (gone[i]) return; const p = i * 4; if (!isBackdrop(data[p], data[p + 1], data[p + 2])) return; gone[i] = 1; stack.push(i); };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop(); const x = i % width; const y = (i - x) / width;
    if (x > 0) push(x - 1, y); if (x < width - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < height - 1) push(x, y + 1);
  }
  // Equipment only: painted checkerboard trapped inside a frame (between chair legs, inside a rack). Remove enclosed
  // light patches that really are a checkerboard (a mix of near-white and light-grey squares), keep plain white details.
  if (pockets) {
    const seen = new Uint8Array(width * height);
    for (let start = 0; start < gone.length; start++) {
      if (gone[start] || seen[start]) continue;
      const p0 = start * 4;
      if (!isBackdrop(data[p0], data[p0 + 1], data[p0 + 2])) continue;
      const part = [start]; seen[start] = 1;
      for (let k = 0; k < part.length; k++) {
        const i = part[k]; const x = i % width; const y = (i - x) / width;
        for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
          if (j < 0 || seen[j] || gone[j]) continue;
          const q = j * 4;
          if (isBackdrop(data[q], data[q + 1], data[q + 2])) { seen[j] = 1; part.push(j); }
        }
      }
      if (part.length < 300) continue;
      let white = 0, grey = 0;
      for (const i of part) { const v = data[i * 4]; if (v >= 247) white++; else if (v <= 238) grey++; }
      if (white / part.length > 0.2 && grey / part.length > 0.2) for (const i of part) gone[i] = 1;
    }
  }
  // Equipment only: a painted floor shadow on top of the checkerboard leaves darker grey squares under the item.
  // Grow the removed area into grey, colourless pixels — but only in the floor strip (bottom 22 % of the item),
  // so chrome bars and frames higher up are never touched.
  if (pockets) {
    let top = height, bottom = 0;
    for (let i = 0; i < gone.length; i++) if (!gone[i]) { const y = Math.floor(i / width); if (y < top) top = y; if (y > bottom) bottom = y; }
    const floor = bottom - Math.round((bottom - top) * 0.22);
    const greyish = (q) => Math.min(data[q], data[q + 1], data[q + 2]) >= 96 && Math.max(data[q], data[q + 1], data[q + 2]) - Math.min(data[q], data[q + 1], data[q + 2]) <= 14;
    const grow = [];
    for (let i = 0; i < gone.length; i++) if (gone[i] && Math.floor(i / width) >= floor) grow.push(i);
    while (grow.length) {
      const i = grow.pop(); const x = i % width; const y = (i - x) / width;
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > floor ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (j < 0 || gone[j] || !greyish(j * 4)) continue;
        gone[j] = 1; grow.push(j);
      }
    }
  }
  // Soft edge: pixels next to removed ones get half alpha.
  for (let i = 0; i < gone.length; i++) {
    if (gone[i]) { data[i * 4 + 3] = 0; continue; }
    const x = i % width;
    const near = (x > 0 && gone[i - 1]) || (x < width - 1 && gone[i + 1]) || gone[i - width] || gone[i + width];
    if (near) data[i * 4 + 3] = Math.min(data[i * 4 + 3], 150);
  }
  return sharp(data, { raw: info });
}

for (const job of JOBS) {
  mkdirSync(job.out.slice(0, job.out.lastIndexOf("/")), { recursive: true });
  const file = `${IN}/${job.src}`;
  if (job.mode === "photo") {
    await sharp(file).resize(job.w, job.h, { fit: "cover", position: "centre" }).webp({ quality: 80 }).toFile(job.out);
  } else {
    const transparent = await (await cut(file, job.pockets)).png().toBuffer();
    const trimmed = await sharp(transparent).trim({ threshold: 1 }).toBuffer();
    const inner = Math.round(Math.min(job.w, job.h) * 0.94);
    await sharp(trimmed).resize(job.w === job.h ? inner : Math.round(job.w * 0.94), job.w === job.h ? inner : Math.round(job.h * 0.94), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 0, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer().then((buffer) => sharp(buffer).resize(job.w, job.h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88, alphaQuality: 100 }).toFile(job.out));
  }
  console.log("✓", job.out);
}
