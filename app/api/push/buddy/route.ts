import { localDateAndHour } from "@/lib/notifications";
import { adminClient, sendPush } from "@/lib/push-server";
import { weekdayOf } from "@/lib/dates";
import { missedReasonLabel } from "@/lib/missed-days";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

/**
 * Train together: tells your buddies you just finished ("Your turn?") or that you're resting today. The caller must
 * be signed in and their own workout for today must really be finished / skipped. Buddies only hear it between 7:00
 * and 21:00 their time, only once per kind per day, and "finished" only reaches buddies who haven't trained yet.
 */
export async function POST(request: Request) {
  const db = adminClient();
  if (!db) return Response.json({ pushed: false, reason: "not-configured" });
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return Response.json({ error: "Sign in first" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { kind?: unknown };
  const kind = body.kind === "finished" || body.kind === "skipped" ? body.kind : null;
  if (!kind) return Response.json({ error: "Unknown kind" }, { status: 400 });

  const { data: mine } = await db.from("buddy_members").select("group_id").eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (!mine) return Response.json({ pushed: false, reason: "no-group" });
  const groupId = String(mine.group_id);
  const [{ data: group }, { data: members }] = await Promise.all([
    db.from("buddy_groups").select("training_days").eq("id", groupId).maybeSingle(),
    db.from("buddy_members").select("user_id, share_reasons").eq("group_id", groupId).eq("status", "active"),
  ]);
  const trainingDays = Array.isArray(group?.training_days) ? group.training_days.map(Number) : [];
  const ids = (members ?? []).map((row: Row) => String(row.user_id));
  const { data: profiles } = await db.from("profiles").select("id, display_name, time_zone").in("id", ids);
  const profileOf = new Map((profiles ?? []).map((row: Row) => [String(row.id), row]));
  const me = profileOf.get(auth.user.id);
  const myDate = localDateAndHour(String(me?.time_zone || "Asia/Kolkata"), new Date()).date;

  // The sender's own day must match what they say.
  const { data: mySession } = await db.from("workout_sessions").select("status, missed_reason").eq("user_id", auth.user.id).eq("workout_date", myDate).maybeSingle();
  if (kind === "finished" && mySession?.status !== "completed") return Response.json({ pushed: false, reason: "not-finished" });
  if (kind === "skipped" && mySession?.status !== "skipped") return Response.json({ pushed: false, reason: "not-skipped" });

  const name = String(me?.display_name || "Your buddy");
  const shares = (members ?? []).find((row: Row) => String(row.user_id) === auth.user.id)?.share_reasons === true;
  const reason = kind === "skipped" && shares && typeof mySession?.missed_reason === "string" ? missedReasonLabel(mySession.missed_reason as never) : "";
  let pushed = 0;

  for (const id of ids.filter((value) => value !== auth.user.id)) {
    const profile = profileOf.get(id);
    const { date, hour } = localDateAndHour(String(profile?.time_zone || "Asia/Kolkata"), new Date());
    if (hour < 7 || hour >= 21) continue;
    if (kind === "finished") {
      if (!trainingDays.includes(weekdayOf(date))) continue;
      const { data: theirs } = await db.from("workout_sessions").select("status").eq("user_id", id).eq("workout_date", date).maybeSingle();
      if (theirs && ["completed", "in_progress", "skipped"].includes(String(theirs.status))) continue;
    }
    // Once per kind, per day, per buddy.
    const { error: logged } = await db.from("buddy_push_log").insert({ user_id: id, kind, sent_on: date, from_user: auth.user.id });
    if (logged) continue;
    const message = kind === "finished"
      ? { kind: "nudge" as const, title: `🔥 ${name} just finished today’s workout`, body: "Your turn? The same session is waiting for you.", url: "/today" }
      : { kind: "nudge" as const, title: `${name} is resting today`, body: reason ? `${reason}. Send them a 💪 from Friends.` : "Send them a 💪 from Friends — back together next session.", url: "/buddies" };
    const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", id).eq("nudges", true);
    for (const sub of subs ?? []) {
      const result = await sendPush(sub, message);
      if (result === "sent") pushed++;
      if (result === "gone") await db.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
  return Response.json({ pushed });
}
