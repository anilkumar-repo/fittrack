import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState } from "../demo-data.ts";
import { getExerciseDefinition } from "../templates.ts";
import type { Profile, WorkoutSession } from "../types";
import { findExercise, muscleOf, resolveDay, ROZI_TOOLS, roziContext, runRoziTool, type RoziContext } from "./tools.ts";

const TODAY = "2026-11-18"; // a Wednesday

/** A completed session of real library exercises: [id, sets, kg]. */
function session(date: string, moves: Array<[string, number, number | null]>, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s-${date}`, date, status: "completed",
    plan: { title: `Workout ${date}`, focus: "Foundation A", durationMinutes: 40, exercises: moves.map(([id]) => getExerciseDefinition(id)!), generationReasons: [] },
    exerciseLogs: moves.map(([id, sets, kg]) => ({ exerciseId: id, plannedSets: sets, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
      sets: Array.from({ length: sets }, () => ({ plannedReps: 8, actualReps: 8, loadKg: kg, completed: true, extra: false })) })),
    ...extra,
  } as unknown as WorkoutSession;
}

const profile: Profile = {
  ...createDemoState().profile,
  id: "user-secret-id-123", displayName: "Secret Person", trainingDays: [1, 3, 5], trainingStartDate: "2026-10-01",
  sessionsPerWeek: 3, heightCm: 180, birthYear: 1994, experience: "intermediate", goal: "muscle",
  equipmentAvailability: "verified", availableEquipment: ["dumbbells", "bench", "barbell", "rack", "cable", "machines", "pullup_bar"] as Profile["availableEquipment"],
  deadliftEnabled: false,
};

const sessions = [
  session("2026-11-09", [["barbell_bench", 3, 40]]),
  session("2026-11-12", [["back_squat", 3, 60]]),
  session("2026-11-16", [["barbell_bench", 3, 42.5]]),
  session("2026-11-17", [["lat_pulldown", 3, 35]], { status: "skipped" } as Partial<WorkoutSession>),
  session("2026-11-10", [["pushup", 2, null]], { sampleData: true } as Partial<WorkoutSession>),
];

const ctx: RoziContext = roziContext({
  profile, sessions,
  bodyWeightEntries: [{ id: "w2", measuredOn: "2026-11-15", weightKg: 79.2 }, { id: "w1", measuredOn: "2026-10-15", weightKg: 81 }] as never,
  trainerRuleSettings: undefined, trainerRuleRevision: 1,
}, TODAY, 18);

test("the context drops sample data and sorts body weight oldest first", () => {
  assert.equal(ctx.sessions.length, 4);
  assert.deepEqual(ctx.bodyWeightEntries.map((entry) => entry.measuredOn), ["2026-10-15", "2026-11-15"]);
});

test("words the user types are understood: days, exercises and muscles", () => {
  assert.equal(resolveDay("tomorrow", TODAY), "2026-11-19");
  assert.equal(resolveDay("yesterday", TODAY), "2026-11-17");
  assert.equal(resolveDay("2026-11-02", TODAY), "2026-11-02");
  assert.equal(resolveDay("2031-01-01", TODAY), TODAY, "far future falls back to today");
  assert.equal(resolveDay("2026-02-31", TODAY), TODAY, "impossible date falls back to today");
  assert.match(findExercise("squats")!.name, /squat/i);
  assert.match(findExercise("How to do the bench press?")!.name, /bench press/i);
  assert.equal(findExercise("plank")!.name, "Plank", "exact name wins over Incline plank");
  assert.match(findExercise("RDL")!.name, /romanian deadlift/i);
  assert.match(findExercise("pull ups")?.name ?? "pull-up", /pull-?up/i);
  assert.equal(findExercise("underwater basket weaving"), null, "never a random exercise");
  assert.equal(findExercise("x"), null);
  assert.equal(muscleOf("my pecs"), "chest");
  assert.equal(muscleOf("quads"), "legs");
  assert.equal(muscleOf("abs"), "core");
  assert.equal(muscleOf("biceps"), "arms");
  assert.equal(muscleOf("toes"), null);
});

test("history counts only what was really logged, and filters by muscle", () => {
  const week = runRoziTool("get_workout_history", { period: "this_week" }, ctx).result as Record<string, unknown>;
  assert.equal(week.from, "2026-11-16");
  assert.equal(week.completed, 1);
  assert.equal(week.skipped, 1, "a skipped day is reported as skipped, not done");
  const historyTool = ROZI_TOOLS.find((tool) => tool.name === "get_workout_history")!;
  assert.match(JSON.stringify(historyTool.parameters), /this_month = from the 1st of the CURRENT month/, "periods are spelled out (benchmark: models picked last_month for 'this month')");
  assert.equal(week.summary, "From Monday, November 16 to Wednesday, November 18: 1 workout completed, 0 partly done, 1 SKIPPED (missed).", "the counts in one plain sentence");
  const last = runRoziTool("get_workout_history", { period: "last_workout" }, ctx).result as { lastWorkout: { date: string; setsDone: number }; daysAgo: number };
  assert.equal(last.lastWorkout.date, "2026-11-16");
  assert.equal(last.lastWorkout.setsDone, 3);
  assert.equal(last.daysAgo, 2);
  const legs = runRoziTool("get_workout_history", { period: "last_30_days", muscle: "legs" }, ctx).result as { workouts: Array<{ date: string }>; completed: number };
  assert.deepEqual(legs.workouts.map((item) => item.date), ["2026-11-12"]);
  const month = runRoziTool("get_workout_history", { period: "this_month" }, ctx).result as { completed: number };
  assert.equal(month.completed, 3, "sample data isn't counted");
});

test("progress for one exercise uses the real logged loads", () => {
  const outcome = runRoziTool("get_progress", { exercise: "bench press" }, ctx);
  const result = outcome.result as { exercise: string; history: Array<{ heaviestKg: number }>; heaviestChangeKg: number; bestSet: { kg: number } };
  assert.match(result.exercise, /bench/i);
  assert.deepEqual(result.history.map((item) => item.heaviestKg), [40, 42.5]);
  assert.equal(result.heaviestChangeKg, 2.5);
  assert.equal(result.bestSet.kg, 42.5);
  assert.equal(outcome.card?.type, "progress");
  const none = runRoziTool("get_progress", { exercise: "lateral raise" }, ctx).result as { logged: boolean };
  assert.equal(none.logged, false, "never invents progress for an exercise that isn't logged");
  const overall = runRoziTool("get_progress", {}, ctx).result as { workoutsCompleted: number; bestSets: Array<{ kg: number }>; biggestImprovements: Array<{ exercise: string; changeKg: number; fromKg: number; toKg: number }> };
  assert.equal(overall.workoutsCompleted, 3);
  assert.equal(overall.bestSets[0].kg, 60);
  assert.equal(overall.biggestImprovements.length, 1, "only exercises logged twice with weights");
  assert.match(overall.biggestImprovements[0].exercise, /bench/i);
  assert.deepEqual([overall.biggestImprovements[0].fromKg, overall.biggestImprovements[0].toKg, overall.biggestImprovements[0].changeKg], [40, 42.5, 2.5]);
});

test("recovery comes from the recovery module", () => {
  const result = runRoziTool("get_recovery", { muscle: "chest" }, ctx).result as { groups: Array<{ group: string; lastTrained: string }>; totalGroups: number };
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].group, "Chest");
  assert.equal(result.groups[0].lastTrained, "2026-11-16");
  assert.equal(result.totalGroups, 6);
});

test("a day's workout comes from the planner; rest days say so", () => {
  const today = runRoziTool("get_workout_for_day", { day: "today" }, ctx);
  const result = today.result as { restDay: boolean; exercises: unknown[]; isToday: boolean };
  assert.equal(result.isToday, true);
  assert.equal(result.restDay, false, "Wednesday is a training day");
  assert.ok(result.exercises.length > 0);
  assert.equal(today.card?.type, "workout");
  const thursday = runRoziTool("get_workout_for_day", { day: "tomorrow" }, ctx).result as { restDay: boolean; nextTrainingDay: string };
  assert.equal(thursday.restDay, true);
  assert.equal(thursday.nextTrainingDay, "2026-11-20");
  const past = runRoziTool("get_workout_for_day", { day: "2026-11-16" }, ctx).result as { status: string; setsDone: number; statusSentence: string };
  assert.equal(past.status, "completed");
  assert.equal(past.setsDone, 3);
  assert.match(past.statusSentence, /already FINISHED this workout on Monday, November 16 \(3 sets done\)/);
  assert.match((result as unknown as { statusSentence: string }).statusSentence, /planned today and not started yet/);
  const skipped = runRoziTool("get_workout_for_day", { day: "2026-11-17" }, ctx).result as { statusSentence: string };
  assert.match(skipped.statusSentence, /SKIPPED/);
});

test("exercise info: steps, alternatives and the deadlift rule", () => {
  const squat = runRoziTool("get_exercise_info", { exercise: "squat" }, ctx).result as { found: boolean; steps: string[]; allowedForYou: boolean; lastTime: { heaviestKg: number } | null };
  assert.equal(squat.found, true);
  assert.ok(squat.steps.length > 0);
  assert.equal(squat.allowedForYou, true);
  const missing = runRoziTool("get_exercise_info", { exercise: "underwater basket weaving" }, ctx).result as { found: boolean };
  assert.equal(missing.found, false);
  const alternatives = (runRoziTool("get_exercise_info", { exercise: "bench press" }, ctx).result as { alternatives: Array<{ name: string }> }).alternatives;
  assert.ok(alternatives.every((item) => !/deadlift/i.test(item.name)));
});

test("streak, week, body, badges, stretch, plan and profile all answer from the existing modules", () => {
  assert.equal(typeof (runRoziTool("get_streak", {}, ctx).result as { current: number }).current, "number");
  const week = runRoziTool("get_weekly_report", { week: "last" }, ctx).result as { from: string; completed: number };
  assert.equal(week.from, "2026-11-09");
  assert.equal(week.completed, 2);
  const body = runRoziTool("get_body_stats", {}, ctx).result as { latestWeightKg: number; changeKg: number; bmi: number };
  assert.equal(body.latestWeightKg, 79.2);
  assert.equal(body.changeKg, -1.8);
  assert.equal(body.bmi, 24.4);
  assert.ok(Array.isArray((runRoziTool("get_achievements", {}, ctx).result as { earned: string[] }).earned));
  assert.ok((runRoziTool("get_mobility_suggestion", {}, ctx).result as { routine: string }).routine);
  const plan = runRoziTool("plan_custom_workout", { area: "legs", minutes: 30 }, ctx);
  assert.equal((plan.result as { planned: boolean }).planned, true);
  assert.equal(plan.card?.type, "plan");
  const me = runRoziTool("get_my_profile", {}, ctx).result as { age: number; trainingDays: string[] };
  assert.equal(me.age, 32);
  assert.deepEqual(me.trainingDays, ["Monday", "Wednesday", "Friday"]);
});

test("nothing personal leaves through any tool: no name, email or account id", () => {
  const args: Record<string, Record<string, unknown>> = { get_progress: { exercise: "bench" }, get_exercise_info: { exercise: "squat" }, plan_custom_workout: { area: "chest" } };
  for (const tool of ROZI_TOOLS) {
    const outcome = JSON.stringify(runRoziTool(tool.name, args[tool.name] ?? {}, ctx));
    assert.ok(!outcome.includes("Secret Person"), `${tool.name} leaks the name`);
    assert.ok(!outcome.includes("user-secret-id-123"), `${tool.name} leaks the account id`);
    assert.ok(!/@/.test(outcome), `${tool.name} contains an @`);
  }
});

test("odd model input never crashes a tool", () => {
  assert.match(String(runRoziTool("delete_everything", {}, ctx).result.error), /Unknown tool/);
  assert.doesNotThrow(() => runRoziTool("get_workout_history", { period: 42, muscle: { x: 1 } }, ctx));
  assert.doesNotThrow(() => runRoziTool("plan_custom_workout", { area: "moon", minutes: "lots" }, ctx));
  assert.doesNotThrow(() => runRoziTool("get_workout_for_day", { day: "'; drop table" }, ctx));
});
