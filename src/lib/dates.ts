import type { Profile } from "./types";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function shortDate(date: string): string {
  return dateLabel(date, { month: "short", day: "numeric" });
}

export function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** The first scheduled training date after `date`, looking one week ahead. */
export function nextTrainingDate(profile: Pick<Profile, "trainingDays">, date: string): string | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = shiftDate(date, offset);
    if (profile.trainingDays.includes(weekdayOf(next))) return next;
  }
  return null;
}

export function describeNextDay(profile: Pick<Profile, "trainingDays">, date: string): string {
  const next = nextTrainingDate(profile, date);
  return next ? dateLabel(next) : "your next scheduled day";
}

/** Link to the workout page for a date; today has the short address. */
export function todayHref(date: string, currentDate: string): string {
  return date === currentDate ? "/today" : `/today?date=${date}`;
}
