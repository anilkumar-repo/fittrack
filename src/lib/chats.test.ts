import assert from "node:assert/strict";
import test from "node:test";
import { dayLabel, isSticker, messagePreview, readWorkoutCard, startsGroup, STICKERS, textProblem, workoutCard } from "./chats.ts";
import { ROZI_MOODS } from "./rozi.ts";
import type { ExerciseLog, WorkoutPlan, WorkoutSession } from "./types";

const set = (reps: number | null, kg: number | null, extra: Partial<ExerciseLog["sets"][number]> = {}): ExerciseLog["sets"][number] =>
  ({ plannedReps: 8, actualReps: reps, loadKg: kg, completed: reps !== null, extra: false, ...extra });
const log = (exerciseId: string, sets: ExerciseLog["sets"]): ExerciseLog =>
  ({ exerciseId, plannedSets: sets.length, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "good", sets, notes: "" } as unknown as ExerciseLog);
const session = (date: string, logs: ExerciseLog[], status: WorkoutSession["status"] = "completed"): WorkoutSession => ({
  id: date, date, status, exerciseLogs: logs,
  plan: { title: "Push B · Chest, shoulders, triceps", durationMinutes: 45, exercises: [{ id: "bench", name: "Bench press" }, { id: "ohp", name: "Overhead press" }] } as unknown as WorkoutPlan,
});

test("stickers: 16 Rozi faces that all exist as moods", () => {
  assert.equal(STICKERS.length, 16);
  for (const sticker of STICKERS) assert.ok((ROZI_MOODS as readonly string[]).includes(sticker.mood), sticker.mood);
  assert.equal(isSticker("cheer"), true);
  assert.equal(isSticker("not-a-face"), false);
});

test("workout card: working sets, rep range, top weight, and new bests only over an earlier lift", () => {
  const before = session("2026-11-10", [log("bench", [set(8, 50), set(8, 55)])]);
  const today = session("2026-11-17", [
    log("bench", [set(10, 20, { kind: "warmup" }), set(8, 57.5), set(6, 60)]),
    log("ohp", [set(10, 30), set(9, 30)]),
    log("skipped", [set(null, null, { completed: false })]),
  ]);
  const card = workoutCard(today, [before, today]);
  assert.ok(card);
  assert.equal(card.title, "Push B · Chest, shoulders, triceps");
  assert.deepEqual(card.exercises, [{ name: "Bench press", sets: 2, reps: "6–8", topKg: 60 }, { name: "Overhead press", sets: 2, reps: "9–10", topKg: 30 }]);
  assert.equal(card.totalSets, 4);
  // Bench beat 55 kg; overhead press had no earlier lift, so it isn't called a PR.
  assert.deepEqual(card.prs, ["Bench press"]);
  assert.equal(workoutCard(session("2026-11-18", [], "planned"), []), null);
  assert.equal(workoutCard(session("2026-11-18", [log("bench", [set(null, null, { completed: false })])]), []), null);
});

test("workout card read back: malformed payloads are dropped", () => {
  assert.equal(readWorkoutCard(null), null);
  assert.equal(readWorkoutCard({ title: 3 }), null);
  const card = readWorkoutCard({ title: "Legs", exercises: [{ name: "Squat", sets: 3, reps: "8", topKg: 80 }, null], totalSets: 3, prs: ["Squat"] });
  assert.deepEqual(card?.exercises, [{ name: "Squat", sets: 3, reps: "8", topKg: 80 }]);
});

test("chat list preview line", () => {
  assert.equal(messagePreview(null, "me"), "Say hi 👋");
  assert.equal(messagePreview({ kind: "text", body: "See you\n at 7", senderId: "me", deleted: false }, "me"), "You: See you at 7");
  assert.equal(messagePreview({ kind: "sticker", body: "", senderId: "r", deleted: false }, "me", "Ravi Kumar"), "Ravi: Sent a sticker");
  assert.equal(messagePreview({ kind: "workout", body: "", title: "Push B", senderId: "r", deleted: false }, "me"), "Shared a workout: Push B");
  assert.equal(messagePreview({ kind: "text", body: "", senderId: "r", deleted: true }, "me", "Ravi"), "Ravi: Message deleted");
});

test("day labels, grouping and the text check", () => {
  assert.equal(dayLabel("2026-11-17", "2026-11-17"), "Today");
  assert.equal(dayLabel("2026-11-16", "2026-11-17"), "Yesterday");
  assert.equal(dayLabel("2026-11-13", "2026-11-17"), "Friday, Nov 13");
  assert.equal(dayLabel("2025-12-30", "2026-11-17"), "Dec 30, 2025");
  assert.equal(startsGroup(undefined, { senderId: "a", at: "2026-11-17T10:00:00Z" }), true);
  assert.equal(startsGroup({ senderId: "a", at: "2026-11-17T10:00:00Z" }, { senderId: "a", at: "2026-11-17T10:04:00Z" }), false);
  assert.equal(startsGroup({ senderId: "a", at: "2026-11-17T10:00:00Z" }, { senderId: "a", at: "2026-11-17T10:06:00Z" }), true);
  assert.equal(startsGroup({ senderId: "a", at: "2026-11-17T10:00:00Z" }, { senderId: "b", at: "2026-11-17T10:00:30Z" }), true);
  assert.equal(textProblem("  "), "Write a message first.");
  assert.equal(textProblem("x".repeat(2001)), "Keep it under 2,000 characters.");
  assert.equal(textProblem("hi"), null);
});
