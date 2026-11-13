import assert from "node:assert/strict";
import test from "node:test";
import { checkLevelChange, levelProgress, programWeek } from "./levels.ts";
import { generateWorkout } from "./planner.ts";
import type { ExperienceLevel, Profile, WorkoutPlan, WorkoutSession } from "./types";

// Tuesday, Thursday, Saturday training from Thursday 2026-10-01.
const base: Profile = {
  id: "demo", displayName: "Maya", experience: "beginner", sessionsPerWeek: 3,
  trainingDays: [2, 4, 6], trainingStartDate: "2026-10-01", timeZone: "Asia/Kolkata", deadliftEnabled: false,
  trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [], goal: "muscle",
};
const at = (experience: ExperienceLevel, extra: Partial<Profile> = {}): Profile => ({ ...base, experience, ...extra });
const plan = { exercises: [] } as unknown as WorkoutSession["plan"];
const done = (date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({ id: date, date, status: "completed", plan, exerciseLogs: [], ...extra });

/** Every training day (Tue/Thu/Sat) from `from` up to and including `to`, all completed. */
function steady(from: string, to: string): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  for (let time = Date.parse(`${from}T12:00:00Z`); time <= Date.parse(`${to}T12:00:00Z`); time += 86_400_000) {
    const date = new Date(time);
    if ([2, 4, 6].includes(date.getUTCDay())) sessions.push(done(date.toISOString().slice(0, 10)));
  }
  return sessions;
}

test("each level starts the 52-week program at its own stage", () => {
  assert.equal(programWeek(at("beginner"), "2026-10-01"), 1);
  assert.equal(programWeek(at("intermediate"), "2026-10-01"), 13);
  assert.equal(programWeek(at("advanced"), "2026-10-01"), 25);
  assert.equal(programWeek(at("pro"), "2026-10-01"), 37);
  // Weeks count from the day the level was reached, and wrap after week 52.
  assert.equal(programWeek(at("intermediate", { levelSince: "2026-12-01" }), "2026-12-15"), 15);
  assert.equal(programWeek(at("pro"), "2027-01-20"), 52);
  assert.equal(programWeek(at("pro"), "2027-01-21"), 1);
});

test("higher levels get more sets on the main exercises; beginners keep gentle volume", () => {
  const date = "2026-10-06";
  const sets = (level: ExperienceLevel) => (generateWorkout({ date, profile: at(level), sessions: [] }) as WorkoutPlan).exercises.map((exercise) => exercise.sets);
  const beginner = sets("beginner");
  const advanced = sets("advanced");
  const pro = sets("pro");
  assert.equal(advanced[0], beginner[0] + 1);
  assert.equal(advanced[1], beginner[1] + 1);
  assert.equal(advanced[2], beginner[2]);
  assert.equal(pro[2], beginner[2] + 1);
  const intermediatePlan = generateWorkout({ date, profile: at("intermediate"), sessions: [] }) as WorkoutPlan;
  assert.equal(intermediatePlan.level, "intermediate");
  assert.equal(intermediatePlan.weekNumber, 13);
  assert.match(intermediatePlan.stage ?? "", /Strength and size/);
});

test("a general-goal intermediate skips the two-set foundation weeks", () => {
  const date = "2026-10-06";
  const general = (level: ExperienceLevel) => generateWorkout({ date, profile: at(level, { goal: "general" }), sessions: [] }) as WorkoutPlan;
  assert.equal(general("beginner").phase, "foundation_1");
  assert.equal(general("intermediate").phase, "foundation_2");
  assert.ok(Math.max(...general("intermediate").exercises.map((exercise) => exercise.sets)) >= Math.max(...general("beginner").exercises.map((exercise) => exercise.sets)));
});

test("a beginner moves up after 8 steady weeks and 20 workouts, not before", () => {
  const sessions = steady("2026-10-01", "2026-11-26");
  assert.equal(checkLevelChange(at("beginner"), sessions, "2026-11-20"), null);
  const change = checkLevelChange(at("beginner"), sessions, "2026-11-26");
  assert.equal(change?.direction, "up");
  assert.equal(change?.to, "intermediate");
});

test("missing too many workouts lately or recent pain holds the level", () => {
  const sessions = steady("2026-10-01", "2026-11-26");
  const patchy = sessions.filter((session) => session.date < "2026-11-01" || session.date.endsWith("6"));
  assert.equal(checkLevelChange(at("beginner"), patchy, "2026-11-26"), null);
  const sore = sessions.map((session) => session.date === "2026-11-24" ? { ...session, review: { effort: 6, energyAfter: 3, discomfort: true, note: "" } } as WorkoutSession : session);
  assert.equal(checkLevelChange(at("beginner"), sore, "2026-11-26"), null);
  assert.equal(levelProgress(at("beginner"), sore, "2026-11-26").requirements.find((item) => item.label.startsWith("Pain-free"))?.met, false);
});

test("six weeks without a workout steps down one level, once", () => {
  const sessions = steady("2026-10-01", "2026-10-15");
  const change = checkLevelChange(at("advanced"), sessions, "2026-12-01");
  assert.equal(change?.direction, "down");
  assert.equal(change?.to, "intermediate");
  // Saved with today's date, the new level does not drop again the next day.
  assert.equal(checkLevelChange(at("intermediate", { levelSince: "2026-12-01" }), sessions, "2026-12-02"), null);
  assert.equal(checkLevelChange(at("beginner"), [], "2027-03-01"), null);
});

test("pro is the top level", () => {
  const progress = levelProgress(at("pro"), [], "2026-11-01");
  assert.equal(progress.next, null);
  assert.equal(progress.share, 1);
});
