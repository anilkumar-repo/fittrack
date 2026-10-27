import type { FitTrackState, Profile, WorkoutSession } from "./types";
import { normalizeWorkoutSession } from "./workout-tracking.ts";

export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isBuiltInDemoExample(session: WorkoutSession): boolean {
  return session.id === `demo-${session.date}` && session.status === "completed" &&
    session.completedAt === `${session.date}T10:00:00.000Z` &&
    session.review?.note === "A good steady session." && session.checkIn?.energy === 4 &&
    session.checkIn.soreness === 1 && !session.checkIn.pain && session.checkIn.recovery === 4 &&
    session.exerciseLogs.length === session.plan.exercises.length && session.exerciseLogs.every((log) =>
      log.status === "completed" && log.formQuality === "not_rated" && !log.notes && log.sets.length > 0 &&
      log.sets.every((set) => set.completed && set.loadKg === null && set.actualReps === set.plannedReps),
    );
}

export function createDemoState(): FitTrackState {
  const timeZone = "Asia/Kolkata";
  const today = todayInTimeZone(timeZone);
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 20);
  const profile: Profile = {
    id: "demo-user",
    displayName: "Maya",
    experience: "beginner",
    sessionsPerWeek: 3,
    trainingDays: [2, 4, 6],
    trainingStartDate: start.toISOString().slice(0, 10),
    timeZone,
    deadliftEnabled: false,
    trainerRole: false,
    preferredSessionMinutes: 40,
    equipmentAvailability: "unknown",
    availableEquipment: [],
  };
  return { profile, sessions: [], bodyWeightEntries: [], bodyWeightAvailable: true, selectedDate: today, mode: "demo" };
}

const STORAGE_KEY = "fittrack-demo-v1";

export function readDemoState(): FitTrackState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as FitTrackState;
    if (value.mode !== "demo" || !value.profile || !Array.isArray(value.sessions)) return null;
    const sessions = value.sessions.map((session) => normalizeWorkoutSession(session)).filter((session): session is WorkoutSession => session !== null)
      .map((session) => isBuiltInDemoExample(session) ? { ...session, sampleData: true } : session);
    const bodyWeightEntries = Array.isArray(value.bodyWeightEntries)
      ? value.bodyWeightEntries.filter((entry) => entry && typeof entry.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.measuredOn) && Number.isFinite(entry.weightKg) && entry.weightKg >= 20 && entry.weightKg <= 500)
      : [];
    return { ...value, sessions, bodyWeightEntries, bodyWeightAvailable: true };
  } catch {
    return null;
  }
}

export function writeDemoState(state: FitTrackState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The current session remains usable if browser storage is unavailable.
  }
}
