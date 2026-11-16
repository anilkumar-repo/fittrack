"use client";

import { useScrollLock } from "./use-scroll-lock";
import { exerciseEquipmentIsAvailable, getExerciseReferenceInstructions, getSafeExerciseAlternatives, isDeadliftVariation } from "@/lib/exercise-library";
import { deadliftAllowedForPlan, preserveOriginalPlan } from "@/lib/planner";
import { getExerciseDefinition } from "@/lib/templates";
import { DEFAULT_TRAINER_RULE_SETTINGS, profileWithTrainerEquipment } from "@/lib/trainer-rules";
import type { ExerciseDefinition, WorkoutPlan, WorkoutSession } from "@/lib/types";
import { useEffect, useState } from "react";
import { Clock, Dumbbell, Play, Repeat, ShieldCheck, X } from "lucide-react";
import { getDemoVideoLink } from "@/lib/exercise-media";
import { REGION_LABELS, regionsForExercises } from "@/lib/figure";
import { TurnableFigure } from "./turnable-figure";
import { MuscleThumb } from "./muscle-thumb";
import { sessionForDate, useFitTrack } from "./fit-track-provider";

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
  const { state, getState, upsertSession, setNotice, figure } = useFitTrack();
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

  function applyAlternative(alternativeId: string) {
    if (!workout || !plan) return;
    const currentState = getState();
    const activeSession = sessionForDate(currentState, workout.date);
    if (!activeSession || activeSession.status !== "planned") return;
    const source = plan.exercises.find((item) => item.id === exercise.id);
    if (!source) return;
    const effectiveProfile = profileWithTrainerEquipment(currentState.profile, currentState.trainerRuleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS);
    const alternative = getSafeExerciseAlternatives(source, effectiveProfile, plan.exercises.filter((item) => item.id !== source.id))
      .find((item) => item.id === alternativeId);
    if (!alternative) {
      setNotice("That alternative is not available with the current equipment or session rules.");
      return;
    }

    const basePlan = preserveOriginalPlan(plan, activeSession.plan);
    const reason = `${alternative.name} was selected as an equipment-checked alternative to ${source.name}.`;
    const replacement: ExerciseDefinition = {
      ...alternative,
      sets: source.sets,
      reps: source.reps,
      restSeconds: source.restSeconds,
      substitutedFor: source.substitutedFor ?? source.id,
      manualOverride: true,
      selectionReason: reason,
    };
    const updatedPlan = {
      ...basePlan,
      exercises: basePlan.exercises.map((item) => item.id === source.id ? replacement : item),
      generationReasons: [...basePlan.generationReasons, reason],
    };
    void upsertSession({ ...activeSession, plan: updatedPlan });
    onClose();
    setNotice(`${alternative.name} is saved in this workout. The original template remains in its history.`);
  }

  const ready = exerciseEquipmentIsAvailable(exercise, state.profile);
  const regions = regionsForExercises([exercise]);
  const [shownRegion, setShownRegion] = useState(regions[0]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="exercise-modal guide" role="dialog" aria-modal="true" aria-labelledby="exercise-modal-title">
        <div className="guide-head">
          <div><p className="guide-kicker">{exercise.category === "core" ? "Core" : exercise.category === "conditioning" ? "Conditioning" : "Strength"} · {exercise.difficulty}</p><h2 id="exercise-modal-title">{exercise.name}</h2></div>
          <button className="guide-close" aria-label="Close guide" onClick={() => onClose()}><X aria-hidden="true" /></button>
        </div>
        <div className="chip-row">
          <span className="chip"><Repeat aria-hidden="true" /> {exercise.sets} × {exercise.reps}</span>
          <span className="chip"><Clock aria-hidden="true" /> {exercise.restSeconds ? `${exercise.restSeconds} sec rest` : "No timed rest"}</span>
          <span className={`chip ${ready ? "chip-ok" : "chip-warn"}`}><Dumbbell aria-hidden="true" /> {exercise.equipment}</span>
        </div>
        {!ready && !restricted && <p className="guide-note warn">This needs equipment that is not ticked in your Settings. Confirm you have it before using this movement.</p>}

        {restricted ? <div className="locked-note">This movement is restricted until your trainer approves it, so its instructions are not shown.</div> : <>
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
            <a className="button button-subtle" href={demoVideo.url} target="_blank" rel="noopener noreferrer"><Play aria-hidden="true" /> Watch a demonstration</a>
            <small>{demoVideo.curated ? "Opens the video your trainer chose, in a new tab." : "Opens a YouTube search in a new tab. These videos are not reviewed by your trainer; the steps below come first."}</small>
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
        <button className="button button-primary guide-done" onClick={() => onClose()}>Close</button>
      </section>
    </div>
  );
}
