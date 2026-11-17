"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, X } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { MuscleThumb } from "./muscle-thumb";
import { AlphabetIndex, firstLetter, letterAnchorId } from "./alphabet-index";
import { useScrollLock } from "./use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { exerciseEquipmentIsAvailable, filterExerciseLibrary } from "@/lib/exercise-library";
import { EXERCISE_LIBRARY } from "@/lib/templates";

const CATEGORIES = ["All", "Strength", "Core", "Conditioning"];

/**
 * Pick exercises (from the reference apps): search, category pills with counts, A–Z strip, tick several,
 * then "Add (3)". Moves you don't have the equipment for are marked but still allowed.
 */
export function ExercisePicker({ already, onAdd, onClose }: { already: string[]; onAdd: (ids: string[]) => void; onClose: () => void }) {
  useScrollLock();
  const { planningProfile } = useFitTrack();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [picked, setPicked] = useState<string[]>([]);
  const list = (cat: string) => filterExerciseLibrary(EXERCISE_LIBRARY, planningProfile, { query, category: cat, muscleGroup: "", movementPattern: "", equipment: "", difficulty: "", area: "full" });
  const results = useMemo(() => [...list(category)].sort((a, b) => a.name.localeCompare(b.name)), [query, category, planningProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  const letters = [...new Set(results.map((exercise) => firstLetter(exercise.name)))];
  const toggle = (id: string) => setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add exercises" onClick={onClose}>
      <section className="modal picker-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <div className="picker-top">
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X aria-hidden="true" /></button>
          <strong>Add exercises</strong>
          <button type="button" className="button button-primary picker-add" disabled={!picked.length} onClick={() => { onAdd(picked); onClose(); }}>Add{picked.length ? ` (${picked.length})` : ""}</button>
        </div>
        <label className="library-find"><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" aria-label="Search exercises" /></label>
        <div className="library-chips" role="group" aria-label="Category">{CATEGORIES.map((cat) => <button key={cat} type="button" className={category === cat ? "selected" : ""} aria-pressed={category === cat} onClick={() => setCategory(cat)}>{cat}<span className="chip-count">{list(cat).length}</span></button>)}</div>
        <ul className="library-list grouped picker-list">{results.flatMap((exercise, index) => {
          const letter = firstLetter(exercise.name);
          const head = index === 0 || firstLetter(results[index - 1].name) !== letter ? [<li key={`h-${letter}`} className="letter-head" id={letterAnchorId("pick", letter)} aria-hidden="true">{letter}</li>] : [];
          const on = picked.includes(exercise.id);
          const inRoutine = already.includes(exercise.id);
          return [...head, <li key={exercise.id}>
            <button type="button" className={`exercise-row picker-row ${on ? "on" : ""}`} aria-pressed={on} disabled={inRoutine} onClick={() => toggle(exercise.id)}>
              <span className="exercise-thumb"><MuscleThumb exercise={exercise} /></span>
              <span className="exercise-text"><strong>{exercise.name}</strong><small>{exercise.targetMuscles.slice(0, 2).join(" · ")}{inRoutine ? " · already added" : exerciseEquipmentIsAvailable(exercise, planningProfile) ? "" : ` · needs ${exercise.equipment.toLowerCase()}`}</small></span>
              <span className={`picker-check ${on ? "on" : ""}`} aria-hidden="true">{on && <Check />}</span>
            </button>
          </li>];
        })}</ul>
        <AlphabetIndex letters={letters} prefix="pick" />
      </section>
    </div>,
    document.body,
  );
}
