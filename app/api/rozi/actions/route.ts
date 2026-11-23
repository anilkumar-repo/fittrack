import { actionsEnabled, listActions } from "@/lib/rozi-ai/actions/action-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

/** The signed-in person's Rozi actions, newest first: GET with `Authorization: Bearer <token>`. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!actionsEnabled()) return Response.json({ ok: false, message: "Rozi actions are off." }, { status: 404, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  const actions = await listActions(signedIn.client);
  return actions ? Response.json({ ok: true, actions }, { headers }) : Response.json({ ok: false, message: "Your actions couldn't be loaded." }, { status: 502, headers });
}
