// ---------- Rozi actions (Level 3): types shared by the server, the screen and the tests ----------
//
// An action is a change Rozi PROPOSES and the person APPROVES on a card. The model never writes: server code builds
// the exact change from the person's own data, the database records it (rozi_actions), the person approves that exact
// change (payload hash), the app applies it through its own save path, and the server checks the result.
// See docs/ROZI_AGENT_ARCHITECTURE.md and docs/ROZI_AGENT_PERMISSION_MODEL.md.

import type { RoziPlan } from "../../rozi-plan.ts";
import type { DailyActivity, FocusArea } from "../../onboarding.ts";
import type { TrainingGoal } from "../../types";

/** Every action Rozi can propose (Category B). Anything else is refused. */
export const ACTION_TYPES = ["swap_exercise", "start_plan_today", "save_routine", "update_training_preferences", "log_body_weight", "log_water"] as const;
export type ActionType = typeof ACTION_TYPES[number];

export const ACTION_STATUSES = ["awaiting_approval", "approved", "executing", "completed", "failed", "rejected", "expired", "cancelled"] as const;
export type ActionStatus = typeof ACTION_STATUSES[number];
/** Statuses after which nothing more happens. */
export const FINAL_STATUSES: ReadonlySet<ActionStatus> = new Set(["completed", "failed", "rejected", "expired", "cancelled"]);

export interface PreferenceChanges {
  goal?: TrainingGoal;
  preferredSessionMinutes?: number;
  focusArea?: FocusArea;
  dailyActivity?: DailyActivity;
}

/** The exact change, as stored and hashed. Dates are the person's local day (YYYY-MM-DD). */
export type ActionPayload =
  | { type: "swap_exercise"; date: string; fromId: string; toId: string }
  | { type: "start_plan_today"; date: string; plan: RoziPlan }
  | { type: "save_routine"; name: string; exercises: Array<{ exerciseId: string; sets: number; reps: string }> }
  | { type: "update_training_preferences"; changes: PreferenceChanges }
  | { type: "log_body_weight"; date: string; kg: number }
  | { type: "log_water"; date: string; ml: number };

/** What the card shows: a title, why Rozi suggests it, and each change in plain words. */
export interface ActionSummary { title: string; why: string; changes: string[] }

/** An action as the person sees it (from the database functions). */
export interface RoziAction {
  id: string;
  type: ActionType;
  status: ActionStatus;
  summary: ActionSummary;
  payload: ActionPayload;
  payloadHash: string;
  createdAt: string;
  expiresAt: string;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  /** True only on the approval call that started it: the app applies the change only then (never twice). */
  startedNow?: boolean;
}

const isType = (value: unknown): value is ActionType => typeof value === "string" && (ACTION_TYPES as readonly string[]).includes(value);
const isStatus = (value: unknown): value is ActionStatus => typeof value === "string" && (ACTION_STATUSES as readonly string[]).includes(value);

/** Reads an action returned by the database (or the API); null if it isn't one. */
export function parseAction(raw: unknown): RoziAction | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !isType(row.type) || !isStatus(row.status) || !row.payload || typeof row.payload !== "object") return null;
  const summary = (row.summary ?? {}) as Partial<ActionSummary>;
  return {
    id: row.id, type: row.type, status: row.status,
    summary: { title: String(summary.title ?? ""), why: String(summary.why ?? ""), changes: Array.isArray(summary.changes) ? summary.changes.map(String) : [] },
    payload: row.payload as ActionPayload,
    payloadHash: String(row.payload_hash ?? row.payloadHash ?? ""),
    createdAt: String(row.created_at ?? row.createdAt ?? ""), expiresAt: String(row.expires_at ?? row.expiresAt ?? ""),
    finishedAt: typeof (row.finished_at ?? row.finishedAt) === "string" ? String(row.finished_at ?? row.finishedAt) : null,
    result: row.result && typeof row.result === "object" ? row.result as Record<string, unknown> : null,
    error: typeof row.error === "string" ? row.error : null,
    ...(row.started_now === true || row.startedNow === true ? { startedNow: true } : {}),
  };
}
