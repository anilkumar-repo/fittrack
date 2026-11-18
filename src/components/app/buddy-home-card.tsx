"use client";

import { useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Dumbbell, Flame, MapPin, Timer } from "lucide-react";
import { Avatar } from "./avatar";
import { useFitTrack } from "./fit-track-provider";
import { useScrollLock } from "./use-scroll-lock";
import { useWorkoutDay } from "./use-workout-day";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { TODAY_LABEL, useBuddies } from "@/components/screens/buddies-screen";
import { buddyStreak, buddyToday, quickVersion } from "@/lib/buddies";
import { notifyBuddies, setAtGym } from "@/lib/buddies-repository";
import { MISSED_REASONS } from "@/lib/missed-days";
import type { MissedReason, WorkoutSession } from "@/lib/types";

/**
 * Home, while training together: who's done today, the buddy streak, "I'm at the gym", and — when your workout is
 * still to do — "Can't today" with the catch-up choices (a quick 20-min version, or rest and let your buddies know).
 */
export function BuddyHomeCard() {
  const { state, browserClient, currentDate, setNotice } = useFitTrack();
  const { overview, refresh } = useBuddies();
  const [catchUp, setCatchUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const group = overview?.group;
  const active = (overview?.members ?? []).filter((member) => member.status === "active");
  if (!overview || !group || active.length < 2 || !browserClient) return null;

  const me = state.profile.id;
  const mine = buddyToday(overview.days, me, currentDate, group.trainingDays);
  const streak = buddyStreak({ trainingDays: group.trainingDays, since: group.anchorDate, members: active.map((member) => member.userId), days: overview.days, carried: overview.carried, today: currentDate });
  const meMember = active.find((member) => member.userId === me);

  async function toggleGym() {
    if (!browserClient || busy || !meMember) return;
    setBusy(true);
    try { await setAtGym(browserClient, !meMember.atGym); await refresh(); if (!meMember.atGym) setNotice("Your buddies can see you’re at the gym for the next 2 hours."); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "That didn’t work. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <article className="panel buddy-home" aria-label="Training together">
      <div className="buddy-home-head">
        <span className="buddy-flame small"><Flame aria-hidden="true" /> {streak}</span>
        <strong>Training together</strong>
        <Link href="/buddies" className="text-button">Open <ArrowRight aria-hidden="true" /></Link>
      </div>
      <ul className="buddy-faces">{active.map((member) => {
        const status = buddyToday(overview.days, member.userId, currentDate, group.trainingDays);
        return (
          <li key={member.userId} className={`today-${status}`} title={`${member.userId === me ? "You" : member.name}: ${TODAY_LABEL[status]}`}>
            <span className="buddy-face"><Avatar value={member.avatar} name={member.name} size={44} />{status === "done" && <Check className="buddy-face-tick" aria-hidden="true" />}{member.atGym && <MapPin className="buddy-face-gym" aria-hidden="true" />}</span>
            <small>{member.userId === me ? "You" : member.name.split(" ")[0]}</small>
            <em>{TODAY_LABEL[status]}</em>
          </li>
        );
      })}</ul>
      {mine === "to-do" && <div className="buddy-home-actions">
        <Link href="/today" className="button button-primary small"><Dumbbell aria-hidden="true" /> Start</Link>
        <button type="button" className={`button small ${meMember?.atGym ? "button-primary" : "button-subtle"}`} disabled={busy} onClick={() => void toggleGym()}><MapPin aria-hidden="true" /> {meMember?.atGym ? "At the gym" : "I’m at the gym"}</button>
        <button type="button" className="text-button" onClick={() => setCatchUp(true)}>Can’t today</button>
      </div>}
      {catchUp && <CatchUpSheet onClose={() => setCatchUp(false)} onDone={() => { setCatchUp(false); void refresh(); }} />}
    </article>
  );
}

/** "Can't today": a quick 20-min version of the same session, or rest (with a reason) and tell your buddies. */
function CatchUpSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { state, browserClient, currentDate, upsertSession, recordMissedDays, setNotice } = useFitTrack();
  const { session, plan } = useWorkoutDay(currentDate, undefined);
  const [reason, setReason] = useState<MissedReason | null>(null);
  const [busy, setBusy] = useState(false);
  useScrollLock();

  async function quick() {
    if (!plan || busy) return;
    setBusy(true);
    const base: WorkoutSession = session ?? { id: state.mode === "demo" ? `demo-${currentDate}-planned` : crypto.randomUUID(), date: currentDate, status: "planned", plan, exerciseLogs: [] };
    await upsertSession({ ...base, plan: quickVersion(plan) });
    setBusy(false);
    setNotice("Today is the quick 20-minute version — same session as your buddies, just shorter.");
    onDone();
  }

  async function rest() {
    if (!plan || !reason || busy || !browserClient) return;
    setBusy(true);
    const saved = await recordMissedDays([{ id: session?.id ?? crypto.randomUUID(), date: currentDate, status: "skipped", plan, exerciseLogs: [], missedReason: { reason, note: "" } }]);
    if (saved) void notifyBuddies(browserClient, "skipped");
    setBusy(false);
    setNotice(saved ? "Rest day saved. Your buddies know — back together next session." : "That didn’t save. Please try again.");
    onDone();
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Can't train today" onClick={onClose}>
      <section className="modal catch-up-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <span className="onb-kicker">Can’t today?</span>
        <h2>Pick what fits</h2>
        <button type="button" className="catch-up-option" disabled={busy || !plan || session?.status === "completed"} onClick={() => void quick()}>
          <Timer aria-hidden="true" /><span><strong>Quick 20-min version</strong><small>The same session as your buddies: the 3 main exercises, 2 sets each.</small></span>
        </button>
        <div className="catch-up-rest">
          <strong>Rest today</strong>
          <small>Your buddies get a gentle note. The reason is only shown if you share reasons.</small>
          <div className="chip-row">{MISSED_REASONS.map((option) => <button key={option.id} type="button" className={`chip ${reason === option.id ? "chip-on" : ""}`} aria-pressed={reason === option.id} onClick={() => setReason(option.id)}>{option.label}</button>)}</div>
          <button type="button" className="button button-subtle full-width" disabled={busy || !reason} onClick={() => void rest()}>Rest today</button>
        </div>
        {(reason === "sore" || reason === "unwell") && <p className="card-note">Good call — rest helps you come back stronger. If something hurts, tell Rozi at your next check-in.</p>}
      </section>
    </div>,
    document.body,
  );
}
