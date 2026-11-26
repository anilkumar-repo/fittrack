"use client";

import { useScrollLock } from "./use-scroll-lock";
import { useState } from "react";
import { createPortal } from "react-dom";
import { BatteryLow, Bone, Briefcase, CalendarX, Check, Ellipsis, Plane, Thermometer, type LucideIcon } from "lucide-react";
import { dateLabel } from "@/lib/dates";
import { MISSED_REASONS, missedDaySession, validateMissedReason } from "@/lib/missed-days";
import { generateWorkout } from "@/lib/planner";
import type { MissedReason, WorkoutSession } from "@/lib/types";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

const REASON_ICONS: Record<MissedReason, LucideIcon> = { busy: Briefcase, unwell: Thermometer, tired: BatteryLow, sore: Bone, travel: Plane, forgot: CalendarX, other: Ellipsis };

/**
 * Asks why a planned training day was missed. Redesigned 2026-11-26: Rozi and the day side by side, "1 of 3" when
 * several days are waiting, and the reasons as an even grid of icon tiles (was a centred wrap of pills). It stays open until a reason is saved, so every missed day
 * has an honest answer the trainer can see. Oldest missed day first.
 */
export function MissedDayPrompt({ dates }: { dates: string[] }) {
  const { state, recordedSessions, trainerRuleSettings, recordMissedDays } = useFitTrack();
  useScrollLock();
  const [reason, setReason] = useState<MissedReason | null>(null);
  const [note, setNote] = useState("");
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const date = dates[0];
  const more = dates.length - 1;

  async function save() {
    if (!reason) { setError("Choose a reason."); return; }
    const entry = { reason, note };
    const problems = validateMissedReason(entry);
    if (problems.length) { setError(problems[0]); return; }
    const sessions = (applyAll ? dates : [date]).flatMap((day): WorkoutSession[] => {
      const existing = sessionForDate(state, day);
      const plan = existing?.plan ?? generateWorkout({ date: day, profile: state.profile, sessions: recordedSessions, trainerRuleSettings, trainerRuleRevision: state.trainerRuleRevision ?? 1 });
      return plan ? [missedDaySession(day, plan, entry, existing?.id)] : [];
    });
    setSaving(true);
    setError("");
    const ok = await recordMissedDays(sessions);
    setSaving(false);
    if (!ok) { setError("Couldn’t save that. Check your connection and try again."); return; }
    setReason(null);
    setNote("");
    setApplyAll(false);
  }

  // Rendered on the page body so it covers the navigation bars as well.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="missed-backdrop">
      <section className="missed-dialog panel" role="dialog" aria-modal="true" aria-labelledby="missed-title" aria-describedby="missed-help">
        <header className="missed-head">
          <Rozi mood="care" size={72} priority />
          <div>
            {dates.length > 1 && <span className="missed-step">Day 1 of {dates.length} to explain</span>}
            <h2 id="missed-title">You missed {dateLabel(date, { weekday: "long", month: "short", day: "numeric" })}</h2>
            <p id="missed-help">What happened? Your trainer sees this and can adjust your plan. No judgement.</p>
          </div>
        </header>
        <div className="missed-reasons" role="radiogroup" aria-label="Reason">
          {MISSED_REASONS.map((item) => {
            const Icon = REASON_ICONS[item.id];
            const picked = reason === item.id;
            return (
              <button key={item.id} type="button" role="radio" aria-checked={picked} className={`missed-tile ${picked ? "picked" : ""}`} onClick={() => { setReason(item.id); setError(""); }}>
                <span className="missed-icon"><Icon aria-hidden="true" /></span>
                <span className="missed-label">{item.label}</span>
                {picked && <span className="missed-tick"><Check aria-hidden="true" /></span>}
              </button>
            );
          })}
        </div>
        <label className="missed-note">
          {reason === "other" ? "What happened? (required)" : "Anything to add? (optional)"}
          <textarea rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder={reason === "sore" ? "Where does it hurt, and how much?" : "A short note for your trainer"} />
        </label>
        {reason === "sore" && <p className="missed-safety">If pain is new, severe or getting worse, please see a health professional before training.</p>}
        {more > 0 && <label className="missed-all"><input type="checkbox" checked={applyAll} onChange={(event) => setApplyAll(event.target.checked)} /> Same reason for all {dates.length} missed days</label>}
        {error && <p className="missed-error" role="alert">{error}</p>}
        <button type="button" className="button button-primary" disabled={saving || !reason} onClick={save}>{saving ? "Saving…" : more > 0 && !applyAll ? "Save and next" : "Save reason"}</button>
      </section>
    </div>,
    document.body,
  );
}
