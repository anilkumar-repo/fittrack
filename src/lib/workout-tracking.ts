import { getExerciseDefinition } from "./templates.ts";
import type { CheckIn, ExerciseDefinition, ExerciseLog, ExerciseStatus, Profile, SessionStatus, WorkoutReview, WorkoutSession } from "./types.ts";

export interface WorkoutActor {
  id: string;
  role: "client" | "trainer";
}

export interface WorkoutPersistencePort {
  upsertSession(ownerId: string, session: WorkoutSession, status: SessionStatus): Promise<string>;
  upsertCheckIn(ownerId: string, sessionId: string, checkIn: CheckIn): Promise<void>;
  upsertExerciseLog(ownerId: string, sessionId: string, log: ExerciseLog): Promise<string>;
  upsertSets(ownerId: string, sessionId: string, exerciseLogId: string, log: ExerciseLog): Promise<void>;
  upsertReview(ownerId: string, sessionId: string, review: WorkoutReview): Promise<void>;
  finalizeSession(ownerId: string, sessionId: string, session: WorkoutSession): Promise<void>;
  readSessions(ownerId: string): Promise<WorkoutSession[]>;
}

const NOTE_LIMIT = 2000;
const DISCOMFORT_LIMIT = 1000;

export function createExerciseLog(exerciseId: string, plannedSets: number, reps: string | number): ExerciseLog {
  const plannedReps = typeof reps === "number" ? reps : Number.parseInt(reps, 10) || 8;
  return {
    exerciseId,
    plannedSets,
    plannedReps,
    status: "not_started",
    substitutionName: "",
    formQuality: "not_rated",
    sets: Array.from({ length: plannedSets }, () => ({ plannedReps, actualReps: null, loadKg: null, completed: false, extra: false })),
    notes: "",
  };
}

export function statusForSets(sets: ExerciseLog["sets"]): ExerciseStatus {
  const completed = sets.filter((set) => set.completed).length;
  if (completed === 0) return "not_started";
  return completed === sets.length ? "completed" : "partial";
}

export function validateWorkoutSession(session: WorkoutSession): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.date) || Number.isNaN(Date.parse(`${session.date}T12:00:00Z`))) errors.push("Choose a valid workout date.");
  const planExercises = Array.isArray(session.plan?.exercises) ? session.plan.exercises : [];
  if (planExercises.length < 1 || planExercises.length > 20) errors.push("The workout plan must include 1–20 exercises.");
  if (new Set(planExercises.map((exercise) => exercise.id)).size !== planExercises.length) errors.push("This workout plan contains duplicate exercises.");
  if (session.status === "in_progress" || session.status === "completed") {
    if (!session.checkIn) errors.push("Complete the pre-workout check-in before saving this session.");
    else errors.push(...validateCheckIn(session.checkIn));
  }
  if (session.checkIn && !(session.status === "in_progress" || session.status === "completed")) errors.push(...validateCheckIn(session.checkIn));

  const expectedIds = new Set(planExercises.map((exercise) => exercise.id));
  const loggedIds = new Set<string>();
  if (!Array.isArray(session.exerciseLogs)) errors.push("Exercise logs must be a list.");
  else {
    for (const log of session.exerciseLogs) {
      if (!expectedIds.has(log.exerciseId)) errors.push(`Exercise ${log.exerciseId} is not part of this workout plan.`);
      if (loggedIds.has(log.exerciseId)) errors.push(`Exercise ${log.exerciseId} is logged more than once.`);
      loggedIds.add(log.exerciseId);
      if (!Number.isInteger(log.plannedSets) || log.plannedSets < 1 || log.plannedSets > 20) errors.push(`${log.exerciseId}: planned sets must be between 1 and 20.`);
      if (!Number.isInteger(log.plannedReps) || log.plannedReps < 1 || log.plannedReps > 1000) errors.push(`${log.exerciseId}: planned reps must be between 1 and 1000.`);
      if (typeof log.notes !== "string" || log.notes.length > NOTE_LIMIT) errors.push(`${log.exerciseId}: exercise notes must be at most ${NOTE_LIMIT} characters.`);
      if (typeof log.substitutionName !== "string" || log.substitutionName.length > 120) errors.push(`${log.exerciseId}: substitution name must be at most 120 characters.`);
      if (!(log.formQuality === "not_rated" || log.formQuality === "sound" || log.formQuality === "needs_practice")) errors.push(`${log.exerciseId}: choose a valid form rating.`);
      if (!Array.isArray(log.sets) || log.sets.length > 30) errors.push(`${log.exerciseId}: log at most 30 sets.`);
      else {
        for (const [index, set] of log.sets.entries()) {
          if (set.plannedReps !== null && (!Number.isInteger(set.plannedReps) || set.plannedReps < 1 || set.plannedReps > 1000)) errors.push(`${log.exerciseId}, set ${index + 1}: planned reps are invalid.`);
          if (set.actualReps !== null && (!Number.isInteger(set.actualReps) || set.actualReps < 1 || set.actualReps > 1000)) errors.push(`${log.exerciseId}, set ${index + 1}: actual reps must be between 1 and 1000.`);
          if (set.loadKg !== null && (!Number.isFinite(set.loadKg) || set.loadKg < 0 || set.loadKg > 2000)) errors.push(`${log.exerciseId}, set ${index + 1}: weight must be between 0 and 2000 kg.`);
          if (set.completed && set.actualReps === null) errors.push(`${log.exerciseId}, set ${index + 1}: enter actual reps before marking the set complete.`);
          if (log.status === "skipped" && set.completed) errors.push(`${log.exerciseId}: a skipped exercise cannot contain completed sets.`);
        }
      }
      if (log.status !== "skipped" && Array.isArray(log.sets) && log.status !== statusForSets(log.sets)) errors.push(`${log.exerciseId}: exercise status does not match its completed sets.`);
    }
    if (session.status !== "planned" && expectedIds.size !== loggedIds.size) errors.push("Save a log for every exercise in this workout.");
  }

  if (session.review) errors.push(...validateReview(session.review));
  if (session.status === "completed") {
    if (!session.review) errors.push("Complete the post-workout review before saving a finished session.");
    if (!session.exerciseLogs.some((log) => log.status !== "not_started")) errors.push("Log at least one completed, partial, or skipped exercise before finishing.");
  }
  return [...new Set(errors)];
}

export function validateCheckIn(checkIn: CheckIn): string[] {
  const errors: string[] = [];
  if (!score(checkIn.energy, 1, 5)) errors.push("Energy must be rated from 1 to 5.");
  if (!score(checkIn.soreness, 1, 5)) errors.push("Soreness must be rated from 1 to 5.");
  if (typeof checkIn.pain !== "boolean") errors.push("Pain or discomfort must be answered.");
  if (!score(checkIn.recovery, 1, 5)) errors.push("Recovery must be rated from 1 to 5.");
  if (typeof checkIn.discomfort !== "string" || checkIn.discomfort.length > DISCOMFORT_LIMIT || typeof checkIn.note !== "string" || checkIn.note.length > NOTE_LIMIT) errors.push("Check-in notes are too long.");
  return errors;
}

export function validateReview(review: WorkoutReview): string[] {
  const errors: string[] = [];
  if (!score(review.effort, 1, 10)) errors.push("Effort must be rated from 1 to 10.");
  if (!(review.mood === "better" || review.mood === "same" || review.mood === "tougher")) errors.push("Choose how the workout compared with expectations.");
  if (!score(review.energyAfter, 1, 5)) errors.push("After-workout energy must be rated from 1 to 5.");
  if (typeof review.discomfort !== "boolean") errors.push("Discomfort must be answered.");
  if (typeof review.discomfortNote !== "string" || review.discomfortNote.length > DISCOMFORT_LIMIT || typeof review.note !== "string" || review.note.length > NOTE_LIMIT) errors.push("Review notes are too long.");
  return errors;
}

function score(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function canReadWorkoutData(actor: WorkoutActor, ownerId: string, activeTrainerClientIds: string[] = []): boolean {
  return actor.id === ownerId || (actor.role === "trainer" && activeTrainerClientIds.includes(ownerId));
}

export function canWriteWorkoutData(actor: WorkoutActor, ownerId: string): boolean {
  return actor.id === ownerId;
}

export async function persistWorkoutSession(port: WorkoutPersistencePort, actor: WorkoutActor, ownerId: string, session: WorkoutSession): Promise<WorkoutSession> {
  if (!canWriteWorkoutData(actor, ownerId)) throw new Error("You can only save workout sessions for your own account.");
  const validationErrors = validateWorkoutSession(session);
  if (validationErrors.length) throw new Error(validationErrors.join(" "));

  // Keep the parent session visibly in progress until all child rows are written.
  const pendingStatus: SessionStatus = session.status === "completed" ? "in_progress" : session.status;
  const sessionId = await port.upsertSession(ownerId, session, pendingStatus);
  if (session.checkIn) await port.upsertCheckIn(ownerId, sessionId, session.checkIn);
  for (const log of session.exerciseLogs) {
    const exerciseLogId = await port.upsertExerciseLog(ownerId, sessionId, log);
    await port.upsertSets(ownerId, sessionId, exerciseLogId, log);
  }
  if (session.review) await port.upsertReview(ownerId, sessionId, session.review);
  await port.finalizeSession(ownerId, sessionId, session);
  return { ...session, id: sessionId };
}

export async function retrieveWorkoutSessions(port: WorkoutPersistencePort, actor: WorkoutActor, ownerId: string, activeTrainerClientIds: string[] = []): Promise<WorkoutSession[]> {
  if (!canReadWorkoutData(actor, ownerId, activeTrainerClientIds)) throw new Error("You are not authorized to view these workout sessions.");
  return port.readSessions(ownerId);
}

export function createInFlightDeduper<T>(): (key: string, run: () => Promise<T>) => Promise<T> {
  const pending = new Map<string, Promise<T>>();
  return (key, run) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const operation = run().finally(() => pending.delete(key));
    pending.set(key, operation);
    return operation;
  };
}

export function normalizeWorkoutSession(raw: WorkoutSession | Record<string, unknown>): WorkoutSession | null {
  const value = raw as Record<string, unknown>;
  const sourcePlan = value.plan as Partial<WorkoutSession["plan"]> | undefined;
  if (!sourcePlan || !Array.isArray(sourcePlan.exercises)) return null;
  const exercises = sourcePlan.exercises.map((rawExercise) => {
    const source = rawExercise as ExerciseDefinition;
    const libraryEntry = getExerciseDefinition(String(source.id ?? ""));
    const merged = { ...libraryEntry, ...source };
    return {
      ...merged,
      cues: Array.isArray(source.cues) ? source.cues.filter((item): item is string => typeof item === "string") : libraryEntry?.cues ?? [],
      instructions: Array.isArray(source.instructions) ? source.instructions.filter((item): item is string => typeof item === "string") : libraryEntry?.instructions ?? ["Use a comfortable setup and ask your trainer to demonstrate the movement before you begin."],
      targetMuscles: Array.isArray(source.targetMuscles) ? source.targetMuscles.filter((item): item is string => typeof item === "string") : libraryEntry?.targetMuscles ?? [],
      difficulty: source.difficulty === "intermediate" ? "intermediate" as const : source.difficulty === "beginner" ? "beginner" as const : libraryEntry?.difficulty ?? "beginner" as const,
      cautionNotes: Array.isArray(source.cautionNotes) ? source.cautionNotes.filter((item): item is string => typeof item === "string") : libraryEntry?.cautionNotes ?? [],
      manualOverride: source.manualOverride === true,
    };
  });
  const plan = {
    ...sourcePlan,
    exercises,
    phase: sourcePlan.phase === "foundation_2" || sourcePlan.phase === "return" ? sourcePlan.phase : "foundation_1",
    sessionType: sourcePlan.sessionType === "recovery" ? "recovery" : "training",
    sourceExerciseIds: Array.isArray(sourcePlan.sourceExerciseIds) ? sourcePlan.sourceExerciseIds : exercises.map((exercise) => exercise.id),
    originalExercises: Array.isArray(sourcePlan.originalExercises) ? sourcePlan.originalExercises : exercises.map(({ id, name, sets, reps, equipment }) => ({ id, name, sets, reps, equipment })),
    generationReasons: Array.isArray(sourcePlan.generationReasons) ? sourcePlan.generationReasons.filter((reason): reason is string => typeof reason === "string") : ["Saved plan from an earlier FitTrack rules version."],
  } as WorkoutSession["plan"];
  const oldLogs = Array.isArray(value.exerciseLogs) ? value.exerciseLogs as Array<Record<string, unknown>> : [];
  const exerciseLogs: ExerciseLog[] = plan.exercises.map((exercise) => {
    const existing = oldLogs.find((log) => log.exerciseId === exercise.id);
    if (!existing) return createExerciseLog(exercise.id, exercise.sets, exercise.reps);
    const legacySets = Array.isArray(existing.sets) ? existing.sets as Array<Record<string, unknown>> : [];
    const oldDone = existing.completed === true;
    const sets = legacySets.map((set) => {
      if ("actualReps" in set || "completed" in set) {
        return {
          plannedReps: typeof set.plannedReps === "number" ? set.plannedReps : null,
          actualReps: typeof set.actualReps === "number" ? set.actualReps : null,
          loadKg: typeof set.loadKg === "number" ? set.loadKg : null,
          completed: set.completed === true,
          extra: set.extra === true,
        };
      }
      const reps = typeof set.reps === "number" ? set.reps : null;
      return { plannedReps: reps, actualReps: oldDone ? reps : null, loadKg: typeof set.loadKg === "number" ? set.loadKg : null, completed: oldDone, extra: false };
    });
    const oldStatus = existing.status;
    const status: ExerciseStatus = oldStatus === "skipped" ? "skipped" : oldStatus === "completed" || oldStatus === "partial" || oldStatus === "not_started" ? oldStatus : oldDone ? "completed" : statusForSets(sets);
    return {
      exerciseId: exercise.id,
      plannedSets: typeof existing.plannedSets === "number" ? existing.plannedSets : exercise.sets,
      plannedReps: typeof existing.plannedReps === "number" ? existing.plannedReps : Number.parseInt(exercise.reps, 10) || 8,
      status,
      substitutionName: typeof existing.substitutionName === "string" ? existing.substitutionName : "",
      formQuality: existing.formQuality === "sound" || existing.formQuality === "needs_practice" ? existing.formQuality : "not_rated",
      sets,
      notes: typeof existing.notes === "string" ? existing.notes : "",
    };
  });
  const rawCheckIn = value.checkIn as Partial<CheckIn> | undefined;
  const checkIn: CheckIn | undefined = rawCheckIn ? {
    energy: Number(rawCheckIn.energy ?? 3), soreness: Number(rawCheckIn.soreness ?? 1), pain: rawCheckIn.pain === true,
    recovery: Number(rawCheckIn.recovery ?? 3), discomfort: String(rawCheckIn.discomfort ?? ""), note: String(rawCheckIn.note ?? ""),
  } : undefined;
  const rawReview = value.review as Partial<WorkoutReview> | undefined;
  const review: WorkoutReview | undefined = rawReview ? {
    effort: Number(rawReview.effort ?? 5), mood: rawReview.mood === "better" || rawReview.mood === "tougher" ? rawReview.mood : "same",
    energyAfter: Number(rawReview.energyAfter ?? 3), discomfort: rawReview.discomfort === true,
    discomfortNote: String(rawReview.discomfortNote ?? ""), note: String(rawReview.note ?? ""),
  } : undefined;
  return {
    id: String(value.id ?? ""), date: String(value.date ?? ""), status: value.status === "completed" || value.status === "skipped" || value.status === "in_progress" ? value.status : "planned",
    plan, exerciseLogs, ...(checkIn ? { checkIn } : {}), ...(review ? { review } : {}),
    ...(typeof value.completedAt === "string" ? { completedAt: value.completedAt } : {}),
  };
}

export function deadliftRuleIsTrainerApproved(profile: Profile): boolean {
  return profile.deadliftEnabled;
}
