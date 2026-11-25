import assert from "node:assert/strict";
import test from "node:test";
import { adjustPlan, applyPlanChange, changeProblem, dismissSuggestion, EMPTY_ADJUSTMENTS, parsePlanAdjustments, setAutoApply, undoLastChange } from "./coach-plan.ts";
import { autoApplicable, REVIEW_RULES, weeklyReview } from "./coach-review.ts";
import { generateWorkout } from "./planner.ts";
import type { CheckIn, Profile, WorkoutReview, WorkoutSession } from "./types.ts";

// R14 Coach review: suggestions from logged weeks, approved changes, undo, and the planner applying them.

const TODAY = "2026-11-25"; // a Wednesday
const profile = { id: "p", displayName: "P", experience: "intermediate", sessionsPerWeek: 3, trainingDays: [1, 3, 5], trainingStartDate: "2026-06-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 45, goal: "general",
  equipmentAvailability: "verified", availableEquipment: ["barbell", "bench", "dumbbells", "rack", "cable_machine", "gym_machines"] } as unknown as Profile;

type Extra = { load?: number; checkIn?: Partial<CheckIn>; review?: Partial<WorkoutReview>; skipped?: string[]; partial?: boolean; status?: WorkoutSession["status"]; missed?: "busy" };
/** One logged workout: a couple of done exercises, optional skipped ones, check-in and review. */
function day(date: string, extra: Extra = {}): WorkoutSession {
  const done = ["goblet_squat", "dumbbell_bench"].map((exerciseId) => ({
    exerciseId, plannedSets: 3, plannedReps: 10, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
    sets: Array.from({ length: extra.partial ? 2 : 3 }, () => ({ plannedReps: 10, actualReps: 10, loadKg: extra.load ?? 20, completed: true, extra: false })),
  }));
  const skipped = (extra.skipped ?? []).map((exerciseId) => ({ exerciseId, plannedSets: 3, plannedReps: 10, status: "skipped", substitutionName: "", formQuality: "not_recorded", notes: "", sets: [] }));
  return {
    id: date, date, status: extra.status ?? "completed", plan: { exercises: [] }, exerciseLogs: extra.status === "skipped" ? [] : [...done, ...skipped],
    ...(extra.checkIn ? { checkIn: { energy: 3, soreness: 2, pain: false, recovery: 3, discomfort: "", note: "", ...extra.checkIn } } : {}),
    ...(extra.review ? { review: { effort: 6, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "", ...extra.review } } : {}),
    ...(extra.missed ? { missedReason: { reason: extra.missed, note: "" } } : {}),
  } as unknown as WorkoutSession;
}

const kinds = (sessions: WorkoutSession[], who: Profile = profile) => weeklyReview({ profile: who, sessions, today: TODAY }).suggestions.map((item) => item.kind);

test("a calm, steady month: nothing to change", () => {
  const sessions = ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23"].map((date, index) => day(date, { review: { effort: 7 }, load: 20 + index * 2.5 }));
  const review = weeklyReview({ profile, sessions, today: TODAY });
  assert.deepEqual(review.suggestions, [], "steady progress, effort 7: nothing to change");
  assert.equal(review.week, "2026-11-23", "Monday of this week");
  assert.equal(review.averageEffort, 7);
});

test("pain, high soreness or very hard workouts → a lighter week first (safe, auto-applicable)", () => {
  const painful = [day("2026-11-20"), day("2026-11-23", { checkIn: { pain: true } })];
  const review = weeklyReview({ profile, sessions: painful, today: TODAY });
  assert.equal(review.suggestions[0].kind, "lighter_week");
  assert.ok(review.suggestions[0].safe);
  assert.deepEqual(review.suggestions[0].change, { type: "light_week", start: TODAY });
  assert.equal(kinds([day("2026-11-20", { checkIn: { soreness: 4 } }), day("2026-11-23", { checkIn: { soreness: 5 } })])[0], "lighter_week");
  assert.equal(kinds(["2026-11-18", "2026-11-20", "2026-11-23"].map((date) => day(date, { review: { effort: 9 } })))[0], "lighter_week");
  // Already in a lighter week (the trainer's): not suggested again.
  assert.ok(!kinds(painful, { ...profile, lightWeekStart: "2026-11-23" }).includes("lighter_week"));
});

test("a move skipped twice in 4 weeks → swap it for the closest one the person can do", () => {
  const sessions = [day("2026-11-11", { skipped: ["barbell_row"] }), day("2026-11-18", { skipped: ["barbell_row"] }), day("2026-11-23")];
  const [swap] = weeklyReview({ profile, sessions, today: TODAY }).suggestions.filter((item) => item.kind === "swap_skipped");
  assert.ok(swap && swap.change.type === "swap" && swap.change.fromId === "barbell_row" && swap.safe);
  assert.equal(changeProblem(profile, swap.change), null, "the replacement fits the equipment");
});

test("easy and fully done for a while → one more set (not safe to auto-apply); never while sore or in pain", () => {
  const easy = ["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23"].map((date) => day(date, { review: { effort: 5 } }));
  const more = weeklyReview({ profile, sessions: easy, today: TODAY }).suggestions.find((item) => item.kind === "more_sets");
  assert.ok(more && !more.safe && more.change.type === "set_delta" && more.change.delta === 1);
  assert.ok(!kinds([...easy, day("2026-11-24", { checkIn: { pain: true } })]).includes("more_sets"));
  assert.ok(!kinds(easy.map((session) => ({ ...session, exerciseLogs: session.exerciseLogs.map((log) => ({ ...log, sets: log.sets.slice(1) })) }))).includes("more_sets"), "sets not all done");
  // Back off the extra set when it turns out too hard.
  const nudged = { ...profile, planAdjustments: { ...EMPTY_ADJUSTMENTS, setDelta: 1 as const } };
  assert.ok(kinds(["2026-11-20", "2026-11-23"].map((date) => day(date, { review: { effort: REVIEW_RULES.backOffEffort } })), nudged).includes("back_off"));
});

test("missing many planned days → shorter sessions; nothing for Train together (shared plan)", () => {
  const sparse = [day("2026-11-09"), day("2026-11-18"), { ...day("2026-11-20"), status: "skipped", exerciseLogs: [], missedReason: { reason: "busy", note: "" } } as unknown as WorkoutSession];
  const short = weeklyReview({ profile, sessions: sparse, today: TODAY }).suggestions.find((item) => item.kind === "shorter_sessions");
  assert.ok(short && short.change.type === "session_minutes" && short.change.minutes === 35);
  assert.match(short.why, /busy 1 time/);
  assert.deepEqual(weeklyReview({ profile: { ...profile, buddyAnchor: "2026-11-02" }, sessions: sparse, today: TODAY }).suggestions, []);
});

test("at most three suggestions; 'not now' and applied ones don't come back this week", () => {
  const busy = [day("2026-11-11", { skipped: ["barbell_row"] }), day("2026-11-18", { skipped: ["barbell_row"] }), day("2026-11-23", { checkIn: { pain: true } })];
  const first = weeklyReview({ profile, sessions: busy, today: TODAY });
  assert.ok(first.suggestions.length <= REVIEW_RULES.max);
  const dismissed = dismissSuggestion(profile, first.suggestions[0].id);
  assert.ok(!weeklyReview({ profile: dismissed, sessions: busy, today: TODAY }).suggestions.some((item) => item.id === first.suggestions[0].id));
  const applied = applyPlanChange(profile, first.suggestions[0].change, { id: first.suggestions[0].id, title: first.suggestions[0].title, on: TODAY });
  assert.ok(applied.ok);
  if (applied.ok) assert.ok(!weeklyReview({ profile: applied.profile, sessions: busy, today: TODAY }).suggestions.some((item) => item.id === first.suggestions[0].id));
});

test("auto-apply: only the safe suggestions, and only when the person turned it on", () => {
  const sessions = [day("2026-11-20"), day("2026-11-23", { checkIn: { pain: true } })];
  const review = weeklyReview({ profile, sessions, today: TODAY });
  assert.deepEqual(autoApplicable(profile, review), [], "off by default");
  const on = setAutoApply(profile, true);
  assert.ok(autoApplicable(on, review).every((item) => item.safe) && autoApplicable(on, review).length > 0);
});

test("apply, then undo: everything goes back; impossible changes are refused", () => {
  const swapped = applyPlanChange(profile, { type: "swap", fromId: "barbell_row", toId: "seated_row" }, { id: "manual:1", title: "Swap rows", on: TODAY });
  assert.ok(swapped.ok);
  if (!swapped.ok) return;
  const shorter = applyPlanChange(swapped.profile, { type: "session_minutes", minutes: 33 }, { id: "manual:2", title: "Shorter", on: TODAY });
  assert.ok(shorter.ok);
  if (!shorter.ok) return;
  assert.equal(shorter.profile.preferredSessionMinutes, 35, "rounded to 5");
  const once = undoLastChange(shorter.profile);
  assert.equal(once.preferredSessionMinutes, 45);
  assert.equal(once.planAdjustments?.swaps.barbell_row, "seated_row", "only the newest change is undone");
  const twice = undoLastChange(once);
  assert.deepEqual(twice.planAdjustments?.swaps, {});
  // Refused: a move the person can't do (deadlift without approval), unknown ids, Train together.
  assert.equal(applyPlanChange(profile, { type: "swap", fromId: "barbell_row", toId: "barbell_deadlift" }, { id: "x", title: "x", on: TODAY }).ok, false);
  assert.equal(applyPlanChange(profile, { type: "swap", fromId: "barbell_row", toId: "moon_walk" }, { id: "x", title: "x", on: TODAY }).ok, false);
  assert.equal(applyPlanChange({ ...profile, buddyAnchor: "2026-11-02" }, { type: "set_delta", delta: 1 }, { id: "x", title: "x", on: TODAY }).ok, false);
});

test("stored data is read defensively: unknown ids, bad dates, wrong types and oversized lists are dropped", () => {
  const parsed = parsePlanAdjustments({ v: 1, swaps: { barbell_row: "seated_row", "<script>": "x", barbell_bench: "barbell_bench", fake_one: "seated_row" }, setDelta: 5, lightWeekStart: "next tuesday", autoApply: "yes", history: [{ junk: true }], dismissed: Array.from({ length: 100 }, (_, index) => `id${index}`) });
  assert.deepEqual(parsed.swaps, { barbell_row: "seated_row" });
  assert.equal(parsed.setDelta, 0);
  assert.equal(parsed.lightWeekStart, null);
  assert.equal(parsed.autoApply, false);
  assert.deepEqual(parsed.history, []);
  assert.equal(parsed.dismissed.length, 40);
  assert.deepEqual(parsePlanAdjustments([1, 2]), EMPTY_ADJUSTMENTS);
});

test("the planner follows approved changes: swaps (re-checked), set nudge, own lighter week; Train together untouched", () => {
  const date = "2026-11-27"; // Friday, a training day
  const base = generateWorkout({ date, profile, sessions: [] })!;
  const first = base.exercises[0];
  const target = ["seated_row", "machine_chest_press", "leg_press", "goblet_squat", "dumbbell_bench"].find((id) => !base.exercises.some((item) => item.id === id))!;
  const withSwap = { ...profile, planAdjustments: { ...EMPTY_ADJUSTMENTS, swaps: { [first.id]: target } } };
  const swapped = generateWorkout({ date, profile: withSwap, sessions: [] })!;
  assert.equal(swapped.exercises[0].id, target);
  assert.equal(swapped.exercises[0].sets, first.sets, "keeps the planned sets");
  // A stored swap to a move the person can't do (no equipment) is ignored, never forced in.
  const noGear = { ...withSwap, availableEquipment: [] } as Profile;
  assert.ok(!generateWorkout({ date, profile: noGear, sessions: [] })!.exercises.some((item) => item.id === target && !["goblet_squat"].includes(target)) || target === "goblet_squat");
  // Set nudge on the first strength moves only, within 1–6.
  const plusOne = generateWorkout({ date, profile: { ...profile, planAdjustments: { ...EMPTY_ADJUSTMENTS, setDelta: 1 } }, sessions: [] })!;
  const strength = base.exercises.filter((item) => item.category === "strength").slice(0, 3).map((item) => item.id);
  for (const exercise of plusOne.exercises.filter((item) => strength.includes(item.id))) {
    assert.equal(exercise.sets, Math.min(6, base.exercises.find((item) => item.id === exercise.id)!.sets + 1));
  }
  // Own lighter week: fewer sets, labelled as the person's choice.
  const light = generateWorkout({ date, profile: { ...profile, planAdjustments: { ...EMPTY_ADJUSTMENTS, lightWeekStart: "2026-11-25" } }, sessions: [] })!;
  assert.ok(light.lightWeek);
  assert.ok(light.generationReasons.some((reason) => reason.includes("coach review")));
  assert.ok(light.exercises.reduce((sum, item) => sum + item.sets, 0) < base.exercises.reduce((sum, item) => sum + item.sets, 0));
  // Train together: the shared plan is never changed per person.
  const buddy = { ...withSwap, buddyAnchor: "2026-11-02" };
  assert.ok(!adjustPlan(generateWorkout({ date, profile: buddy, sessions: [] })!, buddy).exercises.some((item) => item.manualOverride && item.id === target && first.id !== target));
});

test("a saved workout that hasn't started is planned again when the coach changes no longer match it", async () => {
  const { workoutPlanMatchesProfile } = await import("./exercise-library.ts");
  const date = "2026-11-27";
  const plain = generateWorkout({ date, profile, sessions: [] })!;
  assert.ok(workoutPlanMatchesProfile(plain, profile), "no changes: older plans still match (no re-planning)");
  const changed = { ...profile, planAdjustments: { ...EMPTY_ADJUSTMENTS, setDelta: 1 as const } };
  assert.equal(workoutPlanMatchesProfile(plain, changed), false, "a new change → plan it again");
  assert.ok(workoutPlanMatchesProfile(generateWorkout({ date, profile: changed, sessions: [] })!, changed), "the new plan carries the change");
});
