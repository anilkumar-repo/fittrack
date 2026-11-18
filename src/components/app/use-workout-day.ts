"use client";

import { useEffect, useMemo } from "react";
import { workoutPlanMatchesProfile } from "@/lib/exercise-library";
import { generateWorkout, preserveManualExerciseChoices } from "@/lib/planner";
import { quickVersion } from "@/lib/buddies";
import type { CheckIn, WorkoutPlan, WorkoutSession } from "@/lib/types";
import { createInFlightDeduper } from "@/lib/workout-tracking";
import { weekdayOf } from "@/lib/dates";
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
 * `extraDay` (today only) plans a workout on a rest day, for "Train today anyway".
 */
export function useWorkoutDay(date: string, checkIn: CheckIn | undefined, checkInEdited = false, extraDay = false): WorkoutDay {
  const { state, ready, currentDate, recordedSessions, trainerRuleSettings, planningProfile, upsertSession } = useFitTrack();
  const session = sessionForDate(state, date);
  const extra = extraDay && date === currentDate;
  const generatedPlan = useMemo(() => {
    const weekday = weekdayOf(date);
    const profile = extra && !state.profile.trainingDays.includes(weekday) ? { ...state.profile, trainingDays: [...state.profile.trainingDays, weekday] } : state.profile;
    const generated = generateWorkout({
      date,
      profile,
      sessions: recordedSessions,
      checkIn: session?.checkIn ?? checkIn,
      trainerRuleSettings,
      trainerRuleRevision: state.trainerRuleRevision ?? 1,
    });
    const kept = generated && session?.status === "planned"
      ? preserveManualExerciseChoices(generated, session.plan, planningProfile)
      : generated;
    // "Quick 20-min version" (Train together catch-up) stays quick when the plan is rebuilt, e.g. after the check-in.
    return kept && session?.plan.quick ? quickVersion(kept) : kept;
  }, [date, extra, state.profile, recordedSessions, session, checkIn, trainerRuleSettings, state.trainerRuleRevision, planningProfile]);
  // A routine you built yourself is never swapped for the generated plan.
  const ownRoutine = session?.plan.focus === "Your routine";
  const savedPlanCompatible = ownRoutine || session?.status !== "planned" || date < currentDate || workoutPlanMatchesProfile(session.plan, planningProfile);
  const plan = session?.status === "planned" && !ownRoutine && (checkInEdited || !savedPlanCompatible) ? generatedPlan : session?.plan ?? generatedPlan;

  useEffect(() => {
    if (!ready || !generatedPlan || date < currentDate) return;
    if (session?.status === "planned") {
      if (session.plan.focus === "Your routine" || workoutPlanMatchesProfile(session.plan, planningProfile)) return;
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
