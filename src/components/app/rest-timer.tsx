"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/logging";

interface RestTimerProps {
  /** When the rest ends, in milliseconds since the epoch. */
  endsAt: number;
  exerciseName: string;
  onAddTime: () => void;
  onDismiss: () => void;
}

/** A countdown bar shown after a set is ticked done. It only advises; logging is never blocked. */
export function RestTimer({ endsAt, exerciseName, onAddTime, onDismiss }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = (endsAt - now) / 1000;
  const finished = remaining <= 0;

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!finished) return;
    try { navigator.vibrate?.(200); } catch { /* Vibration is optional. */ }
    const close = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(close);
  }, [finished, onDismiss]);

  return (
    <div className={`rest-timer ${finished ? "finished" : ""}`} role="timer" aria-live="off" aria-label={finished ? "Rest finished" : `Rest, ${formatCountdown(remaining)} left`}>
      <div><strong>{finished ? "Ready when you are" : formatCountdown(remaining)}</strong><small>{finished ? "Rest is done. Start your next set." : `Rest · ${exerciseName}`}</small></div>
      <div className="rest-timer-actions">
        {!finished && <button type="button" onClick={onAddTime}>+15 sec</button>}
        <button type="button" onClick={onDismiss}>{finished ? "Close" : "Skip rest"}</button>
      </div>
    </div>
  );
}
