import assert from "node:assert/strict";
import test from "node:test";
import { generateWorkout } from "./planner.ts";
import type { CheckIn, ExerciseLog, Profile, SessionStatus, WorkoutReview, WorkoutSession } from "./types.ts";
import { canReadWorkoutData, canWriteWorkoutData, createExerciseLog, createInFlightDeduper, normalizeWorkoutSession, persistWorkoutSession, retrieveWorkoutSessions, validateWorkoutSession, type WorkoutActor, type WorkoutPersistencePort } from "./workout-tracking.ts";

const profile: Profile = {
  id: "client-1", displayName: "Maya", experience: "beginner", sessionsPerWeek: 3,
  trainingDays: [2, 4, 6], trainingStartDate: "2026-10-01", timeZone: "Asia/Kolkata", deadliftEnabled: false,
  trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [],
};
const checkIn: CheckIn = { energy: 4, soreness: 2, pain: false, recovery: 4, discomfort: "", note: "Ready to train." };
const review: WorkoutReview = { effort: 6, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "Steady session." };

function newSession(): WorkoutSession {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] });
  assert.ok(plan);
  return {
    id: "temporary-session-id", date: plan.date, status: "in_progress", plan, checkIn,
    exerciseLogs: plan.exercises.map((exercise) => createExerciseLog(exercise.id, exercise.sets, exercise.reps)),
  };
}

function completedSession(): WorkoutSession {
  const session = newSession();
  return {
    ...session,
    status: "completed",
    exerciseLogs: session.exerciseLogs.map((log) => ({
      ...log,
      status: "completed",
      sets: log.sets.map((set) => ({ ...set, actualReps: set.plannedReps, loadKg: 12.5, completed: true })),
    })),
    review,
    completedAt: "2026-10-27T11:30:00.000Z",
  };
}

function plannedSession(): WorkoutSession {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] });
  assert.ok(plan);
  return { id: "planned-session-id", date: plan.date, status: "planned", plan, exerciseLogs: [] };
}

class MemoryWorkoutPort implements WorkoutPersistencePort {
  sessions = new Map<string, WorkoutSession>();
  writes = { parent: 0, checkIn: 0, exercises: 0, sets: 0, reviews: 0, finalize: 0 };

  async upsertSession(ownerId: string, session: WorkoutSession, status: SessionStatus) {
    const key = `${ownerId}:${session.date}`;
    const existing = [...this.sessions.entries()].find(([sessionKey]) => sessionKey === key);
    const id = existing?.[1].id ?? `saved-${this.sessions.size + 1}`;
    const old = existing?.[1];
    this.sessions.set(key, { ...(old ?? session), ...session, id, status });
    this.writes.parent += 1;
    return id;
  }

  async upsertCheckIn(_ownerId: string, sessionId: string, value: CheckIn) {
    this.mapSession(sessionId, (session) => ({ ...session, checkIn: value }));
    this.writes.checkIn += 1;
  }

  async upsertExerciseLog(_ownerId: string, sessionId: string, log: ExerciseLog) {
    this.mapSession(sessionId, (session) => ({ ...session, exerciseLogs: [...session.exerciseLogs.filter((item) => item.exerciseId !== log.exerciseId), log] }));
    this.writes.exercises += 1;
    return `${sessionId}-${log.exerciseId}`;
  }

  async upsertSets() {
    this.writes.sets += 1;
  }

  async upsertReview(_ownerId: string, sessionId: string, value: WorkoutReview) {
    this.mapSession(sessionId, (session) => ({ ...session, review: value }));
    this.writes.reviews += 1;
  }

  async finalizeSession(_ownerId: string, sessionId: string, session: WorkoutSession) {
    this.mapSession(sessionId, (stored) => ({ ...stored, status: session.status, completedAt: session.completedAt }));
    this.writes.finalize += 1;
  }

  async readSessions(ownerId: string) {
    return [...this.sessions.entries()].filter(([key]) => key.startsWith(`${ownerId}:`)).map(([, session]) => session);
  }

  private mapSession(sessionId: string, update: (session: WorkoutSession) => WorkoutSession) {
    for (const [key, session] of this.sessions) if (session.id === sessionId) this.sessions.set(key, update(session));
  }
}

test("saves a session and retrieves it with its related check-in and exercise logs", async () => {
  const port = new MemoryWorkoutPort();
  const actor: WorkoutActor = { id: profile.id, role: "client" };
  const saved = await persistWorkoutSession(port, actor, profile.id, newSession());
  const retrieved = await retrieveWorkoutSessions(port, actor, profile.id);
  assert.equal(saved.id, "saved-1");
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].status, "in_progress");
  assert.deepEqual(retrieved[0].checkIn, checkIn);
  assert.equal(retrieved[0].exerciseLogs.length, saved.plan.exercises.length);
  assert.ok(port.writes.sets > 0);
});

test("persists a generated plan before the workout starts and returns the same snapshot on reload", async () => {
  const port = new MemoryWorkoutPort();
  const actor: WorkoutActor = { id: profile.id, role: "client" };
  const planned = plannedSession();
  const saved = await persistWorkoutSession(port, actor, profile.id, planned);
  const refreshed = await retrieveWorkoutSessions(port, actor, profile.id);
  assert.equal(saved.status, "planned");
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].status, "planned");
  assert.deepEqual(refreshed[0].plan, planned.plan);
  assert.equal(refreshed[0].plan.date, "2026-10-27");
  assert.equal(port.writes.exercises, 0);
});

test("older saved exercise snapshots hydrate current text instructions without a schema change", () => {
  const session = newSession();
  const oldExercises = session.plan.exercises.map((exercise) => {
    const legacy = { ...exercise } as unknown as Record<string, unknown>;
    delete legacy.instructions;
    delete legacy.targetMuscles;
    delete legacy.difficulty;
    delete legacy.cautionNotes;
    return legacy;
  });
  const oldPlan = {
    ...session.plan,
    exercises: oldExercises as unknown as typeof session.plan.exercises,
  };
  const restored = normalizeWorkoutSession({ ...session, plan: oldPlan } as unknown as WorkoutSession);
  assert.ok(restored);
  assert.ok(restored.plan.exercises.every((exercise) => exercise.instructions.length >= 3));
  assert.ok(restored.plan.exercises.every((exercise) => exercise.targetMuscles.length > 0));
});

test("an incomplete workout saves as in progress and keeps completed-set details", async () => {
  const port = new MemoryWorkoutPort();
  const session = newSession();
  const firstLog = session.exerciseLogs[0];
  firstLog.sets[0] = { ...firstLog.sets[0], actualReps: 8, loadKg: 15, completed: true };
  firstLog.status = "partial";
  firstLog.substitutionName = "Cable row";
  firstLog.notes = "Used the next station.";
  const saved = await persistWorkoutSession(port, { id: profile.id, role: "client" }, profile.id, session);
  const retrieved = await retrieveWorkoutSessions(port, { id: profile.id, role: "client" }, profile.id);
  assert.equal(saved.status, "in_progress");
  assert.equal(retrieved[0].exerciseLogs[0].status, "partial");
  assert.equal(retrieved[0].exerciseLogs[0].sets[0].actualReps, 8);
  assert.equal(retrieved[0].exerciseLogs[0].sets[0].loadKg, 15);
  assert.equal(retrieved[0].exerciseLogs[0].substitutionName, "Cable row");
});

test("validates set completion, completed-session review, and bounds", () => {
  const invalid = completedSession();
  invalid.review = undefined;
  invalid.exerciseLogs[0].sets[0] = { ...invalid.exerciseLogs[0].sets[0], actualReps: 0 };
  const errors = validateWorkoutSession(invalid);
  assert.ok(errors.some((error) => error.includes("actual reps")));
  assert.ok(errors.some((error) => error.includes("post-workout review")));

  const valid = completedSession();
  assert.deepEqual(validateWorkoutSession(valid), []);
});

test("only the owner and an explicitly linked trainer may read, and only the owner may save", () => {
  const client: WorkoutActor = { id: "client-1", role: "client" };
  const assignedTrainer: WorkoutActor = { id: "trainer-1", role: "trainer" };
  const otherTrainer: WorkoutActor = { id: "trainer-2", role: "trainer" };
  assert.equal(canReadWorkoutData(client, profile.id), true);
  assert.equal(canReadWorkoutData(assignedTrainer, profile.id, [profile.id]), true);
  assert.equal(canReadWorkoutData(otherTrainer, profile.id, []), false);
  assert.equal(canWriteWorkoutData(client, profile.id), true);
  assert.equal(canWriteWorkoutData(assignedTrainer, profile.id), false);
});

test("duplicate in-flight submissions share one save operation", async () => {
  let calls = 0;
  let finish!: (value: string) => void;
  const submitOnce = createInFlightDeduper<string>();
  const save = () => {
    calls += 1;
    return new Promise<string>((resolve) => { finish = resolve; });
  };
  const first = submitOnce("client-1:2026-10-27", save);
  const second = submitOnce("client-1:2026-10-27", save);
  assert.equal(first, second);
  assert.equal(calls, 1);
  finish("saved");
  assert.equal(await first, "saved");
  assert.equal(await second, "saved");
});

test("retrying a submission is idempotent for the same client and date", async () => {
  const port = new MemoryWorkoutPort();
  const actor: WorkoutActor = { id: profile.id, role: "client" };
  const session = completedSession();
  const first = await persistWorkoutSession(port, actor, profile.id, session);
  const second = await persistWorkoutSession(port, actor, profile.id, { ...session, id: "retry-id" });
  assert.equal(port.sessions.size, 1);
  assert.equal(first.id, second.id);
  assert.equal((await port.readSessions(profile.id)).length, 1);
});
