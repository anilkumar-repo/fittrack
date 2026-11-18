import type { SupabaseClient } from "@supabase/supabase-js";
import { readShares, type ClientDay, type TrainerShares } from "./trainers";

type Row = Record<string, unknown>;

const NOT_READY = "This trainer feature needs the latest database update. Please try again after it's installed.";

function fail(error: { code?: string; message: string }): never {
  const missing = error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST205" || error.code === "42P01";
  throw new Error(missing ? NOT_READY : error.message);
}

// ---------- Client side ----------

/** Asks a friend who is a trainer to be your trainer. Returns "requested" or "active" (already linked). */
export async function requestTrainer(client: SupabaseClient, trainerId: string): Promise<"requested" | "active"> {
  const { data, error } = await client.rpc("request_trainer", { p_trainer: trainerId });
  if (error) fail(error);
  return data === "active" ? "active" : "requested";
}

/** Changes what one trainer may see. Returns the saved settings. */
export async function setTrainerShares(client: SupabaseClient, trainerId: string, shares: Partial<TrainerShares>): Promise<TrainerShares> {
  const { data, error } = await client.rpc("set_trainer_shares", { p_trainer: trainerId, p_shares: shares });
  if (error) fail(error);
  return readShares(data);
}

/** Which friends are trainers (so their card can offer "Ask to be my trainer"). Empty before the update. */
export async function loadFriendTrainers(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client.rpc("friend_trainers");
  if (error) return new Set();
  return new Set(((data ?? []) as Row[]).map((row) => String(row.trainer_id)));
}

/** Who a gym QR / invite code belongs to, or null if it's not valid (or not signed in). */
/** `together`: a "Train together" QR (using it also joins the trainer's buddy group). */
export interface TrainerInviteInfo { id: string; name: string; avatar?: string; together: boolean }

export async function trainerInviteInfo(client: SupabaseClient, code: string): Promise<TrainerInviteInfo | null> {
  const { data, error } = await client.rpc("trainer_invite_info", { p_code: code });
  if (error) fail(error);
  const row = ((data ?? []) as Row[])[0];
  return row ? { id: String(row.trainer_id), name: String(row.display_name ?? "Your trainer"), together: row.together === true, ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}) } : null;
}

export interface TrainerMessage { id: string; trainerId: string; body: string; at: string }

/** Recent messages from the client's trainers (row security only returns trainers they're linked to). */
export async function loadTrainerMessages(client: SupabaseClient, since: string): Promise<TrainerMessage[]> {
  const { data, error } = await client.from("trainer_broadcasts").select("id, trainer_id, body, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(10);
  if (error) return [];
  return ((data ?? []) as Row[]).map((row) => ({ id: String(row.id), trainerId: String(row.trainer_id), body: String(row.body), at: String(row.created_at) }));
}

// ---------- Trainer side ----------

export interface TrainerRequest { clientId: string; name: string; avatar?: string; at: string }

export async function loadTrainerRequests(client: SupabaseClient): Promise<TrainerRequest[]> {
  const { data, error } = await client.rpc("trainer_requests");
  if (error) fail(error);
  return ((data ?? []) as Row[]).map((row) => ({
    clientId: String(row.client_id), name: String(row.display_name ?? "Someone"), at: String(row.requested_at ?? ""),
    ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
  }));
}

export async function respondTrainerRequest(client: SupabaseClient, clientId: string, accept: boolean): Promise<void> {
  const { error } = await client.rpc("respond_trainer_request", { p_client: clientId, p_accept: accept });
  if (error) fail(error);
}

export async function trainerRemoveClient(client: SupabaseClient, clientId: string): Promise<void> {
  const { error } = await client.rpc("trainer_remove_client", { p_client: clientId });
  if (error) fail(error);
}

/** Recent training days of every client who shares workouts, grouped by client. */
export async function loadClientDays(client: SupabaseClient, since: string): Promise<Map<string, ClientDay[]>> {
  const { data, error } = await client.rpc("trainer_client_sessions", { p_since: since });
  if (error) fail(error);
  const byClient = new Map<string, ClientDay[]>();
  for (const row of (data ?? []) as Row[]) {
    const id = String(row.client_id);
    const day: ClientDay = {
      date: String(row.workout_date), status: String(row.status),
      ...(row.energy !== null && row.energy !== undefined ? { energy: Number(row.energy) } : {}),
      ...(row.soreness !== null && row.soreness !== undefined ? { soreness: Number(row.soreness) } : {}),
      ...(typeof row.pain === "boolean" ? { pain: row.pain } : {}),
      ...(typeof row.missed_reason === "string" ? { missedReason: row.missed_reason } : {}),
    };
    byClient.set(id, [...(byClient.get(id) ?? []), day]);
  }
  return byClient;
}

export interface SentBroadcast { id: string; body: string; at: string }

export async function loadMyBroadcasts(client: SupabaseClient, trainerId: string): Promise<SentBroadcast[]> {
  const { data, error } = await client.from("trainer_broadcasts").select("id, body, created_at").eq("trainer_id", trainerId).order("created_at", { ascending: false }).limit(5);
  if (error) return [];
  return ((data ?? []) as Row[]).map((row) => ({ id: String(row.id), body: String(row.body), at: String(row.created_at) }));
}

/** Sends a message to all clients, then asks the server to push it to their phones (best effort). */
export async function sendBroadcast(client: SupabaseClient, body: string): Promise<string> {
  const { data, error } = await client.rpc("send_trainer_broadcast", { p_body: body });
  if (error) fail(error);
  const id = String(data);
  const { data: auth } = await client.auth.getSession();
  const token = auth.session?.access_token;
  if (token) await fetch("/api/push/broadcast", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ broadcastId: id }) }).catch(() => undefined);
  return id;
}

export async function deleteBroadcast(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("trainer_broadcasts").delete().eq("id", id);
  if (error) fail(error);
}

// ---------- Self-serve trainers ----------

export interface TrainerProfile { active: boolean; bio: string; specialties: string[]; suspended: boolean }

function toTrainerProfile(row: Row | null | undefined): TrainerProfile | null {
  if (!row) return null;
  return {
    active: row.active === true, bio: typeof row.bio === "string" ? row.bio : "",
    specialties: Array.isArray(row.specialties) ? row.specialties.map(String) : [], suspended: row.suspended === true,
  };
}

/** This person's own trainer profile (null if they've never turned Trainer mode on). */
export async function loadMyTrainerProfile(client: SupabaseClient, userId: string): Promise<TrainerProfile | null> {
  const { data, error } = await client.from("trainer_profiles").select("active, bio, specialties, suspended").eq("user_id", userId).maybeSingle();
  if (error) fail(error);
  return toTrainerProfile(data as Row | null);
}

/** Turns Trainer mode on or off (and saves the bio and specialities). */
export async function setTrainerMode(client: SupabaseClient, on: boolean, bio?: string, specialties?: string[]): Promise<TrainerProfile> {
  const { data, error } = await client.rpc("set_trainer_mode", { p_on: on, ...(bio !== undefined ? { p_bio: bio } : {}), ...(specialties ? { p_specialties: specialties } : {}) });
  if (error) fail(error);
  return toTrainerProfile(data as Row) ?? { active: on, bio: bio ?? "", specialties: specialties ?? [], suspended: false };
}

/** Bios and specialities of active trainers (for badges and the join page). */
export async function loadTrainerProfiles(client: SupabaseClient, ids: string[]): Promise<Map<string, TrainerProfile>> {
  if (!ids.length) return new Map();
  const { data, error } = await client.from("trainer_profiles").select("user_id, active, bio, specialties, suspended").in("user_id", ids);
  if (error) return new Map();
  return new Map(((data ?? []) as Row[]).map((row) => [String(row.user_id), toTrainerProfile(row)!]));
}

export type ReportReason = "unsafe" | "inappropriate" | "spam" | "fake" | "other";

export async function reportTrainer(client: SupabaseClient, trainerId: string, reason: ReportReason, note: string): Promise<void> {
  const { error } = await client.rpc("report_trainer", { p_trainer: trainerId, p_reason: reason, p_note: note });
  if (error) fail(error);
}

// ---------- Coach-buddy extras ----------

/** After using a "Train together" QR (accept it first): join the trainer's buddy group. */
export async function joinTrainerGroup(client: SupabaseClient, code: string): Promise<string> {
  const { data, error } = await client.rpc("join_trainer_group", { p_code: code });
  if (error) fail(error);
  return String(data);
}

/** Makes this week (Monday–Sunday) lighter for a client — and their whole group when you coach it — or turns it off. */
export async function trainerSetLightWeek(client: SupabaseClient, clientId: string, on: boolean): Promise<string | null> {
  const { data, error } = await client.rpc("trainer_set_light_week", { p_client: clientId, p_on: on });
  if (error) fail(error);
  return typeof data === "string" ? data : null;
}

/** Which clients have a lighter week right now (empty before the update). */
export async function loadLightWeeks(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client.rpc("trainer_light_weeks");
  if (error) return new Set();
  return new Set(((data ?? []) as Row[]).map((row) => String(row.client_id)));
}
