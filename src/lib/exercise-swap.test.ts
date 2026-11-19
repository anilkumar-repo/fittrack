import assert from "node:assert/strict";
import test from "node:test";
import { canUseExercise, findInWorkout, swapBlock, swapChoices, swapInPlan, swapInSession, swapSuggestion } from "./exercise-swap.ts";
import { detectIntent } from "./rozi-chat.ts";
import { runRoziTool } from "./rozi-ai/tools.ts";
import { sampleContext } from "./rozi-ai/bench/fixtures.ts";
import { getExerciseDefinition } from "./templates.ts";
import type { WorkoutSession } from "./types";
import { createInitialExerciseLogs } from "./supabase-repository.ts";
import { generateWorkout } from "./planner.ts";

const regular = sampleContext("regular");
const restricted = sampleContext("restricted");
/** Today's planned workout on the made-up sample account (the plan the Train screen shows). */
const todayPlan = () => generateWorkout({ date: regular.today, profile: regular.profile, sessions: regular.sessions, trainerRuleSettings: regular.trainerRuleSettings, trainerRuleRevision: regular.trainerRuleRevision })!;

const session = (status: WorkoutSession["status"], plan = todayPlan()): WorkoutSession => ({ id: "s", date: regular.today, status, plan, exerciseLogs: status === "planned" ? [] : createInitialExerciseLogs(plan) }) as WorkoutSession;

test("anything can be swapped before the workout starts; once started, only exercises with no sets done", () => {
  const plan = todayPlan();
  const [first, second] = plan.exercises;
  assert.equal(swapBlock(undefined, plan, first.id), null, "not saved yet");
  assert.equal(swapBlock(session("planned", plan), plan, first.id), null);
  const started = session("in_progress", plan);
  started.exerciseLogs[0].sets[0].completed = true;
  assert.equal(swapBlock(started, plan, first.id), "sets-done");
  assert.equal(swapBlock(started, plan, second.id), null, "a later exercise can still be swapped");
  assert.equal(swapBlock(session("completed", plan), plan, second.id), "completed");
  assert.equal(swapBlock(session("planned", plan), plan, "not_here"), "not-in-workout");
});

test("choices: close matches first, then any exercise the person can do — never one they can't", () => {
  const plan = todayPlan();
  const choices = swapChoices(plan.exercises[0], regular.planningProfile, plan.exercises);
  assert.ok(choices.suggested.length > 0 || choices.others.length > 0);
  for (const exercise of [...choices.suggested, ...choices.others]) {
    assert.ok(canUseExercise(exercise, regular.planningProfile), exercise.name);
    assert.ok(!plan.exercises.some((item) => item.id === exercise.id), `${exercise.name} is already in the workout`);
  }
  const home = swapChoices(getExerciseDefinition("goblet_squat")!, restricted.planningProfile, []);
  for (const exercise of [...home.suggested, ...home.others]) assert.doesNotMatch(exercise.name, /barbell|deadlift/i, "home dumbbells, deadlifts not approved");
  assert.ok(home.needsEquipment > 0, "the screen can say some need equipment");
  const searched = swapChoices(plan.exercises[0], regular.planningProfile, plan.exercises, "lunge");
  assert.ok(searched.others.length > 0 && searched.others.every((exercise) => /lunge|split|step/i.test(`${exercise.name} ${exercise.movementPattern}`)), searched.others.map((item) => item.name).join(", "));
  assert.deepEqual(swapChoices(plan.exercises[0], regular.planningProfile, plan.exercises, "zzzz").others, []);
});

test("a swap keeps the sets, reps and rest, remembers the original, and gives a started workout a fresh log", () => {
  const plan = todayPlan();
  const source = plan.exercises[1];
  const choice = swapChoices(source, regular.planningProfile, plan.exercises).others[0];
  const next = swapInPlan(plan, source.id, choice);
  const swapped = next.exercises[1];
  assert.equal(swapped.id, choice.id);
  assert.deepEqual([swapped.sets, swapped.reps, swapped.restSeconds], [source.sets, source.reps, source.restSeconds]);
  assert.equal(swapped.substitutedFor, source.substitutedFor ?? source.id);
  assert.equal(swapped.manualOverride, true);
  assert.deepEqual(next.originalExercises, plan.originalExercises);
  assert.equal(swapInPlan(plan, source.id, plan.exercises[0]), plan, "can't bring in one that's already there");
  const started = session("in_progress", plan);
  const after = swapInSession(started, plan, source.id, choice);
  assert.equal(after.exerciseLogs[1].exerciseId, choice.id);
  assert.equal(after.exerciseLogs[1].sets.length, source.sets);
  assert.equal(after.exerciseLogs[0], started.exerciseLogs[0], "other exercises untouched");
});

test("Rozi understands which exercise to swap and what to put in", () => {
  const plan = todayPlan();
  const named = plan.exercises.find((exercise) => /bench press/i.test(exercise.name));
  if (named) assert.equal(findInWorkout(plan.exercises, "can I swap the bench press?")?.id, named.id);
  assert.equal(findInWorkout(plan.exercises, "I want to customise my workout"), null);
  const listOnly = swapSuggestion(undefined, plan, regular.planningProfile, { exercise: "I want to customise my workout" });
  assert.equal(listOnly.from, null);
  assert.equal(listOnly.exercises.length, plan.exercises.length);
  const first = plan.exercises[0];
  const withReplacement = swapSuggestion(undefined, plan, regular.planningProfile, { exercise: first.name, replacement: "goblet squat" });
  assert.equal(withReplacement.from?.id, first.id);
  assert.equal(withReplacement.options[0].name, "Goblet squat", "the named replacement comes first");
  // Restricted account: a deadlift replacement is refused and explained.
  const homePlan = generateWorkout({ date: restricted.today, profile: restricted.profile, sessions: restricted.sessions, trainerRuleSettings: restricted.trainerRuleSettings, trainerRuleRevision: 1 })!;
  const refused = swapSuggestion(undefined, homePlan, restricted.planningProfile, { exercise: homePlan.exercises[0].name, replacement: "romanian deadlift" });
  assert.match(refused.replacementNotAllowed ?? "", /deadlift/i);
  assert.ok(refused.options.every((exercise) => !/deadlift|barbell/i.test(exercise.name)));
});

test("Rozi's swap tool returns choices and a card; on-phone Rozi treats 'customise' as a swap, not a new plan", () => {
  const outcome = runRoziTool("suggest_exercise_swap", {}, regular);
  assert.equal(outcome.card?.type, "swap");
  assert.ok((outcome.result.workoutExercises as string[]).length > 2);
  assert.match(String(outcome.result.howItWorks), /taps/);
  const odd = runRoziTool("suggest_exercise_swap", { exercise: 42, replacement: ["x"], day: "nonsense" }, regular);
  assert.equal(odd.result.error, undefined);
  for (const message of ["I want to customise the workout", "Can I swap the bench press?", "replace squats with lunges", "I don't like this exercise", "change my workout"]) {
    assert.equal(detectIntent(message), "SWAP_EXERCISE", message);
  }
  assert.equal(detectIntent("Plan me a 30 min leg workout"), "PLAN_WORKOUT");
});
