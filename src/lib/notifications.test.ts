import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PUSH_PREFS, dueNotifications, localDateAndHour, nudgeMessage, type ScheduleInput } from "./notifications.ts";
import { motivationFor } from "./motivation.ts";

// Tue/Thu/Sat training. 2026-11-12 is a Thursday. 07:30 in India is 02:00 UTC.
const at = (iso: string) => new Date(iso);
const base = (overrides: Partial<ScheduleInput> = {}): ScheduleInput => ({
  prefs: DEFAULT_PUSH_PREFS, timeZone: "Asia/Kolkata", trainingDays: [2, 4, 6], trainingStartDate: "2026-11-01",
  statusByDate: new Map(), lastMorningOn: null, lastEveningOn: null, now: at("2026-11-12T02:00:00Z"), ...overrides,
});

test("local date and hour follow the person's time zone", () => {
  assert.deepEqual(localDateAndHour("Asia/Kolkata", at("2026-11-12T02:00:00Z")), { date: "2026-11-12", hour: 7 });
  assert.deepEqual(localDateAndHour("America/New_York", at("2026-11-12T02:00:00Z")), { date: "2026-11-11", hour: 21 });
  assert.deepEqual(localDateAndHour("Not/AZone", at("2026-11-12T02:00:00Z")), { date: "2026-11-12", hour: 2 });
});

test("morning brings the day's motivation line once, at the chosen hour", () => {
  const [morning] = dueNotifications(base({ statusByDate: new Map([["2026-11-10", "completed"]]) }));
  assert.equal(morning.kind, "morning");
  assert.equal(morning.title, "Good morning! Workout day ☀️");
  assert.equal(morning.body, motivationFor("2026-11-12"));
  assert.deepEqual(dueNotifications(base({ lastMorningOn: "2026-11-12" })), []);
  assert.deepEqual(dueNotifications(base({ now: at("2026-11-12T03:00:00Z") })), []); // 8:30, not the chosen hour
  assert.deepEqual(dueNotifications(base({ prefs: { ...DEFAULT_PUSH_PREFS, morning: false } })), []);
});

test("a missed workout yesterday changes the morning message", () => {
  // Friday morning after an unlogged Thursday.
  const [morning] = dueNotifications(base({ now: at("2026-11-13T02:00:00Z") }));
  assert.equal(morning.title, "You missed yesterday’s workout");
  const [fine] = dueNotifications(base({ now: at("2026-11-13T02:00:00Z"), statusByDate: new Map([["2026-11-12", "skipped"]]) }));
  assert.equal(fine.title, "Good morning! Rest day ☀️");
});

test("evening reminder only on unlogged training days", () => {
  const evening = at("2026-11-12T14:00:00Z"); // 19:30 Thursday
  assert.equal(dueNotifications(base({ now: evening }))[0].title, "Did you train today? 🔥");
  assert.equal(dueNotifications(base({ now: evening, statusByDate: new Map([["2026-11-12", "in_progress"]]) }))[0].title, "Finish today’s log 📝");
  assert.deepEqual(dueNotifications(base({ now: evening, statusByDate: new Map([["2026-11-12", "completed"]]) })), []);
  assert.deepEqual(dueNotifications(base({ now: at("2026-11-13T14:00:00Z") })), []); // Friday is a rest day
  assert.deepEqual(dueNotifications(base({ now: evening, lastEveningOn: "2026-11-12" })), []);
});

test("nudges name the friend", () => {
  assert.deepEqual(nudgeMessage("Asha", ""), { kind: "nudge", title: "Asha nudged you 👋", body: "Time to train!", url: "/" });
});
