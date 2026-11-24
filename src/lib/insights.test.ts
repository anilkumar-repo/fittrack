import assert from "node:assert/strict";
import test from "node:test";
import { explainWorkout, findPlateaus, PLATEAU_RULES, workoutRecap } from "./insights.ts";
import { getExerciseDefinition } from "./templates.ts";
import type { Profile, WorkoutPlan, WorkoutSession } from "./types.ts";

// R12: plateaus, the post-workout recap and "why this workout", from logged sets only.

const profile = { id: "p", displayName: "P", experience: "intermediate", sessionsPerWeek: 3, trainingDays: [1, 3, 5], trainingStartDate: "2026-06-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 45,
  equipmentAvailability: "verified", availableEquipment: ["barbell", "bench", "dumbbells", "rack"] } as unknown as Profile;

/** One workout with one exercise: [reps, kg] working sets. */
function lift(date: string, exerciseId: string, sets: Array<[number, number]>, extra: Partial<WorkoutSession> = {}, substitutionName = ""): WorkoutSession {
  return {
    id: date, date, status: "completed", plan: { exercises: [] },
    exerciseLogs: [{ exerciseId, plannedSets: sets.length, plannedReps: 8, status: "completed", substitutionName, formQuality: "sound", notes: "",
      sets: sets.map(([reps, loadKg]) => ({ plannedReps: 8, actualReps: reps, loadKg, completed: true, extra: false })) }],
    ...extra,
  } as unknown as WorkoutSession;
}

const BENCH = "barbell_bench";
// Best 80 kg × 5 on Oct 20, then three sessions over the last 3 weeks that never beat it.
const stalled = [
  lift("2026-10-13", BENCH, [[5, 77.5]]),
  lift("2026-10-20", BENCH, [[5, 80]]),
  lift("2026-11-06", BENCH, [[5, 77.5]]),
  lift("2026-11-13", BENCH, [[5, 80]]),
  lift("2026-11-20", BENCH, [[4, 80]]),
];

test("a plateau: no new estimated 1-rep max for 3+ weeks, with the closest usable variation to try", () => {
  const [plateau] = findPlateaus(stalled, profile, "2026-11-24");
  assert.ok(plateau, "found");
  assert.equal(plateau.exerciseId, BENCH);
  assert.equal(plateau.bestOn, "2026-10-20");
  assert.equal(plateau.sessionsSince, 3);
  assert.ok(plateau.weeksStalled >= 3);
  assert.ok(plateau.variation, "a variation is suggested");
  assert.notEqual(plateau.variation?.id, BENCH);
  assert.ok(getExerciseDefinition(plateau.variation!.id)?.variationGroup === getExerciseDefinition(BENCH)?.variationGroup, "same movement");
  assert.match(plateau.advice, new RegExp(`for ${PLATEAU_RULES.variationWeeks} weeks`));
});

test("not a plateau: a new best, too few sessions, too short a stretch, stopped training it, or swapped sets", () => {
  assert.equal(findPlateaus([...stalled.slice(0, 4), lift("2026-11-20", BENCH, [[6, 80]])], profile, "2026-11-24").length, 0, "new best");
  assert.equal(findPlateaus(stalled.slice(0, 4), profile, "2026-11-24").length, 0, "only 2 recent sessions");
  assert.equal(findPlateaus([...stalled.slice(0, 2), lift("2026-11-18", BENCH, [[5, 75]]), lift("2026-11-20", BENCH, [[5, 75]]), lift("2026-11-22", BENCH, [[5, 75]])], profile, "2026-11-24").length, 0, "3 sessions within a few days");
  assert.equal(findPlateaus(stalled, profile, "2026-12-10").length, 0, "no sessions lately: not training it");
  assert.equal(findPlateaus(stalled.slice(0, 2), profile, "2026-11-24").length, 0, "no recent data");
  const swapped = stalled.map((session, index) => index >= 2 ? lift(session.date, BENCH, [[5, 70]], {}, "Machine chest press") : session);
  assert.equal(findPlateaus(swapped, profile, "2026-11-24").length, 0, "sets on a swapped-in exercise don't count");
  assert.equal(findPlateaus(stalled.map((session) => ({ ...session, sampleData: true })), profile, "2026-11-24").length, 0, "sample data ignored");
});

test("recap: new bests, compared with last time, and stalled lifts in this workout", () => {
  const sessions = [lift("2026-11-10", BENCH, [[5, 70], [5, 70]]), lift("2026-11-17", BENCH, [[5, 72.5], [5, 72.5]])];
  const recap = workoutRecap(sessions, "2026-11-17", profile);
  assert.ok(recap);
  assert.equal(recap.setsDone, 2);
  assert.equal(recap.volumeKg, 725);
  assert.equal(recap.records.length, 1);
  assert.match(recap.records[0], /72\.5 kg, your heaviest yet/);
  assert.equal(recap.compared[0].change, "up");
  assert.match(recap.headline, /^New best/);
  assert.equal(workoutRecap(sessions, "2026-11-12", profile), null, "nothing logged that day");
  const first = workoutRecap([lift("2026-11-10", BENCH, [[5, 70]])], "2026-11-10", profile);
  assert.equal(first?.records.length, 0, "a first-ever session isn't a 'record'");
  const flat = workoutRecap(stalled, "2026-11-20", profile);
  assert.equal(flat?.plateaus[0]?.exerciseId, BENCH, "the recap mentions the stalled lift");
  assert.equal(flat?.compared[0].change, "down");
});

test("why this workout: goal and week, lighter weeks, muscles and recovery, personal reasons, stalled lifts", () => {
  const bench = getExerciseDefinition(BENCH)!;
  const plan = {
    id: "x", date: "2026-11-24", focus: "Push", title: "Push day", description: "", durationMinutes: 45, exercises: [bench], isReturnSession: false,
    sessionNumber: 10, templateVersion: "t", ruleVersion: "r", phase: "foundation_2", sessionType: "training", sourceExerciseIds: [], originalExercises: [],
    generationReasons: ["Trainer rules revision 3 is snapshotted with this plan.", "Your check-in reports high soreness.", "High soreness lowers today’s planned set count."],
    goal: "muscle", weekNumber: 12, stage: "Strength", recoveryWeek: true,
  } as unknown as WorkoutPlan;
  const lines = explainWorkout(plan, "2026-11-24", stalled, profile, "2026-11-24");
  assert.ok(lines.length <= 5);
  assert.match(lines[0], /^Week 12 of your “Build muscle” plan \(Strength stage\)/);
  assert.ok(lines.some((line) => /lighter week/.test(line)));
  assert.ok(lines.some((line) => /^It trains .*chest/.test(line)));
  assert.ok(!lines.some((line) => /snapshotted/.test(line)), "internal rule notes stay out");
  const recovery = explainWorkout({ ...plan, sessionType: "recovery", recoveryWeek: false, goal: undefined, weekNumber: undefined } as WorkoutPlan, "2026-11-24", [], profile, "2026-11-24");
  assert.match(recovery[0], /next in your 3-day rotation/);
  assert.match(recovery[1], /recovery session/);
  assert.ok(explainWorkout({ ...plan, recoveryWeek: false, generationReasons: [] } as WorkoutPlan, "2026-11-24", stalled, profile, "2026-11-24").some((line) => /hasn't gone up/.test(line)), "stalled lift in today's plan");
});
