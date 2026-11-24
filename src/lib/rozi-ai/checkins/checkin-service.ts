// ---------- Rozi weekly check-ins (R11): opt-in, no AI, nothing stored but the person's choice ----------
//
// The person switches check-ins on in Settings and picks a day and hour. The hourly push schedule (already running)
// counts that week's workouts from saved sessions and sends one notification; tapping it opens "Your week with
// Rozi" (/report). No model is called and no summary is stored. The AI runs only if the person then asks Rozi.

import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftDate, weekDates, weekdayOf } from "../../dates.ts";
import type { PushMessage } from "../../notifications.ts";

export interface CheckinSettings { enabled: boolean; weekday: number; hour: number; consentedAt: string | null }

export const CHECKIN_DEFAULTS: CheckinSettings = { enabled: false, weekday: 1, hour: 9, consentedAt: null };
export const CHECKIN_HOURS = { min: 5, max: 21 } as const;
/** If the schedule misses an hour, the check-in can still go out within this many hours after the chosen one. */
const LATE_WINDOW_HOURS = 3;

/** Check-ins are switched on per server (ROZI_CHECKINS=on). Off: no setting is shown and nothing is sent. */
export function checkinsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ROZI_CHECKINS ?? "").trim().toLowerCase() === "on";
}

const isWeekday = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 6;
const isHour = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= CHECKIN_HOURS.min && (value as number) <= CHECKIN_HOURS.max;

export function parseCheckinSettings(value: unknown): CheckinSettings {
  if (!value || typeof value !== "object") return CHECKIN_DEFAULTS;
  const row = value as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    weekday: isWeekday(row.weekday) ? row.weekday : CHECKIN_DEFAULTS.weekday,
    hour: isHour(row.hour) ? row.hour : CHECKIN_DEFAULTS.hour,
    consentedAt: typeof row.consented_at === "string" ? row.consented_at : null,
  };
}

/**
 * The Monday of the week a check-in is due for, or null when none is due now. Due on the chosen weekday from the
 * chosen hour (a few hours' grace). Sunday sums up the week ending that day; any other day sums up last week.
 */
export function checkinWeek(localDate: string, localHour: number, settings: Pick<CheckinSettings, "weekday" | "hour">): string | null {
  if (weekdayOf(localDate) !== settings.weekday) return null;
  if (localHour < settings.hour || localHour >= settings.hour + LATE_WINDOW_HOURS) return null;
  const monday = weekDates(localDate)[0];
  return settings.weekday === 0 ? monday : shiftDate(monday, -7);
}

/** The notification: counts only (no names, notes or AI), and a link to that week's report. */
export function checkinMessage(input: { weekStart: string; localDate: string; trainingDays: number[]; trainingStartDate: string; statusByDate: Map<string, string> }): PushMessage {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(input.weekStart, i)).filter((day) => day <= input.localDate);
  const planned = days.filter((day) => day >= input.trainingStartDate && input.trainingDays.includes(weekdayOf(day))).length;
  const done = days.filter((day) => input.statusByDate.get(day) === "completed").length;
  const body = done === 0
    ? (planned ? "A quiet week. Tap to see it, and one short workout gets you rolling again." : "Tap to see your week with Rozi.")
    : planned && done >= planned
      ? `Every planned workout done (${done} of ${planned}). Tap to see your week with Rozi.`
      : `${done} ${done === 1 ? "workout" : "workouts"} done${planned ? ` of ${planned} planned` : ""}. Tap to see your week with Rozi.`;
  return { kind: "checkin", title: "Your weekly check-in 📋", body, url: `/report?week=${input.weekStart}` };
}

// ---------- The person's own choice, always AS the person (their own sign-in) ----------

export async function getCheckinSettings(userClient: SupabaseClient): Promise<CheckinSettings | null> {
  const { data, error } = await userClient.rpc("rozi_my_checkin_settings");
  return error ? null : parseCheckinSettings(data);
}

export async function setCheckinSettings(userClient: SupabaseClient, body: unknown): Promise<CheckinSettings | { problem: string }> {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (typeof input.enabled !== "boolean" || !isWeekday(input.weekday) || !isHour(input.hour)) {
    return { problem: `Pick a day and an hour between ${CHECKIN_HOURS.min}:00 and ${CHECKIN_HOURS.max}:00.` };
  }
  const { data, error } = await userClient.rpc("rozi_set_checkin_settings", { p_enabled: input.enabled, p_weekday: input.weekday, p_hour: input.hour });
  return error ? { problem: "Your choice couldn't be saved right now." } : parseCheckinSettings(data);
}
