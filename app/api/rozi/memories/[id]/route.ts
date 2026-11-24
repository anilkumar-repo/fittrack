import { deleteMemory, isMemoryProblem, memoryEnabled, updateMemory } from "@/lib/rozi-ai/memory/memory-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the person's notes: POST { op: "update", note } or { op: "delete" } (deleting really deletes). */
export async function POST(request: Request, ctx: RouteContext<"/api/rozi/memories/[id]">) {
  const headers = { "Cache-Control": "no-store" };
  if (!memoryEnabled()) return Response.json({ ok: false, message: "Rozi memory is off." }, { status: 404, headers });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, message: "Unknown note." }, { status: 400, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)) as Record<string, unknown>; } catch { /* empty body */ }

  const outcome = body.op === "update" ? await updateMemory(signedIn.client, id, body.note)
    : body.op === "delete" ? await deleteMemory(signedIn.client, id)
      : null;
  if (!outcome) return Response.json({ ok: false, message: "Unknown request." }, { status: 400, headers });
  return isMemoryProblem(outcome)
    ? Response.json({ ok: false, message: outcome.problem }, { status: 409, headers })
    : Response.json({ ok: true, ...("deleted" in outcome ? { deleted: true } : { memory: outcome }) }, { headers });
}
