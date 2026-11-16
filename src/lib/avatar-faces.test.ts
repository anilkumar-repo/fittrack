import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("every Rozi face in the picker has its picture", () => {
  const source = readFileSync(new URL("../components/app/avatar.tsx", import.meta.url), "utf8");
  const faces = JSON.parse(source.match(/ROZI_FACES = (\[[^\]]+\])/)![1]) as string[];
  assert.equal(faces.length, 17);
  for (const face of faces) assert.ok(existsSync(new URL(`../../public/rozi/faces/v1/${face}.webp`, import.meta.url)), `missing ${face}`);
});
