// ---------- Rozi AI: send only the tools a question can need ----------
//
// Every tool's description and schema is sent with every model call, so 13 tools cost ~1,000 tokens each time —
// and Groq's free plan allows only ~8,000 tokens a minute per model. Clear questions get only the matching groups of
// tools (more than one group if the question asks about more than one thing). When in doubt — a follow-up like
// "and last month?", or a question that matches nothing — every tool is sent, so nothing Rozi needs is ever missing.

import type { AiTool } from "./provider.ts";
import type { ChatLine } from "./prompt.ts";
import { ROZI_TOOLS } from "./tools.ts";

const GROUPS: Array<[RegExp, string[]]> = [
  [/\b(workout|train|training|session|today|tomorrow|tonight|yesterday|next|schedule|rest day|routine|plan for)\b/, ["get_workout_for_day", "get_next_workout", "get_workout_history"]],
  [/\b(last|history|did i|have i|how many|how often|count|times|week|month|days|when)\b/, ["get_workout_history", "get_weekly_report"]],
  [/\b(strong|stronger|progress|progressing|improv\w*|record|records|pr|prs|best|lift|lifts|heavier|kg|gain\w*)\b/, ["get_progress", "get_workout_history"]],
  [/\b(recover\w*|sore|soreness|ready|rested|tired|fresh|muscle|muscles|chest|back|legs?|arms?|shoulders?|core|glutes?)\b/, ["get_recovery"]],
  [/\b(streak|in a row|consisten\w*|badge|badges|achiev\w*|award\w*)\b/, ["get_streak", "get_achievements"]],
  [/\b(report|summary|summari[sz]e|recap|overview)\b/, ["get_weekly_report"]],
  [/\b(weight|weigh|bmi|height|body|fat|lose|losing|bulk|cut|goal)\b/, ["get_body_stats", "get_my_profile"]],
  [/\b(how (do|to|should)|explain|form|technique|instead|alternative\w*|replace|swap|exercise|exercises|squats?|press|curls?|rows?|plank|deadlifts?|lunges?|pull[- ]?ups?|push[- ]?ups?|rdl)\b/, ["get_exercise_info"]],
  [/\b(stretch\w*|mobility|flexib\w*|tight|stiff|warm[- ]?up|cool[- ]?down)\b/, ["get_mobility_suggestion"]],
  [/\b(plan me|make me|build me|create|design|give me|suggest)\b.*\b(workout|session|routine|day)\b|\b\d{2,3}\s?(min|mins|minute|minutes)\b|\b(leg|push|pull|arm|chest|back|shoulder|core|full body|upper body|lower body) day\b/, ["plan_custom_workout"]],
  [/\b(level|equipment|my plan|my goal|profile|settings|beginner|intermediate|advanced)\b/, ["get_my_profile"]],
  [/\b(swap\w*|replac\w*|switch\w*|substitut\w*|customi[sz]\w*|instead|alternative\w*|different (exercise|move)|don'?t like|change (my|the|this|that|an?) (exercise|move|workout))\b/, ["suggest_exercise_swap", "get_workout_for_day"]],
];

/** Greetings and thanks need no data, but Rozi may mention the plan: only the profile tool. */
const SMALL_TALK = /^(hi|hello|hey|yo|hola|namaste|thanks|thank you|ok|okay|cool|great|bye)\b[\s!.,?🙂😊💪-]*(rozi)?[\s!.?]*$/;
/** Short replies that lean on the earlier chat ("and last month?", "what about legs?"). */
const FOLLOW_UP = /^(and|what about|how about|also|same for|then|why|really|ok so)\b/;

/** The tools to offer for this question (a subset of ROZI_TOOLS, in their usual order). */
export function selectTools(message: string, history: ChatLine[] = []): AiTool[] {
  const text = message.toLowerCase().replace(/[’']/g, "'").trim();
  // A follow-up leans on the earlier chat, so it may need any tool. (Only real follow-up wording counts — in a live
  // chat almost every question has history, and "Am I getting stronger?" is clear on its own.)
  if (history.length && FOLLOW_UP.test(text)) return ROZI_TOOLS;
  if (SMALL_TALK.test(text)) return ROZI_TOOLS.filter((tool) => tool.name === "get_my_profile");
  const wanted = new Set(GROUPS.filter(([pattern]) => pattern.test(text)).flatMap(([, names]) => names));
  if (!wanted.size) return ROZI_TOOLS;
  return ROZI_TOOLS.filter((tool) => wanted.has(tool.name));
}
