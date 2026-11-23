import { actionsEnabled, finishAction, isProblem, rejectAction, startAction } from "@/lib/rozi-ai/actions/action-service";
import { readForVerify } from "@/lib/rozi-ai/actions/action-reader";
import { roziServiceClient } from "@/lib/rozi-ai/service-client";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Rozi action, acted on by its owner (identified only by the sign-in token):
 *   { op: "approve", hash }  → approves THIS exact change and starts it (executing); returns it with its payload, which
 *                              the app then applies through its normal save path. Repeating returns the same state.
 *   { op: "reject" }         → turns a waiting proposal down.
 *   { op: "complete", ok, error? } → the app reports it applied the change; the server re-reads the person's data,
 *                              checks it, and records completed or failed.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rozi/actions/[id]">) {
  const headers = { "Cache-Control": "no-store" };
  if (!actionsEnabled()) return Response.json({ ok: false, message: "Rozi actions are off." }, { status: 404, headers });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, message: "Unknown change." }, { status: 400, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)) as Record<string, unknown>; } catch { /* empty body */ }

  let outcome;
  if (body.op === "approve" && typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash)) outcome = await startAction(signedIn.client, id, body.hash);
  else if (body.op === "reject") outcome = await rejectAction(signedIn.client, id);
  else if (body.op === "complete" && typeof body.ok === "boolean") {
    const service = roziServiceClient();
    if (!service) return Response.json({ ok: false, message: "Rozi actions aren't set up on this server." }, { status: 503, headers });
    outcome = await finishAction({ service, userId: signedIn.userId, read: (action, approvedAt) => readForVerify(signedIn.client, signedIn.userId, action, approvedAt) }, id,
      { ok: body.ok, ...(typeof body.error === "string" ? { error: body.error.slice(0, 300) } : {}) });
  } else return Response.json({ ok: false, message: "Unknown request." }, { status: 400, headers });

  return isProblem(outcome)
    ? Response.json({ ok: false, message: outcome.problem }, { status: 409, headers })
    : Response.json({ ok: true, action: outcome }, { headers });
}
