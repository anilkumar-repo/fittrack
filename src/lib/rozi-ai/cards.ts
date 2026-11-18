// ---------- Rozi AI: answer cards ----------
//
// Cards are built by RozFit's own code from the tools' results — never written by the model — so every number on a
// card is real. The model's text explains them; the screen shows them (Stage 5).

import type { RoziPlan } from "../rozi-plan.ts";

export interface CardLink { href: string; label: string }

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
  | { type: "stat"; title: string; value: string; detail: string; link?: CardLink };
