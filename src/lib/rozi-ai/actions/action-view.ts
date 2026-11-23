// ---------- Rozi actions: what a card shows for each status (pure, tested) ----------

import type { ActionStatus } from "./action-types.ts";

export type ActionTone = "waiting" | "working" | "done" | "problem" | "closed";

export interface ActionView {
  label: string;
  tone: ActionTone;
  /** Approve / Reject are shown. */
  canDecide: boolean;
  /** Nothing more will happen to it. */
  final: boolean;
  /** One line under the card. */
  note: string;
}

/** Minutes left before a waiting proposal lapses (0 when it already has). */
export function minutesLeft(expiresAt: string, now = Date.now()): number {
  const ms = Date.parse(expiresAt) - now;
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

/**
 * The card's state. "working" is the app's own state while a tap is being handled; everything else comes from the
 * server — the card never says "done" before the server recorded completed.
 */
export function actionView(status: ActionStatus | "working", expiresAt: string, now = Date.now()): ActionView {
  if (status === "awaiting_approval" && minutesLeft(expiresAt, now) === 0) status = "expired";
  switch (status) {
    case "awaiting_approval": {
      const left = minutesLeft(expiresAt, now);
      return { label: "Needs your OK", tone: "waiting", canDecide: true, final: false, note: `Nothing changes until you approve. Expires in ${left} min.` };
    }
    case "working": return { label: "Saving…", tone: "working", canDecide: false, final: false, note: "Applying the change and checking it." };
    case "approved":
    case "executing": return { label: "In progress", tone: "working", canDecide: false, final: false, note: "Being applied. If it doesn't finish, it won't be applied twice." };
    case "completed": return { label: "Done", tone: "done", canDecide: false, final: true, note: "Saved and checked." };
    case "failed": return { label: "Didn't work", tone: "problem", canDecide: false, final: true, note: "Nothing was changed by this card. Ask Rozi again if you still want it." };
    case "rejected": return { label: "Not applied", tone: "closed", canDecide: false, final: true, note: "You turned this down. Nothing changed." };
    case "expired": return { label: "Expired", tone: "closed", canDecide: false, final: true, note: "Not approved in time. Ask Rozi again if you still want it." };
    case "cancelled": return { label: "Cancelled", tone: "closed", canDecide: false, final: true, note: "Nothing changed." };
  }
}

export const ACTION_TYPE_LABEL: Record<string, string> = {
  swap_exercise: "Exercise swap",
  start_plan_today: "Today's workout",
  save_routine: "Routine",
  update_training_preferences: "Plan settings",
  log_body_weight: "Body weight",
  log_water: "Water",
};
