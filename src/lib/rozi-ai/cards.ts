// ---------- Rozi AI: answer cards ----------
//
// Cards are built by RozFit's own code from the tools' results — never written by the model — so every number on a
// card is real. The model's text explains them; the screen shows them (Stage 5).

import type { RoziPlan } from "../rozi-plan.ts";
import type { SwapSuggestion } from "../exercise-swap.ts";

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
  | { type: "stat"; title: string; value: string; detail: string; link?: CardLink };

/** The swap card for a swap suggestion (shared by Rozi AI's tool and Rozi's on-phone answer). */
export function swapCard(date: string, suggestion: SwapSuggestion): RoziCard {
  return {
    type: "swap", date,
    from: suggestion.from ? { id: suggestion.from.id, name: suggestion.from.name } : null,
    options: suggestion.options.map((item) => ({ id: item.id, name: item.name, equipment: item.equipment })),
    exercises: suggestion.exercises.map((item) => ({ id: item.id, name: item.name })),
  };
}
