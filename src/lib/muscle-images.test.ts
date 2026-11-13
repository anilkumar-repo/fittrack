import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { musclePicture, pictureFileNames, sidePicture, sidePictureFileNames, startingSide } from "./muscle-images.ts";

test("every pictured figure has a plain picture and one for every muscle group", () => {
  for (const name of [...pictureFileNames(), ...sidePictureFileNames()]) assert.ok(existsSync(new URL(`../../public/figures/${name}`, import.meta.url)), `missing public/figures/${name}`);
});

test("one-sided muscle groups use a single view, for every figure including neutral", () => {
  assert.deepEqual(musclePicture("female", "chest"), { src: "/figures/v2/female-chest.webp", width: 418, height: 820 });
  assert.equal(musclePicture("male", "hips")?.src, "/figures/v2/male-glutes.webp");
  assert.equal(musclePicture("male", "arms")?.width, 760);
  assert.equal(musclePicture("female")?.src, "/figures/female-base.webp");
  assert.equal(musclePicture("neutral", "chest")?.src, "/figures/v2/neutral-chest.webp");
});

test("the turnable figure starts on the side where the muscle group is seen", () => {
  assert.equal(startingSide("hamstrings"), "back");
  assert.equal(startingSide("chest"), "front");
  assert.equal(startingSide(), "front");
  assert.equal(sidePicture("male", "back", "hips")?.src, "/figures/v2/male-glutes-back.webp");
  assert.equal(sidePicture("neutral", "front")?.src, "/figures/v2/neutral-base-front.webp");
});
