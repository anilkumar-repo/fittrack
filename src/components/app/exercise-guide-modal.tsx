"use client";

import { useScrollLock } from "./use-scroll-lock";
import { exerciseEquipmentIsAvailable, getExerciseReferenceInstructions, getSafeExerciseAlternatives, isDeadliftVariation } from "@/lib/exercise-library";
import { deadliftAllowedForPlan } from "@/lib/planner";
import { getExerciseDefinition } from "@/lib/templates";
import type { ExerciseDefinition, WorkoutPlan, WorkoutSession } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import { Clock, Dumbbell, Play, Repeat, ShieldCheck, X } from "lucide-react";
import { getDemoVideoLink } from "@/lib/exercise-media";
import { REGION_LABELS, regionsForExercises } from "@/lib/figure";
import { TurnableFigure } from "./turnable-figure";
import { ExerciseLeaderboard } from "./exercise-leaderboard";
import { MuscleThumb } from "./muscle-thumb";
import { useFitTrack } from "./fit-track-provider";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { useExerciseSwap } from "./swap-sheet";
import { ExerciseStats } from "./exercise-stats";

/** The library guide for an exercise, keeping the sets, reps, and reasons from the plan it was opened from. */
export function toGuideExercise(exercise: ExerciseDefinition): ExerciseDefinition {
  const reference = getExerciseDefinition(exercise.id);
  return reference ? {
    ...reference,
    sets: exercise.sets,
    reps: exercise.reps,
    restSeconds: exercise.restSeconds,
    substitutedFor: exercise.substitutedFor,
    manualOverride: exercise.manualOverride,
    selectionReason: exercise.selectionReason,
    progressionAdvice: exercise.progressionAdvice,
    loadGuidance: exercise.loadGuidance,
    progressionAction: exercise.progressionAction,
  } : exercise;
}

interface ExerciseGuideModalProps {
  exercise: ExerciseDefinition;
  /** The workout this guide was opened beside, so a safe alternative can be saved into a planned session. */
  workout?: { date: string; session: WorkoutSession | undefined; plan: WorkoutPlan | null };
  onOpen: (exercise: ExerciseDefinition) => void;
  onClose: () => void;
}

export function ExerciseGuideModal({ exercise, workout, onOpen, onClose }: ExerciseGuideModalProps) {
  const { state, figure } = useFitTrack();
  useScrollLock();
  const todaySession = workout?.session;
  const plan = workout?.plan ?? null;
  const restricted = isDeadliftVariation(exercise) && !deadliftAllowedForPlan(state.profile);
  const inPlannedSession = Boolean(todaySession?.status === "planned" && plan?.exercises.some((item) => item.id === exercise.id));
  const inCurrentWorkout = Boolean(todaySession && todaySession.plan.exercises.some((item) => item.id === exercise.id));
  const exercisesForAlternatives = inCurrentWorkout
    ? todaySession?.status === "planned" ? plan?.exercises ?? [] : todaySession?.plan.exercises ?? []
    : [];
  const alternatives = !restricted
    ? getSafeExerciseAlternatives(exercise, state.profile, exercisesForAlternatives.filter((item) => item.id !== exercise.id))
    : [];
  const instructions = getExerciseReferenceInstructions(exercise);
  const demoVideo = getDemoVideoLink(exercise);

  const swapExercise = useExerciseSwap(workout?.date ?? "");
  function applyAlternative(alternativeId: string) {
    if (!workout || !plan) return;
    const alternative = alternatives.find((item) => item.id === alternativeId);
    if (swapExercise(exercise.id, alternativeId, plan, alternative ? `${alternative.name} was selected as an equipment-checked alternative to ${exercise.name}.` : undefined)) onClose();
  }

  const ready = exerciseEquipmentIsAvailable(exercise, state.profile);
  const regions = regionsForExercises([exercise]);
  const [shownRegion, setShownRegion] = useState(regions[0]);
  const [tab, setTab] = useState<"about" | "how" | "history" | "charts" | "records" | "friends">("about");

  // Closing plays the sheet's exit (slide down, backdrop fades) before the guide unmounts. Swiping down on the grip
  // already animates itself, so it still calls onClose directly.
  const [closing, setClosing] = useState(false);
  // The video button is a "▶ Watch video" pill while the sheet is at the top and a round play button once you scroll.
  const [scrolled, setScrolled] = useState(false);
  const close = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onClose(); return; }
    setClosing(true);
    window.setTimeout(onClose, 280);
  }, [onClose]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className={`modal-backdrop guide-backdrop ${closing ? "is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className={`exercise-modal guide ${scrolled ? "is-scrolled" : ""}`} role="dialog" aria-modal="true" aria-labelledby="exercise-modal-title" onScroll={(event) => { const next = event.currentTarget.scrollTop > 40; if (next !== scrolled) setScrolled(next); }}>
        <SheetGrip onClose={onClose} />
        {/* Pinned to the top of the sheet, so it stays in reach while the guide scrolls. */}
        <div className="guide-close-pin"><button type="button" className="guide-close" aria-label="Close guide" onClick={close}><X aria-hidden="true" /></button></div>
        <div className="guide-head">
          <div><p className="guide-kicker">{exercise.category === "core" ? "Core" : exercise.category === "conditioning" ? "Conditioning" : "Strength"} · {exercise.difficulty}</p><h2 id="exercise-modal-title">{exercise.name}</h2></div>
        </div>
        <div className="chip-row">
          <span className="chip"><Repeat aria-hidden="true" /> {exercise.sets} × {exercise.reps}</span>
          <span className="chip"><Clock aria-hidden="true" /> {exercise.restSeconds ? `${exercise.restSeconds} sec rest` : "No timed rest"}</span>
          <span className={`chip ${ready ? "chip-ok" : "chip-warn"}`}><Dumbbell aria-hidden="true" /> {exercise.equipment}</span>
        </div>
        {!ready && !restricted && <p className="guide-note warn">This needs equipment that is not ticked in your Settings. Confirm you have it before using this movement.</p>}

        {!restricted && <div className="segmented guide-tabs" role="tablist" aria-label="Exercise details">
          {([["about", "About"], ["how", "How to"], ["history", "History"], ["charts", "Charts"], ["records", "Records"], ["friends", "Friends"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "selected" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>}

        {!restricted && (tab === "history" || tab === "charts" || tab === "records") && <ExerciseStats exerciseId={exercise.id} view={tab} />}
        {!restricted && tab === "friends" && <ExerciseLeaderboard exerciseId={exercise.id} />}

        {!restricted && tab === "how" && <>
          <ol className="guide-steps big">{instructions.map((instruction, index) => <li key={`${index}-${instruction}`}><span>{index + 1}</span><p>{instruction}</p></li>)}</ol>
          {exercise.cues.length > 0 && <div className="guide-cues"><strong>Keep in mind</strong><ul>{exercise.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul></div>}
        </>}

        {restricted ? <div className="locked-note">This movement is restricted until your trainer approves it, so its instructions are not shown.</div> : tab === "about" && <>
          <div className="guide-body">
            <TurnableFigure key={`${figure}-${shownRegion ?? "base"}`} figure={figure} region={shownRegion} />
            <div className="guide-works">
              <small>Works</small>
              <strong>{exercise.targetMuscles.join(" · ")}</strong>
              {regions.length > 1 && <div className="guide-regions" role="group" aria-label="Show muscle group">{regions.map((region) => (
                <button key={region} type="button" className={shownRegion === region ? "selected" : ""} aria-pressed={shownRegion === region} onClick={() => setShownRegion(region)}>{REGION_LABELS[region]}</button>
              ))}</div>}
            </div>
          </div>

          <div className="guide-video">
            <small>{demoVideo.curated ? "The ▶ video button opens the video your trainer chose, in a new tab." : "The ▶ video button opens a YouTube search in a new tab. Those videos aren’t reviewed by your trainer; the steps below come first."}</small>
          </div>

          {exercise.selectionReason && <p className="guide-note">{exercise.selectionReason}</p>}

          <h3>How to do it</h3>
          <ol className="guide-steps">{instructions.map((instruction, index) => <li key={`${index}-${instruction}`}><span>{index + 1}</span><p>{instruction}</p></li>)}</ol>

          {exercise.cautionNotes.length > 0 && <div className="guide-caution"><strong><ShieldCheck aria-hidden="true" /> Comfort and safety</strong><ul>{exercise.cautionNotes.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>}

          {alternatives.length > 0 && <>
            <h3>Other options</h3>
            <p className="guide-sub">Movements that fit your equipment and work the same area.</p>
            <div className="guide-alternatives">{alternatives.map((alternative) => (
              <article key={alternative.id} className="guide-alternative">
                <span className="exercise-thumb"><MuscleThumb exercise={alternative} /></span>
                <div><strong>{alternative.name}</strong><small>{alternative.equipment} · {alternative.sets} × {alternative.reps}</small></div>
                {inPlannedSession
                  ? <button type="button" className="button button-subtle" onClick={() => applyAlternative(alternative.id)}>Use instead</button>
                  : <button type="button" className="button button-subtle" onClick={() => onOpen(alternative)}>View</button>}
              </article>
            ))}</div>
          </>}
          {inCurrentWorkout && todaySession?.status === "in_progress" && <p className="guide-sub">This workout has started, so the plan stays as it is. If you swap a movement, note it under “Notes, form, and why this exercise”.</p>}
        </>}
        <button className="button button-primary guide-done" onClick={close}>Close</button>
        {!restricted && <div className="guide-video-fab">
          <a className="button button-primary" href={demoVideo.url} target="_blank" rel="noopener noreferrer" aria-label={`Watch a video of ${exercise.name}`}>
            <Play aria-hidden="true" /><span>Watch video</span>
          </a>
        </div>}
      </section>
    </div>
  );
}
