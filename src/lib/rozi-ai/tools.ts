// ---------- Rozi AI: tools ----------
//
// The model never sees the database and never calculates fitness facts. It asks for them through these tools; each
// one runs RozFit's EXISTING modules (planner, progress, recovery, streak, library…) on the person's own data and
// returns a small, plain summary for the model plus a card for the screen.
//
// Privacy: tool results never include the person's name, email, phone or account id.

import { BMI_BAND_LABEL, bmi, bmiBand } from "../body.ts";
import { calculateAchievements } from "../achievements.ts";
import { dateLabel, nextTrainingDate, shiftDate, weekDates, weekdayOf } from "../dates.ts";
import { exactExerciseMatch, exerciseEquipmentIsAvailable, exerciseSearchRank, getExerciseReferenceInstructions, getSafeExerciseAlternatives, isDeadliftVariation, isExerciseAllowedForProfile } from "../exercise-library.ts";
import { levelOf, levelTitle } from "../levels.ts";
import { mobilityMove, routineMinutes, suggestionForDay } from "../mobility.ts";
import { generateWorkout } from "../planner.ts";
import { goalOf, goalTitle } from "../program.ts";
import { buildExercisePerformance, calculatePersonalRecords, recordedSessionStatus } from "../progress.ts";
import { GROUP_LABELS, MUSCLE_GROUPS, muscleRecovery, readyCount, sessionGroupSets, STATUS_LABELS, weeklyReport, type MuscleGroup } from "../recovery.ts";
import { calculateStreak } from "../rozi.ts";
import { planWorkout } from "../rozi-plan.ts";
import { ACTIVITY_OPTIONS } from "../onboarding.ts";
import { EQUIPMENT_OPTIONS, EXERCISE_LIBRARY } from "../templates.ts";
import { DEFAULT_TRAINER_RULE_SETTINGS, profileWithTrainerEquipment } from "../trainer-rules.ts";
import type { BodyWeightEntry, ExerciseDefinition, FitTrackState, Profile, TrainerRuleSettings, WorkoutPlan, WorkoutSession } from "../types";
import { swapCard, type RoziCard } from "./cards.ts";
import { swapSuggestion, SWAP_BLOCK_TEXT } from "../exercise-swap.ts";
import type { AiTool } from "./provider.ts";
import { trackingOf, UNIT_WORD } from "../tracking.ts";
import { variationsOf } from "../exercise-variations.ts";

// ---------- What the tools work on ----------

export interface RoziContext {
  profile: Profile;
  /** The profile with the trainer's equipment rules applied (what plans and alternatives must respect). */
  planningProfile: Profile;
  /** Real saved sessions (no sample data), any status. */
  sessions: WorkoutSession[];
  bodyWeightEntries: BodyWeightEntry[];
  trainerRuleSettings: TrainerRuleSettings;
  trainerRuleRevision: number;
  /** Notes the person saved for Rozi to remember (R10, only with ROZI_MEMORY=on). Newest first. */
  memories?: Array<{ kind: string; note: string }>;
  /** Today in the person's time zone (YYYY-MM-DD) and the hour there. */
  today: string;
  hour: number;
}

/** Builds the tools' context from a loaded account, the same way the app's provider does. */
export function roziContext(state: Pick<FitTrackState, "profile" | "sessions" | "bodyWeightEntries" | "trainerRuleSettings" | "trainerRuleRevision">, today: string, hour: number): RoziContext {
  const trainerRuleSettings = state.trainerRuleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS;
  return {
    profile: state.profile,
    planningProfile: profileWithTrainerEquipment(state.profile, trainerRuleSettings),
    sessions: state.sessions.filter((session) => !session.sampleData),
    bodyWeightEntries: [...state.bodyWeightEntries].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)),
    trainerRuleSettings,
    trainerRuleRevision: state.trainerRuleRevision ?? 1,
    today,
    hour,
  };
}

export interface ToolOutcome {
  /** What the model reads. Small and plain. */
  result: Record<string, unknown>;
  card?: RoziCard;
}

// ---------- Reading the model's arguments safely (they're untrusted input) ----------

type Args = Record<string, unknown>;

function text(args: Args, key: string, max = 60): string {
  const value = args[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function whole(args: Args, key: string, min: number, max: number): number | null {
  const value = Number(args[key]);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : null;
}

function oneOf<T extends string>(args: Args, key: string, options: readonly T[], fallback: T): T {
  const value = text(args, key).toLowerCase().replace(/[\s-]+/g, "_");
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** "today", "tomorrow", "yesterday" or a date (YYYY-MM-DD) within about a year back and two months ahead. */
export function resolveDay(value: string, today: string): string {
  const word = value.toLowerCase();
  if (word === "tomorrow") return shiftDate(today, 1);
  if (word === "yesterday") return shiftDate(today, -1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= shiftDate(today, -400) && value <= shiftDate(today, 60) && shiftDate(value, 0) === value) return value;
  return today;
}

const COMMON_VERSION = /^(barbell|dumbbell|bodyweight)\b/i;
const SPECIALTY_VERSION = /^(hack|smith|wrist|reverse|assisted|sliding|supported|incline|prone|ez-bar|landmine|straight-arm)\b/i;

/**
 * The library exercise the person named ("bench", "squats", "pull ups", "RDL"), or null. Only a real name match
 * counts — Rozi must never explain a different exercise than the one asked about. An exact name wins; among several
 * matches it prefers one the person has logged, then one their equipment allows, then a common version
 * (barbell / dumbbell / bodyweight) over a specialty one, then the shorter name.
 */
export function findExercise(query: string, ctx?: Pick<RoziContext, "planningProfile" | "sessions">): ExerciseDefinition | null {
  const cleaned = query.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\b(the|my|an?|exercises?|how to do|do)\b/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return null;
  const singular = cleaned.split(" ").map((word) => (word.length > 2 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)).join(" ");
  // Other names ("RDL", "OHP", "pull ups") are on the exercises themselves (exercise-taxonomy.ts) and match like a name.
  const tries = [...new Set([cleaned, singular])];
  const logged = new Set(ctx?.sessions.flatMap((session) => session.exerciseLogs.filter((log) => log.sets.some((set) => set.completed)).map((log) => log.exerciseId)) ?? []);
  const score = (exercise: ExerciseDefinition) => [
    logged.has(exercise.id) ? 0 : 1,
    ctx && !exerciseEquipmentIsAvailable(exercise, ctx.planningProfile) ? 1 : 0,
    COMMON_VERSION.test(exercise.name) ? 0 : SPECIALTY_VERSION.test(exercise.name) ? 2 : 1,
    exercise.name.split(/\s+/).length,
  ];
  for (const attempt of tries) {
    const exact = exactExerciseMatch(EXERCISE_LIBRARY, attempt);
    if (exact) return exact;
    const named = EXERCISE_LIBRARY.filter((exercise) => exerciseSearchRank(exercise, attempt) === 0).sort((a, b) => {
      const [x, y] = [score(a), score(b)];
      for (let index = 0; index < x.length; index++) if (x[index] !== y[index]) return x[index] - y[index];
      return a.name.localeCompare(b.name);
    });
    if (named[0]) return named[0];
  }
  return null;
}

const MUSCLE_WORDS: Array<[MuscleGroup, RegExp]> = [
  ["chest", /chest|pec/], ["back", /back|lat|trap|row/], ["shoulders", /shoulder|delt/],
  ["arms", /arm|bicep|tricep|forearm/], ["legs", /leg|quad|hamstring|glute|calf|calves|thigh|hip/], ["core", /core|ab|oblique/],
];

/** A muscle group from words like "pecs", "quads", "abs". */
export function muscleOf(value: string): MuscleGroup | null {
  const word = value.toLowerCase();
  return MUSCLE_WORDS.find(([, pattern]) => pattern.test(word))?.[0] ?? null;
}

// ---------- Small shared summaries ----------

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function setsDone(session: WorkoutSession): number {
  return session.exerciseLogs.reduce((sum, log) => sum + log.sets.filter((set) => set.completed).length, 0);
}

function sessionSummary(session: WorkoutSession) {
  return {
    date: session.date,
    day: dateLabel(session.date),
    title: session.plan.title,
    status: recordedSessionStatus(session),
    setsDone: setsDone(session),
    moves: session.plan.exercises.slice(0, 8).map((exercise) => exercise.name),
  };
}

function completedSessions(ctx: RoziContext): WorkoutSession[] {
  return ctx.sessions.filter((session) => session.status === "completed" && session.date <= ctx.today).sort((a, b) => a.date.localeCompare(b.date));
}

function workoutHref(date: string, today: string): string {
  return date === today ? "/today" : `/today?date=${date}`;
}

// ---------- The tools ----------

/** A day's saved session (if any) and its plan: the saved one, or the planner's plan for that day (nothing is saved). */
function planForDay(ctx: RoziContext, date: string): { session: WorkoutSession | undefined; plan: WorkoutPlan | null } {
  const session = ctx.sessions.find((item) => item.date === date);
  const plan: WorkoutPlan | null = session?.plan ?? generateWorkout({
    date, profile: ctx.profile, sessions: ctx.sessions, trainerRuleSettings: ctx.trainerRuleSettings, trainerRuleRevision: ctx.trainerRuleRevision,
  });
  return { session, plan };
}

/** A day's workout: the saved one, or the planner's plan for that day (read only — nothing is saved). */
function workoutForDay(ctx: RoziContext, date: string): ToolOutcome {
  const { session, plan } = planForDay(ctx, date);
  const base = { date, day: dateLabel(date), isToday: date === ctx.today, isPast: date < ctx.today };
  if (!plan) {
    return {
      result: { ...base, restDay: true, nextTrainingDay: nextTrainingDate(ctx.profile, date) },
      card: { type: "workout", date, title: "Rest day", status: "rest_day", minutes: null, exercises: [], link: { href: date === ctx.today ? "/today?extra=1" : workoutHref(date, ctx.today), label: date === ctx.today ? "Train anyway" : "Open day" } },
    };
  }
  const status = session ? recordedSessionStatus(session) : "planned";
  // One plain sentence about where this day stands, so the model can't overlook it (live test 2026-11-18: a finished
  // workout was cheered on as if it were still to do).
  const when = date === ctx.today ? "today" : date < ctx.today ? `on ${dateLabel(date)}` : `on ${dateLabel(date)} (upcoming)`;
  const done = session ? setsDone(session) : 0;
  const statusSentence = status === "completed" ? `The user already FINISHED this workout ${when} (${done} sets done). Congratulate them; don't tell them to start it.`
    : status === "in_progress" || status === "partial" ? `The user has STARTED this workout ${when} (${done} sets done so far); encourage them to finish.`
      : status === "skipped" ? `This workout was SKIPPED ${when}.`
        : date < ctx.today ? `This workout was planned ${when} and NOT logged; don't say it was done.`
          : `This workout is planned ${when} and not started yet.`;
  const exercises = plan.exercises.slice(0, 10).map((exercise) => ({ name: exercise.name, sets: exercise.sets, reps: exercise.reps, equipment: exercise.equipment, ...(exercise.selectionReason ? { why: exercise.selectionReason.slice(0, 160) } : {}) }));
  return {
    result: {
      ...base, restDay: false, statusSentence, title: plan.title, focus: plan.focus, status, minutes: plan.durationMinutes,
      ...(session && status !== "planned" ? { setsDone: setsDone(session) } : {}),
      level: plan.level ?? null, goal: plan.goal ? goalTitle(plan.goal) : null, week: plan.weekNumber ?? null, stage: plan.stage ?? null,
      lighterWeek: Boolean(plan.recoveryWeek || plan.lightWeek), recoveryDay: plan.sessionType === "recovery",
      whyThisWorkout: plan.generationReasons.slice(0, 5),
      exercises,
    },
    card: {
      type: "workout", date, title: plan.title,
      status: status === "planned" || status === "in_progress" || status === "completed" || status === "partial" || status === "skipped" ? status : "planned",
      minutes: plan.durationMinutes,
      exercises: plan.exercises.slice(0, 10).map((exercise) => ({ name: exercise.name, sets: exercise.sets, reps: exercise.reps })),
      link: { href: workoutHref(date, ctx.today), label: date === ctx.today ? (status === "in_progress" ? "Continue workout" : status === "completed" ? "View session" : "Start workout") : "Open day" },
    },
  };
}

const PERIODS = ["last_workout", "this_week", "last_week", "this_month", "last_month", "last_7_days", "last_30_days", "last_90_days"] as const;
type Period = typeof PERIODS[number];

function periodRange(period: Period, today: string): { from: string; to: string } {
  const week = weekDates(today);
  const month = today.slice(0, 7);
  const previousMonth = shiftDate(`${month}-01`, -1).slice(0, 7);
  switch (period) {
    case "this_week": return { from: week[0], to: today };
    case "last_week": return { from: shiftDate(week[0], -7), to: shiftDate(week[0], -1) };
    case "this_month": return { from: `${month}-01`, to: today };
    case "last_month": return { from: `${previousMonth}-01`, to: shiftDate(`${month}-01`, -1) };
    case "last_7_days": return { from: shiftDate(today, -6), to: today };
    case "last_90_days": return { from: shiftDate(today, -89), to: today };
    default: return { from: shiftDate(today, -29), to: today };
  }
}

function workoutHistory(ctx: RoziContext, args: Args): ToolOutcome {
  const period = oneOf(args, "period", PERIODS, "last_30_days");
  const muscle = muscleOf(text(args, "muscle"));
  const exercise = text(args, "exercise") ? findExercise(text(args, "exercise"), ctx) : null;
  const matches = (session: WorkoutSession) =>
    (!muscle || sessionGroupSets(session).some((hit) => hit.group === muscle && hit.sets > 0))
    && (!exercise || session.exerciseLogs.some((log) => log.exerciseId === exercise.id && log.sets.some((set) => set.completed)));
  const recorded = ctx.sessions.filter((session) => session.status !== "planned" && session.date <= ctx.today && matches(session)).sort((a, b) => b.date.localeCompare(a.date));

  if (period === "last_workout") {
    const last = recorded.find((session) => session.status === "completed");
    return {
      result: last ? { period, filter: { muscle, exercise: exercise?.name ?? null }, lastWorkout: sessionSummary(last), daysAgo: Math.round((Date.parse(ctx.today) - Date.parse(last.date)) / 86_400_000) } : { period, filter: { muscle, exercise: exercise?.name ?? null }, lastWorkout: null },
      card: last ? { type: "stat", title: "Last workout", value: last.plan.title, detail: `${dateLabel(last.date)} · ${setsDone(last)} sets`, link: { href: workoutHref(last.date, ctx.today), label: "Open it" } } : undefined,
    };
  }
  const range = periodRange(period, ctx.today);
  const inRange = recorded.filter((session) => session.date >= range.from && session.date <= range.to);
  const count = (status: string) => inRange.filter((session) => recordedSessionStatus(session) === status).length;
  const completed = count("completed");
  const partial = count("partial");
  const skipped = count("skipped");
  // One plain sentence with the counts, so the model can't overlook them (benchmark 2026-11-18: both gpt-oss models
  // said "no skipped workouts" when the result listed skipped: 2).
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const summary = `From ${dateLabel(range.from)} to ${dateLabel(range.to)}: ${plural(completed, "workout")} completed, ${partial} partly done, ${skipped} SKIPPED (missed).`;
  return {
    result: {
      period, from: range.from, to: range.to, filter: { muscle, exercise: exercise?.name ?? null }, summary,
      completed, partial, skipped, plannedPerWeek: ctx.profile.sessionsPerWeek,
      workouts: inRange.slice(0, 12).map(sessionSummary),
    },
    card: { type: "stat", title: `Workouts · ${period.replace(/_/g, " ")}`, value: String(completed), detail: `${dateLabel(range.from, { month: "short", day: "numeric" })} – ${dateLabel(range.to, { month: "short", day: "numeric" })}${muscle ? ` · ${GROUP_LABELS[muscle]}` : ""}${exercise ? ` · ${exercise.name}` : ""}`, link: { href: "/progress", label: "See progress" } },
  };
}

function progress(ctx: RoziContext, args: Args): ToolOutcome {
  const done = completedSessions(ctx);
  const query = text(args, "exercise");
  const records = calculatePersonalRecords(done);
  if (query) {
    const exercise = findExercise(query, ctx);
    const performance = exercise ? buildExercisePerformance(done).find((item) => item.exerciseId === exercise.id) : undefined;
    if (!exercise || !performance?.records.length) {
      return { result: { exercise: exercise?.name ?? query, matched: Boolean(exercise), logged: false, note: "No completed sets of this exercise are logged yet." } };
    }
    const history = performance.records.slice(-8).map((record) => ({ date: record.date, heaviestKg: record.heaviestRecordedLoadKg, sets: record.completedSets, reps: record.completedReps }));
    const loads = history.map((item) => item.heaviestKg).filter((kg): kg is number => kg !== null);
    const best = records.find((record) => record.exerciseId === exercise.id) ?? null;
    return {
      result: {
        exercise: exercise.name, logged: true, timesLogged: performance.records.length, history,
        // Timed exercises store seconds (holds) or minutes (cardio) in the "reps" fields.
        repsAreIn: UNIT_WORD[trackingOf(exercise).unit],
        bestSet: best ? { kg: best.loadKg, reps: best.reps, date: best.date } : null,
        heaviestChangeKg: loads.length >= 2 ? Math.round((loads[loads.length - 1] - loads[0]) * 10) / 10 : null,
        note: loads.length ? null : "Sets are logged without weights, so only sets and reps can be compared.",
      },
      card: {
        type: "progress", exercise: exercise.name,
        records: best ? [{ exercise: exercise.name, kg: best.loadKg, reps: best.reps, date: best.date }] : [],
        trend: history.map((item) => ({ date: item.date, kg: item.heaviestKg, sets: item.sets, reps: item.reps })),
        link: { href: "/progress", label: "See progress" },
      },
    };
  }
  const last28 = done.filter((session) => session.date >= shiftDate(ctx.today, -27));
  return {
    result: {
      workoutsCompleted: done.length, last28Days: last28.length, plannedPerWeek: ctx.profile.sessionsPerWeek,
      bestSets: records.slice(0, 6).map((record) => ({ exercise: record.exerciseName, kg: record.loadKg, reps: record.reps, date: record.date })),
      biggestImprovements: biggestImprovements(done),
      note: records.length ? null : "No weights are logged yet, so there are no best lifts.",
    },
    card: { type: "progress", exercise: null, records: records.slice(0, 6).map((record) => ({ exercise: record.exerciseName, kg: record.loadKg, reps: record.reps, date: record.date })), trend: [], link: { href: "/progress", label: "See progress" } },
  };
}

/**
 * Which exercises improved most: heaviest logged load in the first vs the latest workout of each exercise logged at
 * least twice with weights (from the existing performance records; nothing estimated). Biggest kg gain first.
 */
export function biggestImprovements(sessions: WorkoutSession[], limit = 3) {
  return buildExercisePerformance(sessions)
    .map((performance) => {
      const loaded = performance.records.filter((record) => record.heaviestRecordedLoadKg !== null);
      if (loaded.length < 2) return null;
      const first = loaded[0];
      const last = loaded[loaded.length - 1];
      const change = Math.round((last.heaviestRecordedLoadKg! - first.heaviestRecordedLoadKg!) * 10) / 10;
      return { exercise: performance.exerciseName, fromKg: first.heaviestRecordedLoadKg!, toKg: last.heaviestRecordedLoadKg!, changeKg: change, from: first.date, to: last.date, workouts: loaded.length };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.changeKg > 0)
    .sort((a, b) => b.changeKg - a.changeKg || a.exercise.localeCompare(b.exercise))
    .slice(0, limit);
}

function recovery(ctx: RoziContext, args: Args): ToolOutcome {
  const all = muscleRecovery(ctx.sessions, ctx.today);
  const muscle = muscleOf(text(args, "muscle"));
  const shown = muscle ? all.filter((item) => item.group === muscle) : all;
  return {
    result: {
      readyGroups: readyCount(all), totalGroups: MUSCLE_GROUPS.length,
      groups: shown.map((item) => ({ group: GROUP_LABELS[item.group], status: STATUS_LABELS[item.status], lastTrained: item.lastTrained, daysSince: item.daysSince, setsLastTime: item.lastSets, setsThisWeek: item.weekSets, readyOn: item.readyOn, exercisesLastTime: item.exercises.slice(0, 5) })),
      note: "Guides from logged sets and check-ins, not medical measurements. Pain means rest and, if it persists, see a professional.",
    },
    card: { type: "recovery", readyCount: readyCount(all), groups: all.map((item) => ({ group: item.group, label: GROUP_LABELS[item.group], status: item.status, statusLabel: STATUS_LABELS[item.status], readyOn: item.readyOn })), link: { href: "/recovery", label: "Open recovery map" } },
  };
}

function streak(ctx: RoziContext): ToolOutcome {
  const value = calculateStreak(ctx.profile, ctx.sessions, ctx.today);
  return {
    result: { ...value },
    card: { type: "stat", title: "Streak", value: `${value.current} in a row`, detail: `Best ${value.best}`, link: { href: "/streak", label: "See calendar" } },
  };
}

function weekReport(ctx: RoziContext, args: Args): ToolOutcome {
  const which = oneOf(args, "week", ["this", "last"] as const, "this");
  const monday = weekDates(ctx.today)[0];
  const start = which === "last" ? shiftDate(monday, -7) : monday;
  const report = weeklyReport(ctx.profile, ctx.sessions, start, ctx.today);
  return {
    result: {
      week: which, from: report.weekStart, to: report.weekEnd, plannedSoFar: report.planned, completed: report.completed, skipped: report.skipped,
      consistencyPercent: report.consistency, sets: report.sets, reps: report.reps, volumeKg: report.volumeKg, minutes: report.minutes,
      newRecords: report.newRecords.map((record) => ({ exercise: record.exerciseName, kg: record.loadKg, reps: record.reps })),
      setsPerMuscleGroup: report.groupSets, averageEnergy: report.avgEnergy, averageSoreness: report.avgSoreness, roziSummary: report.rozi,
    },
    card: { type: "stat", title: which === "last" ? "Last week" : "This week", value: `${report.completed} of ${report.planned}`, detail: `${report.sets} sets${report.newRecords.length ? ` · ${report.newRecords.length} new ${report.newRecords.length === 1 ? "record" : "records"}` : ""}`, link: { href: "/report", label: "Open your week" } },
  };
}

function bodyStats(ctx: RoziContext): ToolOutcome {
  const entries = ctx.bodyWeightEntries;
  const latest = entries.at(-1) ?? null;
  const first = entries[0] ?? null;
  const height = ctx.profile.heightCm ?? null;
  const value = height && latest ? Math.round(bmi(height, latest.weightKg) * 10) / 10 : null;
  const goal = goalOf(ctx.profile);
  return {
    result: {
      goal: goalTitle(goal), heightCm: height,
      latestWeightKg: latest?.weightKg ?? null, latestOn: latest?.measuredOn ?? null,
      firstWeightKg: first?.weightKg ?? null, firstOn: first?.measuredOn ?? null,
      changeKg: latest && first && entries.length > 1 ? Math.round((latest.weightKg - first.weightKg) * 10) / 10 : null,
      entries: entries.length, recent: entries.slice(-6).map((entry) => ({ date: entry.measuredOn, kg: entry.weightKg })),
      bmi: value, bmiBand: value ? BMI_BAND_LABEL[bmiBand(value)] : null,
      note: latest ? null : "No weight logged yet.",
    },
    card: latest ? { type: "stat", title: "Weight", value: `${latest.weightKg} kg`, detail: value ? `BMI ${value.toFixed(1)} · ${BMI_BAND_LABEL[bmiBand(value)].toLowerCase()}` : dateLabel(latest.measuredOn), link: { href: "/progress", label: "See Body & BMI" } } : undefined,
  };
}

function exerciseInfo(ctx: RoziContext, args: Args): ToolOutcome {
  const query = text(args, "exercise");
  const exercise = findExercise(query, ctx);
  if (!exercise) return { result: { exercise: query, found: false, note: "Not in RozFit's exercise library." } };
  const allowed = isExerciseAllowedForProfile(exercise, ctx.planningProfile);
  const equipmentReady = exerciseEquipmentIsAvailable(exercise, ctx.planningProfile);
  const alternatives = getSafeExerciseAlternatives(exercise, ctx.planningProfile).map((item) => ({ name: item.name, equipment: item.equipment }));
  // Other versions of the same movement and how each differs, from library data (R7), so Rozi never guesses.
  const variations = variationsOf(exercise, ctx.planningProfile).slice(0, 6)
    .map((item) => ({ name: item.exercise.name, youCanDoIt: item.usable, differences: item.differences }));
  const performance = buildExercisePerformance(completedSessions(ctx)).find((item) => item.exerciseId === exercise.id);
  const last = performance?.records.at(-1);
  const steps = getExerciseReferenceInstructions(exercise).slice(0, 8);
  return {
    result: {
      found: true, exercise: exercise.name, category: exercise.category, difficulty: exercise.difficulty, muscles: exercise.targetMuscles,
      equipment: exercise.equipment, defaultSetsReps: `${exercise.sets} × ${exercise.reps}`, restSeconds: exercise.restSeconds,
      steps, cues: exercise.cues.slice(0, 5), cautions: exercise.cautionNotes.slice(0, 4),
      allowedForYou: allowed, equipmentAvailable: equipmentReady,
      restrictedReason: !allowed && isDeadliftVariation(exercise) ? "Deadlift variations need your trainer's approval." : null,
      alternatives, variations, lastTime: last ? { date: last.date, heaviestKg: last.heaviestRecordedLoadKg, sets: last.completedSets, reps: last.completedReps, repsAreIn: UNIT_WORD[trackingOf(exercise).unit] } : null,
    },
    card: { type: "exercise", name: exercise.name, muscles: exercise.targetMuscles, equipment: exercise.equipment, steps, cues: exercise.cues.slice(0, 4), allowed: allowed && equipmentReady, alternatives },
  };
}

function mobility(ctx: RoziContext): ToolOutcome {
  const todayPlanned = Boolean(workoutForDay(ctx, ctx.today).result.restDay === false);
  const last = completedSessions(ctx).at(-1);
  const pick = suggestionForDay({ hour: ctx.hour, restDay: !todayPlanned, discomfort: Boolean(last?.review?.discomfort), seatedDay: ctx.profile.dailyActivity === "seated" })
    ?? suggestionForDay({ hour: 9, restDay: true });
  if (!pick) return { result: { suggestion: null } };
  return {
    result: { routine: pick.routine.title, reason: pick.reason, minutes: routineMinutes(pick.routine), moves: pick.routine.moves.slice(0, 8).map((id) => mobilityMove(id)?.name ?? id) },
    card: { type: "stat", title: "Stretch", value: pick.routine.title, detail: `${routineMinutes(pick.routine)} min · ${pick.reason}`, link: { href: `/mobility?routine=${pick.routine.id}`, label: "Open routine" } },
  };
}

function achievements(ctx: RoziContext): ToolOutcome {
  const records = calculatePersonalRecords(completedSessions(ctx));
  const list = calculateAchievements(ctx.sessions, ctx.profile.sessionsPerWeek, records.length);
  const earned = list.filter((item) => item.earned);
  const next = list.filter((item) => !item.earned).sort((a, b) => b.current / b.target - a.current / a.target).slice(0, 3);
  return {
    result: { earned: earned.map((item) => item.title), next: next.map((item) => ({ title: item.title, description: item.description, current: item.current, target: item.target })) },
    card: { type: "stat", title: "Badges", value: `${earned.length} of ${list.length}`, detail: next[0] ? `Next: ${next[0].title} (${next[0].current}/${next[0].target})` : "All earned!", link: { href: "/progress", label: "See badges" } },
  };
}

const PLAN_AREAS = ["legs", "glutes", "chest", "back", "shoulders", "arms", "push", "pull", "upper_body", "lower_body", "full_body", "core"] as const;

function customWorkout(ctx: RoziContext, args: Args): ToolOutcome {
  const area = oneOf(args, "area", PLAN_AREAS, "full_body").replace("_", " ");
  const minutes = whole(args, "minutes", 15, 90);
  const plan = planWorkout(`plan a ${area} workout${minutes ? ` ${minutes} min` : ""}`, ctx.planningProfile);
  if (!plan) return { result: { area, planned: false, note: "No suitable moves with the equipment set in the plan settings." } };
  return {
    result: {
      planned: true, area, minutes: plan.minutes, level: levelTitle(plan.level), note: plan.note,
      exercises: plan.routine.exercises.map((item) => {
        const definition = EXERCISE_LIBRARY.find((exercise) => exercise.id === item.exerciseId);
        return { name: definition?.name ?? item.exerciseId, sets: item.sets, reps: item.reps };
      }),
      canBeSavedAsRoutine: true,
    },
    card: { type: "plan", plan },
  };
}

/**
 * Swap an exercise in a day's workout. Rozi can't change anything itself: this returns the choices (the same rules as
 * the app's Swap button — trainer rules and equipment) and a card; the person taps a choice to swap.
 */
function exerciseSwap(ctx: RoziContext, args: Args): ToolOutcome {
  const date = resolveDay(text(args, "day", 20) || "today", ctx.today);
  const { session, plan } = planForDay(ctx, date);
  const suggestion = swapSuggestion(session, plan, ctx.planningProfile, { exercise: text(args, "exercise", 80) || undefined, replacement: text(args, "replacement", 80) || undefined });
  const names = suggestion.exercises.map((exercise) => exercise.name);
  if (suggestion.blocked === "rest-day") return { result: { day: dateLabel(date), restDay: true, note: "No workout that day, so there's nothing to swap." } };
  return {
    result: {
      day: dateLabel(date), workoutExercises: names,
      exercise: suggestion.from?.name ?? null,
      ...(text(args, "exercise") && !suggestion.from ? { note: `"${text(args, "exercise", 80)}" isn't in this workout. Ask which one to swap, or let the user pick on the card.` } : {}),
      canSwap: !suggestion.blocked,
      ...(suggestion.blocked ? { whyNot: SWAP_BLOCK_TEXT[suggestion.blocked] } : {}),
      options: suggestion.options.map((exercise) => ({ name: exercise.name, equipment: exercise.equipment })),
      ...(suggestion.replacementNotAllowed ? { replacementNotAllowed: `${suggestion.replacementNotAllowed} isn't possible with the user's equipment or trainer rules.` } : {}),
      howItWorks: "The card shows these choices; the user taps one to swap it in (sets and reps stay the same). You can't make the swap yourself — tell them to tap their choice.",
    },
    card: suggestion.blocked && suggestion.blocked !== "sets-done" ? undefined : swapCard(date, suggestion),
  };
}

function myProfile(ctx: RoziContext): ToolOutcome {
  const profile = ctx.planningProfile;
  const latest = ctx.bodyWeightEntries.at(-1);
  const year = Number(ctx.today.slice(0, 4));
  const equipment = profile.equipmentAvailability === "verified"
    ? profile.availableEquipment.map((id) => EQUIPMENT_OPTIONS.find((option) => option.id === id)?.label ?? id)
    : null;
  return {
    result: {
      level: levelTitle(levelOf(profile)), goal: goalTitle(goalOf(profile)), focusArea: profile.focusArea ?? null,
      workoutsPerWeek: profile.sessionsPerWeek, trainingDays: profile.trainingDays.map((day) => DAY_NAMES[day]),
      sessionMinutes: profile.preferredSessionMinutes, trainingSince: profile.trainingStartDate,
      equipment: equipment ?? "not set yet (bodyweight moves are used)", deadliftsAllowed: profile.deadliftEnabled,
      heightCm: profile.heightCm ?? null, latestWeightKg: latest?.weightKg ?? null,
      age: typeof profile.birthYear === "number" ? year - profile.birthYear : null, sex: profile.sex ?? null,
      typicalDay: ACTIVITY_OPTIONS.find((option) => option.id === profile.dailyActivity)?.label ?? null,
      todayIs: `${DAY_NAMES[weekdayOf(ctx.today)]} ${ctx.today}`,
    },
  };
}

// ---------- Declarations the model sees ----------

const MUSCLE_ARG = { type: "string", description: "Optional muscle group: chest, back, shoulders, arms, legs or core." };
const EXERCISE_ARG = { type: "string", description: "Exercise name as the user said it, e.g. \"bench press\", \"squats\"." };

export const ROZI_TOOLS: AiTool[] = [
  { name: "get_workout_for_day", description: "The user's workout for a day from their plan (exercises, sets, reps, minutes, status, and why this workout was chosen), or that it's a rest day. Use for today's/tomorrow's workout and 'why this workout'.", parameters: { type: "object", properties: { day: { type: "string", description: "\"today\", \"tomorrow\", \"yesterday\" or a date YYYY-MM-DD. Default today." } } } },
  { name: "get_next_workout", description: "The next scheduled training day after today and its planned workout.", parameters: { type: "object", properties: {} } },
  { name: "get_workout_history", description: "Workouts the user actually logged in a period — completed, partly done and SKIPPED counts — optionally only those that trained a muscle group or a specific exercise. Use for 'last workout', 'how many workouts (or skipped workouts) this week/month', 'when did I last train legs'.", parameters: { type: "object", properties: { period: { type: "string", enum: [...PERIODS], description: "Match the user's words: this_month = from the 1st of the CURRENT month to today; last_month = the whole previous calendar month; this_week = Monday to today; last_week = the previous Monday–Sunday. Default last_30_days." }, muscle: MUSCLE_ARG, exercise: EXERCISE_ARG } } },
  { name: "get_progress", description: "Strength progress from logged sets: overall best sets (personal records) and the exercises that improved most, or one exercise's history and best set.", parameters: { type: "object", properties: { exercise: { ...EXERCISE_ARG, description: "Optional. Leave empty for overall progress." } } } },
  { name: "get_recovery", description: "How recovered each muscle group is, from logged sets and check-ins (just trained / recovering / ready / sore).", parameters: { type: "object", properties: { muscle: MUSCLE_ARG } } },
  { name: "get_streak", description: "The user's current and best workout streak.", parameters: { type: "object", properties: {} } },
  { name: "get_weekly_report", description: "Summary of a week: workouts done vs planned, sets, volume, new records, sets per muscle group, energy and soreness.", parameters: { type: "object", properties: { week: { type: "string", enum: ["this", "last"] } } } },
  { name: "get_body_stats", description: "Logged body weight history, height, BMI and the user's goal.", parameters: { type: "object", properties: {} } },
  { name: "get_exercise_info", description: "How to do an exercise from RozFit's library (steps, cues, cautions, muscles), whether it's allowed with the user's equipment and rules, safe alternatives, other versions of the same movement (variations) with how each one differs and whether the user can do it, and the user's last performance of it. Use it for 'what's the difference between X and Y' and 'is there an easier/harder version'.", parameters: { type: "object", properties: { exercise: EXERCISE_ARG }, required: ["exercise"] } },
  { name: "get_mobility_suggestion", description: "A stretching/mobility routine suggestion for right now.", parameters: { type: "object", properties: {} } },
  { name: "get_achievements", description: "Badges earned and the closest ones to earn next.", parameters: { type: "object", properties: {} } },
  { name: "plan_custom_workout", description: "Builds a one-off workout for a body area and length, matched to the user's level, goal and equipment. It can be started or saved as a routine from the card.", parameters: { type: "object", properties: { area: { type: "string", enum: [...PLAN_AREAS] }, minutes: { type: "integer", description: "15–90. Optional." } }, required: ["area"] } },
  { name: "suggest_exercise_swap", description: "Swap or replace an exercise in the user's workout (they want a different move, the machine is busy, they don't like one, or want to customise the workout). Returns choices that fit their equipment and trainer rules, and a card where the user taps one to swap it in. Leave 'exercise' empty to let them pick which one.", parameters: { type: "object", properties: { exercise: { ...EXERCISE_ARG, description: "The exercise to swap out, as the user said it. Optional." }, replacement: { ...EXERCISE_ARG, description: "What they want instead, if they said. Optional." }, day: { type: "string", description: "\"today\" (default), \"tomorrow\" or YYYY-MM-DD." } } } },
  { name: "get_my_profile", description: "The user's training setup: level, goal, training days, session length, equipment, height, latest weight, age, and today's date.", parameters: { type: "object", properties: {} } },
];

/** Runs one tool. Unknown tools and failures return a plain error the model can explain; they never throw. */
export function runRoziTool(name: string, args: Args, ctx: RoziContext): ToolOutcome {
  try {
    switch (name) {
      case "get_workout_for_day": return workoutForDay(ctx, resolveDay(text(args, "day", 20), ctx.today));
      case "get_next_workout": {
        const next = nextTrainingDate(ctx.profile, ctx.today);
        return next ? workoutForDay(ctx, next) : { result: { nextTrainingDay: null, note: "No training days are set." } };
      }
      case "get_workout_history": return workoutHistory(ctx, args);
      case "get_progress": return progress(ctx, args);
      case "get_recovery": return recovery(ctx, args);
      case "get_streak": return streak(ctx);
      case "get_weekly_report": return weekReport(ctx, args);
      case "get_body_stats": return bodyStats(ctx);
      case "get_exercise_info": return exerciseInfo(ctx, args);
      case "get_mobility_suggestion": return mobility(ctx);
      case "get_achievements": return achievements(ctx);
      case "plan_custom_workout": return customWorkout(ctx, args);
      case "suggest_exercise_swap": return exerciseSwap(ctx, args);
      case "get_my_profile": return myProfile(ctx);
      default: return { result: { error: `Unknown tool ${name.slice(0, 40)}.` } };
    }
  } catch {
    return { result: { error: "That information couldn't be read right now." } };
  }
}
