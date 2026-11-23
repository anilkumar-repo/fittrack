// ---------- Rozi agent permissions (enforced in code, not by the prompt) ----------
//
//   A — automatic: the read-only tools (tools.ts). Still needs sign-in, consent, 18+ and the rate limits.
//   B — needs the person's approval on a card: the actions in ACTION_TYPES.
//   C — never by Rozi: refused with where to do it yourself.
// docs/ROZI_AGENT_PERMISSION_MODEL.md has the full table.

import { ACTION_TYPES, type ActionType } from "../actions/action-types.ts";
import { ROZI_TOOLS } from "../tools.ts";

export type PermissionCategory = "A" | "B" | "C";

/** Things people may ask Rozi to do that it must never do itself, and where they can do it. */
const NEVER: Array<[RegExp, string]> = [
  [/delet|erase|wipe|remove (all|my) (data|workouts?|history|account)/, "Deleting data has its own screen: Settings → Your data."],
  [/password|sign.?in|security|two.?factor|email address|log ?out/, "Sign-in and security settings are only in Settings → Account."],
  [/trainer|deadlift (approval|rule)|approve deadlift/, "Trainer rules and deadlift approval are set by your trainer."],
  [/post|share|publish|send (a )?message|chat|feed|friend|buddy|public profile|findable/, "Rozi doesn't post, share or message for you. Use Friends or the feed yourself."],
  [/buy|purchase|pay|subscription|order/, "Rozi can't buy anything."],
  [/diagnos|medicat|dose|supplement|steroid/, "Rozi can't diagnose or dose. Please ask a doctor or pharmacist."],
  [/notification|push|consent|rozi ai (on|off)/, "Notification and consent switches are yours: Settings."],
];

/** The category of a tool or action name; unknown names are C. */
export function categoryOf(name: string): PermissionCategory {
  if (ROZI_TOOLS.some((tool) => tool.name === name)) return "A";
  if ((ACTION_TYPES as readonly string[]).includes(name)) return "B";
  return "C";
}

export const isActionType = (name: string): name is ActionType => categoryOf(name) === "B";

/** Why a requested change can't be done by Rozi (Category C), in words for the person. */
export function refusalFor(requested: string): string {
  const text = requested.toLowerCase();
  return NEVER.find(([pattern]) => pattern.test(text))?.[1] ?? "That's not something Rozi can change. You can do it yourself in the app.";
}
