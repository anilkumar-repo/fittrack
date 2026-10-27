import type { BodyWeightEntry, ExerciseLog, Profile, WorkoutSession } from "./types.ts";

export type RecordedSessionStatus = "completed" | "partial" | "skipped" | "planned" | "in_progress";
export type ProgressDayStatus = RecordedSessionStatus | "rest_day" | "no_record" | "not_started";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ProgressTimelineDay {
  date: string;
  status: ProgressDayStatus;
  isScheduledTrainingDay: boolean;
  session?: WorkoutSession;
}

export interface ConsistencySummary extends DateRange {
  scheduledDays: number;
  completedScheduledDays: number;
  percent: number | null;
}

export interface ActualSetResult {
  setNumber: number;
  plannedReps: number | null;
  actualReps: number | null;
  loadKg: number | null;
  completed: boolean;
  extra: boolean;
}

export interface ExercisePerformanceRecord {
  date: string;
  sessionStatus: RecordedSessionStatus;
  plannedSets: number;
  plannedReps: number;
  completedSets: number;
  completedReps: number;
  heaviestRecordedLoadKg: number | null;
  sets: ActualSetResult[];
}

export interface ExercisePerformance {
  exerciseId: string;
  exerciseName: string;
  records: ExercisePerformanceRecord[];
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  loadKg: number;
  reps: number;
  date: string;
}

export interface RecoveryMetrics extends DateRange {
  checkInCount: number;
  reviewCount: number;
  averageEnergy: number | null;
  averageSoreness: number | null;
  averageEnergyAfter: number | null;
  painCheckIns: number;
  postWorkoutDiscomfortReports: number;
  skippedExercises: Array<{ exerciseId: string; exerciseName: string; count: number; latestDate: string }>;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftIsoDate(date: string, amount: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted.toISOString().slice(0, 10);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number | null {
  return values.length ? roundOne(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function withinRange(date: string, range: DateRange): boolean {
  return date >= range.startDate && date <= range.endDate;
}

export function createProgressDateRange(endDate: string, days = 28): DateRange | null {
  if (!isIsoDate(endDate) || !Number.isInteger(days) || days < 1 || days > 366) return null;
  return { startDate: shiftIsoDate(endDate, -(days - 1)), endDate };
}

export function recordedSessionStatus(session: WorkoutSession): RecordedSessionStatus {
  if (session.status === "completed" || session.status === "skipped" || session.status === "planned") return session.status;
  const hasCompletedPerformance = session.exerciseLogs.some((log) =>
    log.status === "partial" || log.status === "completed" || log.sets.some((set) => set.completed && set.actualReps !== null),
  );
  return hasCompletedPerformance ? "partial" : "in_progress";
}

export function buildProgressTimeline(
  profile: Profile,
  sessions: WorkoutSession[],
  endDate: string,
  days = 28,
): ProgressTimelineDay[] {
  const range = createProgressDateRange(endDate, days);
  if (!range) return [];
  const byDate = new Map(sessions.map((session) => [session.date, session]));
  const trainingDays = new Set(profile.trainingDays);
  const programStart = isIsoDate(profile.trainingStartDate) ? profile.trainingStartDate : range.startDate;
  const timeline: ProgressTimelineDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftIsoDate(range.startDate, offset);
    const isScheduledTrainingDay = trainingDays.has(new Date(`${date}T12:00:00Z`).getUTCDay());
    const session = byDate.get(date);
    timeline.push({
      date,
      isScheduledTrainingDay,
      status: session ? recordedSessionStatus(session) : date < programStart ? "not_started" : isScheduledTrainingDay ? "no_record" : "rest_day",
      ...(session ? { session } : {}),
    });
  }
  return timeline;
}

export function calculateConsistency(
  profile: Profile,
  sessions: WorkoutSession[],
  endDate: string,
  days = 28,
): ConsistencySummary | null {
  const range = createProgressDateRange(endDate, days);
  if (!range) return null;
  const trainingDays = new Set(profile.trainingDays);
  const scheduledDates = new Set<string>();
  const programStart = isIsoDate(profile.trainingStartDate) ? profile.trainingStartDate : range.startDate;
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftIsoDate(range.startDate, offset);
    if (date >= programStart && trainingDays.has(new Date(`${date}T12:00:00Z`).getUTCDay())) scheduledDates.add(date);
  }
  const completedDates = new Set(sessions
    .filter((session) => session.status === "completed" && withinRange(session.date, range) && scheduledDates.has(session.date))
    .map((session) => session.date));
  const completedScheduledDays = completedDates.size;
  return {
    ...range,
    scheduledDays: scheduledDates.size,
    completedScheduledDays,
    percent: scheduledDates.size ? Math.round(completedScheduledDays / scheduledDates.size * 100) : null,
  };
}

function completedSetResults(log: ExerciseLog): ActualSetResult[] {
  return log.sets.map((set, index) => ({
    setNumber: index + 1,
    plannedReps: set.plannedReps,
    actualReps: set.actualReps,
    loadKg: set.loadKg,
    completed: set.completed,
    extra: set.extra,
  }));
}

export function buildExercisePerformance(sessions: WorkoutSession[]): ExercisePerformance[] {
  const groups = new Map<string, ExercisePerformance>();
  const orderedSessions = [...sessions].filter((session) => session.status !== "planned").sort((a, b) => a.date.localeCompare(b.date));
  for (const session of orderedSessions) {
    const status = recordedSessionStatus(session);
    for (const log of session.exerciseLogs) {
      const exercise = session.plan.exercises.find((item) => item.id === log.exerciseId);
      const actualName = log.substitutionName.trim() || exercise?.name || log.exerciseId;
      const actualId = log.substitutionName.trim() ? `substitution:${log.substitutionName.trim().toLocaleLowerCase()}` : log.exerciseId;
      const recordSets = completedSetResults(log);
      const actualSets = recordSets.filter((set) => set.completed && Number.isInteger(set.actualReps) && (set.actualReps ?? 0) > 0);
      if (actualSets.length === 0) continue;
      const recordedLoads = actualSets.map((set) => set.loadKg).filter((load): load is number => typeof load === "number" && Number.isFinite(load) && load >= 0);
      const record: ExercisePerformanceRecord = {
        date: session.date,
        sessionStatus: status,
        plannedSets: log.plannedSets,
        plannedReps: log.plannedReps,
        completedSets: actualSets.length,
        completedReps: actualSets.reduce((sum, set) => sum + (set.actualReps ?? 0), 0),
        heaviestRecordedLoadKg: recordedLoads.length ? Math.max(...recordedLoads) : null,
        sets: recordSets,
      };
      const group = groups.get(actualId) ?? { exerciseId: actualId, exerciseName: actualName, records: [] };
      group.records.push(record);
      groups.set(log.exerciseId, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function calculatePersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();
  for (const performance of buildExercisePerformance(sessions)) {
    for (const record of performance.records) {
      for (const set of record.sets) {
        const reps = set.actualReps;
        if (!set.completed || typeof reps !== "number" || !Number.isInteger(reps) || reps <= 0 || typeof set.loadKg !== "number" || !Number.isFinite(set.loadKg) || set.loadKg <= 0) continue;
        const current = records.get(performance.exerciseId);
        if (!current || set.loadKg > current.loadKg || (set.loadKg === current.loadKg && record.date > current.date)) {
          records.set(performance.exerciseId, {
            exerciseId: performance.exerciseId,
            exerciseName: performance.exerciseName,
            loadKg: set.loadKg,
            reps,
            date: record.date,
          });
        }
      }
    }
  }
  return [...records.values()].sort((a, b) => b.loadKg - a.loadKg || a.exerciseName.localeCompare(b.exerciseName));
}

export function calculateRecoveryMetrics(sessions: WorkoutSession[], endDate: string, days = 28): RecoveryMetrics | null {
  const range = createProgressDateRange(endDate, days);
  if (!range) return null;
  const recent = sessions.filter((session) => session.status !== "planned" && withinRange(session.date, range));
  const checkIns = recent.map((session) => session.checkIn).filter((checkIn): checkIn is NonNullable<WorkoutSession["checkIn"]> => Boolean(checkIn));
  const skipped = new Map<string, { exerciseId: string; exerciseName: string; count: number; latestDate: string }>();
  for (const session of recent) {
    for (const log of session.exerciseLogs.filter((item) => item.status === "skipped")) {
      const exerciseName = session.plan.exercises.find((exercise) => exercise.id === log.exerciseId)?.name ?? log.exerciseId;
      const current = skipped.get(log.exerciseId);
      skipped.set(log.exerciseId, {
        exerciseId: log.exerciseId,
        exerciseName,
        count: (current?.count ?? 0) + 1,
        latestDate: !current || session.date > current.latestDate ? session.date : current.latestDate,
      });
    }
  }
  return {
    ...range,
    checkInCount: checkIns.length,
    reviewCount: recent.filter((session) => Boolean(session.review)).length,
    averageEnergy: mean(checkIns.map((checkIn) => checkIn.energy).filter(Number.isFinite)),
    averageSoreness: mean(checkIns.map((checkIn) => checkIn.soreness).filter(Number.isFinite)),
    averageEnergyAfter: mean(recent.map((session) => session.review?.energyAfter).filter((value): value is number => typeof value === "number" && Number.isFinite(value))),
    painCheckIns: checkIns.filter((checkIn) => checkIn.pain).length,
    postWorkoutDiscomfortReports: recent.filter((session) => session.review?.discomfort === true).length,
    skippedExercises: [...skipped.values()].sort((a, b) => b.count - a.count || a.exerciseName.localeCompare(b.exerciseName)),
  };
}

export function validateBodyWeightEntry(measuredOn: string, weightKg: number, today: string): string[] {
  const errors: string[] = [];
  if (!isIsoDate(measuredOn)) errors.push("Enter a valid measurement date.");
  else if (isIsoDate(today) && measuredOn > today) errors.push("A measurement date cannot be in the future.");
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500) errors.push("Weight must be between 20 and 500 kg.");
  else if (Math.round(weightKg * 100) !== weightKg * 100) errors.push("Weight can use at most two decimal places.");
  return errors;
}

export function upsertBodyWeightEntry(entries: BodyWeightEntry[], entry: BodyWeightEntry): BodyWeightEntry[] {
  return [...entries.filter((item) => item.measuredOn !== entry.measuredOn), entry].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
}

export function bodyWeightTrend(entries: BodyWeightEntry[]): Array<{ date: string; weightKg: number }> {
  return [...entries].filter((entry) => isIsoDate(entry.measuredOn) && Number.isFinite(entry.weightKg) && entry.weightKg >= 20 && entry.weightKg <= 500)
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn))
    .map(({ measuredOn, weightKg }) => ({ date: measuredOn, weightKg }));
}

export function canAccessOwnerProgress(actorId: string, ownerId: string): boolean {
  return actorId.length > 0 && actorId === ownerId;
}
