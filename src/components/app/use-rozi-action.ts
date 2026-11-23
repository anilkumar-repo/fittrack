"use client";

import { useCallback } from "react";
import { applyAction, approveFlow, type ApplyPort } from "@/lib/rozi-ai/actions/action-apply";
import { parseAction, type RoziAction } from "@/lib/rozi-ai/actions/action-types";
import { saveRoutine } from "@/lib/routines-store";
import { upsertBodyWeightEntry } from "@/lib/progress";
import { addCloudWater, saveCloudBodyWeightEntry, saveCloudProfile } from "@/lib/supabase-repository";
import { sessionForDate, useFitTrack } from "./fit-track-provider";

export type ActionCallResult = { ok: true; action: RoziAction } | { ok: false; message: string };

/**
 * Approve / reject a Rozi action from its card (Level 3). Approve: the server checks it's THIS exact change and
 * starts it; only when this call started it (`startedNow`) does the app apply it through its normal save path, then
 * reports back so the server can check the result. Never shows "done" before the server says completed.
 */
export function useRoziAction() {
  const { getState, updateState, updateProfile, upsertSession, browserClient } = useFitTrack();

  const token = useCallback(async () => (browserClient ? (await browserClient.auth.getSession()).data.session?.access_token ?? null : null), [browserClient]);

  const call = useCallback(async (id: string, body: Record<string, unknown>): Promise<ActionCallResult> => {
    if (!browserClient) return { ok: false, message: "Sign in to use Rozi actions." };
    const accessToken = await token();
    if (!accessToken) return { ok: false, message: "Your sign-in has expired. Please sign in again." };
    try {
      const response = await fetch(`/api/rozi/actions/${id}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(body) });
      const json = await response.json().catch(() => null) as { ok?: boolean; action?: unknown; message?: string } | null;
      const action = json?.ok ? parseAction(json.action) : null;
      return action ? { ok: true, action } : { ok: false, message: json?.message ?? "That didn't work. Try again." };
    } catch {
      return { ok: false, message: "No connection. Try again." };
    }
  }, [browserClient, token]);

  /** The person's actions, newest first; null when actions are off or can't be loaded (the screen then hides them). */
  const list = useCallback(async (): Promise<RoziAction[] | null> => {
    const accessToken = await token();
    if (!accessToken) return null;
    try {
      const response = await fetch("/api/rozi/actions", { headers: { Authorization: `Bearer ${accessToken}` } });
      const json = await response.json().catch(() => null) as { ok?: boolean; actions?: unknown[] } | null;
      return json?.ok && Array.isArray(json.actions) ? json.actions.map(parseAction).filter((item): item is RoziAction => item !== null) : null;
    } catch {
      return null;
    }
  }, [token]);

  const port = useCallback((): ApplyPort => {
    const state = getState();
    return {
      profileId: state.profile.id,
      sessionOn: (date) => sessionForDate(getState(), date),
      newSessionId: () => crypto.randomUUID(),
      saveSession: (session) => upsertSession(session),
      saveRoutine: async (routine) => { await saveRoutine(browserClient, { id: `local-${Date.now()}`, ...routine, updatedAt: new Date().toISOString() }); },
      saveProfile: async (changes) => {
        updateProfile(changes, { quiet: true });
        if (browserClient) await saveCloudProfile(browserClient, { ...getState().profile, ...changes });
      },
      saveWeight: async (entry) => {
        const saved = browserClient ? await saveCloudBodyWeightEntry(browserClient, getState().profile.id, entry) : entry;
        const current = getState();
        updateState({ ...current, bodyWeightEntries: upsertBodyWeightEntry(current.bodyWeightEntries, saved) });
      },
      addWater: async (date, ml) => { if (browserClient) await addCloudWater(browserClient, date, ml); },
    };
  }, [getState, updateState, updateProfile, upsertSession, browserClient]);

  const approve = useCallback((id: string, hash: string): Promise<ActionCallResult> =>
    approveFlow(id, hash, { call, apply: (payload) => applyAction(payload, port()) }), [call, port]);

  const reject = useCallback((id: string) => call(id, { op: "reject" }), [call]);

  return { approve, reject, list };
}
