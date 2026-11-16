// Rozi face avatars: square pictures with a pastel background → 256 px webp, shown in a circle.
// Usage: node scripts/build-avatars.mjs   (reads design/rozi-incoming/avatars/avatar-<name>.png)
import { readdirSync } from "node:fs";
import sharp from "sharp";

const SRC = "design/rozi-incoming/avatars";
const OUT = "public/rozi/faces/v1";
for (const file of readdirSync(SRC).filter((f) => /^avatar-.+\.png$/.test(f))) {
  const name = file.slice(7, -4);
  const image = sharp(`${SRC}/${file}`);
  const { width, height } = await image.metadata();
  const side = Math.min(width, height);
  // Square centre crop, then a slight zoom so the face fills the circle.
  const inset = Math.round(side * 0.04);
  await image
    .extract({ left: Math.round((width - side) / 2) + inset, top: Math.round((height - side) / 2) + inset, width: side - inset * 2, height: side - inset * 2 })
    .resize(256, 256)
    .webp({ quality: 84 })
    .toFile(`${OUT}/${name}.webp`);
  console.log(name);
}
