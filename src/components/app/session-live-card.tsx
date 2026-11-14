"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Square, Timer } from "lucide-react";
import { clearWorkoutNotification, workoutStartedAt } from "@/lib/session-notify";
import type { WorkoutReview } from "@/lib/types";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

const DEFAULT_REVIEW: WorkoutReview = { effort: 5, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "" };

/** Home: shown while today's workout is running — Continue, Finish (rate it), or End (save what was done, or discard). */
export function SessionLiveCard() {
  const router = useRouter();
  const { state, currentDate, upsertSession } = useFitTrack();
  const session = sessionForDate(state, currentDate);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  if (!session || session.status !== "in_progress") return null;

  const planned = session.exerciseLogs.reduce((sum, log) => sum + Math.max(log.plannedSets, log.sets.length), 0);
  const done = session.exerciseLogs.reduce((sum, log) => sum + log.sets.filter((set) => set.completed).length, 0);
  const started = workoutStartedAt(currentDate);
  const minutes = started ? Math.max(0, Math.round((now - started) / 60_000)) : null;
  const share = planned ? Math.min(1, done / planned) : 0;

  async function saveWhatIDid() {
    if (!session) return;
    setBusy(true);
    const saved = await upsertSession({ ...session, status: "completed", review: session.review ?? DEFAULT_REVIEW, completedAt: new Date().toISOString() });
    setBusy(false);
    if (saved) { void clearWorkoutNotification(currentDate); router.push("/today"); }
  }

  async function discard() {
    if (!session) return;
    setBusy(true);
    // Back to "not started": starting again builds fresh logs.
    const saved = await upsertSession({ ...session, status: "planned", exerciseLogs: [], review: undefined, completedAt: undefined });
    setBusy(false);
    if (saved) { void clearWorkoutNotification(currentDate); setEnding(false); }
  }

  return (
    <article className="live-card" aria-label="Workout in progress">
      <div className="live-top">
        <Rozi mood="workout" size={72} className="live-rozi" />
        <div className="live-copy">
          <span className="live-tag"><span className="live-dot" aria-hidden="true" /> Workout in progress</span>
          <strong>{session.plan.title}</strong>
          <small>{done} of {planned} sets done{minutes !== null ? <> · <Timer aria-hidden="true" /> {minutes} min</> : null}</small>
        </div>
      </div>
      <div className="live-meter" role="progressbar" aria-label="Sets done" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}><span style={{ width: `${Math.round(share * 100)}%` }} /></div>
      {ending ? (
        <div className="live-end">
          <p>End this workout now?</p>
          <button type="button" className="button button-primary" disabled={busy || done === 0} onClick={() => void saveWhatIDid()}><Check aria-hidden="true" /> Save what I did</button>
          <button type="button" className="button button-danger" disabled={busy} onClick={() => void discard()}>Discard workout</button>
          <button type="button" className="text-button" onClick={() => setEnding(false)}>Keep going</button>
          {done === 0 && <small>No sets ticked yet, so there is nothing to save.</small>}
        </div>
      ) : (
        <div className="live-actions">
          <button type="button" className="button button-primary" onClick={() => router.push("/today")}>Continue <ArrowRight aria-hidden="true" /></button>
          <button type="button" className="button button-subtle" onClick={() => router.push("/today?step=review")}><Check aria-hidden="true" /> Finish</button>
          <button type="button" className="button button-subtle live-stop" onClick={() => setEnding(true)}><Square aria-hidden="true" /> End</button>
        </div>
      )}
    </article>
  );
}
