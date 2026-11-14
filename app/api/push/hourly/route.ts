import { dueNotifications, localDateAndHour, type PushMessage, type PushPrefs } from "@/lib/notifications";
import { adminClient, hasCronSecret, sendPush } from "@/lib/push-server";
import { comebackMessage, comebackSlot, waterNudge, waterTargetMl } from "@/lib/wellness";
import { shiftDate, weekdayOf } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

/**
 * Called every hour by the database schedule. For each phone, in its own time zone:
 * morning motivation, evening "log your workout", smart water reminders (only when behind pace),
 * comeback reminders three times a day after a 5-day break (quoting the person's "why"), and the
 * monthly weigh-in. Each kind is rate-limited with a "last sent" marker on the subscription.
 */
export async function POST(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "Not allowed" }, { status: 401 });
  const db = adminClient();
  if (!db) return Response.json({ error: "Notifications are not configured" }, { status: 503 });
  const now = new Date();

  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return Response.json({ sent: 0, checked: 0 });

  const userIds = [...new Set(subs.map((row: Row) => String(row.user_id)))];
  const since = new Date(now.getTime() - 40 * 86_400_000).toISOString().slice(0, 10);
  const recent = new Date(now.getTime() - 2 * 86_400_000).toISOString().slice(0, 10);
  const yearAgo = new Date(now.getTime() - 400 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: profiles }, { data: sessions }, { data: water }, { data: weights }] = await Promise.all([
    db.from("profiles").select("*").in("id", userIds),
    db.from("workout_sessions").select("user_id, workout_date, status, completed_at").in("user_id", userIds).gte("workout_date", since),
    // Missing before the latest database update: then simply no water data.
    db.from("water_logs").select("user_id, logged_on, ml").in("user_id", userIds).gte("logged_on", recent),
    db.from("body_weight_entries").select("user_id, measured_on, weight_kg").in("user_id", userIds).gte("measured_on", yearAgo),
  ]);
  const profileOf = new Map((profiles ?? []).map((row: Row) => [String(row.id), row]));
  const statusOf = new Map<string, Map<string, string>>();
  const lastDoneOf = new Map<string, string>();
  const lastFinishedAt = new Map<string, number>();
  for (const row of (sessions ?? []) as Row[]) {
    const user = String(row.user_id);
    const map = statusOf.get(user) ?? new Map<string, string>();
    map.set(String(row.workout_date), String(row.status));
    statusOf.set(user, map);
    if (row.status === "completed") {
      const date = String(row.workout_date);
      if (!lastDoneOf.has(user) || date > (lastDoneOf.get(user) as string)) lastDoneOf.set(user, date);
      const at = row.completed_at ? Date.parse(String(row.completed_at)) : NaN;
      if (Number.isFinite(at)) lastFinishedAt.set(user, Math.max(at, lastFinishedAt.get(user) ?? 0));
    }
  }
  const waterOf = new Map<string, number>();
  for (const row of (water ?? []) as Row[]) waterOf.set(`${row.user_id}:${row.logged_on}`, (waterOf.get(`${row.user_id}:${row.logged_on}`) ?? 0) + Number(row.ml));
  const weightOf = new Map<string, { date: string; kg: number }>();
  for (const row of (weights ?? []) as Row[]) {
    const user = String(row.user_id), date = String(row.measured_on);
    if (!weightOf.has(user) || date > (weightOf.get(user) as { date: string }).date) weightOf.set(user, { date, kg: Number(row.weight_kg) });
  }

  let sent = 0;
  for (const sub of subs as Row[]) {
    const user = String(sub.user_id);
    const profile = profileOf.get(user);
    if (!profile) continue;
    const prefs: PushPrefs = { morning: sub.morning === true, morningHour: Number(sub.morning_hour), evening: sub.evening === true, eveningHour: Number(sub.evening_hour), nudges: sub.nudges === true, hydration: sub.hydration !== false, comeback: sub.comeback !== false, weighIn: sub.weigh_in !== false };
    // The profile follows the phone (updated when the person travels); the subscription copy can be older.
    const timeZone = String(profile.time_zone || sub.time_zone || "Asia/Kolkata");
    const { date: localDate, hour } = localDateAndHour(timeZone, now);
    const trainingDays = Array.isArray(profile.training_days) ? profile.training_days.map(Number) : [];
    const trainingStartDate = String(profile.training_start_date ?? "1970-01-01");
    const statusByDate = statusOf.get(user) ?? new Map<string, string>();
    const messages: PushMessage[] = dueNotifications({
      prefs, timeZone, trainingDays, trainingStartDate, statusByDate,
      lastMorningOn: typeof sub.last_morning_on === "string" ? sub.last_morning_on : null,
      lastEveningOn: typeof sub.last_evening_on === "string" ? sub.last_evening_on : null,
      now,
    });
    const updates: Row = {};

    // Comeback: 5+ days without a workout → 9:00, 13:00 and 19:00 until a workout starts.
    const todayStatus = statusByDate.get(localDate);
    const lastDone = lastDoneOf.get(user) ?? null;
    const daysOff = lastDone ? daysBetween(localDate, lastDone) : localDate > shiftDate(trainingStartDate, 4) ? daysBetween(localDate, trainingStartDate) : null;
    const slot = prefs.comeback ? comebackSlot(daysOff, hour, todayStatus === "in_progress" || todayStatus === "completed") : null;
    const slotKey = `${localDate}T${hour}`;
    if (slot !== null && sub.last_comeback_slot !== slotKey) {
      const { title, body } = comebackMessage(String(profile.display_name || "friend"), String(profile.why ?? ""), slot);
      messages.push({ kind: "comeback", title, body, url: "/today" });
      updates.last_comeback_slot = slotKey;
    }

    // Water: only when behind pace (or just after a workout), at most every 3 hours, never at night.
    if (prefs.hydration) {
      const latest = weightOf.get(user);
      const workoutDay = trainingDays.includes(weekdayOf(localDate)) || todayStatus === "completed";
      const finished = lastFinishedAt.get(user) ?? 0;
      const nudge = waterNudge({
        loggedMl: waterOf.get(`${user}:${localDate}`) ?? 0,
        targetMl: waterTargetMl(latest?.kg ?? null, workoutDay),
        hour,
        lastSentAt: sub.last_water_at ? Date.parse(String(sub.last_water_at)) : null,
        now: now.getTime(),
        justTrained: finished > 0 && now.getTime() - finished < 2 * 3_600_000,
      });
      if (nudge) { messages.push({ kind: "water", ...nudge, url: "/#water" }); updates.last_water_at = now.toISOString(); }
    }

    // Monthly weigh-in at the morning hour, at most once a week until done.
    if (prefs.weighIn && hour === prefs.morningHour) {
      const latest = weightOf.get(user);
      const due = !latest || daysBetween(localDate, latest.date) >= 30;
      const lastAsked = typeof sub.last_weigh_in_on === "string" ? sub.last_weigh_in_on : null;
      if (due && (!lastAsked || daysBetween(localDate, lastAsked) >= 7)) {
        messages.push({ kind: "weigh-in", title: "Monthly check-in ⚖️", body: "Step on the scale before breakfast and tell Rozi — you’ll get tips for the month ahead.", url: "/#weigh-in" });
        updates.last_weigh_in_on = localDate;
      }
    }

    for (const message of messages) {
      const result = await sendPush({ id: String(sub.id), endpoint: String(sub.endpoint), p256dh: String(sub.p256dh), auth: String(sub.auth) }, message);
      if (result === "gone") { await db.from("push_subscriptions").delete().eq("id", String(sub.id)); break; }
      if (result === "sent") sent++;
      if (message.kind === "morning") updates.last_morning_on = localDate;
      if (message.kind === "evening") updates.last_evening_on = localDate;
    }
    if (Object.keys(updates).length) await db.from("push_subscriptions").update(updates).eq("id", String(sub.id));
  }
  return Response.json({ sent, checked: subs.length });
}
