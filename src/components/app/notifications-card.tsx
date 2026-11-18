"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { DEFAULT_PUSH_PREFS, EVENING_HOURS, MORNING_HOURS, type PushPrefs } from "@/lib/notifications";
import { currentPush, disablePush, enablePush, pushSupport, savePushPrefs, type PushSupport } from "@/lib/push-client";
import { useFitTrack } from "./fit-track-provider";

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

/** Phone notifications: morning motivation, evening log reminder and friend nudges, per device. */
export function NotificationsCard() {
  const { state, isDemo, browserClient } = useFitTrack();
  const [support, setSupport] = useState<PushSupport>({ state: "unsupported" });
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const timeZone = state.profile.timeZone;

  useEffect(() => {
    const found = pushSupport();
    let cancelled = false;
    const finish = (saved: PushPrefs | null) => { if (!cancelled) { setSupport(found); setPrefs(saved); setLoaded(true); } };
    if (isDemo || !browserClient || found.state !== "ready") { queueMicrotask(() => finish(null)); return () => { cancelled = true; }; }
    currentPush(browserClient).then(finish).catch(() => finish(null));
    return () => { cancelled = true; };
  }, [isDemo, browserClient]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Something went wrong."); } finally { setBusy(false); }
  }

  function change(patch: Partial<PushPrefs>) {
    if (!prefs || !browserClient) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void act(() => savePushPrefs(browserClient, timeZone, next));
  }

  const on = Boolean(prefs);
  let body: React.ReactNode;
  if (isDemo) body = <small>Sign in to get reminders on your phone.</small>;
  else if (!loaded) body = <small>Checking this device…</small>;
  else if (support.state === "install-first") body = <small>On iPhone, first add RozFit to your Home Screen: tap Share, then “Add to Home Screen”. Open it from there and turn notifications on here.</small>;
  else if (support.state === "not-configured") body = <small>Notifications are not switched on for this app yet.</small>;
  else if (support.state === "blocked") body = <small>Notifications are blocked for this site. Allow them in your phone or browser settings, then come back.</small>;
  else if (support.state === "unsupported") body = <small>This browser can’t show notifications. Try Chrome on Android, or the Home Screen app on iPhone.</small>;
  else body = <>
    <div className="settings-toggle-row">
      <span><strong>Notifications on this device</strong><small>{on ? "On" : "Off"}</small></span>
      <button type="button" role="switch" aria-checked={on} aria-label="Notifications on this device" className={`toggle ${on ? "on" : ""} ${busy ? "disabled" : ""}`} disabled={busy || !browserClient}
        onClick={() => void act(async () => {
          if (on) { await disablePush(browserClient!); setPrefs(null); setMessage("Notifications are off on this device."); }
          else { setPrefs(await enablePush(browserClient!, timeZone, DEFAULT_PUSH_PREFS)); setMessage("You’re all set. Rozi will check in."); }
        })}><span /></button>
    </div>
    {prefs && <div className="notify-options">
      <label className="notify-row"><input type="checkbox" checked={prefs.morning} onChange={(event) => change({ morning: event.target.checked })} /> Morning motivation
        <select value={prefs.morningHour} disabled={!prefs.morning} onChange={(event) => change({ morningHour: Number(event.target.value) })} aria-label="Morning time">{MORNING_HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
      </label>
      <label className="notify-row"><input type="checkbox" checked={prefs.evening} onChange={(event) => change({ evening: event.target.checked })} /> Reminder to log a workout
        <select value={prefs.eveningHour} disabled={!prefs.evening} onChange={(event) => change({ eveningHour: Number(event.target.value) })} aria-label="Evening time">{EVENING_HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select>
      </label>
      <label className="notify-row"><input type="checkbox" checked={prefs.nudges} onChange={(event) => change({ nudges: event.target.checked })} /> Nudges & messages from friends</label>
      <label className="notify-row"><input type="checkbox" checked={prefs.hydration} onChange={(event) => change({ hydration: event.target.checked })} /> Water — only when you’re behind</label>
      <label className="notify-row"><input type="checkbox" checked={prefs.comeback} onChange={(event) => change({ comeback: event.target.checked })} /> Comeback after a 5-day break (3 a day)</label>
      <label className="notify-row"><input type="checkbox" checked={prefs.weighIn} onChange={(event) => change({ weighIn: event.target.checked })} /> Monthly weigh-in</label>
      <small>The log reminder only comes on training days you haven’t logged yet. Water reminders come at most every 3 hours, 10 am–9 pm, and only when you’re behind your pace. Times follow your time zone ({timeZone}).</small>
    </div>}
  </>;

  return (
    <article className="panel settings-group">
      <h3><Bell aria-hidden="true" /> Notifications</h3>
      {body}
      {message && <p className="field-hint" role="status">{message}</p>}
    </article>
  );
}
