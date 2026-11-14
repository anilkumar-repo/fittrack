import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { coolDownFor, doseLabel, MOBILITY_MOVES, MOBILITY_ROUTINES, mobilityMove, routineMinutes, routineSteps, suggestionForDay, warmUpFor } from "./mobility.ts";

test("130 moves, each with a picture, and 16 routines that only use known moves", () => {
  assert.equal(MOBILITY_MOVES.length, 130);
  assert.equal(new Set(MOBILITY_MOVES.map((move) => move.id)).size, 130);
  for (const move of MOBILITY_MOVES) assert.ok(existsSync(new URL(`../../public/stretches/v1/${move.id}.webp`, import.meta.url)), `missing picture ${move.id}`);
  assert.equal(MOBILITY_ROUTINES.length, 16);
  for (const routine of MOBILITY_ROUTINES) for (const id of routine.moves) assert.ok(mobilityMove(id), `${routine.id} uses unknown ${id}`);
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
