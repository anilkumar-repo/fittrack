// ---------- Rozi actions: the server side (propose, approve/start, reject, finish, history) ----------
//
// SERVER ONLY. Proposals and results are written with the service-role client through database functions that only
// the service role may call; approvals and rejections run AS the person (their own sign-in) through functions that
// check ownership, the payload hash, expiry and the current status. The model never reaches any of this directly:
// it can only call the propose_action tool, whose input is rebuilt and checked by buildAction.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTool } from "../provider.ts";
import type { RoziContext, ToolOutcome } from "../tools.ts";
import { categoryOf, refusalFor } from "../permissions/permission-policy.ts";
import { idempotencyKey, payloadHash } from "./action-approval.ts";
import { buildAction, verifyAction, type VerifyState } from "./action-registry.ts";
import { ACTION_TYPES, parseAction, type ActionType, type RoziAction } from "./action-types.ts";

/** A request that couldn't be done (a stored action has its own `error` field, so this is named differently). */
export interface ActionProblem { problem: string }
export const isProblem = (value: RoziAction | ActionProblem): value is ActionProblem => "problem" in value;

/** Actions are switched on per server (ROZI_ACTIONS=on). Off: Rozi behaves exactly as before (Level 2). */
export function actionsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ROZI_ACTIONS ?? "").trim().toLowerCase() === "on";
}

/** The one tool through which the model can ask for a change. It never changes anything by itself. */
export const PROPOSE_ACTION_TOOL: AiTool = {
  name: "propose_action",
  description: "Propose a change to the user's RozFit data. Nothing changes until the user taps Approve on the card. Use only when the user asks for the change. Types: swap_exercise {exercise, replacement} (today's workout); start_plan_today and save_routine: EITHER {exercises: [{name, sets, reps}], name} when the user lists their own exercises (use their exact words for each name, their sets/reps if given; this is how 'save my workout for today' works) OR {area, minutes} for a workout Rozi picks; update_training_preferences {goal: general|tone|fatloss|muscle, sessionMinutes, focusArea, typicalDay: seated|light|on_feet|active}; log_body_weight {kg}; log_water {ml}. Always include a short 'why'.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", enum: [...ACTION_TYPES] },
      why: { type: "string", description: "One short sentence: why this change helps." },
      exercise: { type: "string" }, replacement: { type: "string" },
      area: { type: "string" }, minutes: { type: "integer" },
      exercises: {
        type: "array",
        description: "The user's own exercises, in order (start_plan_today / save_routine). Up to 10.",
        items: { type: "object", properties: { name: { type: "string" }, sets: { type: "integer" }, reps: { type: "string", description: "e.g. \"8\", \"8-12\", \"30 sec\", \"10 each side\"" } }, required: ["name"] },
      },
      name: { type: "string", description: "A short title for the user's own workout, e.g. \"Chest day\". Optional." },
      goal: { type: "string" }, sessionMinutes: { type: "integer" }, focusArea: { type: "string" }, typicalDay: { type: "string" },
      kg: { type: "number" }, ml: { type: "integer" },
    },
    required: ["type"],
  },
};

export interface ProposeDeps {
  service: SupabaseClient;
  userId: string;
  ctx: RoziContext;
  conversationId: string | null;
}

/** Runs the propose_action tool: build → policy → hash → record. The card carries the action for approval. */
export async function proposeAction(deps: ProposeDeps, args: Record<string, unknown>): Promise<ToolOutcome> {
  const requested = typeof args.type === "string" ? args.type.trim().slice(0, 60) : "";
  if (categoryOf(requested) !== "B") {
    return { result: { proposed: false, refused: true, reason: refusalFor(`${requested} ${JSON.stringify(args).slice(0, 200)}`) } };
  }
  const built = buildAction(requested as ActionType, args, deps.ctx);
  if (!built.ok) return { result: { proposed: false, reason: built.reason } };
  const hash = payloadHash(deps.userId, built.payload);
  const { data, error } = await deps.service.rpc("rozi_propose_action", {
    p_user: deps.userId, p_type: built.payload.type, p_payload: built.payload, p_summary: built.summary,
    p_hash: hash, p_idempotency_key: idempotencyKey(built.payload, hash), p_conversation: deps.conversationId,
  });
  const action = error ? null : parseAction(data);
  if (!action) return { result: { proposed: false, reason: error?.code === "54000" ? "Too many changes are waiting for approval." : "The change couldn't be prepared right now." } };
  return {
    result: {
      proposed: true, status: action.status, title: action.summary.title, changes: action.summary.changes,
      howItWorks: "Nothing has changed yet. The card shows this change with Approve and Reject; tell the user to tap Approve if they want it. Don't say it's done.",
    },
    card: { type: "action", action: { id: action.id, type: action.type, status: action.status, summary: action.summary, payloadHash: action.payloadHash, expiresAt: action.expiresAt } },
  };
}

/** The person approves on the card (their own sign-in). Returns the action, executing → the app applies it now. */
export async function startAction(userClient: SupabaseClient, actionId: string, hash: string): Promise<RoziAction | ActionProblem> {
  const { data, error } = await userClient.rpc("rozi_start_action", { p_action: actionId, p_hash: hash });
  if (error) return { problem: error.code === "22023" ? "That change was modified. Ask Rozi again." : error.code === "42501" ? "That change isn't yours." : "It couldn't be approved right now." };
  return parseAction(data) ?? { problem: "It couldn't be approved right now." };
}

export async function rejectAction(userClient: SupabaseClient, actionId: string): Promise<RoziAction | ActionProblem> {
  const { data, error } = await userClient.rpc("rozi_reject_action", { p_action: actionId });
  if (error) return { problem: error.code === "42501" ? "That change isn't yours." : "It couldn't be rejected right now." };
  return parseAction(data) ?? { problem: "It couldn't be rejected right now." };
}

export async function listActions(userClient: SupabaseClient, limit = 30): Promise<RoziAction[] | null> {
  const { data, error } = await userClient.rpc("rozi_my_actions", { p_limit: limit });
  if (error || !Array.isArray(data)) return null;
  return data.map(parseAction).filter((item): item is RoziAction => item !== null);
}

/**
 * After the app applied an executing action: re-read the person's data (their own sign-in) and record completed or
 * failed. A failure the app reports is recorded as failed without checking.
 */
export async function finishAction(deps: { service: SupabaseClient; userId: string; read: (action: RoziAction, approvedAt: string) => Promise<VerifyState | null> }, actionId: string, report: { ok: boolean; error?: string }): Promise<RoziAction | ActionProblem> {
  const { data: row, error: readError } = await deps.service.from("rozi_actions").select("*").eq("id", actionId).eq("user_id", deps.userId).maybeSingle();
  const action = readError || !row ? null : parseAction({ ...row, type: row.action_type });
  if (!action) return { problem: "That change isn't yours." };
  if (action.status !== "executing") return action;
  let ok = report.ok;
  let reason = (report.error ?? "").slice(0, 300);
  if (ok) {
    const state = await deps.read(action, String(row?.approved_at ?? action.createdAt)).catch(() => null);
    const checked = state ? verifyAction(action.payload, state) : { ok: false as const, reason: "Your data couldn't be read to check it." };
    ok = checked.ok;
    if (!checked.ok) reason = checked.reason;
  }
  const { data, error } = await deps.service.rpc("rozi_finish_action", { p_user: deps.userId, p_action: actionId, p_ok: ok, p_result: ok ? { verified: true } : null, p_error: ok ? null : reason || "It couldn't be completed." });
  if (error) return { problem: "The result couldn't be recorded." };
  return parseAction(data) ?? { problem: "The result couldn't be recorded." };
}
