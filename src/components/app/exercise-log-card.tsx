"use client";

import { useState } from "react";
import { ArrowLeftRight, Calculator, Check, Plus } from "lucide-react";
import { shortDate } from "@/lib/dates";
import { setKind, setLabels, SET_KINDS } from "@/lib/pro-tracking";
import { PlatesSheet } from "./plates-sheet";
import { MuscleThumb } from "./muscle-thumb";
import { describeLastPerformance, displayToKg, formatWeight, kgToDisplay, lastLoadKg, type LastPerformance, type WeightUnit } from "@/lib/logging";
import type { ExerciseDefinition, ExerciseLog } from "@/lib/types";
import { statusForSets } from "@/lib/workout-tracking";
import { formatAmount, trackingOf, UNIT_HEADING, UNIT_WORD, usesLoad } from "@/lib/tracking";

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
  /** Opens "Swap exercise" (shown until a set of this exercise is done). */
  onSwap?: () => void;
}

type SetLog = ExerciseLog["sets"][number];

/** One exercise in the workout logger: what to do, what happened last time, and the sets to tick off. */
export function ExerciseLogCard({ exercise, index, log, substitutedForName, last, unit, onUpdate, onAddSet, onOpenGuide, onSetCompleted, onSwap }: ExerciseLogCardProps) {
  const skipped = log.status === "skipped";
  const hintLoad = lastLoadKg(last);
  const labels = setLabels(log.sets);
  const [menu, setMenu] = useState<number | null>(null);
  const [plates, setPlates] = useState(false);
  // Holds log seconds, cardio logs minutes (and km when it tracks distance); only reps and holds take a weight (R5).
  const tracking = trackingOf(exercise);
  const counted = tracking.unit;
  const showLoad = usesLoad(tracking);
  const showDistance = !showLoad && tracking.distance === true;

  function updateSet(setIndex: number, change: (set: SetLog, current: ExerciseLog) => SetLog) {
    onUpdate((current) => ({ ...current, sets: current.sets.map((item, i) => i === setIndex ? change(item, current) : item) }));
  }

  return (
    <div className={`exercise-log-card ${log.status === "completed" ? "logged" : ""}`}>
      <div className="exercise-log-head">
        <span className="exercise-index">{String(index + 1).padStart(2, "0")}</span>
        <div className="exercise-title">
          <button className="plain-link" onClick={onOpenGuide}>{exercise.name}</button>
          <small>{exercise.equipment} · {log.plannedSets} planned {log.plannedSets === 1 ? "set" : "sets"} × {formatAmount(log.plannedReps, counted)}</small>
          {substitutedForName && <small>Substituted for {substitutedForName}</small>}
        </div>
        <span className={`exercise-status ${log.status}`}>{log.status.replaceAll("_", " ")}</span>
      </div>
      <p className="last-time">{last
        ? <><strong>Last time</strong> ({shortDate(last.date)}): {describeLastPerformance(last, unit, counted)}</>
        : <><strong>First time</strong> logging this movement. Start light and comfortable.</>}</p>

      <div className="pro-sets" role="table" aria-label={`${exercise.name} sets`}>
        <div className="pro-set-head" role="row"><span role="columnheader">Set</span><span role="columnheader">Previous</span><span role="columnheader">{showLoad ? unit : showDistance ? "km" : ""}</span><span role="columnheader">{UNIT_HEADING[counted]}</span><span role="columnheader" aria-label="Done"><Check aria-hidden="true" /></span></div>
        {log.sets.map((set, setIndex) => {
          const kind = setKind(set);
          const previous = last?.sets[setIndex] ?? null;
          const planned = set.plannedReps ?? log.plannedReps;
          return (
            <div key={setIndex} className={`pro-set ${set.completed ? "done" : ""} kind-${kind}`} role="row">
              <span className="pro-set-cell">
                <button type="button" className="pro-set-label" aria-haspopup="menu" aria-expanded={menu === setIndex} disabled={skipped}
                  aria-label={`Set ${labels[setIndex]}, ${SET_KINDS.find((item) => item.id === kind)?.label}. Change set type`} onClick={() => setMenu(menu === setIndex ? null : setIndex)}>{labels[setIndex]}</button>
                {menu === setIndex && <span className="pro-kind-menu" role="menu">
                  {SET_KINDS.map((item) => <button key={item.id} type="button" role="menuitemradio" aria-checked={kind === item.id} className={`kind-${item.id}`} onClick={() => { updateSet(setIndex, (current) => { const { kind: _old, ...rest } = current; void _old; return item.id === "normal" ? rest : { ...rest, kind: item.id }; }); setMenu(null); }}>
                    <b>{item.id === "normal" ? "1" : item.letter}</b><span><strong>{item.label}</strong><small>{item.note}</small></span>
                  </button>)}
                  {log.sets.length > 1 && <button type="button" role="menuitem" className="pro-kind-remove" onClick={() => { onUpdate((current) => ({ ...current, sets: current.sets.filter((_, i) => i !== setIndex) })); setMenu(null); }}><b>×</b><span><strong>Remove this set</strong></span></button>}
                </span>}
              </span>
              <button type="button" className="pro-prev" disabled={!previous || skipped} aria-label={previous ? `Use last time: ${previous.reps} ${UNIT_WORD[counted]}${previous.loadKg ? ` at ${formatWeight(previous.loadKg, unit)}` : ""}${previous.distanceKm ? `, ${previous.distanceKm} km` : ""}` : "No previous set"}
                onClick={() => previous && updateSet(setIndex, (item) => ({ ...item, actualReps: previous.reps, loadKg: showLoad ? previous.loadKg : item.loadKg, ...(showDistance ? { distanceKm: previous.distanceKm ?? null } : {}) }))}>
                {previous ? `${previous.loadKg && showLoad ? `${kgToDisplay(previous.loadKg, unit)} × ` : ""}${showDistance && previous.distanceKm ? `${previous.distanceKm} km · ` : ""}${previous.reps}` : "—"}
              </button>
              {showLoad ? <input aria-label={`${exercise.name} set ${labels[setIndex]} weight in ${unit === "lb" ? "pounds" : "kilograms"}`} type="number" inputMode="decimal" min="0" max={unit === "lb" ? 4400 : 2000} step="0.5"
                placeholder={previous?.loadKg ? String(kgToDisplay(previous.loadKg, unit)) : hintLoad === null ? "—" : String(kgToDisplay(hintLoad, unit))} value={set.loadKg === null ? "" : kgToDisplay(set.loadKg, unit)} disabled={skipped}
                onChange={(event) => updateSet(setIndex, (item) => ({ ...item, loadKg: event.target.value === "" ? null : displayToKg(Number(event.target.value), unit) }))} />
                : showDistance ? <input aria-label={`${exercise.name} set ${labels[setIndex]} distance in kilometres`} type="number" inputMode="decimal" min="0" max="1000" step="0.1"
                  placeholder={previous?.distanceKm ? String(previous.distanceKm) : "km"} value={set.distanceKm ?? ""} disabled={skipped}
                  onChange={(event) => updateSet(setIndex, (item) => ({ ...item, distanceKm: event.target.value === "" ? null : Math.round(Number(event.target.value) * 100) / 100 }))} />
                  : <span className="pro-set-empty" aria-hidden="true">—</span>}
              <input aria-label={`${exercise.name} set ${labels[setIndex]} ${UNIT_WORD[counted]}`} type="number" inputMode="numeric" min="1" max="1000" placeholder={planned ? String(planned) : "—"} value={set.actualReps ?? ""} disabled={skipped}
                onChange={(event) => updateSet(setIndex, (item) => ({ ...item, actualReps: event.target.value === "" ? null : Number(event.target.value), completed: event.target.value === "" ? false : item.completed }))} />
              <button type="button" className="pro-tick" aria-pressed={set.completed} disabled={skipped} aria-label={`Mark ${exercise.name} set ${labels[setIndex]} ${set.completed ? "not done" : "done"}`}
                onClick={() => {
                  const checked = !set.completed;
                  // Ticking an empty row takes the numbers shown in grey (planned reps, last weight).
                  const fallbackLoad = previous?.loadKg ?? hintLoad;
                  updateSet(setIndex, (item, current) => ({ ...item, completed: checked,
                    actualReps: checked ? item.actualReps ?? item.plannedReps ?? current.plannedReps : item.actualReps,
                    loadKg: checked && showLoad && item.loadKg === null && kind !== "warmup" ? fallbackLoad : item.loadKg }));
                  if (checked) onSetCompleted();
                }}><Check aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
      <div className="pro-set-actions">
        <button type="button" className="add-set pro-action" disabled={skipped} onClick={onAddSet}><Plus aria-hidden="true" /> Add set</button>
        {counted === "reps" && <button type="button" className="text-button pro-plates-open pro-action" disabled={skipped} onClick={() => setPlates(true)} aria-label="Warm-up sets and plate calculator"><Calculator aria-hidden="true" /> Plates</button>}
        {onSwap && !log.sets.some((set) => set.completed) && <button type="button" className="text-button pro-plates-open pro-action" onClick={onSwap} aria-label={`Swap ${exercise.name} for another exercise`}><ArrowLeftRight aria-hidden="true" /> Swap</button>}
      </div>
      {plates && <PlatesSheet exerciseName={exercise.name} barbell={/barbell|smith/i.test(`${exercise.equipment} ${exercise.name}`)} unit={unit}
        workKg={log.sets.find((item) => setKind(item) !== "warmup" && item.loadKg)?.loadKg ?? hintLoad}
        onConfirm={(kg, warmUps) => onUpdate((current) => ({
          ...current,
          sets: [
            ...warmUps.map((item) => ({ plannedReps: item.reps, actualReps: null, loadKg: item.loadKg, completed: false, extra: true, kind: "warmup" as const })),
            // Unfinished warm-ups are replaced by the new ones; working sets not done yet get the working weight.
            ...current.sets.filter((item) => !(warmUps.length && setKind(item) === "warmup" && !item.completed))
              .map((item) => (setKind(item) !== "warmup" && !item.completed ? { ...item, loadKg: kg } : item)),
          ],
        }))}
        onClose={() => setPlates(false)} />}

      {/* Workout mode (Phase 4): the sets come first; how-to and load advice are one tap away. */}
      <details className="exercise-coach">
        <summary>How to do it &amp; tips</summary>
        <button type="button" className="exercise-visual" onClick={onOpenGuide} aria-label={`Open the guide for ${exercise.name}`}><span className="exercise-visual-thumb"><MuscleThumb exercise={exercise} /></span><span className="exercise-visual-text"><strong>How to do it</strong><small>{exercise.targetMuscles.join(" · ")}</small></span></button>
        {/* Load and rep advice only fits rep sets; timed moves (planks, cardio) skip it. */}
        {exercise.progressionAdvice && counted === "reps" && <div className="progression-note"><strong>{exercise.progressionAction === "consider_small_load_step" ? "Progression check" : exercise.progressionAction === "hold_load_add_reps" ? "Rep target" : "Load guidance"}</strong><p>{exercise.progressionAdvice} {exercise.loadGuidance}</p></div>}
      </details>
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
