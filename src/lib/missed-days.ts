import { shiftDate, weekdayOf } from "./dates.ts";
import type { MissedReason, MissedReasonEntry, Profile, WorkoutPlan, WorkoutSession } from "./types";

export const MISSED_REASONS: Array<{ id: MissedReason; label: string }> = [
  { id: "busy", label: "Busy with work or family" },
  { id: "unwell", label: "Felt unwell" },
  { id: "tired", label: "Too tired / low energy" },
  { id: "sore", label: "Sore or in pain" },
  { id: "travel", label: "Travelling" },
  { id: "forgot", label: "Forgot" },
  { id: "other", label: "Something else" },
];

export function missedReasonLabel(reason: MissedReason): string {
  return MISSED_REASONS.find((item) => item.id === reason)?.label ?? "Something else";
}

/** How far back the app asks about missed days. Older gaps are treated as a fresh start, not questioned. */
export const MISSED_DAY_LOOKBACK = 7;

/**
 * Planned training days before today, within the last week, with no workout logged and no reason given.
 * Oldest first. Today never counts: there is still time to train.
 */
export function unexplainedMissedDays(profile: Pick<Profile, "trainingDays" | "trainingStartDate">, sessions: WorkoutSession[], today: string): string[] {
  const handled = new Set(sessions.filter((session) => !session.sampleData && session.status !== "planned").map((session) => session.date));
  const days: string[] = [];
  for (let back = MISSED_DAY_LOOKBACK; back >= 1; back--) {
    const date = shiftDate(today, -back);
    if (date < profile.trainingStartDate) continue;
    if (!profile.trainingDays.includes(weekdayOf(date))) continue;
    if (!handled.has(date)) days.push(date);
  }
  return days;
}

export function validateMissedReason(entry: MissedReasonEntry): string[] {
  const errors: string[] = [];
  if (!MISSED_REASONS.some((item) => item.id === entry.reason)) errors.push("Choose a reason.");
  if (entry.note.length > 300) errors.push("Keep the note under 300 characters.");
  if (entry.reason === "other" && entry.note.trim().length < 3) errors.push("Tell us a little about what happened.");
  return errors;
}

/** The session saved for a missed day: skipped, with the reason and the plan that was due. */
export function missedDaySession(date: string, plan: WorkoutPlan, entry: MissedReasonEntry, existingId = ""): WorkoutSession {
  return { id: existingId || `missed-${date}`, date, status: "skipped", plan, exerciseLogs: [], missedReason: { reason: entry.reason, note: entry.note.trim() } };
}

/** Missed days with reasons, newest first, for the Progress screen and the trainer. */
export function missedDayHistory(sessions: WorkoutSession[]): Array<{ date: string; entry: MissedReasonEntry }> {
  return sessions
    .filter((session) => session.status === "skipped" && session.missedReason)
    .map((session) => ({ date: session.date, entry: session.missedReason as MissedReasonEntry }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
