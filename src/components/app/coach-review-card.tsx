"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Check, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";
import { adjustmentsOf, applyPlanChange, dismissSuggestion, setAutoApply, undoLastChange } from "@/lib/coach-plan";
import { autoApplicable, weeklyReview, type CoachSuggestion } from "@/lib/coach-review";
import { dateLabel } from "@/lib/dates";
import type { Profile } from "@/lib/types";

/** The fields a coach change touches, saved together. */
function saveFields(profile: Profile): Partial<Profile> {
  return { planAdjustments: profile.planAdjustments, preferredSessionMinutes: profile.preferredSessionMinutes };
}

/**
 * R14 Coach review (Progress): up to three plan changes from your logged weeks, each approved with one tap (or "not
 * now"). Small safe ones can apply by themselves if you turn that on; every change can be undone. The planner
 * applies approved changes from your next generated workout.
 */
export function CoachReviewCard() {
  const { state, currentDate, recordedSessions, updateProfile, setNotice } = useFitTrack();
  const profile = state.profile;
  const review = useMemo(() => weeklyReview({ profile, sessions: recordedSessions, today: currentDate }), [profile, recordedSessions, currentDate]);
  const adjustments = adjustmentsOf(profile);
  const latest = adjustments.history.find((entry) => !entry.undone);
  const recent = adjustments.history.filter((entry) => !entry.undone).slice(0, 3);

  function apply(item: CoachSuggestion, auto = false): Profile | null {
    const result = applyPlanChange(profile, item.change, { id: item.id, title: item.title, on: currentDate, auto });
    if (!result.ok) { setNotice(result.reason); return null; }
    return result.profile;
  }

  // Auto-apply: the small safe changes, once each, when the person turned it on.
  const applying = useRef(false);
  const pending = autoApplicable(profile, review);
  useEffect(() => {
    if (!pending.length || applying.current) return;
    applying.current = true;
    const timer = window.setTimeout(() => {
      let next: Profile = profile;
      for (const item of pending) {
        const result = applyPlanChange(next, item.change, { id: item.id, title: item.title, on: currentDate, auto: true });
        if (result.ok) next = result.profile;
      }
      if (next !== profile) {
        updateProfile(saveFields(next), { quiet: true });
        setNotice(`Rozi updated your plan: ${pending.map((item) => item.title.toLowerCase()).join(", ")}. You can undo it in your coach review.`);
      }
      applying.current = false;
    }, 0);
    return () => { window.clearTimeout(timer); applying.current = false; };
  }, [pending, profile, currentDate, updateProfile, setNotice]);

  if (profile.buddyAnchor) {
    return (
      <article className="coach-review ui-card ui-card--pad-md" aria-labelledby="coach-title">
        <h3 id="coach-title" className="coach-title"><Sparkles aria-hidden="true" /> Coach review</h3>
        <p className="coach-empty">In Train together your group shares one plan, so changes go through your buddies. <Link href="/buddies">Open Train together</Link></p>
      </article>
    );
  }

  return (
    <article className="coach-review ui-card ui-card--pad-md" id="coach" aria-labelledby="coach-title">
      <header className="coach-head">
        <Rozi mood="report-card" size={56} className="coach-rozi" />
        <div>
          <h3 id="coach-title" className="coach-title">Coach review</h3>
          <p className="coach-sub">Week of {dateLabel(review.week, { month: "short", day: "numeric" })} · {review.done > review.planned ? `${review.done} workouts` : `${review.done} of ${review.planned} workouts`} in 3 weeks{review.averageEffort !== null ? ` · effort ${review.averageEffort}/10` : ""}</p>
        </div>
      </header>

      {review.suggestions.length ? <ul className="coach-list">
        {review.suggestions.map((item) => (
          <li key={item.id} className="coach-item">
            <strong>{item.title}{item.safe && <span className="coach-tag">Small change</span>}</strong>
            <p>{item.why}</p>
            <div className="coach-actions">
              <button type="button" className="coach-apply" onClick={() => { const next = apply(item); if (next) { updateProfile(saveFields(next), { quiet: true }); setNotice(`Done: ${item.title.toLowerCase()}. It starts with your next workout.`); } }}><Check aria-hidden="true" /> Apply</button>
              <button type="button" className="coach-later" onClick={() => updateProfile(saveFields(dismissSuggestion(profile, item.id)), { quiet: true })}>Not now</button>
            </div>
          </li>
        ))}
      </ul> : <p className="coach-empty">Nothing to change this week — your plan fits how you’re training. Keep going.</p>}

      {recent.length > 0 && <div className="coach-history">
        <small>Changes in your plan</small>
        <ul>{recent.map((entry) => <li key={`${entry.id}-${entry.on}`}><span>{entry.title}{entry.auto ? " · by Rozi" : ""}</span><em>{dateLabel(entry.on, { month: "short", day: "numeric" })}</em></li>)}</ul>
        {latest && <button type="button" className="coach-undo" onClick={() => { updateProfile(saveFields(undoLastChange(profile)), { quiet: true }); setNotice(`Undone: ${latest.title.toLowerCase()}.`); }}><RotateCcw aria-hidden="true" /> Undo “{latest.title}”</button>}
      </div>}

      <div className="coach-auto">
        <span><strong>Let Rozi make small changes</strong><small>A lighter week when your body asks for it, swapping a move you keep skipping. You can undo any of them.</small></span>
        <button type="button" role="switch" aria-checked={adjustments.autoApply} aria-label="Let Rozi make small changes to my plan" className={`toggle ${adjustments.autoApply ? "on" : ""}`} onClick={() => updateProfile(saveFields(setAutoApply(profile, !adjustments.autoApply)), { quiet: true })}><span /></button>
      </div>
      <Link href="/rozi" className="coach-ask">Ask Rozi about your plan <ChevronRight aria-hidden="true" /></Link>
    </article>
  );
}
