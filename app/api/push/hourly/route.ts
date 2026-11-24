import { dueNotifications, localDateAndHour, type PushMessage, type PushPrefs } from "@/lib/notifications";
import { adminClient, hasCronSecret, sendPush } from "@/lib/push-server";
import { comebackMessage, comebackSlot, waterNudge, waterTargetMl } from "@/lib/wellness";
import { shiftDate, weekdayOf } from "@/lib/dates";
import { checkinsEnabled } from "@/lib/rozi-ai/checkins/checkin-service";
import { sendWeeklyCheckins } from "@/lib/rozi-ai/checkins/checkin-push";

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

  // Train together: each person's active group, its days, and every member's last two days.
  const { data: myGroups } = await db.from("buddy_members").select("user_id, group_id").in("user_id", userIds).eq("status", "active");
  const groupOfUser = new Map((myGroups ?? []).map((row: Row) => [String(row.user_id), String(row.group_id)]));
  const groupIds = [...new Set(groupOfUser.values())];
  const [{ data: groupRows }, { data: memberRows }] = groupIds.length
    ? await Promise.all([
        db.from("buddy_groups").select("id, training_days").in("id", groupIds),
        db.from("buddy_members").select("group_id, user_id").in("group_id", groupIds).eq("status", "active"),
      ])
    : [{ data: [] }, { data: [] }];
  const groupDays = new Map((groupRows ?? []).map((row: Row) => [String(row.id), Array.isArray(row.training_days) ? row.training_days.map(Number) : []]));
  const membersOf = new Map<string, string[]>();
  for (const row of (memberRows ?? []) as Row[]) membersOf.set(String(row.group_id), [...(membersOf.get(String(row.group_id)) ?? []), String(row.user_id)]);
  const buddyIds = [...new Set([...membersOf.values()].flat())];
  const { data: buddySessions } = buddyIds.length
    ? await db.from("workout_sessions").select("user_id, workout_date, status").in("user_id", buddyIds).gte("workout_date", recent)
    : { data: [] };
  const buddyStatus = new Map(((buddySessions ?? []) as Row[]).map((row) => [`${row.user_id}:${row.workout_date}`, String(row.status)]));
  const buddyNames = new Map<string, string>();
  if (buddyIds.length) {
    const { data: names } = await db.from("profiles").select("id, display_name").in("id", buddyIds);
    for (const row of (names ?? []) as Row[]) buddyNames.set(String(row.id), String(row.display_name || "Your buddy"));
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

    // Train together (buddy groups of 2+): an 8 pm "they trained, still time?" and a joint "you both rested" morning.
    const groupId = groupOfUser.get(user);
    const buddies = groupId ? (membersOf.get(groupId) ?? []).filter((id) => id !== user) : [];
    if (groupId && buddies.length && prefs.nudges) {
      const days = groupDays.get(groupId) ?? [];
      const mineToday = statusByDate.get(localDate);
      if (hour === 20 && days.includes(weekdayOf(localDate)) && !["completed", "in_progress", "skipped"].includes(String(mineToday))) {
        const trained = buddies.find((id) => buddyStatus.get(`${id}:${localDate}`) === "completed");
        if (trained) {
          const { error: logged } = await db.from("buddy_push_log").insert({ user_id: user, kind: "buddy-evening", sent_on: localDate });
          if (!logged) messages.push({ kind: "nudge", title: `${buddyNames.get(trained) ?? "Your buddy"} trained today 💪`, body: "Still time for yours — the same session is waiting.", url: "/today" });
        }
      }
      const yesterday = shiftDate(localDate, -1);
      if (hour === prefs.morningHour && days.includes(weekdayOf(yesterday))) {
        const everyone = [user, ...buddies];
        if (everyone.every((id) => buddyStatus.get(`${id}:${yesterday}`) !== "completed")) {
          const { error: logged } = await db.from("buddy_push_log").insert({ user_id: user, kind: "buddy-both-rested", sent_on: localDate });
          if (!logged) {
            // Replaces the usual "You missed yesterday's workout": one kind message, not two.
            const index = messages.findIndex((message) => message.kind === "morning");
            const together = { kind: "morning" as const, title: buddies.length === 1 ? "You both rested yesterday" : "Your group rested yesterday", body: "Restart together today? 💪 Same session for all of you.", url: "/buddies" };
            if (index >= 0) messages[index] = together; else messages.push(together);
          }
        }
      }
    }

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
  // R11: weekly check-ins for people who opted in (ROZI_CHECKINS=on). Counts only, no AI call.
  if (checkinsEnabled()) sent += await sendWeeklyCheckins(db, { subs: subs as Row[], profileOf: profileOf as Map<string, Row>, statusOf, now });
  return Response.json({ sent, checked: subs.length });
}
