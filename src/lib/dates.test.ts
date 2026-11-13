import assert from "node:assert/strict";
import test from "node:test";
import { describeNextDay, greetingFor, isIsoDate, nextTrainingDate, shiftDate, todayHref, trainingDaysHint, trainingDaysValid, weekDates, weekdayOf } from "./dates.ts";
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
  assert.deepEqual(regionsForExercises([{ movementPattern: "squat" }, { movementPattern: "hip_extension" }, { movementPattern: "core" }]), ["hips", "thighs", "hamstrings", "core"]);
  assert.deepEqual(regionsForExercises([{ movementPattern: "recovery" }, {}]), []);
});

test("walking and marching show the legs, not the back", () => {
  assert.deepEqual(regionsForExercises([{ id: "march_in_place", movementPattern: "carry" }]), ["thighs", "calves"]);
  assert.equal(regionsForExercises([{ id: "farmer_carry", movementPattern: "carry" }])[0], "forearms");
});

test("allows 3 to 6 training days and keeps one rest day", () => {
  assert.equal(trainingDaysValid([1, 3]), false);
  assert.equal(trainingDaysValid([1, 3, 5]), true);
  assert.equal(trainingDaysValid([1, 2, 3, 4, 5, 6]), true);
  assert.equal(trainingDaysValid([0, 1, 2, 3, 4, 5, 6]), false);
  assert.match(trainingDaysHint(2), /at least 3/);
  assert.equal(trainingDaysHint(4), "");
  assert.match(trainingDaysHint(6), /easy/);
  assert.match(trainingDaysHint(7), /rest day/);
});
