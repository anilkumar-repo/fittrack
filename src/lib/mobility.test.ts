import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { AREA_LABELS, coolDownFor, MOBILITY_VIDEOS, moveVideo, youTubeId, doseLabel, MOBILITY_MOVES, MOBILITY_ROUTINES, mobilityMove, routineMinutes, routineSteps, suggestionForDay, warmUpFor } from "./mobility.ts";

test("130 moves, each with a picture, and 16 routines that only use known moves", () => {
  assert.equal(MOBILITY_MOVES.length, 130);
  assert.equal(new Set(MOBILITY_MOVES.map((move) => move.id)).size, 130);
  for (const move of MOBILITY_MOVES) assert.ok(existsSync(new URL(`../../public/stretches/v1/${move.id}.webp`, import.meta.url)), `missing picture ${move.id}`);
  assert.equal(MOBILITY_ROUTINES.length, 16);
  for (const routine of MOBILITY_ROUTINES) for (const id of routine.moves) assert.ok(mobilityMove(id), `${routine.id} uses unknown ${id}`);
  // Every body area on the Mobility page has moves (Knee care once showed 0).
  for (const area of Object.keys(AREA_LABELS)) assert.ok(MOBILITY_MOVES.some((move) => move.area === area), `${area} has no moves`);
  assert.equal(MOBILITY_MOVES.filter((move) => move.area === "knee").length, 8);
  assert.equal(MOBILITY_MOVES.filter((move) => move.area === "strength").length, 21);
  const used = new Set(MOBILITY_ROUTINES.flatMap((routine) => routine.moves));
  assert.equal(used.size, 130);
});

test("one-sided moves play twice, and routines take about 5–15 minutes", () => {
  const pigeon = mobilityMove("pigeon-stretch");
  assert.equal(pigeon?.sides, true);
  assert.equal(doseLabel(pigeon!), "40 s each side");
  const morning = MOBILITY_ROUTINES.find((routine) => routine.id === "morning-wake-up")!;
  const steps = routineSteps(morning);
  assert.ok(steps.length > morning.moves.length);
  for (const routine of MOBILITY_ROUTINES) {
    const minutes = routineMinutes(routine);
    assert.ok(minutes >= 3 && minutes <= 20, `${routine.id}: ${minutes} min`);
  }
});

test("warm-ups and cool-downs follow the workout; the day's pick follows how you are", () => {
  assert.equal(warmUpFor("Lower A · Legs").id, "before-leg-day");
  assert.equal(warmUpFor("Pull · Back and biceps").id, "back-day-mobility");
  assert.equal(warmUpFor("Push · Chest").id, "upper-body-mobility");
  assert.equal(warmUpFor("Foundation A · Full body").id, "morning-wake-up");
  assert.equal(coolDownFor("Push · Chest").id, "triceps-and-arms-stretch");
  assert.equal(coolDownFor("Lower B").id, "full-body-cool-down");
  assert.equal(suggestionForDay({ hour: 10, restDay: false, discomfort: true })?.routine.id, "knee-care");
  assert.equal(suggestionForDay({ hour: 10, restDay: false, recentMissedReason: "travel" })?.routine.id, "desk-and-travel-stretch");
  assert.equal(suggestionForDay({ hour: 9, restDay: true })?.routine.id, "morning-wake-up");
  assert.equal(suggestionForDay({ hour: 15, restDay: true })?.routine.id, "posture-and-pelvis-reset");
  assert.equal(suggestionForDay({ hour: 10, restDay: false }), null);
});

test("videos: a search for every move until a trainer picks one, which then plays inside the app", () => {
  const pigeon = mobilityMove("pigeon-stretch")!;
  const search = moveVideo(pigeon);
  assert.equal(search.curated, false);
  assert.equal(search.embedUrl, null);
  assert.match(search.url, /youtube\.com\/results\?search_query=Pigeon%20stretch%20stretch/);
  assert.match(moveVideo(mobilityMove("glute-bridge")!).url, /exercise%20how%20to/);
  assert.equal(youTubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youTubeId("https://example.com/video"), null);
  MOBILITY_VIDEOS["pigeon-stretch"] = "https://youtu.be/dQw4w9WgXcQ";
  const picked = moveVideo(pigeon);
  assert.equal(picked.curated, true);
  assert.equal(picked.embedUrl, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1");
  delete MOBILITY_VIDEOS["pigeon-stretch"];
});

test("moving pictures: every listed move is real, has 2–4 frames and every frame file exists", async () => {
  const { MOVE_FRAMES } = await import("./move-frames.ts");
  const { moveFrames, loopOrder, mobilityMove } = await import("./mobility.ts");
  const { existsSync } = await import("node:fs");
  for (const [id, count] of Object.entries(MOVE_FRAMES)) {
    assert.ok(mobilityMove(id), `unknown move ${id}`);
    assert.ok(count >= 2 && count <= 4, `${id} has ${count} frames`);
    for (const url of moveFrames(id)) assert.ok(existsSync(new URL(`../../public${url}`, import.meta.url)), `missing ${url}`);
  }
  assert.deepEqual(moveFrames("no-such-move"), []);
  assert.deepEqual(loopOrder(3), [0, 1, 2, 1]);
  assert.deepEqual(loopOrder(2), [0, 1]);
  assert.deepEqual(loopOrder(4), [0, 1, 2, 3, 2, 1]);
  assert.deepEqual(loopOrder(1), [0]);
});
