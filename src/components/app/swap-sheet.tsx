"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Search } from "lucide-react";
import { canUseExercise, swapBlock, swapChoices, swapInSession, SWAP_BLOCK_TEXT } from "@/lib/exercise-swap";
import { getExerciseDefinition } from "@/lib/templates";
import type { ExerciseDefinition, WorkoutPlan } from "@/lib/types";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { MuscleThumb } from "./muscle-thumb";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { useScrollLock } from "./use-scroll-lock";

/**
 * Applies a swap to the workout on `date` (used by the Swap sheet, the exercise guide and Rozi's swap card).
 * `plan` is the plan shown for a workout that hasn't started (it can be newer than the saved one).
 * Returns true when the swap was saved.
 */
export function useExerciseSwap(date: string) {
  const { getState, planningProfile, upsertSession, setNotice } = useFitTrack();
  return (sourceId: string, replacementId: string, plan?: WorkoutPlan | null, reason?: string): boolean => {
    const session = sessionForDate(getState(), date);
    const replacement = getExerciseDefinition(replacementId);
    if (!session || !replacement) { setNotice("This workout isn't ready yet — try again in a moment."); return false; }
    const shownPlan = session.status === "planned" ? plan ?? session.plan : session.plan;
    const blocked = swapBlock(session, shownPlan, sourceId);
    if (blocked) { setNotice(SWAP_BLOCK_TEXT[blocked]); return false; }
    if (!canUseExercise(replacement, planningProfile)) { setNotice(`${replacement.name} needs equipment or a trainer approval you don't have set.`); return false; }
    const next = swapInSession(session, shownPlan, sourceId, replacement, reason);
    if (next === session) { setNotice(`${replacement.name} is already in this workout.`); return false; }
    void upsertSession(next);
    const from = shownPlan.exercises.find((exercise) => exercise.id === sourceId)?.name ?? "it";
    setNotice(`Swapped: ${replacement.name} instead of ${from}.`);
    return true;
  };
}

/** "Swap exercise": close matches first, then search the whole library. Only exercises this person can do are shown. */
export function SwapSheet({ exercise, workoutExercises, onPick, onClose }: {
  exercise: ExerciseDefinition; workoutExercises: ExerciseDefinition[]; onPick: (replacement: ExerciseDefinition) => void; onClose: () => void;
}) {
  useScrollLock();
  const { planningProfile } = useFitTrack();
  const [query, setQuery] = useState("");
  const choices = useMemo(() => swapChoices(exercise, planningProfile, workoutExercises, query), [exercise, planningProfile, workoutExercises, query]);
  const row = (item: ExerciseDefinition) => (
    <li key={item.id}>
      <button type="button" className="swap-row" onClick={() => onPick(item)}>
        <span className="exercise-thumb"><MuscleThumb exercise={item} /></span>
        <span className="swap-row-text"><strong>{item.name}</strong><small>{item.equipment} · {item.targetMuscles.slice(0, 2).join(", ")}</small></span>
        <span className="swap-row-use">Use</span>
      </button>
    </li>
  );

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Swap ${exercise.name}`} onClick={onClose}>
      <section className="modal swap-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <span className="onb-kicker"><ArrowLeftRight aria-hidden="true" /> Swap exercise</span>
        <h2>Instead of {exercise.name}</h2>
        <p className="card-note">Keeps {exercise.sets} × {exercise.reps}. Your plan remembers the original.</p>
        <label className="swap-search"><Search aria-hidden="true" /><input type="search" value={query} placeholder="Search any exercise" aria-label="Search exercises" onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="swap-lists">
          {choices.suggested.length > 0 && <><h3 className="train-subhead">Closest matches</h3><ul className="swap-list">{choices.suggested.map(row)}</ul></>}
          <h3 className="train-subhead">{query.trim() ? "Results" : "Any other exercise"}</h3>
          {choices.others.length ? <ul className="swap-list">{choices.others.slice(0, 60).map(row)}</ul> : <p className="card-note">No exercise matches “{query}”.</p>}
          {choices.needsEquipment > 0 && <p className="card-note">{choices.needsEquipment} more need equipment you haven&apos;t set — add it in Settings → Your plan.</p>}
        </div>
      </section>
    </div>,
    document.body,
  );
}
