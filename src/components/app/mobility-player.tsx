"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Check, ChevronLeft, Pause, Play, SkipForward, Video, X } from "lucide-react";
import { markRoutineDone, moveVideo, routineMinutes, routineSteps, sideSeconds, stretchPicture, type MobilityRoutine } from "@/lib/mobility";
import { Rozi } from "./rozi";

const GET_READY = 5;

/**
 * Guided routine: one move at a time with a big picture. Holds and breathing count down by themselves
 * (with 5 s to get into position first); reps wait for "Done". One-sided moves play left, then right.
 */
export function MobilityPlayer({ routine, date, onClose }: { routine: MobilityRoutine; date: string; onClose: (finished: boolean) => void }) {
  const steps = useMemo(() => routineSteps(routine), [routine]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"ready" | "go">("ready");
  const [left, setLeft] = useState(GET_READY);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const endsAt = useRef(0);
  const remainingWhenPaused = useRef(0);
  const step = steps[index];
  const timed = step && step.move.kind !== "reps";

  const startPhase = useCallback((next: "ready" | "go", seconds: number) => {
    setPhase(next);
    setLeft(seconds);
    endsAt.current = Date.now() + seconds * 1000;
  }, []);

  const goTo = useCallback((next: number) => {
    if (next >= steps.length) { setFinished(true); markRoutineDone(routine.id, date); return; }
    setIndex(Math.max(0, next));
    setPaused(false);
    startPhase("ready", GET_READY);
  }, [steps.length, routine.id, date, startPhase]);

  // The first "get ready" countdown starts when the player opens.
  useEffect(() => { endsAt.current = Date.now() + GET_READY * 1000; }, []);

  // One clock: counts the "get ready" seconds, then the hold; reps stop after "get ready".
  useEffect(() => {
    if (finished || paused || !step) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setLeft(seconds);
      if (seconds > 0) return;
      if (phase === "ready") startPhase("go", timed ? sideSeconds(step.move) : 0);
      else if (timed) goTo(index + 1);
    }, 250);
    return () => window.clearInterval(timer);
  }, [finished, paused, step, phase, timed, index, goTo, startPhase]);

  function togglePause() {
    if (paused) { endsAt.current = Date.now() + remainingWhenPaused.current; setPaused(false); }
    else { remainingWhenPaused.current = Math.max(0, endsAt.current - Date.now()); setPaused(true); }
  }

  if (typeof document === "undefined") return null;
  const total = timed && phase === "go" ? sideSeconds(step.move) : GET_READY;
  const ring = 2 * Math.PI * 52;
  const share = phase === "go" && !timed ? 1 : left / total;
  const breathing = step?.move.kind === "breaths" && phase === "go";
  const breathIn = breathing && Math.floor((sideSeconds(step.move) - left) / 4) % 2 === 0;

  return createPortal(
    <div className="player-backdrop" role="dialog" aria-modal="true" aria-label={routine.title}>
      <section className="player-card">
        <header className="player-top">
          <button type="button" className="icon-button" aria-label="Close" onClick={() => onClose(finished)}><X aria-hidden="true" /></button>
          <div className="player-bars" aria-hidden="true">{steps.map((item, i) => <span key={i} className={i < index || finished ? "done" : i === index ? "now" : ""} />)}</div>
          <span className="player-count">{finished ? steps.length : index + 1}/{steps.length}</span>
        </header>

        {finished ? (
          <div className="player-done">
            <Rozi mood="trophy" size={150} eager />
            <h2>{routine.title} done!</h2>
            <p>{routineMinutes(routine)} minutes of good work. Your body says thank you.</p>
            <button type="button" className="button button-primary full-width" onClick={() => onClose(true)}><Check aria-hidden="true" /> Done</button>
          </div>
        ) : step && <>
          <div className="player-picture">
            <Image src={stretchPicture(step.move.id)} alt={step.move.name} width={840} height={420} priority sizes="(max-width: 700px) 100vw, 640px" />
            {step.side && <span className="player-side">{step.side === "left" ? "Left side" : "Right side"}</span>}
          </div>
          <div className="player-info">
            <h2>{step.move.name}</h2>
            <p>{step.move.how}</p>
            <small>{step.move.works}</small>
            {/* Opening a video pauses the timer, so the move isn't missed. */}
            <a className="text-button player-video" href={moveVideo(step.move).url} target="_blank" rel="noopener noreferrer" onClick={() => { if (!paused) togglePause(); }}><Video aria-hidden="true" /> Watch a video</a>
          </div>
          <div className="player-clock">
            {phase === "ready" ? (
              <div className="player-ring ready"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="track" /><circle cx="60" cy="60" r="52" className="value" strokeDasharray={`${share * ring} ${ring}`} transform="rotate(-90 60 60)" /></svg><span><strong>{left}</strong><small>Get ready</small></span></div>
            ) : timed ? (
              <div className={`player-ring ${breathing ? (breathIn ? "breathe-in" : "breathe-out") : ""}`}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" className="track" /><circle cx="60" cy="60" r="52" className="value" strokeDasharray={`${share * ring} ${ring}`} transform="rotate(-90 60 60)" /></svg><span><strong>{breathing ? (breathIn ? "In" : "Out") : left}</strong><small>{breathing ? `${left} s left` : "seconds"}</small></span></div>
            ) : (
              <button type="button" className="player-reps" onClick={() => goTo(index + 1)}><strong>{step.move.amount}</strong><small>reps — tap when done</small></button>
            )}
          </div>
          <div className="player-controls">
            <button type="button" className="icon-button" aria-label="Previous move" disabled={index === 0} onClick={() => goTo(index - 1)}><ChevronLeft aria-hidden="true" /></button>
            <button type="button" className="button button-primary player-pause" onClick={togglePause}>{paused ? <><Play aria-hidden="true" /> Resume</> : <><Pause aria-hidden="true" /> Pause</>}</button>
            <button type="button" className="icon-button" aria-label="Skip" onClick={() => goTo(index + 1)}><SkipForward aria-hidden="true" /></button>
          </div>
        </>}
      </section>
    </div>,
    document.body,
  );
}
