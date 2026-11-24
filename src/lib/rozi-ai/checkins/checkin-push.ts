// Server only (service role): sends due weekly check-ins from the hourly push schedule. No AI call.

import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateAndHour } from "../../notifications.ts";
import { sendPush } from "../../push-server.ts";
import { checkinMessage, checkinWeek, parseCheckinSettings } from "./checkin-service.ts";

type Row = Record<string, unknown>;

/**
 * For everyone who opted in: when their chosen day and hour arrive (in their own time zone), claim that week once
 * (rozi_mark_checkin_sent, so a week is never sent twice) and send one notification to each of their phones.
 * Uses data the hourly route already loaded. Returns how many notifications were sent.
 */
export async function sendWeeklyCheckins(db: SupabaseClient, input: {
  subs: Row[];
  profileOf: Map<string, Row>;
  statusOf: Map<string, Map<string, string>>;
  now: Date;
}): Promise<number> {
  const { data, error } = await db.rpc("rozi_checkin_people");
  if (error || !Array.isArray(data) || !data.length) return 0;
  const subsOf = new Map<string, Row[]>();
  for (const sub of input.subs) subsOf.set(String(sub.user_id), [...(subsOf.get(String(sub.user_id)) ?? []), sub]);

  let sent = 0;
  for (const person of data as Row[]) {
    const user = String(person.user_id);
    const phones = subsOf.get(user);
    const profile = input.profileOf.get(user);
    if (!phones?.length || !profile) continue;
    const settings = parseCheckinSettings(person);
    const timeZone = String(profile.time_zone || phones[0].time_zone || "Asia/Kolkata");
    const { date: localDate, hour } = localDateAndHour(timeZone, input.now);
    const weekStart = checkinWeek(localDate, hour, settings);
    if (!weekStart || person.last_sent_week === weekStart) continue;
    const { data: claimed } = await db.rpc("rozi_mark_checkin_sent", { p_user: user, p_week: weekStart });
    if (claimed !== true) continue;
    const message = checkinMessage({
      weekStart, localDate,
      trainingDays: Array.isArray(profile.training_days) ? profile.training_days.map(Number) : [],
      trainingStartDate: String(profile.training_start_date ?? "1970-01-01"),
      statusByDate: input.statusOf.get(user) ?? new Map(),
    });
    for (const sub of phones) {
      const result = await sendPush({ id: String(sub.id), endpoint: String(sub.endpoint), p256dh: String(sub.p256dh), auth: String(sub.auth) }, message);
      if (result === "gone") await db.from("push_subscriptions").delete().eq("id", String(sub.id));
      if (result === "sent") sent++;
    }
  }
  return sent;
}
