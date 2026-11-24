import { checkinsEnabled, getCheckinSettings, setCheckinSettings } from "@/lib/rozi-ai/checkins/checkin-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";

/** The signed-in person's weekly check-in choice: GET. Change it (the person's own tap): PUT { enabled, weekday, hour }. */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!checkinsEnabled()) return Response.json({ ok: false, message: "Weekly check-ins are off." }, { status: 404, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  const settings = await getCheckinSettings(signedIn.client);
  return settings ? Response.json({ ok: true, settings }, { headers }) : Response.json({ ok: false, message: "Your choice couldn't be loaded." }, { status: 502, headers });
}

export async function PUT(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!checkinsEnabled()) return Response.json({ ok: false, message: "Weekly check-ins are off." }, { status: 404, headers });
  const signedIn = await userClientFromToken(bearerToken(request));
  if (!signedIn) return Response.json({ ok: false, message: "Sign in first." }, { status: 401, headers });
  let body: unknown = null;
  try { body = JSON.parse((await request.text()).slice(0, 1000)); } catch { /* empty body */ }
  const saved = await setCheckinSettings(signedIn.client, body);
  return "problem" in saved
    ? Response.json({ ok: false, message: saved.problem }, { status: 400, headers })
    : Response.json({ ok: true, settings: saved }, { headers });
}
