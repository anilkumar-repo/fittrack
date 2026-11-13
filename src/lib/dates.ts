import type { Profile } from "./types";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Training days a week a client may choose. Keep in step with the profiles table checks. */
export const MIN_TRAINING_DAYS = 3;
export const MAX_TRAINING_DAYS = 6;

export function trainingDaysValid(days: number[]): boolean {
  return days.length >= MIN_TRAINING_DAYS && days.length <= MAX_TRAINING_DAYS;
}

/** A short note for the chosen number of days, shown under the day picker. */
export function trainingDaysHint(count: number): string {
  if (count < MIN_TRAINING_DAYS) return `choose at least ${MIN_TRAINING_DAYS}`;
  if (count > MAX_TRAINING_DAYS) return `choose at most ${MAX_TRAINING_DAYS} — keep one rest day`;
  if (count >= 5) return "keep back-to-back days easy";
  return "";
}

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

/** The seven dates, Monday to Sunday, of the week containing `date`. */
export function weekDates(date: string): string[] {
  const monday = shiftDate(date, -((weekdayOf(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}

/** A greeting for the current time of day in the given time zone. */
/** The hour (0–23) right now in the given time zone. */
export function hourIn(timeZone: string, now: Date = new Date()): number {
  try { return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now)); } catch { return now.getHours(); }
}

export function greetingFor(timeZone: string, now: Date = new Date()): string {
  const hour = hourIn(timeZone, now);
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
