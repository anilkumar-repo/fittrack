import { shiftDate, weekdayOf } from "./dates.ts";
import { goalOf } from "./program.ts";
import { calculateStreak } from "./rozi.ts";
import type { Profile, TrainingGoal, WorkoutSession } from "./types";

/** The summary a person shares with friends. Never their workout logs. */
export interface FriendStats {
  userId: string;
  displayName: string;
  goal: TrainingGoal;
  currentStreak: number;
  bestStreak: number;
  weekCount: number;
  weekGoal: number;
  lastWorkoutDate: string | null;
  /** Completed workout dates from the last 62 days. */
  recentDates: string[];
}

export interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  period: "week" | "month";
  target: number;
  startsOn: string;
  endsOn: string;
  memberIds: string[];
}

export interface Nudge {
  id: string;
  fromUser: string;
  toUser: string;
  message: string;
  sentOn: string;
  seenAt: string | null;
}

/** Monday of the week containing the date. */
export function weekStart(date: string): string {
  return shiftDate(date, -((weekdayOf(date) + 6) % 7));
}

export function monthRange(date: string): { start: string; end: string } {
  const [year, month] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` };
}

export function challengeWindow(period: "week" | "month", today: string): { startsOn: string; endsOn: string } {
  if (period === "week") {
    const start = weekStart(today);
    return { startsOn: start, endsOn: shiftDate(start, 6) };
  }
  const { start, end } = monthRange(today);
  return { startsOn: start, endsOn: end };
}

export function computeFriendStats(profile: Profile, sessions: WorkoutSession[], today: string): FriendStats {
  const done = [...new Set(sessions.filter((session) => !session.sampleData && session.status === "completed" && session.date <= today).map((session) => session.date))].sort();
  const streak = calculateStreak(profile, sessions, today);
  const monday = weekStart(today);
  const cutoff = shiftDate(today, -61);
  return {
    userId: profile.id,
    displayName: profile.displayName.trim() || "Friend",
    goal: goalOf(profile),
    currentStreak: streak.current,
    bestStreak: streak.best,
    weekCount: done.filter((date) => date >= monday).length,
    weekGoal: Math.min(7, Math.max(1, profile.sessionsPerWeek)),
    lastWorkoutDate: done.at(-1) ?? null,
    recentDates: done.filter((date) => date >= cutoff),
  };
}

/** Workouts a person finished inside a challenge window, from their shared recent dates. */
export function challengeProgress(challenge: Pick<Challenge, "startsOn" | "endsOn">, recentDates: string[]): number {
  return recentDates.filter((date) => date >= challenge.startsOn && date <= challenge.endsOn).length;
}

export interface LeaderboardRow { userId: string; name: string; done: number; percent: number; finished: boolean }

/** Members ranked by workouts done; ties keep alphabetical order. Unknown members show as 0. */
export function challengeLeaderboard(challenge: Challenge, stats: Map<string, FriendStats>): LeaderboardRow[] {
  return challenge.memberIds.map((userId) => {
    const member = stats.get(userId);
    const done = member ? challengeProgress(challenge, member.recentDates) : 0;
    return { userId, name: member?.displayName ?? "Friend", done, percent: Math.min(100, Math.round((done / challenge.target) * 100)), finished: done >= challenge.target };
  }).sort((a, b) => b.done - a.done || a.name.localeCompare(b.name));
}

export function challengeIsActive(challenge: Pick<Challenge, "startsOn" | "endsOn">, today: string): boolean {
  return today >= challenge.startsOn && today <= challenge.endsOn;
}

/** Days left including today. */
export function daysLeft(challenge: Pick<Challenge, "endsOn">, today: string): number {
  return Math.max(0, Math.round((Date.parse(`${challenge.endsOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000) + 1);
}

/** "Today", "Yesterday", "3 days ago". */
export function lastWorkoutLabel(lastWorkoutDate: string | null, today: string): string {
  if (!lastWorkoutDate) return "No workouts yet";
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastWorkoutDate}T12:00:00Z`)) / 86_400_000);
  if (days <= 0) return "Trained today";
  if (days === 1) return "Trained yesterday";
  return `Last trained ${days} days ago`;
}

export const NUDGE_MESSAGES = [
  "Time to move! 💪",
  "Your streak is waiting 🔥",
  "Quick workout today? I believe in you!",
  "Rozi misses you. Let's train!",
];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** An 8-character invite code without look-alike characters, from a secure random source. */
export function generateInviteCode(random: (bytes: Uint8Array) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
  return [...random(new Uint8Array(8))].map((byte) => CODE_ALPHABET[byte & 31]).join("");
}

export function isInviteCode(value: string): boolean {
  return /^[A-Z2-9]{8}$/.test(value.trim().toUpperCase());
}
