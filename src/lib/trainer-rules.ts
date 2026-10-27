import { EXERCISE_LIBRARY } from "./templates.ts";
import { isDeadliftVariation } from "./exercise-library.ts";
import type { EquipmentKey, Profile, TrainerRuleSettings } from "./types";

export const DEFAULT_TRAINER_RULE_SETTINGS: TrainerRuleSettings = {
  exerciseTemplates: [],
  progression: { repIncrement: 1, smallLoadStepKg: 1 },
  recovery: {
    stopEnergyThreshold: 1,
    stopRecoveryThreshold: 1,
    stopSorenessThreshold: 5,
    lowEnergyVolumeThreshold: 2,
    highSorenessVolumeThreshold: 4,
    repeatedHighSorenessSessions: 2,
    volumeReductionSets: 1,
  },
  equipment: { mode: "inherit", availableEquipment: [] },
};

const equipmentKeys: EquipmentKey[] = ["dumbbells", "bench", "cable_machine", "leg_press", "leg_curl_machine", "rack", "mat", "chair"];
const exercisesById = new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.id, exercise]));
const editableTemplateIds = new Set(["goblet_squat", "dumbbell_bench", "lat_pulldown", "glute_bridge", "leg_press", "seated_row", "shoulder_press", "hamstring_curl", "incline_pushup", "chest_row", "hip_thrust"]);

export function isTrainerEditableTemplateExercise(exerciseId: string): boolean {
  const exercise = exercisesById.get(exerciseId);
  return Boolean(exercise && editableTemplateIds.has(exercise.id) && !isDeadliftVariation(exercise) && !/sec|each side/i.test(exercise.reps));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function allowedKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function boundedNumber(value: unknown, min: number, max: number, integer = true): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
}

export function validateTrainerRuleSettings(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value) || !allowedKeys(value, ["exerciseTemplates", "progression", "recovery", "equipment"])) {
    return ["Trainer settings must be an object with supported rule sections only."];
  }

  const templates = value.exerciseTemplates;
  if (!Array.isArray(templates) || templates.length > 20) {
    errors.push("Template changes must be a list of at most 20 exercise entries.");
  } else {
    const seen = new Set<string>();
    for (const entry of templates) {
      if (!isRecord(entry) || !allowedKeys(entry, ["exerciseId", "sets", "minReps", "maxReps", "restSeconds"])) {
        errors.push("Each template change must contain only an exercise and bounded sets, reps, and rest values.");
        continue;
      }
      const exercise = typeof entry.exerciseId === "string" ? exercisesById.get(entry.exerciseId) : undefined;
      if (!exercise || isDeadliftVariation(exercise) || !editableTemplateIds.has(entry.exerciseId as string) || /sec|each side/i.test(exercise.reps)) errors.push("Template changes must use an allowed repetition-based exercise from the FitTrack templates.");
      if (typeof entry.exerciseId === "string" && seen.has(entry.exerciseId)) errors.push("An exercise can appear only once in template changes.");
      if (typeof entry.exerciseId === "string") seen.add(entry.exerciseId);
      if (!boundedNumber(entry.sets, 1, 3)) errors.push("Exercise sets must be between 1 and 3.");
      if (!boundedNumber(entry.minReps, 4, 20) || !boundedNumber(entry.maxReps, 4, 20) || (typeof entry.minReps === "number" && typeof entry.maxReps === "number" && entry.minReps > entry.maxReps)) {
        errors.push("Rep ranges must be whole numbers from 4 to 20, with the minimum no greater than the maximum.");
      }
      if (!boundedNumber(entry.restSeconds, 30, 180)) errors.push("Rest guidance must be between 30 and 180 seconds.");
    }
  }

  const progression = value.progression;
  if (!isRecord(progression) || !allowedKeys(progression, ["repIncrement", "smallLoadStepKg"]) || !boundedNumber(progression.repIncrement, 1, 2) || !boundedNumber(progression.smallLoadStepKg, 0.5, 2.5, false)) {
    errors.push("Progression must add 1–2 reps and keep any suggested load step between 0.5 and 2.5 kg.");
  }

  const recovery = value.recovery;
  if (!isRecord(recovery) || !allowedKeys(recovery, ["stopEnergyThreshold", "stopRecoveryThreshold", "stopSorenessThreshold", "lowEnergyVolumeThreshold", "highSorenessVolumeThreshold", "repeatedHighSorenessSessions", "volumeReductionSets"])) {
    errors.push("Recovery settings contain unsupported fields.");
  } else {
    if (!boundedNumber(recovery.stopEnergyThreshold, 1, 2) || !boundedNumber(recovery.stopRecoveryThreshold, 1, 2) || !boundedNumber(recovery.stopSorenessThreshold, 4, 5)) {
      errors.push("Recovery-session cutoffs must stay within the supported conservative range.");
    }
    if (!boundedNumber(recovery.lowEnergyVolumeThreshold, 1, 3) || !boundedNumber(recovery.highSorenessVolumeThreshold, 3, 5)) {
      errors.push("Volume-reduction cutoffs are outside the supported range.");
    }
    if (!boundedNumber(recovery.repeatedHighSorenessSessions, 1, 3) || !boundedNumber(recovery.volumeReductionSets, 1, 2)) {
      errors.push("Repeated-soreness and volume-reduction settings are outside the supported range.");
    }
  }

  const equipment = value.equipment;
  if (!isRecord(equipment) || !allowedKeys(equipment, ["mode", "availableEquipment"]) || !["inherit", "unknown", "verified"].includes(String(equipment.mode)) || !Array.isArray(equipment.availableEquipment)) {
    errors.push("Equipment settings must be inherited, unknown, or explicitly verified.");
  } else {
    const items = equipment.availableEquipment;
    if (items.length > equipmentKeys.length || items.some((item) => typeof item !== "string" || !equipmentKeys.includes(item as EquipmentKey)) || new Set(items).size !== items.length) {
      errors.push("Equipment must use unique FitTrack equipment values only.");
    }
    if ((equipment.mode === "inherit" || equipment.mode === "unknown") && items.length > 0) errors.push("Inherited or unknown equipment cannot include a confirmed equipment list.");
  }

  return [...new Set(errors)];
}

export function normalizeTrainerRuleSettings(value: unknown): TrainerRuleSettings {
  if (validateTrainerRuleSettings(value).length) return structuredClone(DEFAULT_TRAINER_RULE_SETTINGS);
  const settings = value as TrainerRuleSettings;
  return {
    exerciseTemplates: settings.exerciseTemplates.map((item) => ({ ...item })),
    progression: { ...settings.progression },
    recovery: { ...settings.recovery },
    equipment: { mode: settings.equipment.mode, availableEquipment: [...settings.equipment.availableEquipment] },
  };
}

export function profileWithTrainerEquipment(profile: Profile, settings: TrainerRuleSettings): Profile {
  if (settings.equipment.mode === "inherit") return { ...profile, availableEquipment: [...profile.availableEquipment] };
  if (settings.equipment.mode === "unknown") return { ...profile, equipmentAvailability: "unknown", availableEquipment: [] };
  return { ...profile, equipmentAvailability: "verified", availableEquipment: [...settings.equipment.availableEquipment] };
}

export function trainerRuleChangesNeedConfirmation(previous: TrainerRuleSettings, next: TrainerRuleSettings): boolean {
  const old = previous.recovery;
  const changed = next.recovery;
  if (changed.stopEnergyThreshold < old.stopEnergyThreshold
    || changed.stopRecoveryThreshold < old.stopRecoveryThreshold
    || changed.stopSorenessThreshold > old.stopSorenessThreshold
    || changed.lowEnergyVolumeThreshold < old.lowEnergyVolumeThreshold
    || changed.highSorenessVolumeThreshold > old.highSorenessVolumeThreshold
    || changed.repeatedHighSorenessSessions > old.repeatedHighSorenessSessions
    || changed.volumeReductionSets < old.volumeReductionSets
    || next.progression.repIncrement > previous.progression.repIncrement
    || next.progression.smallLoadStepKg > previous.progression.smallLoadStepKg) return true;

  const oldTemplates = new Map(previous.exerciseTemplates.map((item) => [item.exerciseId, item]));
  return next.exerciseTemplates.some((item) => {
    const before = oldTemplates.get(item.exerciseId);
    const exercise = exercisesById.get(item.exerciseId);
    const defaultReps = exercise ? [...exercise.reps.matchAll(/\d+/g)].map((match) => Number(match[0])) : [];
    const baseline = before ?? (exercise ? {
      sets: Math.min(3, exercise.sets), minReps: defaultReps[0] ?? 8,
      maxReps: defaultReps[1] ?? defaultReps[0] ?? 8, restSeconds: exercise.restSeconds,
    } : undefined);
    return baseline !== undefined && (item.sets > baseline.sets || item.maxReps > baseline.maxReps || item.minReps > baseline.minReps || item.restSeconds < baseline.restSeconds);
  });
}

export interface TrainerRuleActor {
  id: string;
  trustedRole: string | undefined;
}

export function canManageTrainerClientRules(actor: TrainerRuleActor, trainerId: string, clientId: string, activeClientIds: string[]): boolean {
  return actor.id === trainerId && actor.trustedRole === "trainer" && trainerId !== clientId && activeClientIds.includes(clientId);
}
