import type { SupabaseClient } from "@supabase/supabase-js";
import type { Routine } from "./pro-tracking";

/**
 * Your own routines: saved to the account when signed in (the `routines` table), otherwise on this device.
 * Before the Phase 4 migration exists, signed-in people fall back to the device copy too.
 */
const LOCAL_KEY = "rozfit-routines-v1";
const MISSING = new Set(["PGRST205", "42P01"]);

export function readLocalRoutines(): Routine[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const list = raw ? JSON.parse(raw) as Routine[] : [];
    return Array.isArray(list) ? list.filter((item) => item && typeof item.id === "string" && Array.isArray(item.exercises)) : [];
  } catch { return []; }
}

function writeLocal(list: Routine[]) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

export async function loadRoutines(client: SupabaseClient | null): Promise<Routine[]> {
  if (!client) return readLocalRoutines();
  const { data, error } = await client.from("routines").select("id,name,exercises,updated_at").order("updated_at", { ascending: false });
  if (error) { if (MISSING.has(error.code ?? "")) return readLocalRoutines(); throw new Error(error.message); }
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name), exercises: row.exercises as Routine["exercises"], updatedAt: String(row.updated_at) }));
}

export async function saveRoutine(client: SupabaseClient | null, routine: Routine): Promise<Routine> {
  const saved = { ...routine, updatedAt: new Date().toISOString() };
  if (client) {
    const isNew = routine.id.startsWith("local-");
    const row = { name: saved.name.trim(), exercises: saved.exercises, updated_at: saved.updatedAt };
    const { data, error } = isNew
      ? await client.from("routines").insert(row).select("id").single()
      : await client.from("routines").update(row).eq("id", routine.id).select("id").single();
    if (!error) return { ...saved, id: String(data.id) };
    if (!MISSING.has(error.code ?? "")) throw new Error(error.message);
  }
  const list = readLocalRoutines().filter((item) => item.id !== saved.id);
  writeLocal([saved, ...list]);
  return saved;
}

export async function deleteRoutine(client: SupabaseClient | null, id: string): Promise<void> {
  if (client && !id.startsWith("local-")) {
    const { error } = await client.from("routines").delete().eq("id", id);
    if (error && !MISSING.has(error.code ?? "")) throw new Error(error.message);
  }
  writeLocal(readLocalRoutines().filter((item) => item.id !== id));
}
