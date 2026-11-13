import { dueNotifications, localDateAndHour, type PushPrefs } from "@/lib/notifications";
import { adminClient, hasCronSecret, sendPush } from "@/lib/push-server";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

/**
 * Called every hour by the database schedule. Sends each phone the morning motivation and the evening
 * "log your workout" reminder when its local hour matches, at most once a day each.
 */
export async function POST(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "Not allowed" }, { status: 401 });
  const db = adminClient();
  if (!db) return Response.json({ error: "Notifications are not configured" }, { status: 503 });
  const now = new Date();

  const { data: subs, error } = await db.from("push_subscriptions").select("*").or("morning.eq.true,evening.eq.true");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return Response.json({ sent: 0, checked: 0 });

  const userIds = [...new Set(subs.map((row: Row) => String(row.user_id)))];
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    db.from("profiles").select("id, training_days, training_start_date, time_zone").in("id", userIds),
    db.from("workout_sessions").select("user_id, workout_date, status").in("user_id", userIds).gte("workout_date", since),
  ]);
  const profileOf = new Map((profiles ?? []).map((row: Row) => [String(row.id), row]));
  const statusOf = new Map<string, Map<string, string>>();
  for (const row of (sessions ?? []) as Row[]) {
    const map = statusOf.get(String(row.user_id)) ?? new Map<string, string>();
    map.set(String(row.workout_date), String(row.status));
    statusOf.set(String(row.user_id), map);
  }

  let sent = 0;
  for (const sub of subs as Row[]) {
    const profile = profileOf.get(String(sub.user_id));
    if (!profile) continue;
    const prefs: PushPrefs = { morning: sub.morning === true, morningHour: Number(sub.morning_hour), evening: sub.evening === true, eveningHour: Number(sub.evening_hour), nudges: sub.nudges === true };
    const timeZone = String(sub.time_zone || profile.time_zone || "Asia/Kolkata");
    const { date: localDate } = localDateAndHour(timeZone, now);
    const messages = dueNotifications({
      prefs,
      timeZone,
      trainingDays: Array.isArray(profile.training_days) ? profile.training_days.map(Number) : [],
      trainingStartDate: String(profile.training_start_date ?? "1970-01-01"),
      statusByDate: statusOf.get(String(sub.user_id)) ?? new Map(),
      lastMorningOn: typeof sub.last_morning_on === "string" ? sub.last_morning_on : null,
      lastEveningOn: typeof sub.last_evening_on === "string" ? sub.last_evening_on : null,
      now,
    });
    for (const message of messages) {
      const result = await sendPush({ id: String(sub.id), endpoint: String(sub.endpoint), p256dh: String(sub.p256dh), auth: String(sub.auth) }, message);
      if (result === "gone") { await db.from("push_subscriptions").delete().eq("id", String(sub.id)); break; }
      if (result === "sent") sent++;
      await db.from("push_subscriptions").update(message.kind === "morning" ? { last_morning_on: localDate } : { last_evening_on: localDate }).eq("id", String(sub.id));
    }
  }
  return Response.json({ sent, checked: subs.length });
}
