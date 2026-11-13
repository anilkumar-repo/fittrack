"use client";

import { shortDate } from "@/lib/dates";
import { MuscleThumb } from "./muscle-thumb";
import { describeLastPerformance, displayToKg, kgToDisplay, lastLoadKg, type LastPerformance, type WeightUnit } from "@/lib/logging";
import type { ExerciseDefinition, ExerciseLog } from "@/lib/types";
import { statusForSets } from "@/lib/workout-tracking";

interface ExerciseLogCardProps {
  exercise: ExerciseDefinition;
  index: number;
  log: ExerciseLog;
  /** Name of the template exercise this one replaced, if any. */
  substitutedForName?: string;
  last: LastPerformance | null;
  unit: WeightUnit;
  onUpdate: (updater: (log: ExerciseLog) => ExerciseLog) => void;
  onAddSet: () => void;
  onOpenGuide: () => void;
  /** Called when a set is ticked done, so the rest timer can start. */
  onSetCompleted: () => void;
}

type SetLog = ExerciseLog["sets"][number];

/** One exercise in the workout logger: what to do, what happened last time, and the sets to tick off. */
export function ExerciseLogCard({ exercise, index, log, substitutedForName, last, unit, onUpdate, onAddSet, onOpenGuide, onSetCompleted }: ExerciseLogCardProps) {
  const skipped = log.status === "skipped";
  const hintLoad = lastLoadKg(last);

  function updateSet(setIndex: number, change: (set: SetLog, current: ExerciseLog) => SetLog) {
    onUpdate((current) => ({ ...current, sets: current.sets.map((item, i) => i === setIndex ? change(item, current) : item) }));
  }

  return (
    <div className={`exercise-log-card ${log.status === "completed" ? "logged" : ""}`}>
      <div className="exercise-log-head">
        <span className="exercise-index">{String(index + 1).padStart(2, "0")}</span>
        <div className="exercise-title">
          <button className="plain-link" onClick={onOpenGuide}>{exercise.name}</button>
          <small>{exercise.equipment} · {log.plannedSets} planned sets × {log.plannedReps} reps</small>
          {substitutedForName && <small>Substituted for {substitutedForName}</small>}
        </div>
        <span className={`exercise-status ${log.status}`}>{log.status.replaceAll("_", " ")}</span>
      </div>
      <p className="last-time">{last
        ? <><strong>Last time</strong> ({shortDate(last.date)}): {describeLastPerformance(last, unit)}</>
        : <><strong>First time</strong> logging this movement. Start light and comfortable.</>}</p>
      <button type="button" className="exercise-visual" onClick={onOpenGuide} aria-label={`Open the guide for ${exercise.name}`}><span className="exercise-visual-thumb"><MuscleThumb exercise={exercise} /></span><span className="exercise-visual-text"><strong>How to do it</strong><small>{exercise.targetMuscles.join(" · ")}</small></span></button>
      {exercise.progressionAdvice && <div className="progression-note"><strong>{exercise.progressionAction === "consider_small_load_step" ? "Progression check" : exercise.progressionAction === "hold_load_add_reps" ? "Rep target" : "Load guidance"}</strong><p>{exercise.progressionAdvice} {exercise.loadGuidance}</p></div>}

      <div className="set-grid set-grid-phase2">
        <span>SET</span><span>PLAN</span><span>ACTUAL REPS</span><span>LOAD ({unit.toUpperCase()})</span><span>DONE</span>
        {log.sets.map((set, setIndex) => (
          <div className="set-row" key={setIndex}>
            <strong>{set.extra ? "＋" : String(setIndex + 1).padStart(2, "0")}</strong>
            <span className="planned-reps">{set.plannedReps ?? "Extra"}</span>
            <input aria-label={`${exercise.name} set ${setIndex + 1} actual reps`} type="number" inputMode="numeric" min="1" max="1000" value={set.actualReps ?? ""} disabled={skipped}
              onChange={(event) => updateSet(setIndex, (item) => ({ ...item, actualReps: event.target.value === "" ? null : Number(event.target.value), completed: event.target.value === "" ? false : item.completed }))} />
            <input aria-label={`${exercise.name} set ${setIndex + 1} load in ${unit === "lb" ? "pounds" : "kilograms"}`} type="number" inputMode="decimal" min="0" max={unit === "lb" ? 4400 : 2000} step="0.5"
              placeholder={hintLoad === null ? "—" : String(kgToDisplay(hintLoad, unit))} value={set.loadKg === null ? "" : kgToDisplay(set.loadKg, unit)} disabled={skipped}
              onChange={(event) => updateSet(setIndex, (item) => ({ ...item, loadKg: event.target.value === "" ? null : displayToKg(Number(event.target.value), unit) }))} />
            <input className="set-complete" type="checkbox" aria-label={`Mark ${exercise.name} set ${setIndex + 1} complete`} checked={set.completed} disabled={skipped}
              onChange={(event) => {
                const checked = event.target.checked;
                updateSet(setIndex, (item, current) => ({ ...item, completed: checked, actualReps: checked ? item.actualReps ?? item.plannedReps ?? current.plannedReps : item.actualReps }));
                if (checked) onSetCompleted();
              }} />
          </div>
        ))}
      </div>
      <button className="add-set" disabled={skipped} onClick={onAddSet}>＋ Add set</button>

      <details className="exercise-more">
        <summary>Notes, form, and why this exercise</summary>
        {exercise.selectionReason && <p className="exercise-reason">{exercise.selectionReason}</p>}
        <div className="exercise-extra-fields">
          <label className="field-label">Substituted movement <input maxLength={120} value={log.substitutionName} disabled={skipped} onChange={(event) => onUpdate((current) => ({ ...current, substitutionName: event.target.value }))} placeholder="Optional movement name" /></label>
          <label className="field-label">How did your form feel? <select value={log.formQuality} disabled={skipped} onChange={(event) => onUpdate((current) => ({ ...current, formQuality: event.target.value as ExerciseLog["formQuality"] }))}><option value="not_rated">Not rated</option><option value="sound">Controlled and comfortable</option><option value="needs_practice">Needs more practice</option></select><small className="field-hint">Load progression requires controlled form and no pain.</small></label>
          <label className="field-label">Exercise notes <textarea maxLength={2000} value={log.notes} disabled={skipped} onChange={(event) => onUpdate((current) => ({ ...current, notes: event.target.value }))} placeholder="How it felt, setup changes, or anything to remember" rows={2} /></label>
        </div>
      </details>
      <button className="skip-exercise" onClick={() => onUpdate((current) => ({ ...current, status: current.status === "skipped" ? statusForSets(current.sets) : "skipped", sets: current.status === "skipped" ? current.sets : current.sets.map((set) => ({ ...set, completed: false })) }))}>{skipped ? "Undo skip" : "Skip this exercise"}</button>
    </div>
  );
}
