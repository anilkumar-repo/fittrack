"use client";

import Link from "next/link";
import { MOBILITY_MOVES, MOBILITY_ROUTINES } from "@/lib/mobility";
import { useState } from "react";
import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { ExerciseGuideModal, toGuideExercise } from "@/components/app/exercise-guide-modal";
import { MuscleThumb } from "@/components/app/muscle-thumb";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { Rozi } from "@/components/app/rozi";
import { AlphabetIndex, firstLetter, letterAnchorId } from "@/components/app/alphabet-index";
import { BODY_AREAS, type BodyArea, exerciseEquipmentIsAvailable, filterExerciseLibrary, getExerciseLibraryFilterOptions, rankSearchResults } from "@/lib/exercise-library";
import type { RoziMood } from "@/lib/rozi";
import { EXERCISE_LIBRARY } from "@/lib/templates";
import type { ExerciseDefinition } from "@/lib/types";
import { EmptyState } from "@/components/ui/empty-state";

const AREA_MOODS: Record<BodyArea, RoziMood> = { full: "full-body", upper: "upper-body", lower: "lower-body", core: "stretch" };

export function LibraryScreen() {
  const { currentDate, planningProfile } = useFitTrack();
  const { session: todaySession, plan } = useWorkoutDay(currentDate, DEFAULT_CHECK_IN);
  const [guideExercise, setGuideExercise] = useState<ExerciseDefinition | null>(null);
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [libraryArea, setLibraryArea] = useState<BodyArea>("full");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryMuscleFilter, setLibraryMuscleFilter] = useState("");
  const [libraryPatternFilter, setLibraryPatternFilter] = useState("");
  const [libraryEquipmentFilter, setLibraryEquipmentFilter] = useState("");
  const [libraryDifficultyFilter, setLibraryDifficultyFilter] = useState("");
  const libraryOptions = getExerciseLibraryFilterOptions(EXERCISE_LIBRARY, planningProfile);
  const libraryResults = filterExerciseLibrary(EXERCISE_LIBRARY, planningProfile, {
    query: librarySearch,
    category: libraryFilter,
    muscleGroup: libraryMuscleFilter,
    movementPattern: libraryPatternFilter,
    equipment: libraryEquipmentFilter,
    difficulty: libraryDifficultyFilter,
    area: libraryArea,
  });

  // How many exercises each category pill would show with the other filters kept ("Strength 34").
  const categoryCount = (category: string) => filterExerciseLibrary(EXERCISE_LIBRARY, planningProfile, {
    query: librarySearch, category, muscleGroup: libraryMuscleFilter, movementPattern: libraryPatternFilter,
    equipment: libraryEquipmentFilter, difficulty: libraryDifficultyFilter, area: libraryArea,
  }).length;
  // A–Z order, so the side letter strip can jump straight to a letter. Searching: best matches first instead.
  const searching = librarySearch.trim().length > 0;
  const ranked = searching
    ? rankSearchResults(libraryResults, librarySearch)
    : [...libraryResults].sort((a, b) => a.name.localeCompare(b.name)).map((exercise) => ({ exercise, best: true }));
  const sortedResults = ranked.map((item) => item.exercise);
  const mixed = searching && ranked.some((item) => item.best) && ranked.some((item) => !item.best);
  const letters = searching ? [] : [...new Set(sortedResults.map((exercise) => firstLetter(exercise.name)))];
  const extraFilters = [libraryMuscleFilter, libraryPatternFilter, libraryEquipmentFilter, libraryDifficultyFilter].filter(Boolean).length;
  const anyFilter = Boolean(librarySearch) || libraryFilter !== "All" || libraryArea !== "full" || extraFilters > 0;
  const clearFilters = () => { setLibrarySearch(""); setLibraryFilter("All"); setLibraryArea("full"); setLibraryMuscleFilter(""); setLibraryPatternFilter(""); setLibraryEquipmentFilter(""); setLibraryDifficultyFilter(""); };

  return (
    <>
      <section className="library">
        <label className="library-find"><Search aria-hidden="true" /><input type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search exercises or muscles" aria-label="Search exercises, muscles, or equipment" />{librarySearch && <button type="button" onClick={() => setLibrarySearch("")} aria-label="Clear search"><X aria-hidden="true" /></button>}</label>
        <div className="area-cards" role="group" aria-label="Body area">{BODY_AREAS.map((area) => {
          const count = filterExerciseLibrary(EXERCISE_LIBRARY, planningProfile, { area: area.id }).length;
          return (
            <button key={area.id} type="button" className={`area-card area-${area.id} ${libraryArea === area.id ? "selected" : ""}`} aria-pressed={libraryArea === area.id} onClick={() => setLibraryArea(area.id)}>
              <span className="area-text"><strong>{area.label}</strong><small>{count} {count === 1 ? "move" : "moves"}</small></span>
              <Rozi mood={AREA_MOODS[area.id]} size={96} className="area-rozi" />
            </button>
          );
        })}
          <Link href="/mobility" className="area-card area-mobility">
            <span className="area-text"><strong>Stretch &amp; mobility</strong><small>{MOBILITY_MOVES.length} moves · {MOBILITY_ROUTINES.length} routines</small></span>
            <Rozi mood="mobility" size={96} className="area-rozi" />
          </Link>
        </div>
        <div className="library-chips" role="group" aria-label="Category">{["All", "Strength", "Core", "Conditioning"].map((filter) => <button key={filter} type="button" className={libraryFilter === filter ? "selected" : ""} aria-pressed={libraryFilter === filter} onClick={() => setLibraryFilter(filter)}>{filter}<span className="chip-count">{categoryCount(filter)}</span></button>)}</div>
        <details className="library-more">
          <summary><SlidersHorizontal aria-hidden="true" /> More filters{extraFilters > 0 ? ` (${extraFilters})` : ""}</summary>
          <div className="library-selects">
            <label>Muscle group<select value={libraryMuscleFilter} onChange={(event) => setLibraryMuscleFilter(event.target.value)}><option value="">All muscles</option>{libraryOptions.muscleGroups.map((muscle) => <option key={muscle.key} value={muscle.key}>{muscle.label}</option>)}</select></label>
            <label>Movement<select value={libraryPatternFilter} onChange={(event) => setLibraryPatternFilter(event.target.value)}><option value="">All movements</option>{libraryOptions.movementPatterns.map((pattern) => <option key={pattern.key} value={pattern.key}>{pattern.label}</option>)}</select></label>
            <label>Equipment<select value={libraryEquipmentFilter} onChange={(event) => setLibraryEquipmentFilter(event.target.value)}><option value="">Any equipment</option>{libraryOptions.equipment.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label>Level<select value={libraryDifficultyFilter} onChange={(event) => setLibraryDifficultyFilter(event.target.value)}><option value="">All levels</option>{libraryOptions.difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</option>)}</select></label>
          </div>
        </details>
        <div className="library-count"><span>{libraryResults.length} {libraryResults.length === 1 ? "exercise" : "exercises"}</span>{anyFilter && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}</div>

        {libraryResults.length ? <ul className="library-list grouped has-alpha">{sortedResults.flatMap((exercise, index) => {
          const equipmentReady = exerciseEquipmentIsAvailable(exercise, planningProfile);
          const letter = firstLetter(exercise.name);
          const best = ranked[index].best;
          const startsLetter = index === 0 || firstLetter(sortedResults[index - 1].name) !== letter;
          const head = searching
            ? (mixed && (index === 0 || ranked[index - 1].best !== best) ? [<li key={`head-${best ? "best" : "also"}`} className="letter-head">{best ? "Best matches" : "Also matches"}</li>] : [])
            : startsLetter ? [<li key={`head-${letter}`} className="letter-head" id={letterAnchorId("lib", letter)} data-letter={letter} aria-hidden="true">{letter}</li>] : [];
          return [...head, (
            <li key={exercise.id}>
              <button className="exercise-row" onClick={() => setGuideExercise(toGuideExercise(exercise))}>
                <span className="exercise-thumb"><MuscleThumb exercise={exercise} /></span>
                <span className="exercise-text"><strong>{exercise.name}</strong><small>{exercise.targetMuscles.slice(0, searching ? 3 : 2).join(" · ")}</small><small className={`library-ready ${equipmentReady ? "ok" : "warn"}`}>{equipmentReady ? (exercise.requiredEquipment?.length ? "You have the equipment" : "No equipment needed") : `Needs ${exercise.equipment.toLowerCase()}`}</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            </li>
          )];
        })}</ul> : <div className="panel"><EmptyState mood="grumpy" title="No matching exercises" text="Rozi looked everywhere. Try a different word or clear the filters." action={{ label: "Clear filters", onClick: clearFilters }} /></div>}
        {libraryResults.length > 0 && !searching && <AlphabetIndex letters={letters} prefix="lib" />}
      </section>
      {guideExercise && <ExerciseGuideModal exercise={guideExercise} workout={{ date: currentDate, session: todaySession, plan }} onOpen={(exercise) => setGuideExercise(toGuideExercise(exercise))} onClose={() => setGuideExercise(null)} />}
    </>
  );
}
