/**
 * One short motivation line per day. Written for RozFit (not quoted from anyone), so they are free to use
 * in the app and, later, in daily notifications.
 */
export const MOTIVATION_LINES = [
  "Small steps, done often, beat big plans done once.",
  "You don’t need a perfect day. You need a started one.",
  "Strong is built one rep at a time.",
  "Show up today. Future you is watching.",
  "Rest is training too. Your muscles grow while you recover.",
  "The hardest set is getting your shoes on.",
  "Progress hides in the boring days. Keep going.",
  "Ten honest minutes beats zero perfect ones.",
  "Good form first. Heavier weights will follow.",
  "Consistency is a quiet superpower.",
  "You are allowed to go slow. You are not allowed to quit.",
  "Every workout is a vote for the person you’re becoming.",
  "Feel tired? Do the warm-up and decide after.",
  "Your only competition is last week’s you.",
  "Drink water, sleep well, lift with care. Simple wins.",
  "Missed a day? The next session still counts.",
  "Earn the rest day. Then really rest.",
  "One more good rep is still progress.",
  "Motivation starts it. Habit finishes it.",
  "Breathe out on the hard part. You’ve got this.",
  "A strong body carries a calm mind.",
  "Today’s effort is tomorrow’s warm-up weight.",
  "Your body keeps every promise you make it.",
  "Celebrate the small wins. They add up fast.",
  "Move a little today. Your joints will thank you.",
  "Keep two reps in the tank and come back stronger.",
  "Discipline is remembering what you want most.",
  "It’s not about being the best. It’s about being better than yesterday.",
  "Slow reps, steady breath, strong finish.",
  "Your streak is a story. Write today’s line.",
  "Strength is patience you can lift.",
] as const;

/** The same line all day, a new one each day, cycling through the list. */
export function motivationFor(date: string): string {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const index = ((day % MOTIVATION_LINES.length) + MOTIVATION_LINES.length) % MOTIVATION_LINES.length;
  return MOTIVATION_LINES[index];
}
