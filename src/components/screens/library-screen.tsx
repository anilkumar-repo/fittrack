"use client";

import { useState } from "react";
import { ExerciseGuideModal, toGuideExercise } from "@/components/app/exercise-guide-modal";
import { ExerciseIllustration } from "@/components/app/exercise-illustration";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { exerciseEquipmentIsAvailable, filterExerciseLibrary, getExerciseLibraryFilterOptions } from "@/lib/exercise-library";
import { EXERCISE_LIBRARY } from "@/lib/templates";
import type { ExerciseDefinition } from "@/lib/types";

export function LibraryScreen() {
  const { state, currentDate, planningProfile } = useFitTrack();
  const { session: todaySession, plan } = useWorkoutDay(currentDate, DEFAULT_CHECK_IN);
  const [guideExercise, setGuideExercise] = useState<ExerciseDefinition | null>(null);
  const [libraryFilter, setLibraryFilter] = useState("All");
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
  });

  return (
    <>
      <section className="library-page">
        <div className="page-intro"><div><span className="eyebrow">Learn the movement before you lift</span><h2>Simple references, right when you need them.</h2><p>Search clear, beginner-friendly steps, equipment needs, target muscles, and comfortable alternatives.</p></div></div>
        <label className="library-search"><span aria-hidden="true">⌕</span><input type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search exercises, muscles, or equipment" aria-label="Search exercises, muscles, or equipment" />{librarySearch && <button type="button" onClick={() => setLibrarySearch("")} aria-label="Clear exercise search">×</button>}</label>
        <div className="filter-row">{["All", "Strength", "Core", "Conditioning"].map((filter) => <button key={filter} className={libraryFilter === filter ? "selected" : ""} onClick={() => setLibraryFilter(filter)}>{filter}</button>)}</div>
        <div className="library-filter-controls">
          <label>Muscle group<select value={libraryMuscleFilter} onChange={(event) => setLibraryMuscleFilter(event.target.value)}><option value="">All muscles</option>{libraryOptions.muscleGroups.map((muscle) => <option key={muscle} value={muscle}>{muscle}</option>)}</select></label>
          <label>Movement pattern<select value={libraryPatternFilter} onChange={(event) => setLibraryPatternFilter(event.target.value)}><option value="">All patterns</option>{libraryOptions.movementPatterns.map((pattern) => <option key={pattern.key} value={pattern.key}>{pattern.label}</option>)}</select></label>
          <label>Equipment<select value={libraryEquipmentFilter} onChange={(event) => setLibraryEquipmentFilter(event.target.value)}><option value="">Any equipment</option>{libraryOptions.equipment.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <label>Difficulty<select value={libraryDifficultyFilter} onChange={(event) => setLibraryDifficultyFilter(event.target.value)}><option value="">All levels</option>{libraryOptions.difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</option>)}</select></label>
        </div>
        <div className="library-results-heading"><span>{libraryResults.length} {libraryResults.length === 1 ? "exercise" : "exercises"}</span>{(librarySearch || libraryFilter !== "All" || libraryMuscleFilter || libraryPatternFilter || libraryEquipmentFilter || libraryDifficultyFilter) && <button type="button" className="text-button" onClick={() => { setLibrarySearch(""); setLibraryFilter("All"); setLibraryMuscleFilter(""); setLibraryPatternFilter(""); setLibraryEquipmentFilter(""); setLibraryDifficultyFilter(""); }}>Clear filters</button>}</div>
        {libraryResults.length ? <div className="library-grid">{libraryResults.map((exercise) => {
          const equipmentReady = exerciseEquipmentIsAvailable(exercise, planningProfile);
          return <button key={exercise.id} className="library-card" onClick={() => setGuideExercise(toGuideExercise(exercise))}><ExerciseIllustration exerciseId={exercise.id} name={exercise.name} compact /><span className="library-tag">{exercise.difficulty}</span><strong>{exercise.name}</strong><small>{exercise.equipment}</small><small className="library-muscles">{exercise.targetMuscles.join(" · ")}</small><span className={`equipment-ready ${equipmentReady ? "ready" : "needs-check"}`}>{equipmentReady ? "Equipment available" : state.profile.equipmentAvailability === "unknown" ? "Confirm equipment first" : "Not in confirmed equipment"}</span><span className="library-open">Open instructions ↗</span></button>;
        })}</div> : <div className="library-empty"><span>⌕</span><h3>No matching exercises</h3><p>Try a different search or clear one of the filters.</p><button type="button" className="button button-subtle" onClick={() => { setLibrarySearch(""); setLibraryFilter("All"); setLibraryMuscleFilter(""); setLibraryPatternFilter(""); setLibraryEquipmentFilter(""); setLibraryDifficultyFilter(""); }}>Reset library filters</button></div>}
      </section>
      {guideExercise && <ExerciseGuideModal exercise={guideExercise} workout={{ date: currentDate, session: todaySession, plan }} onOpen={(exercise) => setGuideExercise(toGuideExercise(exercise))} onClose={() => setGuideExercise(null)} />}
    </>
  );
}
