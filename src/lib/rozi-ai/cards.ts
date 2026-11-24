// ---------- Rozi AI: answer cards ----------
//
// Cards are built by RozFit's own code from the tools' results — never written by the model — so every number on a
// card is real. The model's text explains them; the screen shows them (Stage 5).

import type { RoziPlan } from "../rozi-plan.ts";
import type { SwapSuggestion } from "../exercise-swap.ts";
import type { ActionStatus, ActionSummary, ActionType } from "./actions/action-types.ts";
import type { GoalKind, GoalStatus, GoalStep } from "./planning/goal-types.ts";
import type { GoalState, WeekProgress } from "./planning/plan-monitor.ts";

export interface CardLink { href: string; label: string }

/**
 * Card links only ever go to a page inside RozFit: "/today" yes; "//other.site", "/\\other.site", "https://…",
 * "javascript:…" no. Cards are built by our own code, so this is defence in depth (and covers saved cards).
 */
export function isInAppLink(href: unknown): href is string {
  return typeof href === "string" && /^\/(?![/\\])/.test(href) && !/[\u0000-\u001f]/.test(href);
}

export type RoziCard =
  | {
    type: "workout";
    date: string;
    title: string;
    status: "planned" | "in_progress" | "completed" | "partial" | "skipped" | "rest_day";
    minutes: number | null;
    exercises: Array<{ name: string; sets: number; reps: string }>;
    link: CardLink;
  }
  | {
    type: "progress";
    exercise: string | null;
    /** Best set per exercise (heaviest load, then most reps). */
    records: Array<{ exercise: string; kg: number; reps: number; date: string }>;
    /** For one exercise: heaviest load per workout, oldest first. */
    trend: Array<{ date: string; kg: number | null; sets: number; reps: number }>;
    link: CardLink;
  }
  | {
    type: "recovery";
    groups: Array<{ group: string; label: string; status: string; statusLabel: string; readyOn: string | null }>;
    readyCount: number;
    link: CardLink;
  }
  | {
    type: "exercise";
    name: string;
    muscles: string[];
    equipment: string;
    steps: string[];
    cues: string[];
    allowed: boolean;
    alternatives: Array<{ name: string; equipment: string }>;
  }
  | { type: "plan"; plan: RoziPlan }
  /**
   * Swap an exercise in a day's workout. With `from`: tap an option to use it instead (sets and reps stay). Without:
   * the workout's exercises, each with a Swap button. The swap itself runs in the app (same rules as the Swap button).
   */
  | {
    type: "swap";
    date: string;
    from: { id: string; name: string } | null;
    options: Array<{ id: string; name: string; equipment: string }>;
    exercises: Array<{ id: string; name: string }>;
  }
  | { type: "stat"; title: string; value: string; detail: string; link?: CardLink }
  /**
   * A change Rozi proposed (Level 3). Approve / Reject act on THIS action id and hash only; the payload itself is
   * fetched from the server on approval, never taken from the card.
   */
  | {
    type: "action";
    action: { id: string; type: ActionType; status: ActionStatus; summary: ActionSummary; payloadHash: string; expiresAt: string };
  }
  /**
   * A goal with a weekly plan Rozi proposed (Level 4, R8). Approve / Not now act on THIS goal id and plan hash only;
   * the database refuses a different plan.
   */
  | {
    type: "goal";
    goal: { id: string; kind: GoalKind; title: string; reason: string; status: GoalStatus; startDate: string; endDate: string; steps: GoalStep[]; planHash: string; expiresAt: string };
  }
  /** A note Rozi suggests remembering (R10). Saved only when the person taps Save (their own sign-in). */
  | { type: "memory"; memory: { kind: "injury" | "preference" | "schedule" | "other"; note: string } }
  /** How a goal is going, week by week (Level 4, R9). Read-only. */
  | {
    type: "goal_progress";
    progress: { title: string; state: GoalState; summary: string; currentWeek: number; endDate: string; weeks: WeekProgress[] };
  };

/** The swap card for a swap suggestion (shared by Rozi AI's tool and Rozi's on-phone answer). */
export function swapCard(date: string, suggestion: SwapSuggestion): RoziCard {
  return {
    type: "swap", date,
    from: suggestion.from ? { id: suggestion.from.id, name: suggestion.from.name } : null,
    options: suggestion.options.map((item) => ({ id: item.id, name: item.name, equipment: item.equipment })),
    exercises: suggestion.exercises.map((item) => ({ id: item.id, name: item.name })),
  };
}
