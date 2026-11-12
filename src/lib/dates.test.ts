import assert from "node:assert/strict";
import test from "node:test";
import { describeNextDay, greetingFor, isIsoDate, nextTrainingDate, shiftDate, todayHref, weekDates, weekdayOf } from "./dates.ts";
import { regionsForExercises } from "./figure.ts";

test("validates calendar dates used in workout page addresses", () => {
  assert.equal(isIsoDate("2026-11-14"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("14-11-2026"), false);
  assert.equal(isIsoDate(null), false);
});

test("finds the next scheduled training day across a month boundary", () => {
  assert.equal(shiftDate("2026-11-30", 1), "2026-12-01");
  assert.equal(weekdayOf("2026-11-12"), 4);
  assert.equal(nextTrainingDate({ trainingDays: [2, 4, 6] }, "2026-11-12"), "2026-11-14");
  assert.equal(nextTrainingDate({ trainingDays: [] }, "2026-11-12"), null);
  assert.equal(describeNextDay({ trainingDays: [] }, "2026-11-12"), "your next scheduled day");
});

test("today's workout keeps the short address", () => {
  assert.equal(todayHref("2026-11-12", "2026-11-12"), "/today");
  assert.equal(todayHref("2026-11-14", "2026-11-12"), "/today?date=2026-11-14");
});

test("a week runs Monday to Sunday around any date in it", () => {
  assert.deepEqual(weekDates("2026-11-12"), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  assert.equal(weekDates("2026-11-15")[0], "2026-11-09");
  assert.equal(weekDates("2026-11-09")[0], "2026-11-09");
});

test("greets by the time of day in the person's time zone", () => {
  const instant = new Date("2026-11-12T03:30:00Z");
  assert.equal(greetingFor("Asia/Kolkata", instant), "Good morning");
  assert.equal(greetingFor("America/Los_Angeles", instant), "Good evening");
  assert.equal(greetingFor("Asia/Kolkata", new Date("2026-11-12T08:30:00Z")), "Good afternoon");
});

test("maps a workout's movements to the body regions to highlight, most-used first", () => {
  assert.deepEqual(regionsForExercises([{ movementPattern: "squat" }, { movementPattern: "hip_extension" }, { movementPattern: "core" }]), ["thighs", "hips", "core"]);
  assert.deepEqual(regionsForExercises([{ movementPattern: "recovery" }, {}]), []);
});
