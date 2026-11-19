"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { formatCountdown } from "@/lib/logging";
import { haptic } from "@/lib/haptics";

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

const SIZE_KEY = "rozfit-rest-size";

/**
 * Rest between sets: a bar that sits just above the dock — nothing to drag. Full size shows the time with a ring,
 * the exercise, and −10 s / +10 s / Skip; tap the time (or the arrow) to shrink it to a small pill, and tap the pill
 * to bring it back. The size is remembered on this device. It only advises; logging is never blocked. A haptic tick
 * on every button, and a stronger one when the rest is over.
 */
export function RestTimer({ endsAt, totalSeconds, exerciseName, onAdjust, onDismiss }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const [small, setSmall] = useState(false);

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
    const timer = window.setTimeout(() => { try { setSmall(window.localStorage.getItem(SIZE_KEY) === "small"); } catch { /* full by default */ } }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!finished) return;
    haptic("strong");
    const close = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(close);
  }, [finished, onDismiss]);

  function resize(next: boolean) {
    haptic();
    setSmall(next);
    try { window.localStorage.setItem(SIZE_KEY, next ? "small" : "full"); } catch { /* remembered for this visit */ }
  }
  const press = (action: () => void) => () => { haptic(); action(); };

  const time = finished ? "Go!" : formatCountdown(remaining);
  const ring = (
    <span className="rest-bar-ring" aria-hidden="true">
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={r} className="rest-ring-track" /><circle cx="50" cy="50" r={r} className="rest-ring-value" strokeDasharray={`${share * length} ${length}`} transform="rotate(-90 50 50)" /></svg>
    </span>
  );
  const label = finished ? "Rest finished" : `Rest, ${formatCountdown(remaining)} left`;

  if (small) {
    return (
      <div className={`rest-bar small ${finished ? "finished" : ""}`} role="timer" aria-live="off" aria-label={label}>
        <button type="button" className="rest-bar-main" onClick={() => resize(false)} aria-label={`${label}. Show the rest controls`}>{ring}<strong>{time}</strong></button>
        <button type="button" className="rest-bar-skip" onClick={press(onDismiss)} aria-label={finished ? "Close" : "Skip rest"}><X aria-hidden="true" /></button>
      </div>
    );
  }
  return (
    <div className={`rest-bar ${finished ? "finished" : ""}`} role="timer" aria-live="off" aria-label={label}>
      <button type="button" className="rest-bar-main" onClick={() => resize(true)} aria-label={`${label}. Make the timer smaller`}>
        {ring}
        <span className="rest-bar-text"><strong>{time}</strong><small>{finished ? "Start your next set" : exerciseName}</small></span>
        <ChevronDown aria-hidden="true" className="rest-bar-shrink" />
      </button>
      <div className="rest-bar-actions">
        {!finished && <button type="button" onClick={press(() => onAdjust(-10))} disabled={remaining <= 10} aria-label="10 seconds less">−10</button>}
        {!finished && <button type="button" onClick={press(() => onAdjust(10))} aria-label="10 seconds more">+10</button>}
        <button type="button" className="rest-bar-skip" onClick={press(onDismiss)}>{finished ? "Close" : "Skip"}</button>
      </div>
    </div>
  );
}
