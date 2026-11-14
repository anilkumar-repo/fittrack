import type { BodyWeightEntry, ExperienceLevel, Profile, TrainingGoal } from "./types";

/**
 * Body stats from Get started: BMI, the healthy weight range for the person's height, and what that means
 * for them (lose fat, gain muscle, or keep weight and get stronger). BMI is a rough screening number,
 * not a diagnosis, and it does not apply to under-18s or tell muscle from fat.
 */
export type BodySex = "female" | "male" | "other";

export interface BodyStats {
  heightCm: number;
  weightKg: number;
  age: number;
  sex?: BodySex;
}

export const HEALTHY_BMI = { min: 18.5, max: 24.9 } as const;
export const MIN_AGE = 13;

export function bmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export type BmiBand = "under" | "healthy" | "over" | "obese";

export function bmiBand(value: number): BmiBand {
  if (value < HEALTHY_BMI.min) return "under";
  if (value <= HEALTHY_BMI.max) return "healthy";
  if (value < 30) return "over";
  return "obese";
}

export const BMI_BAND_LABEL: Record<BmiBand, string> = { under: "Below the healthy range", healthy: "Healthy range", over: "Above the healthy range", obese: "Well above the healthy range" };

/** Healthy weight range for a height (BMI 18.5–24.9), rounded to whole kg. */
export function healthyRange(heightCm: number): { minKg: number; maxKg: number } {
  const m2 = (heightCm / 100) ** 2;
  return { minKg: Math.ceil(HEALTHY_BMI.min * m2), maxKg: Math.floor(HEALTHY_BMI.max * m2) };
}

export function ageFrom(birthYear: number | undefined, today: string): number | null {
  if (!birthYear) return null;
  return Number(today.slice(0, 4)) - birthYear;
}

export function validBodyStats(stats: Partial<BodyStats>): stats is BodyStats {
  return Boolean(stats.heightCm && stats.heightCm >= 100 && stats.heightCm <= 250
    && stats.weightKg && stats.weightKg >= 25 && stats.weightKg <= 350
    && stats.age && stats.age >= MIN_AGE && stats.age <= 100);
}

export interface BodyPlan {
  bmi: number;
  band: BmiBand;
  range: { minKg: number; maxKg: number };
  direction: "lose" | "gain" | "maintain";
  /** Kilograms to reach the edge of the healthy range (0 when already inside it). */
  amountKg: number;
  /** Rough time at a safe pace, in weeks. */
  weeks: number;
  headline: string;
  detail: string;
  recommendedGoal: TrainingGoal;
  recommendedLevel: ExperienceLevel;
  /** True for under-18s: BMI needs age charts, so targets are not shown. */
  youth: boolean;
}

/** Safe monthly muscle gain for a beginner (kg): about 0.5–1 for men, 0.25–0.5 for women. */
function muscleGainPerMonth(sex?: BodySex): number {
  return sex === "male" ? 0.75 : sex === "female" ? 0.4 : 0.55;
}

export function bodyPlan(stats: BodyStats): BodyPlan {
  const value = bmi(stats.heightCm, stats.weightKg);
  const band = bmiBand(value);
  const range = healthyRange(stats.heightCm);
  const youth = stats.age < 18;
  if (youth) {
    return {
      bmi: value, band, range, direction: "maintain", amountKg: 0, weeks: 0, youth,
      headline: "Let’s build healthy habits",
      detail: "Under 18, BMI is read with age charts, so RozFit won’t set a weight target. Focus on moving well, getting stronger and sleeping well — and check with a parent, coach or doctor.",
      recommendedGoal: "general", recommendedLevel: "beginner",
    };
  }
  if (stats.weightKg > range.maxKg) {
    const amountKg = Math.round((stats.weightKg - range.maxKg) * 10) / 10;
    // A safe pace is about 0.5% of body weight a week.
    const weeks = Math.ceil(amountKg / (stats.weightKg * 0.005));
    return {
      bmi: value, band, range, direction: "lose", amountKg, weeks, youth,
      headline: `Lose about ${Math.round(amountKg)} kg of fat`,
      detail: `Your healthy range is ${range.minKg}–${range.maxKg} kg. At a safe pace (about ${Math.round(stats.weightKg * 5) / 1000} kg a week) that’s roughly ${weeks} weeks. Strength training keeps your muscle while the fat comes off.`,
      recommendedGoal: "fatloss",
      recommendedLevel: "beginner",
    };
  }
  if (stats.weightKg < range.minKg) {
    const amountKg = Math.round((range.minKg - stats.weightKg) * 10) / 10;
    const months = amountKg / muscleGainPerMonth(stats.sex);
    return {
      bmi: value, band, range, direction: "gain", amountKg, weeks: Math.ceil(months * 4.35), youth,
      headline: `Gain about ${Math.round(amountKg * 10) / 10} kg — as muscle`,
      detail: `Your healthy range is ${range.minKg}–${range.maxKg} kg. Built as muscle (not fat), that’s about ${muscleGainPerMonth(stats.sex)} kg a month — around ${Math.ceil(months)} months. Eat a little more than you burn, with protein at every meal.`,
      recommendedGoal: "muscle",
      recommendedLevel: "beginner",
    };
  }
  return {
    bmi: value, band, range, direction: "maintain", amountKg: 0, weeks: 0, youth,
    headline: "You’re in the healthy range",
    detail: `Your healthy range is ${range.minKg}–${range.maxKg} kg. Keep your weight and change your shape: build muscle and lose a little fat at the same time.`,
    recommendedGoal: "tone",
    recommendedLevel: "beginner",
  };
}

/** Body stats from a profile and the latest weight, if everything needed is there. */
export function profileBodyStats(profile: Pick<Profile, "heightCm" | "birthYear" | "sex">, entries: BodyWeightEntry[], today: string): BodyStats | null {
  const latest = [...entries].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)).at(-1);
  const age = ageFrom(profile.birthYear, today);
  const stats = { heightCm: profile.heightCm, weightKg: latest?.weightKg, age: age ?? undefined, sex: profile.sex };
  return validBodyStats(stats) ? stats : null;
}

// ---------- Monthly weigh-in ----------

export const WEIGH_IN_DAYS = 30;

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

/** Due when the last weight is 30+ days old (or there is none). */
export function weighInDue(entries: BodyWeightEntry[], today: string): boolean {
  const last = [...entries].map((entry) => entry.measuredOn).filter((date) => date <= today).sort().at(-1);
  return !last || daysBetween(today, last) >= WEIGH_IN_DAYS;
}

/** Tips after a weigh-in, comparing with the previous weight and the person's goal. */
export function weighInTips(previousKg: number | null, latestKg: number, days: number, goal: TrainingGoal, heightCm?: number): string[] {
  const tips: string[] = [];
  const range = heightCm ? healthyRange(heightCm) : null;
  if (previousKg === null) return ["First weight saved. Next check-in in a month — weigh in the morning, before breakfast, for fair comparisons."];
  const change = Math.round((latestKg - previousKg) * 10) / 10;
  const perWeek = days > 0 ? change / (days / 7) : 0;
  const pace = Math.abs(perWeek) / latestKg;
  const wantsLoss = goal === "fatloss" || (range !== null && latestKg > range.maxKg);
  const wantsGain = goal === "muscle" || (range !== null && latestKg < range.minKg);
  tips.push(`${change === 0 ? "No change" : `${change > 0 ? "+" : ""}${change} kg`} since last time (${days} days).`);
  if (wantsLoss) {
    if (change >= 0) tips.push("No loss yet. Keep 3–4 workouts a week, add 2,000 steps a day, and trim one snack or sugary drink.");
    else if (pace > 0.01) tips.push("You’re losing fast (over 1% a week). Eat a bit more protein and don’t skip strength days, so the loss is fat, not muscle.");
    else tips.push("Great pace — steady loss keeps muscle. Keep doing exactly this.");
  } else if (wantsGain) {
    if (change <= 0) tips.push("No gain yet. Add one extra snack with protein (curd, eggs, paneer, nuts) and push to the top of your rep ranges.");
    else if (perWeek > 0.35) tips.push("Gaining quickly — some may be fat. Keep the extra food modest and train hard.");
    else tips.push("Good, slow gain — that’s muscle. Keep adding small weight to your lifts.");
  } else {
    if (Math.abs(change) <= 1) tips.push("Weight is steady — perfect for getting stronger and more toned.");
    else tips.push(change > 0 ? "Up a little. Watch portion sizes and keep moving on rest days." : "Down a little. Make sure you eat enough to recover from training.");
  }
  if (range && latestKg >= range.minKg && latestKg <= range.maxKg) tips.push(`You’re within your healthy range (${range.minKg}–${range.maxKg} kg).`);
  return tips;
}
