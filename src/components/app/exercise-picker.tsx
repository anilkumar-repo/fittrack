"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, X } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { MuscleThumb } from "./muscle-thumb";
import { useScrollLock } from "./use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { exerciseEquipmentIsAvailable, filterExerciseLibrary, rankSearchResults } from "@/lib/exercise-library";
import { EXERCISE_LIBRARY } from "@/lib/templates";

const CATEGORIES = ["All", "Strength", "Core", "Conditioning"];
/** Short names so the four tabs fit one row you can slide across (docs/DESIGN.md §7). */
export const CATEGORY_LABEL: Record<string, string> = { Conditioning: "Cardio" };

/**
 * Pick exercises (from the reference apps): search, category pills with counts, a plain A–Z list, tick several,
 * then "Add (3)". Moves you don't have the equipment for are marked but still allowed.
 */
export function ExercisePicker({ already, onAdd, onClose }: { already: string[]; onAdd: (ids: string[]) => void; onClose: () => void }) {
  useScrollLock();
  const { planningProfile } = useFitTrack();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [picked, setPicked] = useState<string[]>([]);
  const list = (cat: string) => filterExerciseLibrary(EXERCISE_LIBRARY, planningProfile, { query, category: cat, muscleGroup: "", movementPattern: "", equipment: "", difficulty: "", area: "full" });
  // Searching: best matches first ("Biceps" → curls, then rows that also work biceps). Otherwise A–Z with the letter strip.
  const searching = query.trim().length > 0;
  const ranked = useMemo(() => searching
    ? rankSearchResults(list(category), query)
    : [...list(category)].sort((a, b) => a.name.localeCompare(b.name)).map((exercise) => ({ exercise, best: true })),
  [query, category, planningProfile]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = ranked.map((item) => item.exercise);
  const mixed = searching && ranked.some((item) => item.best) && ranked.some((item) => !item.best);
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
        <div className="library-chips" role="group" aria-label="Category">{CATEGORIES.map((cat) => <button key={cat} type="button" className={category === cat ? "selected" : ""} aria-pressed={category === cat} onClick={() => setCategory(cat)}>{CATEGORY_LABEL[cat] ?? cat}<span className="chip-count">{list(cat).length}</span></button>)}</div>
        {!results.length && <p className="picker-empty">No exercises match “{query.trim()}”. Try a muscle (chest, biceps, glutes) or equipment (dumbbell, cable).</p>}
        <ul className="library-list grouped picker-list">{ranked.flatMap(({ exercise, best }, index) => {
          // A plain A–Z list (no letter strip); while searching, "Best matches" / "Also matches".
          const head = mixed && (index === 0 || ranked[index - 1].best !== best) ? [<li key={`h-${best ? "best" : "also"}`} className="letter-head">{best ? "Best matches" : "Also matches"}</li>] : [];
          const on = picked.includes(exercise.id);
          const inRoutine = already.includes(exercise.id);
          return [...head, <li key={exercise.id}>
            <button type="button" className={`exercise-row picker-row ${on ? "on" : ""}`} aria-pressed={on} disabled={inRoutine} onClick={() => toggle(exercise.id)}>
              <span className="exercise-thumb"><MuscleThumb exercise={exercise} /></span>
              <span className="exercise-text"><strong>{exercise.name}</strong><small>{exercise.targetMuscles.slice(0, searching ? 3 : 2).join(" · ")}{inRoutine ? " · already added" : exerciseEquipmentIsAvailable(exercise, planningProfile) ? "" : ` · needs ${exercise.equipment.toLowerCase()}`}</small></span>
              <span className={`picker-check ${on ? "on" : ""}`} aria-hidden="true">{on && <Check />}</span>
            </button>
          </li>];
        })}</ul>
      </section>
    </div>,
    document.body,
  );
}
