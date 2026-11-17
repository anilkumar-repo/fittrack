"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/logging";

interface RestTimerProps {
  /** When the rest ends, in milliseconds since the epoch. */
  endsAt: number;
  /** Full rest length in seconds, for the ring. */
  totalSeconds: number;
  exerciseName: string;
  /** Adds (or with a negative number, removes) seconds. */
  onAdjust: (seconds: number) => void;
  onDismiss: () => void;
}

/**
 * Rest between sets: a floating card with a ring that empties as the rest runs out (like the reference apps),
 * −10 s / +10 s and Skip. It only advises; logging is never blocked. Vibrates when the rest is over.
 */
export function RestTimer({ endsAt, totalSeconds, exerciseName, onAdjust, onDismiss }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = (endsAt - now) / 1000;
  const finished = remaining <= 0;
  const share = Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds)));
  const r = 44;
  const length = 2 * Math.PI * r;

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!finished) return;
    try { navigator.vibrate?.([120, 80, 120]); } catch { /* Vibration is optional. */ }
    const close = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(close);
  }, [finished, onDismiss]);

  return (
    <div className={`rest-timer rest-ring-card ${finished ? "finished" : ""}`} role="timer" aria-live="off" aria-label={finished ? "Rest finished" : `Rest, ${formatCountdown(remaining)} left`}>
      <div className="rest-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="rest-ring-track" />
          <circle cx="50" cy="50" r={r} className="rest-ring-value" strokeDasharray={`${share * length} ${length}`} transform="rotate(-90 50 50)" />
        </svg>
        <span><strong>{finished ? "Go!" : formatCountdown(remaining)}</strong><small>{finished ? "next set" : formatCountdown(totalSeconds)}</small></span>
      </div>
      <div className="rest-ring-text">
        <strong>{finished ? "Ready when you are" : "Rest"}</strong>
        <small>{finished ? "Start your next set." : exerciseName}</small>
        <div className="rest-ring-actions">
          {!finished && <button type="button" onClick={() => onAdjust(-10)} disabled={remaining <= 10}>−10s</button>}
          {!finished && <button type="button" onClick={() => onAdjust(10)}>+10s</button>}
          <button type="button" className="rest-skip" onClick={onDismiss}>{finished ? "Close" : "Skip"}</button>
        </div>
      </div>
    </div>
  );
}
