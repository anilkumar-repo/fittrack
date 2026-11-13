import { shiftDate, weekdayOf } from "./dates.ts";
import { motivationFor } from "./motivation.ts";

/** One phone's notification choices. Hours are in the person's own time zone. */
export interface PushPrefs {
  morning: boolean;
  morningHour: number;
  evening: boolean;
  eveningHour: number;
  nudges: boolean;
}

export const DEFAULT_PUSH_PREFS: PushPrefs = { morning: true, morningHour: 7, evening: true, eveningHour: 19, nudges: true };
export const MORNING_HOURS = [5, 6, 7, 8, 9, 10, 11];
export const EVENING_HOURS = [16, 17, 18, 19, 20, 21, 22];

export interface PushMessage {
  kind: "morning" | "evening" | "nudge";
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
}

/** Local date (YYYY-MM-DD) and hour (0–23) in a time zone. */
export function localDateAndHour(timeZone: string, now: Date): { date: string; hour: number } {
  let zone = timeZone;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "UTC"; }
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(now).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

export interface ScheduleInput {
  prefs: PushPrefs;
  timeZone: string;
  trainingDays: number[];
  trainingStartDate: string;
  /** Workout status by date for recent days ("completed", "in_progress", "skipped", "planned"). */
  statusByDate: Map<string, string>;
  lastMorningOn: string | null;
  lastEveningOn: string | null;
  now: Date;
}

function isTrainingDay(input: Pick<ScheduleInput, "trainingDays" | "trainingStartDate">, date: string): boolean {
  return date >= input.trainingStartDate && input.trainingDays.includes(weekdayOf(date));
}

/**
 * Which scheduled notifications are due this hour. The morning one brings the day's motivation line
 * (or asks about yesterday if that workout was missed); the evening one reminds you to log a planned
 * workout that has not been logged yet. Each is sent at most once a day.
 */
export function dueNotifications(input: ScheduleInput): PushMessage[] {
  const { date, hour } = localDateAndHour(input.timeZone, input.now);
  const messages: PushMessage[] = [];

  if (input.prefs.morning && hour === input.prefs.morningHour && input.lastMorningOn !== date) {
    const yesterday = shiftDate(date, -1);
    const yesterdayStatus = input.statusByDate.get(yesterday);
    const missedYesterday = isTrainingDay(input, yesterday) && (!yesterdayStatus || yesterdayStatus === "planned");
    messages.push(missedYesterday
      ? { kind: "morning", title: "You missed yesterday’s workout", body: "No stress. Tell Rozi what happened, then let’s get today right.", url: "/" }
      : { kind: "morning", title: isTrainingDay(input, date) ? "Good morning! Workout day ☀️" : "Good morning! Rest day ☀️", body: motivationFor(date), url: "/" });
  }

  if (input.prefs.evening && hour === input.prefs.eveningHour && input.lastEveningOn !== date && isTrainingDay(input, date)) {
    const status = input.statusByDate.get(date);
    if (status !== "completed" && status !== "skipped") {
      messages.push(status === "in_progress"
        ? { kind: "evening", title: "Finish today’s log 📝", body: "Your workout is still open. Save it to keep your streak going.", url: "/today" }
        : { kind: "evening", title: "Did you train today? 🔥", body: "Log today’s workout to keep your streak going. Even a short session counts.", url: "/today" });
    }
  }
  return messages;
}

export function nudgeMessage(fromName: string, message: string): PushMessage {
  return { kind: "nudge", title: `${fromName} nudged you 👋`, body: message || "Time to train!", url: "/" };
}
