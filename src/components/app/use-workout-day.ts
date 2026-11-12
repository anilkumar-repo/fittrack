"use client";

import { useEffect, useMemo } from "react";
import { workoutPlanMatchesProfile } from "@/lib/exercise-library";
import { generateWorkout, preserveManualExerciseChoices } from "@/lib/planner";
import type { CheckIn, WorkoutPlan, WorkoutSession } from "@/lib/types";
import { createInFlightDeduper } from "@/lib/workout-tracking";
import { sessionForDate, useFitTrack } from "./fit-track-provider";

const dedupePlannedWorkout = createInFlightDeduper<boolean>();

/** The answers a check-in starts with before the person changes anything. */
export const emptyCheckIn = (): CheckIn => ({ energy: 3, soreness: 1, pain: false, recovery: 3, discomfort: "", note: "" });
export const DEFAULT_CHECK_IN: CheckIn = emptyCheckIn();

export interface WorkoutDay {
  session: WorkoutSession | undefined;
  generatedPlan: WorkoutPlan | null;
  /** The plan to show: the saved one, or a fresh one while the check-in is being edited. */
  plan: WorkoutPlan | null;
}

/**
 * The saved session and current plan for one date. For today and future training days it also
 * saves the generated plan as a `planned` session, so the same plan is reused after a refresh.
 */
export function useWorkoutDay(date: string, checkIn: CheckIn | undefined, checkInEdited = false): WorkoutDay {
  const { state, ready, currentDate, recordedSessions, trainerRuleSettings, planningProfile, upsertSession } = useFitTrack();
  const session = sessionForDate(state, date);
  const generatedPlan = useMemo(() => {
    const generated = generateWorkout({
      date,
      profile: state.profile,
      sessions: recordedSessions,
      checkIn: session?.checkIn ?? checkIn,
      trainerRuleSettings,
      trainerRuleRevision: state.trainerRuleRevision ?? 1,
    });
    return generated && session?.status === "planned"
      ? preserveManualExerciseChoices(generated, session.plan, planningProfile)
      : generated;
  }, [date, state.profile, recordedSessions, session, checkIn, trainerRuleSettings, state.trainerRuleRevision, planningProfile]);
  const savedPlanCompatible = session?.status !== "planned" || date < currentDate || workoutPlanMatchesProfile(session.plan, planningProfile);
  const plan = session?.status === "planned" && (checkInEdited || !savedPlanCompatible) ? generatedPlan : session?.plan ?? generatedPlan;

  useEffect(() => {
    if (!ready || !generatedPlan || date < currentDate) return;
    if (session?.status === "planned") {
      if (workoutPlanMatchesProfile(session.plan, planningProfile)) return;
      const adapted = { ...session, plan: generatedPlan };
      const planKey = JSON.stringify(generatedPlan.exercises.map((exercise) => [exercise.id, exercise.sets, exercise.reps]));
      const equipmentKey = state.profile.availableEquipment.slice().sort().join(",");
      void dedupePlannedWorkout(`${state.profile.id}:${date}:${planKey}:${state.profile.deadliftEnabled}:${state.profile.equipmentAvailability}:${equipmentKey}`, () => upsertSession(adapted));
      return;
    }
    if (session) return;
    const planned: WorkoutSession = {
      id: state.mode === "demo" ? `demo-${date}-planned` : crypto.randomUUID(),
      date,
      status: "planned",
      plan: generatedPlan,
      exerciseLogs: [],
    };
    void dedupePlannedWorkout(`${state.profile.id}:${date}`, () => upsertSession(planned));
  }, [ready, generatedPlan, session, date, currentDate, state.mode, state.profile, planningProfile, upsertSession]);

  return { session, generatedPlan, plan };
}
