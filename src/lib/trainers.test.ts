import assert from "node:assert/strict";
import test from "node:test";
import { broadcastProblem, clientSummary, DEFAULT_TRAINER_SHARES, joinCode, joinLink, readShares, sortForAttention, type ClientDay } from "./trainers.ts";

// 2026-11-17 is a Tuesday. Plan: Mon / Wed / Fri, started a month ago.
const plan = { trainingDays: [1, 3, 5], trainingStartDate: "2026-10-12", sessionsPerWeek: 3 };
const day = (date: string, extra: Partial<ClientDay> = {}): ClientDay => ({ date, status: "completed", ...extra });

test("sharing: workouts on, the rest off by default; odd values fall back to the default", () => {
  assert.deepEqual(DEFAULT_TRAINER_SHARES, { workouts: true, body: false, checkins: false, missed: false });
  assert.deepEqual(readShares({ body: true, workouts: "yes", extra: true }), { workouts: true, body: true, checkins: false, missed: false });
  assert.deepEqual(readShares(null), DEFAULT_TRAINER_SHARES);
});

test("gym QR: the join link carries the trainer's code, and the code is read back from a link or typed text", () => {
  assert.equal(joinLink("https://rozfit-a.vercel.app/", "ABCD2345"), "https://rozfit-a.vercel.app/join/ABCD2345");
  assert.equal(joinCode("https://rozfit-a.vercel.app/join/abcd2345"), "ABCD2345");
  assert.equal(joinCode(" ABCD2345 "), "ABCD2345");
  assert.equal(joinCode("/join/ABC"), null);
  assert.equal(joinCode("ABCD2341"), null, "1 is not in the code alphabet");
});

test("client card: streak over planned days, this week, last workout; an unfinished today doesn't break the streak", () => {
  const days = [day("2026-11-06"), day("2026-11-09"), day("2026-11-11"), day("2026-11-13"), day("2026-11-16")];
  const summary = clientSummary(plan, days, "2026-11-17");
  assert.equal(summary.streak, 5); // Fri 6, Mon 9, Wed 11, Fri 13, Mon 16 (Wed 4 was missed); today (Tue) is a rest day
  assert.equal(summary.lastWorkout, "2026-11-16");
  assert.equal(summary.weekDone, 1);
  assert.equal(summary.weekGoal, 3);
  assert.deepEqual(summary.flags, []);
});

test("client card flags: pain, no workout for a week, missed days, soreness, low energy", () => {
  assert.deepEqual(clientSummary(plan, [day("2026-11-16", { pain: true })], "2026-11-17").flags.includes("pain"), true);
  assert.deepEqual(clientSummary(plan, [day("2026-11-02")], "2026-11-17").flags, ["inactive"]);
  // Trained Fri 13 but skipped Mon 16 and Wed 11 → 2 missed in the last 7 days.
  assert.deepEqual(clientSummary(plan, [day("2026-11-13")], "2026-11-17").flags, ["missed"]);
  assert.ok(clientSummary(plan, [day("2026-11-11"), day("2026-11-13"), day("2026-11-16", { soreness: 4 })], "2026-11-17").flags.includes("sore"));
  assert.ok(clientSummary(plan, [day("2026-11-11"), day("2026-11-13", { energy: 2 }), day("2026-11-16", { energy: 1 })], "2026-11-17").flags.includes("low-energy"));
  // A brand-new client isn't flagged as inactive.
  assert.deepEqual(clientSummary({ ...plan, trainingStartDate: "2026-11-16" }, [], "2026-11-17").flags, []);
});

test("dashboard order: pain first, then inactive, then the rest by name", () => {
  const card = (name: string, flags: Array<"pain" | "inactive" | "sore">) => ({ name, summary: { streak: 0, lastWorkout: null, weekDone: 0, weekGoal: 3, flags } });
  assert.deepEqual(sortForAttention([card("Zed", []), card("Amy", []), card("Bo", ["sore"]), card("Cy", ["inactive"]), card("Di", ["pain"])]).map((c) => c.name), ["Di", "Cy", "Bo", "Amy", "Zed"]);
});

test("broadcast text: 1–500 characters", () => {
  assert.equal(broadcastProblem("   "), "Write a message first.");
  assert.equal(broadcastProblem("x".repeat(501)), "Keep it under 500 characters.");
  assert.equal(broadcastProblem("Gym closed Sunday — do the home workout!"), null);
});

test("trainer specialities: trimmed, no duplicates, at most 6 of 30 characters", async () => {
  const { cleanSpecialties } = await import("./trainers.ts");
  assert.deepEqual(cleanSpecialties([" Strength ", "strength", "", "Yoga", "x".repeat(40), "A", "B", "C", "D"]), ["Strength", "Yoga", "x".repeat(30), "A", "B", "C"]);
});
