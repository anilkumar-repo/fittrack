import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalPlan, GOAL_LIMITS } from "./plan-builder.ts";
import { goalsEnabled, planHash, proposeGoal, PROPOSE_GOAL_TOOL } from "./goal-service.ts";
import { parseGoal } from "./goal-types.ts";
import { roziContext, type RoziContext } from "../tools.ts";
import { getExerciseDefinition } from "../../templates.ts";
import type { BodyWeightEntry, Profile, WorkoutSession } from "../../types.ts";

// R8: goals with a weekly plan. Every number comes from fixed templates and the person's own data; unsafe plans are
// refused with a reason and, where possible, a safer suggestion.

const TODAY = "2026-11-24";
const profile: Profile = {
  id: "client", displayName: "Client", experience: "beginner", sessionsPerWeek: 4, trainingDays: [1, 2, 4, 6], trainingStartDate: "2026-09-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 45, equipmentAvailability: "verified",
  availableEquipment: ["dumbbells", "bench", "barbell", "rack"], heightCm: 175,
};

function session(date: string, exerciseId?: string, kg?: number, reps = 8): WorkoutSession {
  const exercise = exerciseId ? getExerciseDefinition(exerciseId)! : null;
  return {
    id: date, date, status: "completed", plan: { exercises: exercise ? [exercise] : [] },
    exerciseLogs: exercise ? [{ exerciseId: exercise.id, plannedSets: 1, plannedReps: reps, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
      sets: [{ plannedReps: reps, actualReps: reps, loadKg: kg ?? null, completed: true, extra: false }] }] : [],
  } as unknown as WorkoutSession;
}

function ctx(options: { weights?: BodyWeightEntry[]; sessions?: WorkoutSession[]; profile?: Partial<Profile> } = {}): RoziContext {
  return roziContext({ profile: { ...profile, ...options.profile }, sessions: options.sessions ?? [], bodyWeightEntries: options.weights ?? [] } as never, TODAY, 10);
}
const weighed = (kg: number, on = "2026-11-20"): BodyWeightEntry[] => [{ id: "w", measuredOn: on, weightKg: kg }];

test("consistency: starts near what they do now and builds up, never past their training days", () => {
  // Two workouts a week lately → week 1 asks for 3, then +1 every two weeks up to 4.
  const sessions = ["2026-10-28", "2026-10-31", "2026-11-04", "2026-11-07", "2026-11-11", "2026-11-14", "2026-11-18", "2026-11-21"].map((date) => session(date));
  const built = buildGoalPlan({ kind: "consistency", sessionsPerWeek: 4, why: "feel fitter" }, ctx({ sessions }));
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.equal(built.plan.steps.length, 6, "6 weeks by default");
  assert.deepEqual(built.plan.steps.map((step) => step.sessions), [3, 3, 4, 4, 4, 4]);
  assert.equal(built.plan.steps[0].start, TODAY);
  assert.equal(built.plan.steps[0].end, "2026-11-30");
  assert.equal(built.plan.endDate, "2027-01-05");
  assert.equal(built.plan.reason, "feel fitter");
  const tooMany = buildGoalPlan({ kind: "consistency", sessionsPerWeek: 5 }, ctx());
  assert.ok(!tooMany.ok && tooMany.reason.includes("4 training days"));
  assert.ok(!buildGoalPlan({ kind: "consistency", sessionsPerWeek: 9 }, ctx()).ok);
});

test("weight loss: needs a recent weight and height, max 1% a week, never below a healthy BMI", () => {
  assert.ok(!buildGoalPlan({ kind: "weight_loss", targetKg: 75 }, ctx()).ok, "no weight logged");
  assert.ok(!buildGoalPlan({ kind: "weight_loss", targetKg: 75 }, ctx({ weights: weighed(80, "2026-09-01") })).ok, "weight too old");
  assert.ok(!buildGoalPlan({ kind: "weight_loss", targetKg: 75 }, ctx({ weights: weighed(80), profile: { heightCm: undefined } })).ok, "height needed");
  // 80 → 75 kg: 5 kg at ≤ 0.8 kg a week → at least 7 weeks.
  const built = buildGoalPlan({ kind: "weight_loss", targetKg: 75 }, ctx({ weights: weighed(80) }));
  assert.ok(built.ok);
  if (built.ok) {
    assert.equal(built.plan.steps.length, 7);
    assert.equal(built.plan.steps.at(-1)?.weightKg, 75);
    assert.ok(built.plan.steps.every((step, index, all) => index === 0 || all[index - 1].weightKg! - step.weightKg! <= 80 * GOAL_LIMITS.lossPerWeek + 0.05));
  }
  const fast = buildGoalPlan({ kind: "weight_loss", targetKg: 75, weeks: 4 }, ctx({ weights: weighed(80) }));
  assert.ok(!fast.ok && fast.suggestion === "7 weeks");
  // 175 cm: BMI 18.5 is 56.7 kg.
  const under = buildGoalPlan({ kind: "weight_loss", targetKg: 52 }, ctx({ weights: weighed(60) }));
  assert.ok(!under.ok && under.suggestion === "56.7 kg");
  const huge = buildGoalPlan({ kind: "weight_loss", targetKg: 60 }, ctx({ weights: weighed(90) }));
  assert.ok(!huge.ok && huge.suggestion?.includes("12 weeks"), "more than 12 weeks → a smaller first goal");
  assert.ok(!buildGoalPlan({ kind: "weight_loss", targetKg: 82 }, ctx({ weights: weighed(80) })).ok, "target must be lower");
});

test("weight gain: max 0.5% a week", () => {
  const built = buildGoalPlan({ kind: "weight_gain", targetKg: 62 }, ctx({ weights: weighed(60) }));
  assert.ok(built.ok);
  if (built.ok) assert.equal(built.plan.steps.length, 7, "2 kg at 0.3 kg a week");
});

test("strength: from the best logged set, ≤ 2.5% a week and ≤ 20%, with hold weeks", () => {
  const sessions = [session("2026-11-10", "barbell_bench", 50), session("2026-11-17", "barbell_bench", 52.5, 6)];
  assert.ok(!buildGoalPlan({ kind: "strength", exercise: "bench press", targetKg: 60 }, ctx()).ok, "nothing logged yet");
  const built = buildGoalPlan({ kind: "strength", exercise: "bench press", targetKg: 60 }, ctx({ sessions }));
  assert.ok(built.ok);
  if (built.ok) {
    assert.equal(built.plan.target.kind, "strength");
    assert.equal(built.plan.steps.length, 8);
    assert.equal(built.plan.steps.at(-1)?.liftKg, 60);
    assert.equal(built.plan.steps[3].liftKg, built.plan.steps[2].liftKg, "week 4 holds");
    assert.equal(built.plan.steps[7].liftKg, 60);
    assert.ok(built.plan.steps.every((step, index, all) => index === 0 || step.liftKg! >= all[index - 1].liftKg!), "never goes down");
  }
  const greedy = buildGoalPlan({ kind: "strength", exercise: "bench press", targetKg: 80, weeks: 8 }, ctx({ sessions }));
  assert.ok(!greedy.ok && greedy.suggestion === "63 kg", "52.5 × 1.2");
  assert.ok(!buildGoalPlan({ kind: "strength", exercise: "plank", targetKg: 10 }, ctx({ sessions })).ok, "timed exercise");
  const locked = buildGoalPlan({ kind: "strength", exercise: "deadlift", targetKg: 100 }, ctx({ sessions }));
  assert.ok(!locked.ok && locked.reason.includes("trainer"));
});

test("bad input is refused, never guessed", () => {
  assert.ok(!buildGoalPlan({ kind: "run_marathon" }, ctx()).ok);
  assert.ok(!buildGoalPlan({ kind: "consistency", sessionsPerWeek: 3, weeks: 20 }, ctx()).ok);
  assert.ok(!buildGoalPlan({ kind: "consistency", sessionsPerWeek: 3, weeks: 2 }, ctx()).ok);
  assert.ok(!buildGoalPlan({ kind: "strength", exercise: "underwater basket weaving", targetKg: 50 }, ctx()).ok);
});

test("the plan hash binds the person and the exact plan", () => {
  const built = buildGoalPlan({ kind: "consistency", sessionsPerWeek: 3 }, ctx());
  assert.ok(built.ok);
  if (!built.ok) return;
  assert.match(planHash("user-a", built.plan), /^[0-9a-f]{64}$/);
  assert.notEqual(planHash("user-a", built.plan), planHash("user-b", built.plan));
  assert.notEqual(planHash("user-a", built.plan), planHash("user-a", { ...built.plan, steps: built.plan.steps.slice(1) }));
  assert.equal(planHash("user-a", built.plan), planHash("user-a", JSON.parse(JSON.stringify(built.plan))));
});

test("proposeGoal records the validated plan through the server function and returns a goal card", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const service = { rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return { data: { id: "11111111-1111-4111-8111-111111111111", kind: args.p_kind, title: args.p_title, reason: args.p_reason, target: args.p_target, start_date: args.p_start, end_date: args.p_end, steps: args.p_steps, plan_hash: args.p_hash, status: "awaiting_approval", created_at: "x", expires_at: "2026-11-24T11:00:00Z" }, error: null };
  } } as never;
  const outcome = await proposeGoal({ service, userId: "user-a", ctx: ctx(), conversationId: null }, { kind: "consistency", sessionsPerWeek: 3, why: "habit" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, "rozi_propose_goal");
  assert.match(String(calls[0].args.p_hash), /^[0-9a-f]{64}$/);
  assert.equal(outcome.result.proposed, true);
  assert.equal(outcome.card?.type, "goal");
  // A refused plan never reaches the database.
  const refused = await proposeGoal({ service, userId: "user-a", ctx: ctx(), conversationId: null }, { kind: "consistency", sessionsPerWeek: 9 });
  assert.equal(refused.result.proposed, false);
  assert.equal(calls.length, 1);
});

test("parseGoal reads database rows and rejects junk; the flag is off by default", () => {
  assert.equal(parseGoal(null), null);
  assert.equal(parseGoal({ id: "x", kind: "hack", status: "active", steps: [], target: {} }), null);
  const goal = parseGoal({ id: "x", kind: "strength", status: "active", steps: [{ week: 1 }], target: { exerciseId: "barbell_bench" }, start_date: "2026-11-24", end_date: "2027-01-19", approved_now: true });
  assert.equal(goal?.approvedNow, true);
  assert.equal(goal?.target.kind, "strength");
  assert.equal(goalsEnabled({}), false);
  assert.equal(goalsEnabled({ ROZI_GOALS: "on" }), true);
  assert.deepEqual(PROPOSE_GOAL_TOOL.parameters.required, ["kind"]);
});

// ---------- R9: weekly progress and replan suggestions ----------

import { goalProgress } from "./plan-monitor.ts";
import { goalProgressOutcome } from "./goal-service.ts";
import type { RoziGoal } from "./goal-types.ts";

/** A stored goal built from a real plan, started `daysAgo` days before TODAY. */
function storedGoal(args: Record<string, unknown>, context: RoziContext, daysAgo: number): RoziGoal {
  const startCtx = { ...context, today: new Date(Date.parse(`${TODAY}T00:00:00Z`) - daysAgo * 86_400_000).toISOString().slice(0, 10) };
  const built = buildGoalPlan(args, startCtx);
  if (!built.ok) throw new Error(built.reason);
  return { ...built.plan, id: "g", status: "active", planHash: "h", createdAt: "", expiresAt: "", approvedAt: "", finishedAt: null };
}

test("progress: weeks met, missed, this week, upcoming; behind after two missed weeks, with a gentler plan", () => {
  // 4-a-week goal started 3 weeks ago (weeks 1–3 done, week 4 now); targets 2,2,3,3,… from a 0-workout start.
  const goal = storedGoal({ kind: "consistency", sessionsPerWeek: 4, weeks: 8 }, ctx(), 21);
  const start = goal.startDate;
  const day = (offset: number) => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
  // Week 1: 2 workouts (met), week 2: 1 (missed), week 3: 1 (missed), week 4: 1 so far.
  const sessions = [day(0), day(2), day(8), day(15), day(22)].map((date) => session(date));
  const progress = goalProgress(goal, ctx({ sessions }));
  assert.deepEqual(progress.weeks.slice(0, 5).map((week) => week.state), ["met", "missed", "missed", "in_progress", "upcoming"]);
  assert.equal(progress.currentWeek, 4);
  assert.equal(progress.state, "behind");
  assert.equal(progress.suggestion?.propose.kind, "consistency");
  assert.equal(progress.suggestion?.propose.sessionsPerWeek, 2, "managed ~1 a week → build from 2");
  // The suggestion is a valid plan request: the builder accepts it.
  assert.ok(buildGoalPlan(progress.suggestion!.propose, ctx({ sessions })).ok);
});

test("progress: on track when the last finished week was met; paused and finished states", () => {
  const goal = storedGoal({ kind: "consistency", sessionsPerWeek: 3, weeks: 6 }, ctx(), 7);
  const sessions = [0, 2, 4].map((offset) => session(new Date(Date.parse(`${goal.startDate}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)));
  const onTrack = goalProgress(goal, ctx({ sessions }));
  assert.equal(onTrack.weeks[0].state, "met");
  assert.notEqual(onTrack.state, "behind");
  assert.equal(onTrack.suggestion, null);
  assert.equal(goalProgress({ ...goal, status: "paused" }, ctx({ sessions })).state, "paused");
  const ended = storedGoal({ kind: "consistency", sessionsPerWeek: 3, weeks: 4 }, ctx(), 40);
  const done = goalProgress(ended, ctx());
  assert.equal(done.state, "finished");
  assert.match(done.summary, /of 4 weeks/);
});

test("progress: weight weeks use the last weigh-in of the week with a small tolerance; no log is 'no_data'", () => {
  const goal = storedGoal({ kind: "weight_loss", targetKg: 76 }, ctx({ weights: weighed(80, "2026-10-26") }), 14);
  // Week 1 target ≈ 79.2 (+0.3 tolerance): logged 79.4 → met. Week 2: nothing logged → no_data.
  const weights: BodyWeightEntry[] = [{ id: "a", measuredOn: goal.steps[0].start, weightKg: 80 }, { id: "b", measuredOn: goal.steps[0].end, weightKg: 79.4 }];
  const progress = goalProgress(goal, ctx({ weights }));
  assert.equal(progress.weeks[0].state, "met");
  assert.equal(progress.weeks[1].state, "no_data");
});

test("progress: strength weeks compare the best working set that week", () => {
  const before = [session("2026-10-20", "barbell_bench", 50)];
  const goal = storedGoal({ kind: "strength", exercise: "bench press", targetKg: 55, weeks: 6 }, ctx({ sessions: before }), 14);
  const week1 = session(goal.steps[0].start, "barbell_bench", goal.steps[0].liftKg!);
  const week2 = session(goal.steps[1].start, "barbell_bench", goal.steps[1].liftKg! - 2.5);
  const progress = goalProgress(goal, ctx({ sessions: [...before, week1, week2] }));
  assert.deepEqual(progress.weeks.slice(0, 2).map((week) => week.state), ["met", "missed"]);
});

test("get_goal_progress: no goal → says so; a goal → facts and a read-only progress card", () => {
  assert.equal(goalProgressOutcome(null, ctx()).result.hasGoal, false);
  const goal = storedGoal({ kind: "consistency", sessionsPerWeek: 3, weeks: 6 }, ctx(), 7);
  const outcome = goalProgressOutcome(goal, ctx());
  assert.equal(outcome.result.hasGoal, true);
  assert.equal(outcome.card?.type, "goal_progress");
  assert.ok(Array.isArray(outcome.result.weeks));
  assert.ok((outcome.result.weeks as unknown[]).every((week) => (week as { state: string }).state !== "upcoming"), "upcoming weeks aren't sent to the model");
});
