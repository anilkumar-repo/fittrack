"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Flame } from "lucide-react";
import { buildStreakTimeline, weekStrip } from "@/lib/streak";
import type { RoziMood } from "@/lib/rozi";
import type { WorkoutSession } from "@/lib/types";
import { useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";
import { WeekCheck } from "./streak-day";

const SEEN_PREFIX = "rozfit-celebrated-";
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Pops up once after a workout is finished: Rozi, the streak counting up, this week's checks and the
 * workout's numbers. A workout that repairs a broken streak gets its own message.
 */
export function WorkoutCelebration({ session, setsDone, roziMood }: { session: WorkoutSession; setsDone: number; roziMood: RoziMood }) {
  const { state, recordedSessions } = useFitTrack();
  const key = `${SEEN_PREFIX}${session.date}`;
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(0);
  const timeline = useMemo(() => buildStreakTimeline(state.profile, recordedSessions, session.date), [state.profile, recordedSessions, session.date]);
  const streak = timeline.current;
  const repaired = timeline.repairedOn.includes(session.date);

  useEffect(() => {
    let seen = true;
    try { seen = window.localStorage.getItem(key) === "1"; } catch { /* show it */ seen = false; }
    if (seen) return;
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, [key]);

  // Count the streak up from where it was, so the new workout visibly adds one.
  useEffect(() => {
    if (!open) return;
    const from = Math.max(0, streak - 1);
    let value = from;
    const tick = window.setInterval(() => {
      value += 1;
      setShown(Math.min(value, streak));
      if (value >= streak) window.clearInterval(tick);
    }, 450);
    const start = window.setTimeout(() => setShown(from), 0);
    return () => { window.clearInterval(tick); window.clearTimeout(start); };
  }, [open, streak]);

  if (!open || typeof document === "undefined") return null;
  function close() {
    try { window.localStorage.setItem(key, "1"); } catch { /* may show again next time */ }
    setOpen(false);
  }

  const title = repaired ? "Streak repaired!" : streak <= 1 ? "A streak is born!" : streak % 10 === 0 ? `${streak} in a row — amazing!` : `${streak} in a row!`;
  const line = repaired
    ? `Your streak is back. ${timeline.repairsLeft} ${timeline.repairsLeft === 1 ? "repair" : "repairs"} left.`
    : streak <= 1 ? "Show up again on your next training day to help it grow." : "Rozi is proud of you. Keep it going!";
  const moves = session.exerciseLogs.filter((log) => log.status === "completed" || log.status === "partial").length;
  const week = weekStrip(timeline, session.date);

  return createPortal(
    <div className="celebrate-backdrop" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
      <section className="celebrate-card">
        <span className="celebrate-burst" aria-hidden="true" />
        <Rozi mood={repaired ? "cheer" : roziMood} size={150} eager className="celebrate-rozi" />
        <div className="celebrate-streak" aria-live="polite"><Flame aria-hidden="true" /><span>{shown}</span></div>
        <h2 id="celebrate-title">{title}</h2>
        <p>{line}</p>
        <div className="celebrate-week" aria-label="This week">
          {week.map((day, index) => <span key={day.date} className="celebrate-day"><small className={day.date === session.date ? "on" : ""}>{WEEKDAY_LETTERS[index]}</small><WeekCheck status={day.status} today={day.date === session.date} /></span>)}
        </div>
        <dl className="celebrate-stats">
          <div><dd>{moves}</dd><dt>moves</dt></div>
          <div><dd>{setsDone}</dd><dt>sets</dt></div>
          <div><dd>{session.plan.durationMinutes}</dd><dt>minutes</dt></div>
        </dl>
        <button type="button" className="button button-primary full-width" onClick={close}>Continue</button>
        <Link className="text-button" href="/streak" onClick={close}>See my streak calendar</Link>
      </section>
    </div>,
    document.body,
  );
}
