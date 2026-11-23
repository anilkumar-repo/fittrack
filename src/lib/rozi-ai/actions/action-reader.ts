// ---------- Rozi actions: re-reading the person's data to check a result (SERVER ONLY) ----------
//
// Runs with the person's own sign-in (row-level security), after the app reported an action as applied.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOwnTrainingData } from "../../supabase-repository";
import type { VerifyState } from "./action-registry.ts";
import type { RoziAction } from "./action-types.ts";

export async function readForVerify(client: SupabaseClient, userId: string, action: RoziAction, approvedAt: string): Promise<VerifyState | null> {
  const data = await loadOwnTrainingData(client, userId);
  if (!data) return null;
  const state: VerifyState = { sessions: data.sessions, profile: data.profile, bodyWeightEntries: data.bodyWeightEntries };
  if (action.payload.type === "save_routine") {
    const { data: rows } = await client.from("routines").select("name").order("updated_at", { ascending: false }).limit(30);
    state.routineNames = (rows ?? []).map((row) => String(row.name));
  }
  if (action.payload.type === "log_water") {
    const { data: rows } = await client.from("water_logs").select("ml").eq("logged_on", action.payload.date).gte("created_at", approvedAt);
    state.waterLogsSinceApproval = (rows ?? []).map((row) => Number(row.ml));
  }
  return state;
}
