import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { musclePicture, pictureFileNames, sidePicture, sidePictureFileNames, startingSide } from "./muscle-images.ts";

test("every pictured figure has a plain picture and one for every muscle group", () => {
  for (const name of [...pictureFileNames(), ...sidePictureFileNames()]) assert.ok(existsSync(new URL(`../../public/figures/${name}`, import.meta.url)), `missing public/figures/${name}`);
});

test("one-sided muscle groups use a single view, for every figure including neutral", () => {
  assert.deepEqual(musclePicture("female", "chest"), { src: "/figures/v3/female-chest.webp", width: 489, height: 820 });
  assert.equal(musclePicture("male", "hips")?.src, "/figures/v3/male-glutes.webp");
  assert.equal(musclePicture("male", "arms")?.width, 978);
  assert.equal(musclePicture("female")?.src, "/figures/v3/female-base.webp");
  assert.equal(musclePicture("neutral", "chest")?.src, "/figures/v3/neutral-chest.webp");
});

test("the turnable figure starts on the side where the muscle group is seen", () => {
  assert.equal(startingSide("hamstrings"), "back");
  assert.equal(startingSide("chest"), "front");
  assert.equal(startingSide(), "front");
  assert.equal(sidePicture("male", "back", "hips")?.src, "/figures/v3/male-glutes-back.webp");
  assert.equal(sidePicture("neutral", "front")?.src, "/figures/v3/neutral-base-front.webp");
  // A view where the muscle cannot be seen shows the plain body.
  assert.equal(sidePicture("female", "back", "chest")?.src, "/figures/v3/female-base-back.webp");
  assert.equal(sidePicture("male", "front", "hamstrings")?.src, "/figures/v3/male-base-front.webp");
});

test("side view: every listed figure has its plain side picture and a side mask for every muscle group", async () => {
  const { SIDE_VIEW_FIGURES } = await import("./muscle-images.ts");
  const regions = ["shoulders", "chest", "back", "arms", "forearms", "core", "glutes", "quads", "hamstrings", "calves"];
  for (const figure of SIDE_VIEW_FIGURES) {
    assert.ok(existsSync(new URL(`../../public/figures/v3/${figure}-base-side.webp`, import.meta.url)), `${figure}: missing plain side picture`);
    for (const region of regions) assert.ok(existsSync(new URL(`../../public/figures/masks/v1/${figure}-${region}-side.webp`, import.meta.url)), `${figure}: missing ${region} side mask`);
  }
});
