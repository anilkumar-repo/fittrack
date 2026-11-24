import { canUseExercise } from "./exercise-swap.ts";
import { VARIATION_GROUPS, VARIATION_NOTES } from "./exercise-taxonomy.ts";
import { EQUIPMENT_OPTIONS, getExerciseDefinition } from "./templates.ts";
import { trackingOf } from "./tracking.ts";
import type { EquipmentKey, ExerciseDefinition, Profile } from "./types.ts";

/**
 * Exercise variations (R7): the other versions of the same movement, and how each one differs, worked out only from
 * library data (equipment, difficulty, main muscle, one side or both, timed or reps, trainer approval). Rozi reads
 * these facts instead of guessing why an incline press differs from a flat one.
 */

export interface Variation {
  exercise: ExerciseDefinition;
  /** This person can do it now (equipment and trainer rules). */
  usable: boolean;
  /** Plain facts, e.g. "more upper chest focus", "needs barbell + bench", "harder (intermediate)". Empty when no clear difference. */
  differences: string[];
}

// Short labels: "weight machines (press, pec deck, leg extension)" → "weight machines".
const EQUIPMENT_LABEL = new Map<EquipmentKey, string>(EQUIPMENT_OPTIONS.map((option) => [option.id, option.label.replace(/\s*\(.*\)$/, "").toLowerCase()]));

/** True for moves done one side at a time ("Single-arm cable row", "8 each leg"). */
function oneSided(exercise: ExerciseDefinition): boolean {
  return /\b(single|one)[- ](arm|leg)\b/i.test(exercise.name) || /\beach (leg|side|arm)\b/i.test(exercise.reps) || /^(bulgarian|walking|supported reverse)/i.test(exercise.name);
}

function equipmentText(keys: EquipmentKey[]): string {
  return keys.length ? keys.map((key) => EQUIPMENT_LABEL.get(key) ?? key).join(" + ") : "no equipment";
}

/** How `other` differs from `from`, as short facts taken from the library. */
export function compareVariation(from: ExerciseDefinition, other: ExerciseDefinition): string[] {
  const facts: string[] = [];
  const note = VARIATION_NOTES[other.id];
  if (note) facts.push(note);
  const mainFrom = (from.targetMuscles[0] ?? "").toLowerCase();
  const mainOther = (other.targetMuscles[0] ?? "").toLowerCase();
  if (mainOther && mainOther !== mainFrom && !note?.includes(mainOther)) facts.push(`more ${mainOther} focus`);
  const needFrom = from.requiredEquipment ?? [];
  const needOther = other.requiredEquipment ?? [];
  const added = needOther.filter((key) => !needFrom.includes(key));
  const removed = needFrom.filter((key) => !needOther.includes(key));
  if (added.length) facts.push(`needs ${equipmentText(added)}`);
  else if (removed.length) facts.push(needOther.length ? `no ${equipmentText(removed)} needed` : "no equipment needed");
  if (other.difficulty !== from.difficulty) facts.push(other.difficulty === "intermediate" ? "harder (intermediate)" : "easier (beginner)");
  if (oneSided(other) && !oneSided(from)) facts.push("one side at a time");
  if (!oneSided(other) && oneSided(from)) facts.push("both sides together");
  const unitFrom = trackingOf(from).unit;
  const unitOther = trackingOf(other).unit;
  if (unitOther !== unitFrom) facts.push(unitOther === "reps" ? "counted in reps" : `counted in ${unitOther}`);
  if (other.restriction === "trainer_deadlift_approval" && from.restriction !== "trainer_deadlift_approval") facts.push("needs your trainer's approval");
  return facts;
}

/** The other versions of this exercise's movement, closest first (variation-group order), with what differs. */
export function variationsOf(exercise: ExerciseDefinition, profile: Profile): Variation[] {
  const source = getExerciseDefinition(exercise.id) ?? exercise;
  const group = source.variationGroup ? VARIATION_GROUPS[source.variationGroup] ?? [] : [];
  return group
    .filter((id) => id !== source.id)
    .map((id) => getExerciseDefinition(id))
    .filter((item): item is ExerciseDefinition => Boolean(item))
    .map((item) => ({ exercise: item, usable: canUseExercise(item, profile), differences: compareVariation(source, item) }));
}
