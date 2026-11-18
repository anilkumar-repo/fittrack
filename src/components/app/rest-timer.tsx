"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { formatCountdown } from "@/lib/logging";
import { clampTimerTop, readTimerPlace, snapSide, type TimerPlace, type TimerSize } from "@/lib/rest-timer-place";

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

const PLACE_KEY = "rozfit-rest-place";
const SIZE_KEY = "rozfit-rest-size";
const EDGE = 12;
/** About how tall each size is, to keep it on screen. */
const HEIGHT: Record<TimerSize, number> = { compact: 74, full: 126 };
/** Movement (px) before a press counts as a drag rather than a tap. */
const DRAG_SLOP = 6;

/**
 * Rest between sets, as a floating timer you can move and resize (like a picture-in-picture video):
 * - two sizes: a small round timer, or the full card with −10 s / +10 s / Skip. Tap the ring (or the corner button)
 *   to switch;
 * - drag it anywhere; let go and it settles against the nearest side. Size and place are remembered on this device.
 * It only advises; logging is never blocked. Vibrates when the rest is over.
 */
export function RestTimer({ endsAt, totalSeconds, exerciseName, onAdjust, onDismiss }: RestTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const [size, setSize] = useState<TimerSize>("compact");
  const [place, setPlace] = useState<TimerPlace | null>(null);
  const [dragging, setDragging] = useState<{ left: number; top: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; left: number; top: number; moved: boolean; onRing: boolean } | null>(null);

  const remaining = (endsAt - now) / 1000;
  const finished = remaining <= 0;
  const share = Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds)));
  const r = 44;
  const length = 2 * Math.PI * r;

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, []);

  // Remembered size and place (this device only).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(SIZE_KEY) === "full") setSize("full");
        setPlace(readTimerPlace(window.localStorage.getItem(PLACE_KEY)));
      } catch { /* defaults */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!finished) return;
    try { navigator.vibrate?.([120, 80, 120]); } catch { /* Vibration is optional. */ }
    const close = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(close);
  }, [finished, onDismiss]);

  // Keep it on screen when the size changes or the phone rotates.
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const toggleSize = useCallback(() => {
    setSize((current) => {
      const next = current === "full" ? "compact" : "full";
      try { window.localStorage.setItem(SIZE_KEY, next); } catch { /* remembered for this visit */ }
      return next;
    });
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    press.current = { x: event.clientX, y: event.clientY, left: box.left, top: box.top, moved: false, onRing: Boolean((event.target as HTMLElement).closest(".rest-ring")) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = press.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    start.moved = true;
    const box = root.current?.getBoundingClientRect();
    const w = box?.width ?? 0;
    const h = box?.height ?? 0;
    setDragging({
      left: Math.min(Math.max(EDGE, start.left + dx), window.innerWidth - w - EDGE),
      top: Math.min(Math.max(EDGE, start.top + dy), window.innerHeight - h - EDGE),
    });
  }

  function onPointerUp() {
    const start = press.current;
    press.current = null;
    if (!start) return;
    if (!start.moved) {
      if (start.onRing) toggleSize();
      return;
    }
    const box = root.current?.getBoundingClientRect();
    if (box) {
      const next: TimerPlace = { side: snapSide(box.left, box.width, window.innerWidth), top: Math.round(box.top) };
      setPlace(next);
      try { window.localStorage.setItem(PLACE_KEY, JSON.stringify(next)); } catch { /* remembered for this visit */ }
    }
    setDragging(null);
  }

  // Where it sits: while dragging it follows the finger; otherwise against its side, kept on screen.
  let style: React.CSSProperties | undefined;
  if (dragging) style = { left: dragging.left, top: dragging.top, right: "auto", bottom: "auto" };
  else if (place && viewport.h) {
    const top = clampTimerTop(place.top, HEIGHT[size], viewport.h, EDGE);
    style = place.side === "left" ? { left: EDGE, right: "auto", top, bottom: "auto" } : { right: EDGE, left: "auto", top, bottom: "auto" };
  }

  const label = finished ? "Rest finished" : `Rest, ${formatCountdown(remaining)} left`;
  return (
    <div ref={root} className={`rest-float ${size} ${finished ? "finished" : ""} ${dragging ? "dragging" : ""}`} style={style}
      role="timer" aria-live="off" aria-label={label}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="rest-ring" title={size === "full" ? "Tap to make smaller · drag to move" : "Tap to make bigger · drag to move"}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="rest-ring-track" />
          <circle cx="50" cy="50" r={r} className="rest-ring-value" strokeDasharray={`${share * length} ${length}`} transform="rotate(-90 50 50)" />
        </svg>
        <span><strong>{finished ? "Go!" : formatCountdown(remaining)}</strong>{size === "full" && <small>{finished ? "next set" : formatCountdown(totalSeconds)}</small>}</span>
      </div>

      {size === "full" ? <div className="rest-ring-text">
        <strong>{finished ? "Ready when you are" : "Rest"}</strong>
        <small>{finished ? "Start your next set." : exerciseName}</small>
        <div className="rest-ring-actions">
          {!finished && <button type="button" onClick={() => onAdjust(-10)} disabled={remaining <= 10}>−10s</button>}
          {!finished && <button type="button" onClick={() => onAdjust(10)}>+10s</button>}
          <button type="button" className="rest-skip" onClick={onDismiss}>{finished ? "Close" : "Skip"}</button>
        </div>
      </div> : <div className="rest-mini-actions">
        {!finished && <button type="button" className="rest-mini-add" onClick={() => onAdjust(10)} aria-label="Add 10 seconds">+10</button>}
        <button type="button" className="rest-mini-skip" onClick={onDismiss} aria-label={finished ? "Close" : "Skip rest"}><X aria-hidden="true" /></button>
      </div>}

      <button type="button" className="rest-size" onClick={toggleSize} aria-label={size === "full" ? "Make the timer smaller" : "Make the timer bigger"}>
        {size === "full" ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      </button>
    </div>
  );
}
