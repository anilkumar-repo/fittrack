// ---------- Rozi Level 4 (R8): goals with a weekly plan ----------
//
// A goal is one target (workouts a week, a body weight, or a lift) and a short plan: one step per week, each with
// that week's targets. The person approves the whole plan once. The server builds every plan from fixed templates
// (plan-builder.ts); the model only supplies the numbers it was told.

export const GOAL_KINDS = ["consistency", "weight_loss", "weight_gain", "strength"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_STATUSES = ["awaiting_approval", "active", "paused", "completed", "cancelled", "replaced", "rejected", "expired"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export type GoalTarget =
  | { kind: "consistency"; sessionsPerWeek: number }
  | { kind: "weight_loss" | "weight_gain"; fromKg: number; targetKg: number }
  | { kind: "strength"; exerciseId: string; exerciseName: string; fromKg: number; targetKg: number };

/** One week of the plan: dates and that week's targets. */
export interface GoalStep {
  week: number;
  start: string;
  end: string;
  title: string;
  /** Workouts to do this week. */
  sessions?: number;
  /** Body weight to be at by the end of the week. */
  weightKg?: number;
  /** Working weight to lift this week (strength goals). */
  liftKg?: number;
  note?: string;
}

/** A plan the server built and validated, ready to propose. */
export interface GoalPlan {
  kind: GoalKind;
  title: string;
  reason: string;
  target: GoalTarget;
  startDate: string;
  endDate: string;
  steps: GoalStep[];
}

/** A goal as stored (from rozi_my_goals / the goal functions). */
export interface RoziGoal extends GoalPlan {
  id: string;
  status: GoalStatus;
  planHash: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  finishedAt: string | null;
  /** Only on the call that approved it. */
  approvedNow?: boolean;
}

const isKind = (value: unknown): value is GoalKind => typeof value === "string" && (GOAL_KINDS as readonly string[]).includes(value);
const isStatus = (value: unknown): value is GoalStatus => typeof value === "string" && (GOAL_STATUSES as readonly string[]).includes(value);

/** A goal from the database, or null if it doesn't look like one. Keys are snake_case there. */
export function parseGoal(value: unknown): RoziGoal | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !isKind(row.kind) || !isStatus(row.status) || !Array.isArray(row.steps)) return null;
  const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");
  const target = row.target && typeof row.target === "object" ? { ...(row.target as Record<string, unknown>), kind: row.kind } as GoalTarget : null;
  if (!target) return null;
  return {
    id: row.id, kind: row.kind, status: row.status, title: text("title"), reason: text("reason"), target,
    startDate: text("start_date").slice(0, 10), endDate: text("end_date").slice(0, 10), steps: row.steps as GoalStep[],
    planHash: text("plan_hash"), createdAt: text("created_at"), expiresAt: text("expires_at"),
    approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
    ...(row.approved_now === true ? { approvedNow: true } : {}),
  };
}
