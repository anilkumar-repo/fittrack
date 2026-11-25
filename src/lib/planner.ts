import { adjustPlan, inOwnLightWeek } from "./coach-plan.ts";
import { EXERCISE_LIBRARY, FOCUS_SUBTITLES, GOAL_CYCLES, getExerciseDefinition, getOptionalDeadliftExercise, getRecoveryExercises, getTemplateExercises, RULE_VERSION, TEMPLATE_VERSION, type TemplateFocus } from "./templates.ts";
import { goalOf, goalTitle, inLightWeek, isRecoveryWeek, recoveryWeekSets, setCap, stageLabel } from "./program.ts";
import { extraSets, levelOf, levelSetBonus, levelTitle, programWeek, usesFoundationWeeks } from "./levels.ts";
import { exerciseEquipmentIsAvailable, hasEquipmentFor, isDeadliftVariation, isExerciseAllowedForProfile } from "./exercise-library.ts";
import type { CheckIn, ExerciseDefinition, Profile, TrainerRuleSettings, TrainingGoal, TrainingPhase, WorkoutFocus, WorkoutPlan, WorkoutSession } from "./types";
import { DEFAULT_TRAINER_RULE_SETTINGS, normalizeTrainerRuleSettings, profileWithTrainerEquipment } from "./trainer-rules.ts";
import { regionsForExercises } from "./figure.ts";
import { FOCUS_OPTIONS, focusRegions } from "./onboarding.ts";
import { NOT_AUTO_PICKED } from "./library-additions.ts";

export interface PlanInput {
  date: string;
  profile: Profile;
  sessions: WorkoutSession[];
  checkIn?: CheckIn;
  trainerRuleSettings?: TrainerRuleSettings;
  trainerRuleRevision?: number;
}

const CYCLE: Array<Exclude<WorkoutFocus, "Return to training" | "Recovery">> = ["Foundation A", "Foundation B", "Foundation C"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RecoveryDecision {
  recover: boolean;
  reduceVolume: boolean;
  reasons: string[];
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

function daysBetween(later: string, earlier: string): number {
  const a = Date.parse(`${later}T12:00:00Z`);
  const b = Date.parse(`${earlier}T12:00:00Z`);
  return Math.max(0, Math.floor((a - b) / 86_400_000));
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dueTrainingDays(profile: Profile): string[] {
  return [...profile.trainingDays].sort((a, b) => a - b).map((day) => DAY_LABELS[day]).filter(Boolean);
}

function phaseFor(date: string, profile: Profile, completed: WorkoutSession[], isReturnSession: boolean): TrainingPhase {
  if (isReturnSession) return "return";
  const tenureDays = daysBetween(date, profile.trainingStartDate);
  const completedInEightWeeks = completed.filter((session) => daysBetween(date, session.date) <= 56).length;
  // A second foundation phase requires both eight weeks and four weeks' worth of completed sessions.
  // This phase change never unlocks deadlift variations.
  return tenureDays >= 56 && completedInEightWeeks >= Math.max(6, profile.sessionsPerWeek * 4) ? "foundation_2" : "foundation_1";
}

/**
 * Train together: how many of the plan's training days come between the buddy group's start date (counted) and this
 * date (not counted). Every buddy gets the same number on the same day, whoever skipped.
 */
export function calendarSessionIndex(anchor: string, date: string, trainingDays: number[]): number {
  if (date <= anchor) return 0;
  const days = new Set(trainingDays);
  const total = daysBetween(date, anchor);
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * days.size;
  for (let offset = fullWeeks * 7; offset < total; offset++) {
    const weekday = new Date(Date.parse(`${anchor}T12:00:00Z`) + offset * 86_400_000).getUTCDay();
    if (days.has(weekday)) count++;
  }
  return count;
}

/** The session for a buddy group's day: the rotation follows the calendar instead of completed workouts. */
function calendarFocus(goal: TrainingGoal, index: number, week: number): WorkoutFocus {
  if (goal === "general") return CYCLE[index % CYCLE.length];
  if (goal === "muscle" && isRecoveryWeek(goal, week)) return index % 2 === 0 ? "Conditioning circuit" : "Core and cardio";
  const cycle = GOAL_CYCLES[goal];
  return cycle[index % cycle.length];
}

function chooseFocus(completed: WorkoutSession[], isReturnSession: boolean): WorkoutFocus {
  if (isReturnSession) return "Return to training";
  return CYCLE[completed.length % CYCLE.length];
}

/** Next session in a goal's rotation. Only sessions from that rotation count, so a new goal starts at its first workout. */
function chooseProgramFocus(goal: Exclude<TrainingGoal, "general">, attempts: WorkoutSession[], date: string, week: number): TemplateFocus {
  const cycle = GOAL_CYCLES[goal];
  if (goal === "muscle" && isRecoveryWeek(goal, week)) {
    // Conditioning week: circuit days alternate with abs + easy cardio.
    const thisWeek = attempts.filter((session) => daysBetween(date, session.date) < 7 && ["Conditioning circuit", "Core and cardio"].includes(session.plan.focus));
    return thisWeek.length % 2 === 0 ? "Conditioning circuit" : "Core and cardio";
  }
  const done = attempts.filter((session) => (cycle as string[]).includes(session.plan.focus)).length;
  return cycle[done % cycle.length];
}

/** Stand-in for a deadlift variation in a template when the trainer has not approved deadlifts. */
const DEADLIFT_STAND_IN = "hip_thrust";

function recoveryDecision(date: string, checkIn: CheckIn | undefined, prior: WorkoutSession[], sessionsPerWeek: number, settings: TrainerRuleSettings): RecoveryDecision {
  const reasons: string[] = [];
  const recent = [...prior].reverse().filter((session) => daysBetween(date, session.date) <= 7);
  const completedThisWeek = recent.filter((session) => session.status === "completed").length;

  if (checkIn?.pain) reasons.push("Your check-in reports pain or discomfort, so this plan avoids loaded training.");
  // A pain or discomfort report from the previous logged session lightens only the next session.
  // Today's own check-in is the hard stop: reporting pain today always switches to recovery.
  const lastLogged = [...prior].reverse().find((session) => session.status !== "planned" && !session.missedReason);
  const lastSessionPain = Boolean(lastLogged && (lastLogged.checkIn?.pain || lastLogged.review?.discomfort));
  if (completedThisWeek >= 4 && completedThisWeek > sessionsPerWeek) reasons.push("Training frequency exceeded the selected weekly schedule; allow more recovery instead of adding another hard session.");
  if ((checkIn?.energy ?? 5) <= settings.recovery.stopEnergyThreshold
    || (checkIn?.recovery ?? 5) <= settings.recovery.stopRecoveryThreshold
    || (checkIn?.soreness ?? 1) >= settings.recovery.stopSorenessThreshold) {
    reasons.push("Today’s very low energy/recovery or high soreness supports a recovery session.");
  }

  if (reasons.length) return { recover: true, reduceVolume: true, reasons };

  const recentHighSoreness = recent.filter((session) => (session.checkIn?.soreness ?? 1) >= settings.recovery.highSorenessVolumeThreshold).length >= settings.recovery.repeatedHighSorenessSessions;
  const recentLowReadiness = recent.some((session) =>
    ((session.checkIn?.energy ?? 5) <= 2 && (session.checkIn?.recovery ?? 5) <= 2)
    || (session.review?.energyAfter ?? 5) <= 2
    || (session.review?.effort ?? 0) >= 9,
  );
  const lowCurrentReadiness = (checkIn?.energy ?? 3) <= settings.recovery.lowEnergyVolumeThreshold || (checkIn?.recovery ?? 3) <= settings.recovery.lowEnergyVolumeThreshold;
  const highCurrentSoreness = (checkIn?.soreness ?? 1) >= settings.recovery.highSorenessVolumeThreshold;
  const busyWeek = completedThisWeek > sessionsPerWeek;
  const reduceVolume = lastSessionPain || recentHighSoreness || recentLowReadiness || lowCurrentReadiness || highCurrentSoreness || busyWeek;

  if (lastSessionPain) reasons.push("Your last session reported pain or discomfort, so today is a lighter session with fewer sets and no progression. If anything hurts today, tick the pain box in your check-in and the plan switches to recovery.");
  if (recentHighSoreness) reasons.push("Soreness has been high in more than one recent check-in, so planned sets are reduced.");
  if (recentLowReadiness || lowCurrentReadiness) reasons.push("Low energy or recovery lowers today’s planned set count.");
  if (highCurrentSoreness) reasons.push("High soreness lowers today’s planned set count.");
  if (busyWeek) reasons.push("Recent training frequency is high for the chosen weekly schedule, so volume is reduced.");
  return { recover: false, reduceVolume, reasons };
}

function equipmentAvailable(exercise: ExerciseDefinition, profile: Profile): boolean {
  const required = exercise.requiredEquipment ?? [];
  if (!required.length) return true;
  if (profile.equipmentAvailability !== "verified") return false;
  return hasEquipmentFor(exercise, profile.availableEquipment);
}

function mostRecentLoggedSession(sessions: WorkoutSession[]): WorkoutSession | undefined {
  // Missed days (skipped with a reason) were never trained, so they say nothing about recent movements.
  return [...sessions].filter((session) => session.status !== "planned" && !session.missedReason).sort((a, b) => b.date.localeCompare(a.date))[0];
}

function patternOf(exercise: ExerciseDefinition | undefined): string | undefined {
  return exercise?.movementPattern ?? (exercise ? getExerciseDefinition(exercise.id)?.movementPattern : undefined);
}

function adaptEquipment(exercise: ExerciseDefinition, profile: Profile): ExerciseDefinition | null {
  if (equipmentAvailable(exercise, profile)) return { ...exercise, cues: [...exercise.cues] };
  if (!exercise.fallbackId) return null;
  // Follow the fallback chain (for example barbell squat → Smith squat → goblet squat → bodyweight squat).
  let alternative = getExerciseDefinition(exercise.fallbackId);
  for (let step = 0; alternative && !equipmentAvailable(alternative, profile) && step < 4; step++) {
    alternative = alternative.fallbackId ? getExerciseDefinition(alternative.fallbackId) : undefined;
  }
  if (!alternative || !equipmentAvailable(alternative, profile) || isDeadliftVariation(alternative)) return null;
  const missing = profile.equipmentAvailability === "unknown"
    ? "available equipment has not been confirmed"
    : `required equipment (${exercise.equipment}) is not listed as available`;
  return {
    ...alternative,
    sets: exercise.sets,
    restSeconds: exercise.restSeconds,
    substitutedFor: exercise.id,
    selectionReason: `Used ${alternative.name} instead of ${exercise.name} because ${missing}.`,
  };
}

function alternativeForPattern(
  exercise: ExerciseDefinition,
  profile: Profile,
  blockedPatterns: Set<string>,
  blockedIds: Set<string>,
): ExerciseDefinition | null {
  const candidates = EXERCISE_LIBRARY
    .filter((item) => item.category === exercise.category && !blockedIds.has(item.id) && !isDeadliftVariation(item) && !NOT_AUTO_PICKED.has(item.id))
    .filter((item) => !blockedPatterns.has(item.movementPattern ?? ""))
    .map((item) => adaptEquipment(item, profile))
    .filter((item): item is ExerciseDefinition => item !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  return candidates[0] ?? null;
}

function repBounds(reps: string): { min: number; max: number } {
  const values = [...reps.matchAll(/\d+/g)].map((match) => Number(match[0]));
  const min = values[0] ?? 8;
  const max = values[1] ?? min;
  return { min, max: Math.max(min, max) };
}

function priorLogFor(exercise: ExerciseDefinition, sessions: WorkoutSession[]): { session: WorkoutSession; log: WorkoutSession["exerciseLogs"][number] } | undefined {
  for (const session of [...sessions].filter((item) => item.status === "completed").sort((a, b) => b.date.localeCompare(a.date))) {
    const log = session.exerciseLogs.find((item) => item.exerciseId === exercise.id);
    if (log) return { session, log };
  }
  return undefined;
}

function progressionFor(exercise: ExerciseDefinition, sessions: WorkoutSession[], settings: TrainerRuleSettings): Pick<ExerciseDefinition, "progressionAdvice" | "loadGuidance" | "progressionAction" | "reps"> {
  const bounds = repBounds(exercise.reps);
  const previous = priorLogFor(exercise, sessions);
  const noLoadGuidance = "No saved working load for this movement. Choose a comfortable load; leave the weight blank if it is unrecorded.";
  if (!previous) {
    return {
      reps: exercise.reps,
      progressionAction: "choose_comfortable_load",
      progressionAdvice: "No completed history for this exact movement; begin at the lower end of the rep range and focus on smooth, comfortable repetitions.",
      loadGuidance: noLoadGuidance,
    };
  }

  const { session, log } = previous;
  const recentPain = session.checkIn?.pain === true || session.review?.discomfort === true;
  const plannedSets = log.sets.slice(0, log.plannedSets);
  const allPlannedSetsCompleted = plannedSets.length >= log.plannedSets && plannedSets.every((set) => set.completed && set.actualReps !== null);
  const minimumCompletedReps = plannedSets.length ? Math.min(...plannedSets.map((set) => set.actualReps ?? 0)) : 0;
  const hasRecordedLoads = plannedSets.length > 0 && plannedSets.every((set) => set.loadKg !== null && set.loadKg > 0);

  if (recentPain) {
    return {
      reps: exercise.reps,
      progressionAction: "repeat_or_reduce",
      progressionAdvice: "A recent pain or discomfort report prevents progression. Stop any movement that causes symptoms and use a comfortable alternative or recovery.",
      loadGuidance: hasRecordedLoads ? "Use no more than the last recorded load, and only if the movement is comfortable; otherwise leave it unrecorded." : noLoadGuidance,
    };
  }
  if (log.status === "skipped" || !allPlannedSetsCompleted) {
    return {
      reps: exercise.reps,
      progressionAction: "repeat_or_reduce",
      progressionAdvice: log.status === "skipped" ? "This movement was skipped last time; do not add load. Repeat only if it now feels suitable, or use the listed alternative." : "The planned sets were not all completed last time; repeat the current target or reduce it if needed.",
      loadGuidance: hasRecordedLoads ? "Keep to the last recorded load or choose less; do not increase it yet." : noLoadGuidance,
    };
  }
  if (log.formQuality !== "sound") {
    return {
      reps: exercise.reps,
      progressionAction: "repeat_or_reduce",
      progressionAdvice: "Form was not confirmed as sound last time. Keep the load steady and prioritize controlled, pain-free repetitions before progressing.",
      loadGuidance: hasRecordedLoads ? "Use no more than the last recorded load." : noLoadGuidance,
    };
  }
  if (minimumCompletedReps >= bounds.max && log.plannedReps < bounds.max) {
    return {
      reps: String(bounds.max),
      progressionAction: "hold_load_add_reps",
      progressionAdvice: `You reached ${bounds.max} reps before it was the planned target. Repeat that top-of-range target with the same load and sound form before considering a load increase.`,
      loadGuidance: hasRecordedLoads ? "Repeat the last recorded load; confirm the top-of-range target before considering any increase." : noLoadGuidance,
    };
  }
  if (minimumCompletedReps >= bounds.max && log.plannedReps >= bounds.max) {
    if ((exercise.requiredEquipment ?? []).length > 0 && hasRecordedLoads && plannedSets.every((set) => set.loadKg === plannedSets[0]?.loadKg)) {
      return {
        reps: `${bounds.min}–${bounds.max}`,
        progressionAction: "consider_small_load_step",
        progressionAdvice: `All planned sets reached the top of the rep range with sound form and no reported pain. Consider only one small available load step, no greater than ${settings.progression.smallLoadStepKg} kg; if increased, return to the lower end of the rep range.`,
        loadGuidance: "Last completed load is recorded in history. Choose only a small available increment; no numeric working weight is assumed.",
      };
    }
    return {
      reps: `${bounds.min}–${bounds.max}`,
      progressionAction: "choose_comfortable_load",
      progressionAdvice: `The top of the rep range was reached with sound form and no reported pain. If you used a load, consider one available step no greater than ${settings.progression.smallLoadStepKg} kg; otherwise continue with a comfortable load.`,
      loadGuidance: noLoadGuidance,
    };
  }

  const nextTarget = Math.min(bounds.max, Math.max(bounds.min, minimumCompletedReps + settings.progression.repIncrement));
  return {
    reps: String(nextTarget),
    progressionAction: "hold_load_add_reps",
    progressionAdvice: `Keep the load steady and aim for ${nextTarget} smooth reps per planned set, if comfortable. Reps progress before any load increase.`,
    loadGuidance: hasRecordedLoads ? "Repeat the last recorded load; do not increase it until the top of the rep range is completed with sound form and no pain." : noLoadGuidance,
  };
}

function recoveryPlan(date: string, completed: WorkoutSession[], phase: TrainingPhase, reasons: string[], currentPain: boolean, settings: TrainerRuleSettings, revision: number): WorkoutPlan {
  const exercises = getRecoveryExercises().map((exercise) => ({
    ...exercise,
    sets: 1,
    selectionReason: currentPain
      ? "Optional recovery only. Skip it if it brings on pain or discomfort."
      : "Selected as a low-effort recovery option; it can be skipped if it does not feel comfortable.",
    progressionAction: "recovery" as const,
    progressionAdvice: "This is not a strength progression session.",
    loadGuidance: "No external load is prescribed.",
  }));
  if (currentPain) reasons.push("Stop the relevant activity if it causes pain. If pain is new, severe, persists, or limits ordinary activity, seek assessment from an appropriate health professional.");
  return {
    id: `${date}-recovery`, date, focus: "Recovery", title: currentPain ? "Recovery and comfort" : "Easy recovery session",
    description: currentPain
      ? "Skip loaded training today. Recovery options are optional and should not provoke symptoms. This app does not diagnose pain."
      : "A low-effort recovery option replaces strength work today. Rest is also a valid choice.",
    durationMinutes: currentPain ? 10 : 15,
    exercises,
    isReturnSession: phase === "return",
    sessionNumber: completed.length + 1,
    templateVersion: TEMPLATE_VERSION,
    ruleVersion: RULE_VERSION,
    phase,
    sessionType: "recovery",
    sourceExerciseIds: [],
    originalExercises: [],
    generationReasons: reasons,
    trainerRuleRevision: revision,
    trainerRuleSettings: settings,
  };
}

export function generateWorkout({ date, profile, sessions, checkIn, trainerRuleSettings, trainerRuleRevision = 1 }: PlanInput): WorkoutPlan | null {
  const settings = normalizeTrainerRuleSettings(trainerRuleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS);
  profile = profileWithTrainerEquipment(profile, settings);
  if (!isValidDate(date) || !profile.trainingDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) return null;
  const prior = sessions.filter((session) => session.date < date).sort((a, b) => a.date.localeCompare(b.date));
  const completed = prior.filter((session) => session.status === "completed");
  const trainingAttempts = prior.filter((session) => session.status === "completed" || session.status === "in_progress");
  const lastTrainingAttempt = trainingAttempts.at(-1);
  const gapDays = lastTrainingAttempt ? daysBetween(date, lastTrainingAttempt.date) : null;
  const isReturnSession = gapDays !== null && gapDays >= 14;
  const goal = goalOf(profile);
  const level = levelOf(profile);
  // The program week starts at the level's stage (an intermediate begins at week 13, not at "learn the movements").
  const week = programWeek(profile, date);
  const program = goal !== "general";
  const recoveryWeek = isRecoveryWeek(goal, week);
  // A week the trainer made lighter: the same session (buddies stay in step), about a third fewer sets.
  const trainerLightWeek = inLightWeek(profile.lightWeekStart, date);
  // R14: a lighter week can also be one the person accepted in their coach review (never in Train together).
  const ownLightWeek = !trainerLightWeek && !profile.buddyAnchor && inOwnLightWeek(profile, date);
  const lightWeek = !isReturnSession && (trainerLightWeek || ownLightWeek);
  const stage = stageLabel(goal, week);
  // Train together: the same session as your buddies, from the calendar (a return after a long break still comes first).
  const focus: WorkoutFocus = profile.buddyAnchor && !isReturnSession
    ? calendarFocus(goal, calendarSessionIndex(profile.buddyAnchor, date, profile.trainingDays), week)
    : program ? chooseProgramFocus(goal, trainingAttempts, date, week) : chooseFocus(trainingAttempts, isReturnSession);
  const foundPhase = phaseFor(date, profile, completed, isReturnSession);
  // Only beginners get the gentle two-set foundation phase.
  const phase: TrainingPhase = foundPhase === "foundation_1" && !usesFoundationWeeks(level) ? "foundation_2" : foundPhase;
  const feedback = recoveryDecision(date, checkIn, prior, profile.sessionsPerWeek, settings);
  if (feedback.recover) {
    const plan = recoveryPlan(date, trainingAttempts, phase, feedback.reasons, checkIn?.pain === true, settings, trainerRuleRevision);
    return program ? { ...plan, goal, weekNumber: week, stage, recoveryWeek, level } : { ...plan, level };
  }

  // The planner never produces "Your routine" (that comes from routinePlan); it only needs a template focus here.
  const baseFocus = (focus === "Return to training" || focus === "Recovery" || focus === "Your routine" ? CYCLE[0] : focus) as TemplateFocus;
  const originalTemplateExercises = getTemplateExercises(baseFocus);
  const sourceExercises = originalTemplateExercises.map((exercise) => {
    const override = settings.exerciseTemplates.find((item) => item.exerciseId === exercise.id);
    return override ? {
      ...exercise,
      sets: override.sets,
      reps: override.minReps === override.maxReps ? String(override.minReps) : `${override.minReps}–${override.maxReps}`,
      restSeconds: override.restSeconds,
      selectionReason: `A trainer-approved template change sets ${override.sets} sets of ${override.minReps}–${override.maxReps} reps with ${override.restSeconds} seconds of rest.`,
    } : exercise;
  });
  // Program templates list deadlift variations; without trainer approval a hip thrust takes their place.
  for (const [index, exercise] of sourceExercises.entries()) {
    if (!isDeadliftVariation(exercise) || deadliftAllowedForPlan(profile)) continue;
    const standIn = getExerciseDefinition(DEADLIFT_STAND_IN);
    if (standIn) sourceExercises[index] = { ...standIn, sets: exercise.sets, reps: exercise.reps, substitutedFor: exercise.id, selectionReason: `${standIn.name} replaces ${exercise.name} until your trainer approves deadlift variations.` };
  }
  // Get fit & toned: from week 13, a trainer-approved light hinge replaces the dumbbell glute bridge on Lower B.
  if (goal === "tone" && baseFocus === "Lower B" && deadliftAllowedForPlan(profile) && week >= 13 && !recoveryWeek) {
    const index = sourceExercises.findIndex((exercise) => exercise.id === "db_glute_bridge");
    if (index >= 0) sourceExercises.splice(index, 1, { ...getOptionalDeadliftExercise(), sets: 2, reps: "8", substitutedFor: "db_glute_bridge", selectionReason: "Light hinge practice, added after week 12 under the explicit trainer approval rule." });
  }
  if (deadliftAllowedForPlan(profile) && baseFocus === "Foundation B") {
    sourceExercises.splice(3, 1, {
      ...getOptionalDeadliftExercise(),
      substitutedFor: originalTemplateExercises[3]?.id,
      selectionReason: `Substituted for ${originalTemplateExercises[3]?.name ?? "the template hamstring movement"} under the explicit trainer approval rule.`,
    });
  }
  const isEarlyFoundation = phase === "foundation_1" || phase === "return";
  const volumeAdjustment = feedback.reduceVolume || isReturnSession;
  const latestSession = mostRecentLoggedSession(prior);
  const latestGap = latestSession ? daysBetween(date, latestSession.date) : null;
  // Program splits are built so neighbouring days train different muscles; only the general plan checks patterns.
  const avoidRecentPatterns = !program && latestGap !== null && latestGap < 2;
  const recentPatterns = new Set((latestSession?.plan.exercises ?? []).map((exercise) => patternOf(exercise)).filter((pattern): pattern is string => Boolean(pattern)));
  const recentlySkipped = new Set((latestSession?.exerciseLogs ?? []).filter((log) => log.status === "skipped").map((log) => log.exerciseId));
  const selectedIds = new Set<string>();
  const selectedPatterns = new Set<string>();
  const generationReasons = [
    program
      ? `Selected ${baseFocus} for the "${goalTitle(goal)}" goal, week ${week} of 52${stage ? ` (${stage})` : ""}; workouts rotate in order and missed days are not added to today.`
      : `Selected ${baseFocus} from the approved ${profile.sessionsPerWeek}-day schedule using completed-session rotation; missed days are not added to today.`,
    `Trainer rules revision ${trainerRuleRevision} is snapshotted with this plan; pain always triggers recovery and deadlift approval remains a separate explicit trainer rule.`,
    phase === "foundation_2"
      ? "The trainee has completed the foundation consistency threshold; conservative beginner movement choices and trainer restrictions still apply."
      : phase === "return"
        ? "A break of at least 14 days makes this a lighter return session."
        : "Foundation phase 1 uses conservative beginner volume and a repeatable full-body template.",
    level === "beginner"
      ? "Beginner level: gentle volume while the movements become familiar."
      : `${levelTitle(level)} level: the program starts at a later stage${level === "advanced" || level === "pro" ? " and the main exercises get an extra set" : ""}.`,
    ...(feedback.reasons.length ? feedback.reasons : ["Recent check-ins and training frequency support the standard conservative volume."]),
    profile.equipmentAvailability === "verified"
      ? `Only confirmed equipment is used: ${profile.availableEquipment.length ? profile.availableEquipment.join(", ") : "bodyweight only"}.`
      : "Equipment availability is unconfirmed, so the plan uses alternatives that do not require listed gym equipment.",
  ];
  if (recoveryWeek) generationReasons.push(goal === "muscle"
    ? "Every fourth week is a conditioning week: no heavy lifting, a 20-minute circuit and easy cardio so you recover and move well."
    : "Every fourth week is a recovery week: the same workouts with about a third fewer sets and comfortable loads.");
  if (lightWeek) generationReasons.push(ownLightWeek ? "A lighter week you chose in your coach review: the same session with about a third fewer sets. Keep the weights comfortable." : "Your trainer made this week lighter: the same session with about a third fewer sets. Keep the weights comfortable.");
  if (avoidRecentPatterns) generationReasons.push("The last completed workout was within one day; repeated movement patterns are replaced or omitted where a safe alternative is available.");
  if (profile.deadliftEnabled && baseFocus === "Foundation B") generationReasons.push("A trainer-approved rule permits the hinge variation for this client; time in training alone never enables it.");

  const focusTargets = focusRegions(profile.focusArea);
  let focusUsed = false;
  const exercises: ExerciseDefinition[] = [];
  for (const source of sourceExercises) {
    if (isDeadliftVariation(source) && !deadliftAllowedForPlan(profile)) continue;
    let candidate = adaptEquipment(source, profile);
    if (!candidate) {
      generationReasons.push(`${source.name} was left out because neither its required equipment nor a safe equipment-free alternative is available in the exercise rules.`);
      continue;
    }

    if (recentlySkipped.has(candidate.id) || recentlySkipped.has(source.id)) {
      const alternative = candidate.fallbackId ? adaptEquipment(getExerciseDefinition(candidate.fallbackId) ?? candidate, profile) : null;
      if (alternative && !selectedIds.has(alternative.id)) {
        candidate = { ...alternative, substitutedFor: source.id, selectionReason: `Used ${alternative.name} because ${source.name} was skipped in the most recent session.` };
      } else {
        const alternativePattern = alternativeForPattern(candidate, profile, new Set([...recentPatterns, ...selectedPatterns]), selectedIds);
        if (!alternativePattern) {
          generationReasons.push(`${source.name} was not repeated because it was skipped last time and no suitable alternative was available.`);
          continue;
        }
        candidate = { ...alternativePattern, substitutedFor: source.id, selectionReason: `Used ${alternativePattern.name} because ${source.name} was skipped in the most recent session.` };
      }
    }

    const pattern = candidate.movementPattern ?? "";
    if (selectedIds.has(candidate.id)) {
      generationReasons.push(`${candidate.name} was omitted to prevent a duplicate exercise in this session.`);
      continue;
    }
    if (!program && selectedPatterns.has(pattern)) {
      const alternative = alternativeForPattern(candidate, profile, selectedPatterns, selectedIds);
      if (!alternative) {
        generationReasons.push(`${candidate.name} was omitted because its movement pattern is already represented in this session.`);
        continue;
      }
      candidate = { ...alternative, substitutedFor: source.id, selectionReason: `Used ${alternative.name} to avoid repeating a movement pattern in this session.` };
    }
    if (avoidRecentPatterns && recentPatterns.has(candidate.movementPattern ?? "")) {
      const alternative = alternativeForPattern(candidate, profile, new Set([...recentPatterns, ...selectedPatterns]), selectedIds);
      if (!alternative) {
        generationReasons.push(`${candidate.name} was omitted because the same movement pattern was trained on the previous day.`);
        continue;
      }
      candidate = { ...alternative, substitutedFor: source.id, selectionReason: `Used ${alternative.name} to avoid repeating yesterday’s movement pattern.` };
    }

    const sourceOverride = settings.exerciseTemplates.find((item) => item.exerciseId === source.id);
    if (sourceOverride) {
      generationReasons.push(`${source.name} uses the saved trainer template override for ${sourceOverride.sets} sets, ${sourceOverride.minReps}–${sourceOverride.maxReps} reps, and ${sourceOverride.restSeconds} seconds of rest, subject to the current beginner-phase volume cap.`);
      candidate = {
        ...candidate,
        sets: sourceOverride.sets,
        reps: sourceOverride.minReps === sourceOverride.maxReps ? String(sourceOverride.minReps) : `${sourceOverride.minReps}–${sourceOverride.maxReps}`,
        restSeconds: sourceOverride.restSeconds,
      };
    }
    const baseReason = candidate.selectionReason ?? (candidate.substitutedFor
      ? `Substituted for ${source.name} while preserving the saved source plan.`
      : program ? `Part of the ${baseFocus} session.` : `Selected from the ${baseFocus} template as part of the approved beginner rotation.`);
    const progression = progressionFor(candidate, prior, settings);
    // Advanced and pro levels add a set to the main (first) exercises; a return session never does.
    const levelSets = isReturnSession ? 0 : extraSets(level, exercises.length);
    const cap = setCap(goal, week, isEarlyFoundation, isReturnSession) + (isReturnSession ? 0 : levelSetBonus(level));
    const cappedSets = Math.min(candidate.sets + levelSets, cap);
    const weekSets = (recoveryWeek && goal !== "muscle") || lightWeek ? recoveryWeekSets(cappedSets) : cappedSets;
    // Focus muscle: one extra set on moves that train it (never in a return, recovery or first-weeks session).
    const focusHit = focusTargets.length > 0 && !isReturnSession && !recoveryWeek && !lightWeek && !isEarlyFoundation
      && regionsForExercises([candidate]).some((region) => focusTargets.includes(region));
    const plannedSets = focusHit ? Math.min(weekSets + 1, cap + 1) : weekSets;
    if (focusHit) focusUsed = true;
    exercises.push({
      ...candidate,
      sets: volumeAdjustment ? Math.max(1, plannedSets - settings.recovery.volumeReductionSets) : plannedSets,
      ...progression,
      selectionReason: baseReason,
      progressionAdvice: volumeAdjustment
        ? `${progression.progressionAdvice} Planned sets are reduced today for recovery.`
        : progression.progressionAdvice,
    });
    selectedIds.add(candidate.id);
    if (candidate.movementPattern) selectedPatterns.add(candidate.movementPattern);
  }

  if (focusUsed) generationReasons.push(`Your focus is ${FOCUS_OPTIONS.find((option) => option.id === profile.focusArea)?.label.toLowerCase()}: moves that train it get one extra set.`);

  if (!exercises.length) {
    return recoveryPlan(date, trainingAttempts, phase, [...generationReasons, "No safe exercises matched the verified equipment and movement-pattern constraints."], false, settings, trainerRuleRevision);
  }
  const title = isReturnSession ? "Easy return session" : `${baseFocus} · ${FOCUS_SUBTITLES[baseFocus] ?? "Full body"}`;
  const description = isReturnSession
    ? "A lighter first session back. Keep every rep comfortable and leave plenty in reserve."
    : baseFocus === "Conditioning circuit"
      ? "Repeat the three moves as a circuit for 20 minutes at a controlled pace, resting when needed. Keep 2–3 reps in reserve; this is not a race."
      : recoveryWeek || lightWeek
        ? `${lightWeek ? (ownLightWeek ? "Your lighter week" : "Lighter week from your trainer") : "Recovery week"}: same workout, fewer sets and comfortable weights. Focus on smooth, clean reps.`
        : volumeAdjustment
      ? "Today’s plan uses fewer sets based on recovery feedback and recent training."
      : goal === "fatloss"
        ? "Warm up first and keep rests short. Pair training with a modest calorie deficit, plenty of protein and 7–10k steps a day — slow, steady loss keeps your muscle."
        : program
        ? "Warm up for 5–7 minutes first. Finish most sets with 1–3 reps in reserve; add reps before adding weight."
        : "Build comfortable, repeatable strength with simple movements and a calm pace.";
  // R14: the swaps and set nudge the person approved in their coach review (re-checked against their rules).
  return adjustPlan({
    id: `${date}-${baseFocus.toLowerCase().replaceAll(" ", "-")}`,
    date,
    focus,
    title,
    description,
    durationMinutes: volumeAdjustment ? Math.min(profile.preferredSessionMinutes, 30) : profile.preferredSessionMinutes,
    exercises,
    isReturnSession,
    sessionNumber: trainingAttempts.length + 1,
    templateVersion: TEMPLATE_VERSION,
    ruleVersion: RULE_VERSION,
    phase,
    sessionType: "training",
    sourceExerciseIds: originalTemplateExercises.map((exercise) => exercise.id),
    originalExercises: originalTemplateExercises.map(({ id, name, sets, reps, equipment }) => ({ id, name, sets, reps, equipment })),
    generationReasons,
    trainerRuleRevision,
    trainerRuleSettings: settings,
    level,
    ...(program ? { goal, weekNumber: week, stage, recoveryWeek } : {}),
    ...(lightWeek ? { lightWeek: true, ...(ownLightWeek ? { ownLightWeek: true } : {}) } : {}),
  }, profile);
}

export function hasDuplicateExerciseIds(plan: WorkoutPlan): boolean {
  return new Set(plan.exercises.map((exercise) => exercise.id)).size !== plan.exercises.length;
}

export function preserveOriginalPlan(adaptedPlan: WorkoutPlan, originalPlan: WorkoutPlan): WorkoutPlan {
  const changed = adaptedPlan.sessionType !== originalPlan.sessionType
    || adaptedPlan.focus !== originalPlan.focus
    || adaptedPlan.exercises.length !== originalPlan.exercises.length
    || adaptedPlan.exercises.some((exercise, index) => {
      const previous = originalPlan.exercises[index];
      return !previous || exercise.id !== previous.id || exercise.sets !== previous.sets || exercise.reps !== previous.reps;
    });
  return {
    ...adaptedPlan,
    sourceExerciseIds: [...originalPlan.sourceExerciseIds],
    originalExercises: originalPlan.originalExercises.map((exercise) => ({ ...exercise })),
    generationReasons: changed
      ? [...adaptedPlan.generationReasons, adaptedPlan.exercises.some((exercise) => exercise.manualOverride)
        ? "A selected exercise alternative is saved while the original template remains in this session snapshot."
        : "Today’s check-in adapted the saved plan; the original template remains in this session snapshot."]
      : [...adaptedPlan.generationReasons],
  };
}

export function preserveManualExerciseChoices(adaptedPlan: WorkoutPlan, savedPlan: WorkoutPlan, profile: Profile): WorkoutPlan {
  const choices = savedPlan.exercises.filter((exercise) => exercise.manualOverride && exercise.substitutedFor);
  if (!choices.length) return preserveOriginalPlan(adaptedPlan, savedPlan);

  const appliedReasons: string[] = [];
  const exercises = adaptedPlan.exercises.map((generated) => {
    const choice = choices.find((exercise) => exercise.substitutedFor === generated.id || exercise.substitutedFor === generated.substitutedFor);
    if (!choice) return generated;
    const selected = getExerciseDefinition(choice.id);
    if (!selected || !isExerciseAllowedForProfile(selected, profile) || !exerciseEquipmentIsAvailable(selected, profile)) {
      appliedReasons.push(`${choice.name} was not kept because its equipment or trainer restriction no longer permits it.`);
      return generated;
    }
    appliedReasons.push(`${selected.name} remains as the selected alternative for ${generated.name}; the current check-in still sets today’s volume.`);
    return {
      ...selected,
      sets: generated.sets,
      reps: generated.reps,
      restSeconds: generated.restSeconds,
      substitutedFor: choice.substitutedFor,
      manualOverride: true,
      selectionReason: appliedReasons.at(-1),
      progressionAdvice: generated.progressionAdvice,
      loadGuidance: generated.loadGuidance,
      progressionAction: generated.progressionAction,
    };
  });

  return preserveOriginalPlan({
    ...adaptedPlan,
    exercises,
    generationReasons: [...adaptedPlan.generationReasons, ...appliedReasons],
  }, savedPlan);
}

export function deadliftAllowedForPlan(profile: Profile): boolean {
  // The persisted trainer approval is the only unlock. A later phase or training date never changes it.
  return profile.deadliftEnabled === true;
}
