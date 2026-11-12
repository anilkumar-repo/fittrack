import assert from "node:assert/strict";
import test from "node:test";
import { describeNextDay, isIsoDate, nextTrainingDate, shiftDate, todayHref, weekdayOf } from "./dates.ts";

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
