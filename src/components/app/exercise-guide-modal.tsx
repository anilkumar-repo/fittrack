"use client";

import { exerciseEquipmentIsAvailable, getExerciseReferenceInstructions, getSafeExerciseAlternatives, isDeadliftVariation } from "@/lib/exercise-library";
import { deadliftAllowedForPlan, preserveOriginalPlan } from "@/lib/planner";
import { getExerciseDefinition } from "@/lib/templates";
import { DEFAULT_TRAINER_RULE_SETTINGS, profileWithTrainerEquipment } from "@/lib/trainer-rules";
import type { ExerciseDefinition, WorkoutPlan, WorkoutSession } from "@/lib/types";
import { getDemoVideoLink, getExerciseIllustration } from "@/lib/exercise-media";
import { ExerciseIllustration } from "./exercise-illustration";
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
  const { state, getState, upsertSession, setNotice } = useFitTrack();
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
  const hasIllustration = Boolean(getExerciseIllustration(exercise.id));

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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="exercise-modal" role="dialog" aria-modal="true" aria-labelledby="exercise-modal-title"><button className="modal-close" aria-label="Close exercise details" onClick={() => onClose()}>×</button><span className="modal-kicker">EXERCISE LIBRARY · GUIDE</span><span className="modal-art">{exercise.category === "core" ? "◉" : exercise.category === "conditioning" ? "↗" : "✦"}</span><h2 id="exercise-modal-title">{exercise.name}</h2><p className="modal-subtitle">{exercise.equipment} · {exercise.sets} sets × {exercise.reps} · {exercise.restSeconds ? `${exercise.restSeconds} sec rest` : "No timed rest"}</p>
      {restricted ? <div className="locked-note">This movement is currently restricted by the trainer rule. It is hidden from library search and its instructions are unavailable unless an authorized trainer explicitly approves it.</div> : <>
        <div className="exercise-detail-grid"><div><small>Target muscles</small><strong>{exercise.targetMuscles.join(" · ")}</strong></div><div><small>Difficulty</small><strong>{exercise.difficulty[0].toUpperCase() + exercise.difficulty.slice(1)}</strong></div><div><small>Movement pattern</small><strong>{exercise.movementPattern?.replaceAll("_", " ") ?? "General movement"}</strong></div><div><small>Equipment</small><strong>{exercise.equipment}</strong><span className={exerciseEquipmentIsAvailable(exercise, state.profile) ? "equipment-ready ready" : "equipment-ready needs-check"}>{exerciseEquipmentIsAvailable(exercise, state.profile) ? "Available in your setup" : "Confirm equipment before using"}</span></div></div>
        {exercise.selectionReason && <p className="exercise-reason">{exercise.selectionReason}</p>}
        <ExerciseIllustration exerciseId={exercise.id} name={exercise.name} />
          {hasIllustration && <p className="illustration-note">Simple position guide drawn for FitTrack. Follow the written steps for detail.</p>}
          <div className="demo-video"><a className="button button-subtle" href={demoVideo.url} target="_blank" rel="noopener noreferrer">Watch a demonstration <span>↗</span></a><small>{demoVideo.curated ? "Opens the video your trainer chose, in a new tab." : "Opens a YouTube search for this exercise in a new tab. FitTrack has not reviewed those videos; your trainer’s guidance and the steps below come first."}</small></div>
          <h3>Step-by-step instructions</h3><ol className="instruction-list">{instructions.map((instruction, index) => <li key={`${index}-${instruction}`}><span>{index + 1}</span><p>{instruction}</p></li>)}</ol>
        {exercise.cautionNotes.length > 0 && <div className="exercise-cautions"><strong>Comfort and safety</strong><ul>{exercise.cautionNotes.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>}
        {alternatives.length > 0 && <div className="exercise-alternatives"><h3>Suitable alternatives</h3><p>Only equipment-free options or movements that match your confirmed equipment and the current restrictions are shown.</p>{alternatives.map((alternative) => <article key={alternative.id} className="alternative-choice"><div><strong>{alternative.name}</strong><small>{alternative.equipment} · {alternative.sets} sets × {alternative.reps}</small><p>{alternative.selectionReason}</p></div>{inPlannedSession ? <button type="button" className="button button-subtle" onClick={() => applyAlternative(alternative.id)}>Use in this workout</button> : <button type="button" className="text-button" onClick={() => onOpen(alternative)}>View guide</button>}</article>)}</div>}
        {inCurrentWorkout && todaySession?.status === "in_progress" && <p className="field-hint">This workout has started. Keep its saved exercise history; record any actual substitution in the workout logger.</p>}
      </>}
      <button className="button button-primary full-width" onClick={() => onClose()}>Close guide</button></section></div>
  );
}
