import { formatAmount, formatAmounts, formatDistance } from "./tracking.ts";
import type { TrackingUnit, WorkoutSession } from "./types";

export type WeightUnit = "kg" | "lb";

const KG_PER_LB = 0.45359237;

/** Weights are always stored in kilograms; this is the number to show for the chosen unit. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? Math.round((kg / KG_PER_LB) * 10) / 10 : Math.round(kg * 100) / 100;
}

/** Converts a typed number in the chosen unit to kilograms, at the precision the database keeps. */
export function displayToKg(value: number, unit: WeightUnit): number {
  return Math.round((unit === "lb" ? value * KG_PER_LB : value) * 100) / 100;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${kgToDisplay(kg, unit)} ${unit}`;
}

export interface LastPerformance {
  date: string;
  sets: Array<{ reps: number; loadKg: number | null; distanceKm?: number | null }>;
}

/** The most recent earlier session where this exercise has completed sets with reps recorded. */
export function lastPerformance(exerciseId: string, sessions: WorkoutSession[], beforeDate: string): LastPerformance | null {
  const earlier = sessions
    .filter((session) => !session.sampleData && session.date < beforeDate && session.status !== "planned")
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const session of earlier) {
    const log = session.exerciseLogs.find((item) => item.exerciseId === exerciseId);
    const sets = (log?.sets ?? [])
      .filter((set) => set.completed && set.actualReps !== null)
      .map((set) => ({ reps: set.actualReps as number, loadKg: set.loadKg, ...(typeof set.distanceKm === "number" ? { distanceKm: set.distanceKm } : {}) }));
    if (sets.length) return { date: session.date, sets };
  }
  return null;
}

/**
 * For example "10, 10 reps · 12.5 kg", or "10 × 12.5 kg, 8 × 10 kg" when the load changed between sets. Timed
 * exercises read "30, 30 sec" or "25 min · 2.4 km" (`counted` is the exercise's tracking unit).
 */
export function describeLastPerformance(last: LastPerformance, unit: WeightUnit, counted: TrackingUnit = "reps"): string {
  const distance = last.sets.reduce((sum, set) => sum + (set.distanceKm ?? 0), 0);
  const withDistance = (text: string) => distance > 0 ? `${text} · ${formatDistance(distance)}` : text;
  const loads = last.sets.map((set) => set.loadKg);
  const sameLoad = loads.every((load) => load === loads[0]);
  if (sameLoad) {
    const amounts = formatAmounts(last.sets.map((set) => set.reps), counted);
    return withDistance(loads[0] === null || loads[0] <= 0 ? amounts : `${amounts} · ${formatWeight(loads[0], unit)}`);
  }
  return withDistance(last.sets.map((set) => set.loadKg === null || set.loadKg <= 0 ? formatAmount(set.reps, counted) : `${counted === "reps" ? set.reps : formatAmount(set.reps, counted)} × ${formatWeight(set.loadKg, unit)}`).join(", "));
}

/** The load used on the last completed set last time, as a hint for today's entry. */
export function lastLoadKg(last: LastPerformance | null): number | null {
  const loads = (last?.sets ?? []).map((set) => set.loadKg).filter((load): load is number => load !== null && load > 0);
  return loads.length ? loads[loads.length - 1] : null;
}

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
