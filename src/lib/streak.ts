import { shiftDate, weekdayOf } from "./dates.ts";
import type { MissedReason, Profile, WorkoutSession } from "./types";

/** Each streak comes with this many repairs. When they run out, a break restarts the streak at day one. */
export const REPAIRS_PER_STREAK = 5;
/** A missed day can be repaired by any workout within this many days. */
export const REPAIR_WINDOW_DAYS = 7;
/** Missed-day reasons that pause the streak instead of breaking it: health and travel come first. */
const PAUSE_REASONS = new Set<MissedReason>(["unwell", "sore", "travel"]);

/**
 * How each calendar day counts:
 *   done      a workout was finished
 *   rest      not a training day
 *   paused    missed for illness, soreness or travel; the streak is kept, not counted
 *   repaired  missed, then repaired by a workout within the repair window
 *   missed    missed and not repaired
 *   today     today's planned workout, still to do
 *   upcoming  after today
 *   before    before training started
 */
export type StreakDay = "done" | "rest" | "paused" | "repaired" | "missed" | "today" | "upcoming" | "before";

export interface StreakRepair {
  /** The streak that comes back if a workout is done in time. */
  lostStreak: number;
  /** Last day a workout repairs it. */
  deadline: string;
}

export interface StreakTimeline {
  days: Record<string, StreakDay>;
  current: number;
  best: number;
  repairsLeft: number;
  /** Set while a broken streak can still be repaired. */
  repair: StreakRepair | null;
  /** Dates on which a workout repaired the streak. */
  repairedOn: string[];
  /** True when a missed day is unrepaired and the streak is at zero. */
  broken: boolean;
  firstDate: string;
}

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

export function buildStreakTimeline(profile: Pick<Profile, "trainingDays" | "trainingStartDate">, sessions: WorkoutSession[], today: string): StreakTimeline {
  const real = sessions.filter((session) => !session.sampleData);
  const done = new Set(real.filter((session) => session.status === "completed" && session.date <= today).map((session) => session.date));
  const reasons = new Map(real.filter((session) => session.missedReason).map((session) => [session.date, session.missedReason!.reason]));
  const firstDone = [...done].sort()[0];
  const firstDate = firstDone && firstDone < profile.trainingStartDate ? firstDone : profile.trainingStartDate;
  const planned = (date: string) => date >= profile.trainingStartDate && profile.trainingDays.includes(weekdayOf(date));

  const days: Record<string, StreakDay> = {};
  const repairedOn: string[] = [];
  let current = 0;
  let best = 0;
  let repairsLeft = REPAIRS_PER_STREAK;
  let pending: string[] = [];
  let lostStreak = 0;

  for (let date = firstDate, guard = 0; date <= today && guard < 4000; date = shiftDate(date, 1), guard += 1) {
    if (done.has(date)) {
      if (pending.length) {
        if (repairsLeft > 0 && lostStreak > 0) {
          // A workout in time brings the old streak back and marks the missed days as repaired.
          for (const missed of pending) days[missed] = "repaired";
          repairsLeft -= 1;
          repairedOn.push(date);
          current = lostStreak + 1;
        } else {
          current = 1;
          repairsLeft = REPAIRS_PER_STREAK;
        }
        pending = [];
      } else {
        current += 1;
      }
      days[date] = "done";
      best = Math.max(best, current);
    } else if (planned(date) && date < today) {
      const reason = reasons.get(date);
      if (reason && PAUSE_REASONS.has(reason)) days[date] = "paused";
      else {
        days[date] = "missed";
        if (!pending.length) {
          lostStreak = current;
          current = 0;
        }
        pending.push(date);
      }
    } else {
      days[date] = date === today && planned(date) ? "today" : "rest";
    }

    // The repair window closed: the old streak is gone and the next workout starts a fresh one with fresh repairs.
    // A workout on the deadline day itself still counts (it is handled at the top of that day), and today never closes it.
    if (pending.length && date < today && daysBetween(date, pending[0]) >= REPAIR_WINDOW_DAYS) {
      pending = [];
      lostStreak = 0;
      repairsLeft = REPAIRS_PER_STREAK;
    }
  }

  const repairable = pending.length > 0 && repairsLeft > 0 && lostStreak > 0;
  const repair = repairable ? { lostStreak, deadline: shiftDate(pending[0], REPAIR_WINDOW_DAYS) } : null;
  const lastDone = [...done].sort().at(-1);
  const missedSinceLastDone = Object.entries(days).some(([date, status]) => status === "missed" && (!lastDone || date > lastDone));
  return { days, current, best, repairsLeft, repair, repairedOn, broken: done.size > 0 && current === 0 && missedSinceLastDone, firstDate };
}

/** Monday-first weeks of a month for the calendar: null pads the days outside the month. */
export function monthGrid(year: number, month: number): Array<Array<string | null>> {
  const pad = (value: number) => String(value).padStart(2, "0");
  const first = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (weekdayOf(first) + 6) % 7;
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => `${year}-${pad(month)}-${pad(index + 1)}`)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** The seven days (Monday to Sunday) of the week containing `date`, with their streak status. */
export function weekStrip(timeline: StreakTimeline, date: string): Array<{ date: string; status: StreakDay }> {
  const monday = shiftDate(date, -((weekdayOf(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(monday, index);
    return { date: day, status: timeline.days[day] ?? (day > date ? "upcoming" : "before") };
  });
}
