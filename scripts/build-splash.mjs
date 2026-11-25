/**
 * Builds the iPhone launch pictures in public/splash from the home-screen icons (2026-11-25).
 * iOS shows one of these while a Home Screen web app starts, before any page code runs (it was a black screen).
 * Each matches the first frame of the opening animation (rozi-opening.tsx): the app's dark page colour with the
 * 76 pt icon, corner radius 16 pt, in the centre. The app opens in dark mode unless the user picked light, so the
 * background is always dark; the icon follows the phone's appearance, like the opening's own <picture>.
 * Devices: src/lib/splash-devices.json (portrait iPhones, CSS width × height × pixel ratio).
 *
 * Usage: node scripts/build-splash.mjs
 */
import sharp from "sharp";
import fs from "node:fs";

const OUT = "public/splash";
const PAGE_DARK = "#0b0f12"; // --page in dark mode
const ICON = 76, RADIUS = 16;
const devices = JSON.parse(fs.readFileSync("src/lib/splash-devices.json", "utf8"));

fs.mkdirSync(OUT, { recursive: true });
for (const { w, h, dpr } of devices) {
  for (const look of ["light", "dark"]) {
    const size = ICON * dpr, r = RADIUS * dpr;
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
    const icon = await sharp(`public/icons/apple-touch-icon${look === "dark" ? "-dark" : ""}.png`)
      .resize(size, size).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    await sharp({ create: { width: w * dpr, height: h * dpr, channels: 3, background: PAGE_DARK } })
      .composite([{ input: icon, left: Math.round((w * dpr - size) / 2), top: Math.round((h * dpr - size) / 2) }])
      .png({ compressionLevel: 9 }).toFile(`${OUT}/${w}x${h}@${dpr}-${look}.png`);
  }
}
console.log(`Wrote ${devices.length * 2} launch pictures to ${OUT}.`);
