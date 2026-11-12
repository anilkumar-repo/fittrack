import assert from "node:assert/strict";
import test from "node:test";
import { FLOOR_Y, getDemoVideoLink, getExerciseIllustration, poseJoints } from "./exercise-media.ts";
import { EXERCISE_LIBRARY } from "./templates.ts";

test("every library exercise has a drawing whose joints stay inside the frame and above the floor", () => {
  for (const exercise of EXERCISE_LIBRARY) {
    const illustration = getExerciseIllustration(exercise.id);
    assert.ok(illustration, `${exercise.id} has no illustration`);
    for (const pose of [illustration.start, illustration.finish]) {
      if (!pose) continue;
      for (const [joint, [x, y]] of Object.entries(poseJoints(pose))) {
        assert.ok(x >= 2 && x <= 98, `${exercise.id} ${joint} x=${x.toFixed(1)} is outside the frame`);
        assert.ok(y >= 2 && y <= FLOOR_Y + 3, `${exercise.id} ${joint} y=${y.toFixed(1)} is outside the frame or below the floor`);
      }
    }
  }
});

test("demo links search by exercise name and never invent a specific video", () => {
  const link = getDemoVideoLink({ id: "glute_bridge", name: "Glute bridge" });
  assert.equal(link.curated, false);
  assert.match(link.url, /^https:\/\/www\.youtube\.com\/results\?search_query=Glute%20bridge/);
});
