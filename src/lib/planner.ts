import { EXERCISE_LIBRARY, getExerciseDefinition, getOptionalDeadliftExercise, getRecoveryExercises, getTemplateExercises, RULE_VERSION, TEMPLATE_VERSION } from "./templates.ts";
import { exerciseEquipmentIsAvailable, isDeadliftVariation, isExerciseAllowedForProfile } from "./exercise-library.ts";
import type { CheckIn, ExerciseDefinition, Profile, TrainerRuleSettings, TrainingPhase, WorkoutFocus, WorkoutPlan, WorkoutSession } from "./types";
import { DEFAULT_TRAINER_RULE_SETTINGS, normalizeTrainerRuleSettings, profileWithTrainerEquipment } from "./trainer-rules.ts";

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

function chooseFocus(completed: WorkoutSession[], isReturnSession: boolean): WorkoutFocus {
  if (isReturnSession) return "Return to training";
  return CYCLE[completed.length % CYCLE.length];
}

function recoveryDecision(date: string, checkIn: CheckIn | undefined, prior: WorkoutSession[], sessionsPerWeek: number, settings: TrainerRuleSettings): RecoveryDecision {
  const reasons: string[] = [];
  const recent = [...prior].reverse().filter((session) => daysBetween(date, session.date) <= 7);
  const completedThisWeek = recent.filter((session) => session.status === "completed").length;

  if (checkIn?.pain) reasons.push("Your check-in reports pain or discomfort, so this plan avoids loaded training.");
  const recentPain = recent.find((session) => session.checkIn?.pain || session.review?.discomfort);
  if (recentPain) reasons.push("A recent session reported pain or discomfort; take a recovery day and do not train through symptoms.");
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
  const reduceVolume = recentHighSoreness || recentLowReadiness || lowCurrentReadiness || highCurrentSoreness || busyWeek;

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
  return required.every((key) => profile.availableEquipment.includes(key));
}

function mostRecentLoggedSession(sessions: WorkoutSession[]): WorkoutSession | undefined {
  return [...sessions].filter((session) => session.status !== "planned").sort((a, b) => b.date.localeCompare(a.date))[0];
}

function patternOf(exercise: ExerciseDefinition | undefined): string | undefined {
  return exercise?.movementPattern ?? (exercise ? getExerciseDefinition(exercise.id)?.movementPattern : undefined);
}

function adaptEquipment(exercise: ExerciseDefinition, profile: Profile): ExerciseDefinition | null {
  if (equipmentAvailable(exercise, profile)) return { ...exercise, cues: [...exercise.cues] };
  if (!exercise.fallbackId) return null;
  const alternative = getExerciseDefinition(exercise.fallbackId);
  if (!alternative || !equipmentAvailable(alternative, profile)) return null;
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
    .filter((item) => item.category === exercise.category && !blockedIds.has(item.id) && !isDeadliftVariation(item))
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
  const focus = chooseFocus(trainingAttempts, isReturnSession);
  const phase = phaseFor(date, profile, completed, isReturnSession);
  const feedback = recoveryDecision(date, checkIn, prior, profile.sessionsPerWeek, settings);
  if (feedback.recover) return recoveryPlan(date, trainingAttempts, phase, feedback.reasons, checkIn?.pain === true, settings, trainerRuleRevision);

  const baseFocus = focus === "Return to training" || focus === "Recovery" ? CYCLE[0] : focus;
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
  const avoidRecentPatterns = latestGap !== null && latestGap < 2;
  const recentPatterns = new Set((latestSession?.plan.exercises ?? []).map((exercise) => patternOf(exercise)).filter((pattern): pattern is string => Boolean(pattern)));
  const recentlySkipped = new Set((latestSession?.exerciseLogs ?? []).filter((log) => log.status === "skipped").map((log) => log.exerciseId));
  const selectedIds = new Set<string>();
  const selectedPatterns = new Set<string>();
  const generationReasons = [
    `Selected ${baseFocus} from the approved ${profile.sessionsPerWeek}-day schedule using completed-session rotation; missed days are not added to today.`,
    `Trainer rules revision ${trainerRuleRevision} is snapshotted with this plan; pain always triggers recovery and deadlift approval remains a separate explicit trainer rule.`,
    phase === "foundation_2"
      ? "The trainee has completed the foundation consistency threshold; conservative beginner movement choices and trainer restrictions still apply."
      : phase === "return"
        ? "A break of at least 14 days makes this a lighter return session."
        : "Foundation phase 1 uses conservative beginner volume and a repeatable full-body template.",
    ...(feedback.reasons.length ? feedback.reasons : ["Recent check-ins and training frequency support the standard conservative volume."]),
    profile.equipmentAvailability === "verified"
      ? `Only confirmed equipment is used: ${profile.availableEquipment.length ? profile.availableEquipment.join(", ") : "bodyweight only"}.`
      : "Equipment availability is unconfirmed, so the plan uses alternatives that do not require listed gym equipment.",
  ];
  if (avoidRecentPatterns) generationReasons.push("The last completed workout was within one day; repeated movement patterns are replaced or omitted where a safe alternative is available.");
  if (profile.deadliftEnabled && baseFocus === "Foundation B") generationReasons.push("A trainer-approved rule permits the hinge variation for this client; time in training alone never enables it.");

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
    if (selectedPatterns.has(pattern)) {
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
      : `Selected from the ${baseFocus} template as part of the approved beginner rotation.`);
    const progression = progressionFor(candidate, prior, settings);
    const plannedSets = Math.min(candidate.sets, isEarlyFoundation ? 2 : 3);
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

  if (!exercises.length) {
    return recoveryPlan(date, trainingAttempts, phase, [...generationReasons, "No safe exercises matched the verified equipment and movement-pattern constraints."], false, settings, trainerRuleRevision);
  }
  const title = isReturnSession ? "Easy return session" : `${baseFocus} · Full body`;
  const description = isReturnSession
    ? "A lighter first session back. Keep every rep comfortable and leave plenty in reserve."
    : volumeAdjustment
      ? "Today’s plan uses fewer sets based on recovery feedback and recent training."
      : "Build comfortable, repeatable strength with simple movements and a calm pace.";
  return {
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
  };
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
