import assert from "node:assert/strict";
import test from "node:test";
import { deadliftAllowedForPlan, generateWorkout, hasDuplicateExerciseIds, preserveManualExerciseChoices, preserveOriginalPlan } from "./planner.ts";
import { getExerciseDefinition } from "./templates.ts";
import { createExerciseLog } from "./workout-tracking.ts";
import type { CheckIn, ExerciseLog, Profile, WorkoutPlan, WorkoutSession } from "./types";
import { DEFAULT_TRAINER_RULE_SETTINGS } from "./trainer-rules.ts";

const profile: Profile = {
  id: "demo", displayName: "Maya", experience: "beginner", sessionsPerWeek: 3,
  trainingDays: [2, 4, 6], trainingStartDate: "2026-10-01", timeZone: "Asia/Kolkata", deadliftEnabled: false,
  trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [],
};
const readyCheckIn: CheckIn = { energy: 4, soreness: 1, pain: false, recovery: 4, discomfort: "", note: "" };

function session(date: string, overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  const plan = generateWorkout({ date, profile, sessions: [] }) as WorkoutPlan;
  return { id: `session-${date}`, date, status: "completed", plan, exerciseLogs: [], ...overrides };
}

function completedLog(exerciseId: string, reps: number, loadKg: number | null, formQuality: ExerciseLog["formQuality"] = "sound"): ExerciseLog {
  return {
    ...createExerciseLog(exerciseId, 2, reps),
    status: "completed",
    formQuality,
    sets: Array.from({ length: 2 }, () => ({ plannedReps: reps, actualReps: reps, loadKg, completed: true, extra: false })),
  };
}

function consistentHistory(): WorkoutSession[] {
  return ["2026-09-22", "2026-09-29", "2026-10-01", "2026-10-03", "2026-10-06", "2026-10-08", "2026-10-10", "2026-10-13", "2026-10-15", "2026-10-17", "2026-10-20", "2026-10-22", "2026-10-24"].map((date) => session(date));
}

test("generates only for a valid date on the approved weekly schedule", () => {
  assert.equal(generateWorkout({ date: "2026-10-28", profile, sessions: [] }), null);
  assert.equal(generateWorkout({ date: "2026-02-30", profile, sessions: [] }), null);
  assert.equal(generateWorkout({ date: "2026-10-27", profile, sessions: [] })?.focus, "Foundation A");
});

test("prevents duplicate exercise IDs and movement patterns within one session", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] });
  assert.ok(plan);
  assert.equal(hasDuplicateExerciseIds(plan), false);
  const patterns = plan.exercises.map((exercise) => exercise.movementPattern);
  assert.equal(new Set(patterns).size, patterns.length);
});

test("never automatically introduces any deadlift variation, even after the foundation phase", () => {
  const oldProfile = { ...profile, trainingStartDate: "2026-08-01", deadliftEnabled: false };
  const plan = generateWorkout({ date: "2026-10-27", profile: oldProfile, sessions: consistentHistory() });
  assert.ok(plan);
  assert.equal(plan.phase, "foundation_2");
  assert.equal(plan.focus, "Foundation B");
  assert.equal(deadliftAllowedForPlan(oldProfile), false);
  assert.equal(plan.exercises.some((exercise) => /deadlift|rdl/i.test(`${exercise.id} ${exercise.name}`)), false);
});

test("only the explicit trainer approval flag can select the optional hinge and preserves the source template", () => {
  const approvedProfile: Profile = {
    ...profile,
    deadliftEnabled: true,
    equipmentAvailability: "verified",
    availableEquipment: ["dumbbells", "bench", "cable_machine", "leg_press", "leg_curl_machine", "rack", "mat"],
  };
  const plan = generateWorkout({ date: "2026-10-29", profile: approvedProfile, sessions: [session("2026-10-27")] });
  assert.ok(plan);
  assert.equal(plan.exercises.some((exercise) => exercise.id === "dumbbell_rdl"), true);
  assert.ok(plan.originalExercises.some((exercise) => exercise.id === "hamstring_curl"));
  assert.equal(plan.generationReasons.some((reason) => reason.includes("trainer-approved")), true);
});

test("uses no-equipment alternatives when equipment is unknown", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] });
  assert.ok(plan);
  assert.ok(plan.exercises.some((exercise) => exercise.id === "bodyweight_squat" && exercise.substitutedFor === "goblet_squat"));
  assert.ok(plan.exercises.every((exercise) => (exercise.requiredEquipment ?? []).length === 0));
  assert.ok(plan.generationReasons.some((reason) => reason.includes("unconfirmed")));
});

test("uses only confirmed equipment and explains an equipment substitution", () => {
  const known: Profile = { ...profile, equipmentAvailability: "verified", availableEquipment: ["dumbbells"] };
  const plan = generateWorkout({ date: "2026-10-27", profile: known, sessions: [] });
  assert.ok(plan);
  assert.ok(plan.exercises.some((exercise) => exercise.id === "dumbbell_bench" && exercise.selectionReason?.includes("not listed as available")) === false);
  const bench = plan.exercises.find((exercise) => exercise.substitutedFor === "dumbbell_bench");
  assert.equal(bench?.id, "wall_pushup");
  assert.match(bench?.selectionReason ?? "", /not listed as available/);
  assert.ok(plan.exercises.filter((exercise) => (exercise.requiredEquipment ?? []).length > 0).every((exercise) => (exercise.requiredEquipment ?? []).every((key) => known.availableEquipment.includes(key))));
});

test("snapshots bounded trainer template, progression, recovery, and equipment rules in the plan", () => {
  const settings = structuredClone(DEFAULT_TRAINER_RULE_SETTINGS);
  settings.exerciseTemplates = [{ exerciseId: "goblet_squat", sets: 3, minReps: 9, maxReps: 13, restSeconds: 120 }];
  settings.progression.repIncrement = 2;
  settings.equipment = { mode: "verified", availableEquipment: ["dumbbells"] };
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [], trainerRuleSettings: settings, trainerRuleRevision: 7 });
  assert.ok(plan);
  const squat = plan.exercises.find((exercise) => exercise.id === "goblet_squat");
  assert.equal(squat?.reps, "9–13");
  assert.equal(squat?.restSeconds, 120);
  assert.equal(plan.trainerRuleRevision, 7);
  assert.deepEqual(plan.trainerRuleSettings, settings);
  assert.ok(plan.generationReasons.some((reason) => reason.includes("trainer template override")));
});

test("cannot bypass the deadlift restriction via trainer template settings", () => {
  const settings = structuredClone(DEFAULT_TRAINER_RULE_SETTINGS);
  settings.exerciseTemplates = [{ exerciseId: "dumbbell_rdl", sets: 2, minReps: 8, maxReps: 10, restSeconds: 90 }];
  const plan = generateWorkout({ date: "2026-10-29", profile, sessions: [session("2026-10-27")], trainerRuleSettings: settings });
  assert.ok(plan);
  assert.equal(plan.exercises.some((exercise) => /deadlift|\brdl\b/i.test(`${exercise.id} ${exercise.name}`)), false);
});

test("trainer recovery settings may add caution but pain remains an unconditional recovery guardrail", () => {
  const settings = structuredClone(DEFAULT_TRAINER_RULE_SETTINGS);
  settings.recovery.stopEnergyThreshold = 2;
  const tired = generateWorkout({ date: "2026-10-27", profile, sessions: [], checkIn: { ...readyCheckIn, energy: 2 }, trainerRuleSettings: settings });
  assert.equal(tired?.sessionType, "recovery");
  const pain = generateWorkout({ date: "2026-10-27", profile, sessions: [], checkIn: { ...readyCheckIn, pain: true }, trainerRuleSettings: DEFAULT_TRAINER_RULE_SETTINGS });
  assert.equal(pain?.sessionType, "recovery");
  assert.ok(pain?.generationReasons.some((reason) => reason.toLowerCase().includes("pain")));
});

test("replaces a recently skipped movement and retains the original plan reference", () => {
  const skippedLog = {
    ...createExerciseLog("bodyweight_squat", 2, 8),
    status: "skipped" as const,
    sets: createExerciseLog("bodyweight_squat", 2, 8).sets.map((set) => ({ ...set, completed: false })),
  };
  const last = session("2026-10-24", { exerciseLogs: [skippedLog] });
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [last] });
  assert.ok(plan);
  const replacement = plan.exercises.find((exercise) => exercise.substitutedFor === "leg_press");
  assert.ok(replacement);
  assert.notEqual(replacement.id, "bodyweight_squat");
  assert.match(replacement.selectionReason ?? "", /skipped in the most recent session/);
  assert.ok(plan.originalExercises.some((exercise) => exercise.id === "leg_press"));
});

test("adds a rep before any load increase when prior form is sound and pain-free", () => {
  const first = session("2026-10-20", { checkIn: readyCheckIn, exerciseLogs: [completedLog("bodyweight_squat", 8, null)] });
  const middle = session("2026-10-22");
  const recent = session("2026-10-24");
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [first, middle, recent] });
  assert.ok(plan);
  const squat = plan.exercises.find((exercise) => exercise.substitutedFor === "goblet_squat");
  assert.equal(squat?.reps, "9");
  assert.equal(squat?.progressionAction, "hold_load_add_reps");
  assert.match(squat?.progressionAdvice ?? "", /load steady/);
});

test("recommends only a small available load step after the top of the range with sound form", () => {
  const equipped: Profile = { ...profile, equipmentAvailability: "verified", availableEquipment: ["dumbbells", "bench", "cable_machine"] };
  const first = generateWorkout({ date: "2026-10-20", profile: equipped, sessions: [] }) as WorkoutPlan;
  const priorLog = completedLog("goblet_squat", 10, 12.5);
  const firstDone = session("2026-10-20", { plan: first, exerciseLogs: [priorLog], checkIn: readyCheckIn });
  const plan = generateWorkout({ date: "2026-10-27", profile: equipped, sessions: [firstDone, session("2026-10-22"), session("2026-10-24")] });
  assert.ok(plan);
  const squat = plan.exercises.find((exercise) => exercise.id === "goblet_squat");
  assert.equal(squat?.progressionAction, "consider_small_load_step");
  assert.match(squat?.progressionAdvice ?? "", /top of the rep range/);
  assert.match(squat?.loadGuidance ?? "", /no numeric working weight is assumed/);
});

test("does not progress if form was not confirmed or if the previous session reported pain", () => {
  const prior = session("2026-10-20", { checkIn: readyCheckIn, exerciseLogs: [completedLog("bodyweight_squat", 10, null, "needs_practice")] });
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [prior, session("2026-10-22"), session("2026-10-24")] });
  assert.ok(plan);
  const squat = plan.exercises.find((exercise) => exercise.substitutedFor === "goblet_squat");
  assert.equal(squat?.progressionAction, "repeat_or_reduce");

  const painful = { ...prior, checkIn: { ...readyCheckIn, pain: true } };
  const cautious = generateWorkout({ date: "2026-10-27", profile, sessions: [painful] });
  assert.equal(cautious?.sessionType, "recovery");
});

test("turns a current pain report into recovery, never a harder prescription", () => {
  const plan = generateWorkout({
    date: "2026-10-27", profile, sessions: [],
    checkIn: { energy: 5, soreness: 1, pain: true, recovery: 5, discomfort: "new knee pain", note: "" },
  });
  assert.equal(plan?.sessionType, "recovery");
  assert.equal(plan?.focus, "Recovery");
  assert.ok(plan?.generationReasons.some((reason) => reason.includes("new, severe")));
  assert.ok(plan?.exercises.every((exercise) => exercise.progressionAction === "recovery"));
});

test("keeps the saved template visible when the check-in adapts the workout to recovery", () => {
  const savedPlan = generateWorkout({ date: "2026-10-27", profile, sessions: [] });
  const recovery = generateWorkout({ date: "2026-10-27", profile, sessions: [], checkIn: { ...readyCheckIn, pain: true } });
  assert.ok(savedPlan && recovery);
  const adapted = preserveOriginalPlan(recovery, savedPlan);
  assert.equal(adapted.sessionType, "recovery");
  assert.deepEqual(adapted.sourceExerciseIds, savedPlan.sourceExerciseIds);
  assert.deepEqual(adapted.originalExercises, savedPlan.originalExercises);
  assert.ok(adapted.generationReasons.some((reason) => reason.includes("original template remains")));
});

test("keeps a selected safe library alternative through a check-in refresh without replacing the source template", () => {
  const withChair: Profile = { ...profile, equipmentAvailability: "verified", availableEquipment: ["chair"] };
  const saved = generateWorkout({ date: "2026-10-27", profile: withChair, sessions: [] });
  const adjusted = generateWorkout({
    date: "2026-10-27", profile: withChair, sessions: [],
    checkIn: { ...readyCheckIn, energy: 2, soreness: 4, recovery: 2 },
  });
  const chairAlternative = getExerciseDefinition("sit_to_stand");
  assert.ok(saved && adjusted && chairAlternative);
  const originalSquat = saved.exercises.find((exercise) => exercise.substitutedFor === "goblet_squat");
  assert.ok(originalSquat);
  const selected = {
    ...chairAlternative,
    sets: originalSquat.sets,
    reps: originalSquat.reps,
    restSeconds: originalSquat.restSeconds,
    substitutedFor: "goblet_squat",
    manualOverride: true,
  };
  const savedWithChoice = {
    ...saved,
    exercises: saved.exercises.map((exercise) => exercise.id === originalSquat.id ? selected : exercise),
  };
  const result = preserveManualExerciseChoices(adjusted, savedWithChoice, withChair);
  const kept = result.exercises.find((exercise) => exercise.manualOverride);
  assert.equal(kept?.id, "sit_to_stand");
  assert.equal(kept?.sets, 1);
  assert.ok(result.originalExercises.some((exercise) => exercise.id === "goblet_squat"));
  assert.ok(result.generationReasons.some((reason) => reason.includes("selected alternative")));
});

test("reduces sets for low energy or high soreness", () => {
  const plan = generateWorkout({
    date: "2026-10-27", profile, sessions: [],
    checkIn: { energy: 2, soreness: 4, pain: false, recovery: 2, discomfort: "", note: "" },
  });
  assert.equal(plan?.sessionType, "training");
  assert.equal(plan?.exercises[0].sets, 1);
  assert.ok(plan?.generationReasons.some((reason) => reason.includes("set count")));
});

test("returns a low-volume recovery plan for very low readiness", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [], checkIn: { ...readyCheckIn, energy: 1, recovery: 1 } });
  assert.equal(plan?.sessionType, "recovery");
  assert.equal(plan?.exercises.some((exercise) => exercise.category === "strength"), false);
});

test("uses a lighter return plan after a long break without stacking missed sessions", () => {
  const old = session("2026-10-10");
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [old] });
  assert.ok(plan);
  assert.equal(plan.isReturnSession, true);
  assert.equal(plan.phase, "return");
  assert.equal(plan.focus, "Return to training");
  assert.equal(plan.exercises[0].sets, 1);
  assert.ok(plan.generationReasons.some((reason) => reason.includes("missed days are not added")));
});

test("avoids repeating movement patterns on consecutive scheduled days", () => {
  const consecutiveProfile = { ...profile, trainingDays: [2, 3], sessionsPerWeek: 2 };
  const previous = session("2026-10-27", { plan: generateWorkout({ date: "2026-10-27", profile: consecutiveProfile, sessions: [] }) as WorkoutPlan });
  const plan = generateWorkout({ date: "2026-10-28", profile: consecutiveProfile, sessions: [previous] });
  assert.ok(plan);
  const priorPatterns = new Set(previous.plan.exercises.map((exercise) => exercise.movementPattern));
  assert.ok(plan.exercises.every((exercise) => !priorPatterns.has(exercise.movementPattern)));
});

test("changes the training phase only after the consistency threshold, never the deadlift rule", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile: { ...profile, trainingStartDate: "2026-08-01" }, sessions: consistentHistory().slice(0, 11) });
  assert.equal(plan?.phase, "foundation_1");
  assert.equal(deadliftAllowedForPlan(profile), false);
});

test("missing history never invents a working load", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] });
  assert.ok(plan);
  const exercise = plan.exercises[0];
  assert.equal(exercise.progressionAction, "choose_comfortable_load");
  assert.match(exercise.loadGuidance ?? "", /Choose a comfortable load/);
  assert.doesNotMatch(exercise.loadGuidance ?? "", /\d+(?:\.\d+)?\s*kg/i);
});

test("keeps generated plans deterministic for the same date, profile, history, and check-in", () => {
  const sessions = [session("2026-10-24", { checkIn: readyCheckIn })];
  const first = generateWorkout({ date: "2026-10-27", profile, sessions, checkIn: readyCheckIn });
  const second = generateWorkout({ date: "2026-10-27", profile, sessions, checkIn: readyCheckIn });
  assert.deepEqual(second, first);
});
