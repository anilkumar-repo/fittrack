/**
 * Rozi chat, version 0: works out what a question is about from its words (no AI service, no cost) so the
 * chat screen can answer from the person's own saved data. Phase 1 of the roadmap grows this into the full
 * engine (entities, follow-ups, saved conversations); see docs/ROADMAP.md.
 */
export type RoziIntent =
  | "TODAY_WORKOUT" | "NEXT_WORKOUT" | "LAST_WORKOUT" | "WEEKLY_WORKOUT_COUNT" | "STREAK_STATUS"
  | "PROGRESS_CHECK" | "MOBILITY_RECOMMENDATION" | "WATER" | "BODY_GOAL_PROGRESS" | "WEEKLY_REPORT" | "MUSCLE_RECOVERY" | "PLAN_WORKOUT" | "SWAP_EXERCISE" | "HELLO" | "UNKNOWN";

// Checked in order: the first intent with a matching phrase wins, so more specific ones come first.
const DICTIONARY: Array<[RoziIntent, RegExp]> = [
  // "Swap the bench press", "replace squats with lunges", "I want to customise my workout", "I don't like this exercise".
  // Before PLAN_WORKOUT: "I want to customise the workout" is about changing today's, not planning a new one.
  ["SWAP_EXERCISE", /\b(swap\w*|replac\w*|switch\w*|substitut\w*|customi[sz]\w*|instead of|different (exercise|move)|don'?t like (this|that|the)|change (my|the|this|that|an?) (exercise|move|workout))\b/],
  // "Plan me a leg workout", "give me a 30 min chest workout", "build a push day", "arm day".
  ["PLAN_WORKOUT", /^(?!.*\brest\b)(?:.*\b(plan|make|build|create|give|suggest|design|write|need|want)\b.*\b(workout|session|routine|day|training)\b|\b(leg|legs|chest|back|arm|arms|shoulder|shoulders|push|pull|glute|glutes|core|abs|upper ?body|lower ?body|full ?body)\s+(day|workout|session|routine)\b)/],
  ["WEEKLY_REPORT", /\b(summar|report|recap|review)\w*\b.*\bweek\b|\bmy week\b/],
  ["MUSCLE_RECOVERY", /\b(recover|recovered|recovery|rested|ready|sore)\b/],
  ["LAST_WORKOUT", /\b(last|previous|yesterday'?s?|recent)\b.*\b(workout|session|train|trained|training)\b|what did i (do|train)/],
  ["NEXT_WORKOUT", /\b(next|tomorrow'?s?|upcoming)\b.*\b(workout|session|train|training|day)\b/],
  ["TODAY_WORKOUT", /\b(today'?s?|now)\b.*\b(workout|session|train|plan)\b|what('?s| is) my workout|what am i training|what should i (do|train)/],
  ["WEEKLY_WORKOUT_COUNT", /how many.*\b(workouts?|sessions?)\b|\bthis week\b/],
  ["STREAK_STATUS", /\bstreak\b|in a row|\bconsisten/],
  ["MOBILITY_RECOMMENDATION", /\b(stretch|stretching|mobility|flexib|tight|stiff|warm ?up|cool ?down)\b/],
  ["WATER", /\b(water|drink|hydrat)/],
  ["BODY_GOAL_PROGRESS", /\b(weight|bmi|kg|fat|lose|losing)\b/],
  ["PROGRESS_CHECK", /\b(progress|progressing|stronger|improv|records?|pr|best)\b/],
  ["HELLO", /^(hi|hello|hey|yo|hola|namaste)\b/],
];

export function detectIntent(message: string): RoziIntent {
  const text = message.toLowerCase().replace(/[’]/g, "'").trim();
  if (!text) return "UNKNOWN";
  return DICTIONARY.find(([, pattern]) => pattern.test(text))?.[0] ?? "UNKNOWN";
}

export const SUGGESTED_QUESTIONS = [
  "What’s my workout today?",
  "Show my last workout",
  "How many workouts this week?",
  "How is my streak?",
  "Am I getting stronger?",
  "I feel stiff, what should I stretch?",
  "Plan me a 30 min leg workout",
];

/** Messages longer than this are cut, so a pasted essay can't slow the page down. */
export const MAX_MESSAGE_LENGTH = 300;
