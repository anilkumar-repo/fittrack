import { approveGoal, GOAL_STATUS_ACTIONS, goalsEnabled, isGoalProblem, setGoalStatus, type GoalStatusAction } from "@/lib/rozi-ai/planning/goal-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Rozi goal, acted on by its owner (identified only by the sign-in token):
 *   { op: "approve", hash }               → starts THIS exact plan (replacing any current goal). Repeating is harmless.
 *   { op: "reject" | "pause" | "resume" | "cancel" } → only the allowed status changes; others leave it as it is.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (!goalsEnabled()) return Response.json({ ok: false, message: "Rozi goals are off." }, { status: 404, headers });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, message: "Unknown goal." }, { status: 400, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)) as Record<string, unknown>; } catch { /* empty body */ }

  let outcome;
  if (body.op === "approve" && typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash)) outcome = await approveGoal(signedIn.client, id, body.hash);
  else if (typeof body.op === "string" && (GOAL_STATUS_ACTIONS as readonly string[]).includes(body.op)) outcome = await setGoalStatus(signedIn.client, id, body.op as GoalStatusAction);
  else return Response.json({ ok: false, message: "Unknown request." }, { status: 400, headers });

  return isGoalProblem(outcome)
    ? Response.json({ ok: false, message: outcome.problem }, { status: 409, headers })
    : Response.json({ ok: true, goal: outcome }, { headers });
}
