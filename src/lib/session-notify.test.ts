import assert from "node:assert/strict";
import test from "node:test";
import { workoutNotificationText } from "./session-notify.ts";

// A fixed clock so the test doesn't depend on the machine's time zone or language.
const clock = (ms: number, withSeconds = false) => {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCHours()}:${pad(date.getUTCMinutes())}${withSeconds ? `:${pad(date.getUTCSeconds())}` : ""}`;
};
const at = (time: string) => Date.parse(`2026-11-18T${time}Z`);

test("while resting, the notification says when the rest ends", () => {
  const text = workoutNotificationText({
    title: "Push B", startedAt: at("09:23:00"), setsDone: 4, setsTotal: 21,
    rest: { endsAt: at("10:15:30"), exerciseName: "Incline dumbbell press" }, now: at("10:13:00"), clock,
  });
  assert.equal(text.title, "⏱ Rest until 10:15:30");
  assert.match(text.body, /^Incline dumbbell press — next set when the rest ends\./);
  assert.match(text.body, /Started 9:23 · 4\/21 sets\./);
});

test("between rests it shows the workout, progress and start time", () => {
  const text = workoutNotificationText({ title: "Push B", startedAt: at("09:23:00"), setsDone: 4, setsTotal: 21, rest: null, now: at("10:13:00"), clock });
  assert.equal(text.title, "💪 Push B · 4/21 sets");
  assert.equal(text.body, "Started 9:23. Tap to get back to your sets.");
});

test("a rest that already ended isn't shown", () => {
  const text = workoutNotificationText({
    title: "Push B", startedAt: null, setsDone: 0, setsTotal: 0,
    rest: { endsAt: at("10:00:00"), exerciseName: "Squat" }, now: at("10:01:00"), clock,
  });
  assert.equal(text.title, "💪 Push B");
  assert.equal(text.body, "In progress. Tap to get back to your sets.");
});
