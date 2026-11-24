import { goalsEnabled, listGoals } from "@/lib/rozi-ai/planning/goal-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

/** The signed-in person's goals, newest first: GET with `Authorization: Bearer <token>`. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!goalsEnabled()) return Response.json({ ok: false, message: "Rozi goals are off." }, { status: 404, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  const goals = await listGoals(signedIn.client);
  return goals ? Response.json({ ok: true, goals }, { headers }) : Response.json({ ok: false, message: "Your goals couldn't be loaded." }, { status: 502, headers });
}
