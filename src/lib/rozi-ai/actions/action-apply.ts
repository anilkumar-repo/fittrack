// ---------- Rozi actions: applying an APPROVED change in the app ----------
//
// After the person taps Approve, the server returns the exact change (payload) and — only for the call that started
// it — `startedNow`. The app then applies it through its own existing save path (the same functions the screens use),
// so there's one writer and no stale copy can overwrite it. The server re-reads the data afterwards and records the
// result. This module is pure: the app passes its save functions in (`ApplyPort`), and tests pass fakes.

import { swapInSession } from "../../exercise-swap.ts";
import { routinePlan } from "../../pro-tracking.ts";
import { getExerciseDefinition } from "../../templates.ts";
import type { BodyWeightEntry, WorkoutSession } from "../../types";
import type { ActionPayload, PreferenceChanges } from "./action-types.ts";

export interface ApplyPort {
  sessionOn(date: string): WorkoutSession | undefined;
  newSessionId(): string;
  saveSession(session: WorkoutSession): Promise<boolean>;
  saveRoutine(routine: { name: string; exercises: Array<{ exerciseId: string; sets: number; reps: string }> }): Promise<void>;
  saveProfile(changes: PreferenceChanges): Promise<void>;
  saveWeight(entry: BodyWeightEntry): Promise<void>;
  addWater(date: string, ml: number): Promise<void>;
  profileId: string;
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ApplyResult => ({ ok: false, error });

export async function applyAction(payload: ActionPayload, port: ApplyPort): Promise<ApplyResult> {
  try {
    switch (payload.type) {
      case "swap_exercise": {
        const session = port.sessionOn(payload.date);
        const replacement = getExerciseDefinition(payload.toId);
        if (!session || !replacement) return fail("Today's workout isn't ready on this phone yet.");
        const next = swapInSession(session, session.plan, payload.fromId, replacement, `${replacement.name} replaces ${session.plan.exercises.find((item) => item.id === payload.fromId)?.name ?? "an exercise"} (approved in Rozi).`);
        if (next === session) return fail("That swap no longer fits today's workout.");
        if (session.status === "in_progress" && session.exerciseLogs.find((log) => log.exerciseId === payload.fromId)?.sets.some((set) => set.completed)) return fail("You've already logged sets of that exercise.");
        return (await port.saveSession(next)) ? { ok: true } : fail("The workout couldn't be saved.");
      }
      case "start_plan_today": {
        const today = port.sessionOn(payload.date);
        if (today && today.status !== "planned") return fail(today.status === "completed" ? "Today's workout is already done." : "A workout is already in progress today.");
        const session: WorkoutSession = { id: today?.id ?? port.newSessionId(), date: payload.date, status: "planned", plan: routinePlan({ ...payload.plan.routine, id: payload.plan.routine.id || `rozi-${payload.date}` }, payload.date), exerciseLogs: [] };
        return (await port.saveSession(session)) ? { ok: true } : fail("The workout couldn't be saved.");
      }
      case "save_routine":
        await port.saveRoutine({ name: payload.name, exercises: payload.exercises });
        return { ok: true };
      case "update_training_preferences":
        await port.saveProfile(payload.changes);
        return { ok: true };
      case "log_body_weight":
        await port.saveWeight({ id: `weight-${port.profileId}-${payload.date}`, measuredOn: payload.date, weightKg: payload.kg } as BodyWeightEntry);
        return { ok: true };
      case "log_water":
        await port.addWater(payload.date, payload.ml);
        return { ok: true };
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message.slice(0, 200) : "It couldn't be saved.");
  }
}

export type FlowResult = { ok: true; action: import("./action-types.ts").RoziAction } | { ok: false; message: string };

/**
 * Approve → (only if THIS call started it) apply → report back. A repeat tap, a refresh or a second tab gets the
 * current state and applies nothing. "Done" is only ever what the server returns after checking.
 */
export async function approveFlow(id: string, hash: string, deps: {
  call: (id: string, body: Record<string, unknown>) => Promise<FlowResult>;
  apply: (payload: ActionPayload) => Promise<ApplyResult>;
}): Promise<FlowResult> {
  const started = await deps.call(id, { op: "approve", hash });
  if (!started.ok || started.action.status !== "executing" || !started.action.startedNow) return started;
  const applied = await deps.apply(started.action.payload);
  return deps.call(id, { op: "complete", ok: applied.ok, ...(applied.ok ? {} : { error: applied.error }) });
}
