import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuddyDay } from "./buddies";
import type { TrainingGoal } from "./types";

type Row = Record<string, unknown>;
const NOT_READY = "Train together needs the latest database update. Please try again after it's installed.";

function fail(error: { code?: string; message: string }): never {
  const missing = error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST205" || error.code === "42P01";
  throw new Error(missing ? NOT_READY : error.message);
}

const GOALS = new Set(["general", "muscle", "tone", "fatloss"]);
const goalOf = (value: unknown): TrainingGoal => (GOALS.has(String(value)) ? value : "general") as TrainingGoal;
const daysOf = (value: unknown): number[] => (Array.isArray(value) ? value.map(Number).filter((day) => day >= 0 && day <= 6) : []);

export interface BuddyInvite { groupId: string; from: string; fromAvatar?: string; goal: TrainingGoal; trainingDays: number[]; members: number }
export interface BuddyMember { userId: string; name: string; avatar?: string; status: "active" | "invited"; shareReasons: boolean; atGym: boolean; lightWeek: boolean }
export interface BuddyProposal { id: string; by: string; goal: TrainingGoal; trainingDays: number[]; acceptedBy: string[]; at: string }
/** `coach`: the member who is every other member's trainer — their plan changes apply straight away. */
export interface BuddyGroup { id: string; goal: TrainingGoal; trainingDays: number[]; anchorDate: string; createdBy: string; coach: string | null }
export interface BuddyOverview {
  invites: BuddyInvite[];
  group: BuddyGroup | null;
  members: BuddyMember[];
  days: BuddyDay[];
  carried: string[];
  proposal: BuddyProposal | null;
}

/** Everything the buddy screens need: invites, your group, buddies, recent days, carries, an open plan change. */
export async function loadBuddyOverview(client: SupabaseClient, since: string): Promise<BuddyOverview | null> {
  const { data, error } = await client.rpc("buddy_overview", { p_since: since });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null; // not installed yet
    fail(error);
  }
  const value = (data ?? {}) as Row;
  const group = value.group as Row | null;
  const proposal = value.proposal as Row | null;
  return {
    invites: ((value.invites ?? []) as Row[]).map((row) => ({
      groupId: String(row.group_id), from: String(row.from ?? "A friend"), goal: goalOf(row.goal), trainingDays: daysOf(row.training_days), members: Number(row.members ?? 1),
      ...(typeof row.from_avatar === "string" && row.from_avatar ? { fromAvatar: row.from_avatar } : {}),
    })),
    group: group ? { id: String(group.id), goal: goalOf(group.goal), trainingDays: daysOf(group.training_days), anchorDate: String(group.anchor_date ?? ""), createdBy: String(group.created_by ?? ""), coach: typeof group.coach === "string" && group.coach ? group.coach : null } : null,
    members: ((value.members ?? []) as Row[]).map((row) => ({
      userId: String(row.user_id), name: String(row.name ?? "Buddy"), status: row.status === "invited" ? "invited" : "active",
      shareReasons: row.share_reasons === true, atGym: row.at_gym === true, lightWeek: row.light_week === true,
      ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
    })),
    days: ((value.days ?? []) as Row[]).map((row) => ({ userId: String(row.user_id), date: String(row.date), status: String(row.status), reason: typeof row.reason === "string" ? row.reason : null })),
    carried: ((value.carries ?? []) as Row[]).map((row) => String(row.date)),
    proposal: proposal ? { id: String(proposal.id), by: String(proposal.by), goal: goalOf(proposal.goal), trainingDays: daysOf(proposal.training_days), acceptedBy: Array.isArray(proposal.accepted_by) ? proposal.accepted_by.map(String) : [], at: String(proposal.at ?? "") } : null,
  };
}

async function call<T>(client: SupabaseClient, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) fail(error);
  return data as T;
}

export const inviteBuddy = (client: SupabaseClient, friendId: string) => call<string>(client, "invite_buddy", { p_friend: friendId });
export const respondBuddyInvite = (client: SupabaseClient, groupId: string, accept: boolean) => call<boolean>(client, "respond_buddy_invite", { p_group: groupId, p_accept: accept });
/** Leave your group, or (with `memberId`) cancel an invite you sent. */
export const leaveBuddyGroup = (client: SupabaseClient, memberId?: string) => call<boolean>(client, "leave_buddy_group", memberId ? { p_member: memberId } : {});
export const proposeBuddyPlan = (client: SupabaseClient, goal: TrainingGoal, trainingDays: number[]) => call<string>(client, "propose_buddy_plan", { p_goal: goal, p_training_days: trainingDays });
export const respondBuddyProposal = (client: SupabaseClient, proposalId: string, accept: boolean) => call<"accepted" | "waiting" | "declined">(client, "respond_buddy_proposal", { p_proposal: proposalId, p_accept: accept });
export const setAtGym = (client: SupabaseClient, on: boolean) => call<string | null>(client, "set_at_gym", { p_on: on });
export const setBuddyShareReasons = (client: SupabaseClient, on: boolean) => call<boolean>(client, "set_buddy_share_reasons", { p_on: on });
export const carryBuddyStreak = (client: SupabaseClient, date: string) => call<boolean>(client, "carry_buddy_streak", { p_date: date });

/** Tells buddies you finished, or that you're resting today (best effort; the server decides who to notify). */
export async function notifyBuddies(client: SupabaseClient, kind: "finished" | "skipped"): Promise<void> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch("/api/push/buddy", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ kind }) }).catch(() => undefined);
}
