import { shiftDate, weekDates } from "./dates.ts";
import type { WorkoutSession } from "./types";

export type AchievementId = "first-workout" | "full-week" | "five-workouts" | "ten-workouts" | "twenty-five-workouts" | "two-weeks" | "four-weeks" | "first-load";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  earned: boolean;
  /** Progress toward the target, never more than the target. */
  current: number;
  target: number;
}

/**
 * Badges worked out only from saved, completed workouts. Nothing is estimated: a badge is earned
 * when the records show it, and progress is the real count so far.
 */
export function calculateAchievements(sessions: WorkoutSession[], sessionsPerWeek: number, recordedLoadCount: number): Achievement[] {
  const completed = sessions.filter((session) => !session.sampleData && session.status === "completed");
  const goal = Math.max(1, sessionsPerWeek);
  const perWeek = new Map<string, number>();
  for (const session of completed) {
    const monday = weekDates(session.date)[0];
    perWeek.set(monday, (perWeek.get(monday) ?? 0) + 1);
  }
  const bestWeek = Math.max(0, ...perWeek.values());
  const fullWeeks = [...perWeek.entries()].filter(([, count]) => count >= goal).map(([monday]) => monday).sort();
  let longestRun = 0;
  let run = 0;
  let previous: string | null = null;
  for (const monday of fullWeeks) {
    run = previous !== null && shiftDate(previous, 7) === monday ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
    previous = monday;
  }
  const badge = (id: AchievementId, title: string, description: string, value: number, target: number): Achievement => ({
    id, title, description, target, current: Math.min(value, target), earned: value >= target,
  });
  return [
    badge("first-workout", "First workout", "Finish and save your first session.", completed.length, 1),
    badge("full-week", "Full week", `Finish all ${goal} planned sessions in one week.`, bestWeek, goal),
    badge("five-workouts", "5 workouts", "Finish five sessions.", completed.length, 5),
    badge("two-weeks", "2 weeks in a row", "Hit your weekly goal two weeks running.", longestRun, 2),
    badge("ten-workouts", "10 workouts", "Finish ten sessions.", completed.length, 10),
    badge("first-load", "First recorded load", "Log a weight on a completed set.", recordedLoadCount, 1),
    badge("four-weeks", "4 weeks in a row", "Hit your weekly goal four weeks running.", longestRun, 4),
    badge("twenty-five-workouts", "25 workouts", "Finish twenty-five sessions.", completed.length, 25),
  ];
}
