"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { CHECKIN_HOURS, type CheckinSettings } from "@/lib/rozi-ai/checkins/checkin-service";
import { useRoziCheckins } from "./use-rozi-checkins";

const DAYS = [
  { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" }, { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }, { value: 0, label: "Sunday" },
];
const HOURS = Array.from({ length: CHECKIN_HOURS.max - CHECKIN_HOURS.min + 1 }, (_, index) => CHECKIN_HOURS.min + index);

/** Settings → "Weekly check-in with Rozi" (R11). Off by default. Hidden completely when check-ins are switched off on the server. */
export function RoziCheckinSettings() {
  const { load, save } = useRoziCheckins();
  const [settings, setSettings] = useState<CheckinSettings | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldId = useId();

  const refresh = useCallback(async () => {
    const result = await load();
    if (result.ok) { setSettings(result.settings); setLoadProblem(null); }
    else if (result.off) setHidden(true);
    else setLoadProblem(result.message);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  if (hidden) return null;

  async function change(patch: Partial<Pick<CheckinSettings, "enabled" | "weekday" | "hour">>) {
    if (busy || !settings) return;
    setBusy(true);
    setProblem(null);
    const result = await save({ enabled: settings.enabled, weekday: settings.weekday, hour: settings.hour, ...patch });
    setBusy(false);
    if (result.ok) setSettings(result.settings);
    else setProblem(result.message); // settings stay as last saved, so the controls show the old values again
  }

  return (
    <article className="panel settings-group rozi-checkin" aria-busy={busy}>
      <h3><CalendarCheck aria-hidden="true" /> Weekly check-in with Rozi</h3>
      <p className="card-note">Once a week Rozi sends one notification with how many workouts you did. Tapping it opens your week. It&apos;s built from your saved workouts on our server, with no AI. Off by default; switch it off any time.</p>
      {loadProblem && <p className="rozi-action-problem" role="alert">{loadProblem} <button type="button" className="text-button" onClick={() => void refresh()}>Try again</button></p>}
      {!loadProblem && settings === null && <p className="card-note" role="status">Loading…</p>}
      {settings && <>
        <label className="checkbox-row">
          <input type="checkbox" checked={settings.enabled} disabled={busy} onChange={(event) => void change({ enabled: event.target.checked })} />
          <span><strong>Send me a weekly check-in</strong></span>
        </label>
        {settings.enabled && <div className="rozi-checkin-fields">
          <label className="field-label" htmlFor={`${fieldId}-day`}>Day
            <select id={`${fieldId}-day`} value={settings.weekday} disabled={busy} onChange={(event) => void change({ weekday: Number(event.target.value) })}>
              {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </label>
          <label className="field-label" htmlFor={`${fieldId}-hour`}>Time
            <select id={`${fieldId}-hour`} value={settings.hour} disabled={busy} onChange={(event) => void change({ hour: Number(event.target.value) })}>
              {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
            </select>
          </label>
        </div>}
        <small className="rozi-action-note">Needs notifications switched on for this phone (Settings → Notifications).</small>
      </>}
      {problem && <p className="rozi-action-problem" role="alert">{problem}</p>}
    </article>
  );
}
