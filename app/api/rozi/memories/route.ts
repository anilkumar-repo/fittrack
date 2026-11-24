import { isMemoryProblem, listMemories, memoryEnabled, saveMemory } from "@/lib/rozi-ai/memory/memory-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

/** The signed-in person's notes: GET. Save one (the person's own tap): POST { kind, note }. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!memoryEnabled()) return Response.json({ ok: false, message: "Rozi memory is off." }, { status: 404, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  const memories = await listMemories(signedIn.client);
  return memories ? Response.json({ ok: true, memories }, { headers }) : Response.json({ ok: false, message: "Your notes couldn't be loaded." }, { status: 502, headers });
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!memoryEnabled()) return Response.json({ ok: false, message: "Rozi memory is off." }, { status: 404, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)) as Record<string, unknown>; } catch { /* empty body */ }
  const saved = await saveMemory(signedIn.client, body.kind, body.note);
  return isMemoryProblem(saved)
    ? Response.json({ ok: false, message: saved.problem }, { status: 409, headers })
    : Response.json({ ok: true, memory: saved }, { headers });
}
