import assert from "node:assert/strict";
import test from "node:test";
import { CHECKIN_DEFAULTS, checkinMessage, checkinsEnabled, checkinWeek, parseCheckinSettings, setCheckinSettings } from "./checkin-service.ts";

// R11: weekly check-ins the person opts into. Counts only, no AI, nothing stored but the choice.

test("a check-in is due on the chosen day from the chosen hour, for the right week", () => {
  // 2026-11-23 is a Monday; 2026-11-29 is a Sunday.
  const monday = { weekday: 1, hour: 9 };
  assert.equal(checkinWeek("2026-11-23", 8, monday), null, "before the hour");
  assert.equal(checkinWeek("2026-11-23", 9, monday), "2026-11-16", "Monday sums up last week");
  assert.equal(checkinWeek("2026-11-23", 11, monday), "2026-11-16", "a missed hour still sends");
  assert.equal(checkinWeek("2026-11-23", 12, monday), null, "too late in the day");
  assert.equal(checkinWeek("2026-11-24", 9, monday), null, "wrong day");
  assert.equal(checkinWeek("2026-11-29", 19, { weekday: 0, hour: 19 }), "2026-11-23", "Sunday sums up the week ending today");
  assert.equal(checkinWeek("2026-11-28", 9, { weekday: 6, hour: 9 }), "2026-11-16", "Saturday sums up the last full week");
});

test("the message has counts only and opens that week's report", () => {
  const statusByDate = new Map([["2026-11-16", "completed"], ["2026-11-18", "skipped"], ["2026-11-20", "completed"], ["2026-11-25", "completed"]]);
  const base = { weekStart: "2026-11-16", localDate: "2026-11-23", trainingDays: [1, 3, 5], trainingStartDate: "2026-09-01", statusByDate };
  const message = checkinMessage(base);
  assert.equal(message.kind, "checkin");
  assert.equal(message.url, "/report?week=2026-11-16");
  assert.match(message.body, /^2 workouts done of 3 planned/);
  assert.match(checkinMessage({ ...base, statusByDate: new Map([["2026-11-16", "completed"], ["2026-11-18", "completed"], ["2026-11-20", "completed"]]) }).body, /^Every planned workout done \(3 of 3\)/);
  assert.match(checkinMessage({ ...base, statusByDate: new Map() }).body, /^A quiet week/);
  assert.match(checkinMessage({ ...base, trainingStartDate: "2026-12-01", statusByDate: new Map() }).body, /^Tap to see/, "plan not started yet");
  // Sunday check-in: the week so far, nothing from the future.
  assert.match(checkinMessage({ ...base, weekStart: "2026-11-23", localDate: "2026-11-23", statusByDate }).body, /^A quiet week/);
});

test("settings are parsed safely and checked before saving", async () => {
  assert.deepEqual(parseCheckinSettings(null), CHECKIN_DEFAULTS);
  assert.deepEqual(parseCheckinSettings({ enabled: true, weekday: 9, hour: 2, consented_at: "x" }), { enabled: true, weekday: 1, hour: 9, consentedAt: "x" });
  const calls: Array<Record<string, unknown>> = [];
  const client = { rpc: async (_fn: string, args: Record<string, unknown>) => { calls.push(args); return { data: { enabled: args.p_enabled, weekday: args.p_weekday, hour: args.p_hour, consented_at: "t" }, error: null }; } } as never;
  assert.ok("problem" in await setCheckinSettings(client, { enabled: true, weekday: 7, hour: 9 }));
  assert.ok("problem" in await setCheckinSettings(client, { enabled: "yes", weekday: 1, hour: 9 }));
  assert.ok("problem" in await setCheckinSettings(client, { enabled: true, weekday: 1, hour: 23 }));
  assert.equal(calls.length, 0, "bad input never reaches the database");
  assert.deepEqual(await setCheckinSettings(client, { enabled: true, weekday: 0, hour: 19 }), { enabled: true, weekday: 0, hour: 19, consentedAt: "t" });
});

test("check-ins are off by default", () => {
  assert.equal(checkinsEnabled({}), false);
  assert.equal(checkinsEnabled({ ROZI_CHECKINS: "on" }), true);
});
