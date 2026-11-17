"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { ExercisePicker } from "@/components/app/exercise-picker";
import { MuscleThumb } from "@/components/app/muscle-thumb";
import { EmptyState } from "@/components/ui/empty-state";
import { routinePlan, validateRoutine, type Routine } from "@/lib/pro-tracking";
import { deleteRoutine, loadRoutines, saveRoutine } from "@/lib/routines-store";
import { getExerciseDefinition } from "@/lib/templates";
import type { WorkoutSession } from "@/lib/types";

const REP_CHOICES = ["5", "6–8", "8", "8–12", "10", "12", "12–15", "15"];

/** My routines: build your own workouts (exercise picker, sets × reps) and start one as today's workout. */
export function RoutinesScreen() {
  const router = useRouter();
  const { state, isDemo, browserClient, currentDate, upsertSession, setNotice } = useFitTrack();
  const client = isDemo ? null : browserClient;
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [picking, setPicking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => { void loadRoutines(client).then(setRoutines).catch((error: Error) => { setRoutines([]); setNotice(error.message); }); }, [client, setNotice]);

  async function save() {
    if (!editing) return;
    const problems = validateRoutine(editing);
    setErrors(problems);
    if (problems.length) return;
    try {
      const saved = await saveRoutine(client, editing);
      setRoutines((current) => [saved, ...(current ?? []).filter((item) => item.id !== editing.id && item.id !== saved.id)]);
      setEditing(null);
      setNotice(`Routine “${saved.name}” saved.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The routine couldn’t be saved."); }
  }

  async function remove(routine: Routine) {
    if (!window.confirm(`Delete the routine “${routine.name}”? Workouts you already did with it stay in your history.`)) return;
    await deleteRoutine(client, routine.id).catch(() => undefined);
    setRoutines((current) => (current ?? []).filter((item) => item.id !== routine.id));
  }

  function start(routine: Routine) {
    const today = sessionForDate(state, currentDate);
    if (today && today.status !== "planned") { setNotice(today.status === "completed" ? "You already trained today. Start this routine tomorrow." : "A workout is already in progress today."); router.push("/today"); return; }
    const session: WorkoutSession = { id: today?.id ?? (state.mode === "demo" ? `demo-${currentDate}-planned` : crypto.randomUUID()), date: currentDate, status: "planned", plan: routinePlan(routine, currentDate), exerciseLogs: [] };
    void upsertSession(session);
    router.push("/today");
  }

  if (editing) {
    const ids = editing.exercises.map((item) => item.exerciseId);
    const patch = (index: number, change: Partial<Routine["exercises"][number]>) => setEditing({ ...editing, exercises: editing.exercises.map((item, i) => i === index ? { ...item, ...change } : item) });
    return (
      <section className="routines-page">
        <button type="button" className="text-button settings-back" onClick={() => { setEditing(null); setErrors([]); }}><ArrowLeft aria-hidden="true" /> My routines</button>
        <label className="settings-field">Routine name<input type="text" maxLength={60} value={editing.name} placeholder="e.g. Push day" onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
        {editing.exercises.length ? <ol className="routine-edit-list">{editing.exercises.map((item, index) => {
          const exercise = getExerciseDefinition(item.exerciseId);
          if (!exercise) return null;
          return (
            <li key={item.exerciseId} className="panel routine-edit-row">
              <span className="exercise-thumb"><MuscleThumb exercise={exercise} /></span>
              <div className="routine-edit-main">
                <strong>{exercise.name}</strong>
                <div className="routine-edit-controls">
                  <span className="stepper" aria-label="Sets"><button type="button" aria-label="Fewer sets" onClick={() => patch(index, { sets: Math.max(1, item.sets - 1) })}><Minus aria-hidden="true" /></button><b>{item.sets} sets</b><button type="button" aria-label="More sets" onClick={() => patch(index, { sets: Math.min(10, item.sets + 1) })}><Plus aria-hidden="true" /></button></span>
                  <select aria-label="Reps" value={item.reps} onChange={(event) => patch(index, { reps: event.target.value })}>{[...new Set([item.reps, ...REP_CHOICES])].map((reps) => <option key={reps} value={reps}>{reps} reps</option>)}</select>
                </div>
              </div>
              <button type="button" className="icon-button" aria-label={`Remove ${exercise.name}`} onClick={() => setEditing({ ...editing, exercises: editing.exercises.filter((_, i) => i !== index) })}><Trash2 aria-hidden="true" /></button>
            </li>
          );
        })}</ol> : <EmptyState mood="upper-body" title="No exercises yet" text="Add the moves you like — Rozi tracks your sets, rest, history and records the same way." />}
        <button type="button" className="button button-subtle full-width" onClick={() => setPicking(true)}><Plus aria-hidden="true" /> Add exercises</button>
        {errors.length > 0 && <p className="form-error" role="alert">{errors.join(" ")}</p>}
        <button type="button" className="button button-primary full-width" onClick={() => void save()}>Save routine</button>
        {picking && <ExercisePicker already={ids} onClose={() => setPicking(false)} onAdd={(added) => setEditing({ ...editing, exercises: [...editing.exercises, ...added.map((id) => { const def = getExerciseDefinition(id)!; return { exerciseId: id, sets: Math.min(def.sets, 4) || 3, reps: def.reps }; })] })} />}
      </section>
    );
  }

  return (
    <section className="routines-page">
      <article className="panel routines-hero">
        <div><h2>My routines</h2><p>Build your own workouts. Start one any day and Rozi tracks it like any other session.</p></div>
        <button type="button" className="button button-primary" onClick={() => setEditing({ id: `local-${Date.now()}`, name: "", exercises: [], updatedAt: "" })}><Plus aria-hidden="true" /> New routine</button>
      </article>
      {routines === null ? <p className="loading-inline" role="status">Loading your routines…</p>
        : routines.length === 0 ? <div className="panel"><EmptyState mood="workout" title="No routines yet" text="Make a routine for the days you want to train your own way — for example a quick push day or a home workout." action={{ label: "New routine", onClick: () => setEditing({ id: `local-${Date.now()}`, name: "", exercises: [], updatedAt: "" }) }} /></div>
        : <div className="routine-cards">{routines.map((routine) => {
          const plan = routinePlan(routine, currentDate);
          return (
            <article key={routine.id} className="panel routine-own-card">
              <div className="routine-own-head"><h3>{routine.name}</h3><button type="button" className="icon-button" aria-label={`Edit ${routine.name}`} onClick={() => setEditing(routine)}><Pencil aria-hidden="true" /></button><button type="button" className="icon-button" aria-label={`Delete ${routine.name}`} onClick={() => void remove(routine)}><Trash2 aria-hidden="true" /></button></div>
              <p>{plan.exercises.map((exercise) => exercise.name).join(", ")}</p>
              <small>{plan.exercises.length} exercises · about {plan.durationMinutes} min</small>
              <button type="button" className="button button-primary" onClick={() => start(routine)}><Play aria-hidden="true" /> Start today</button>
            </article>
          );
        })}</div>}
    </section>
  );
}
