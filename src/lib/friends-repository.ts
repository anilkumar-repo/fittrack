import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInviteCode, type Challenge, type FriendStats, type Nudge } from "./friends";
import type { TrainingGoal } from "./types";

type Row = Record<string, unknown>;

function mapStats(row: Row): FriendStats {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? "Friend"),
    goal: (["general", "muscle", "tone"].includes(String(row.goal)) ? row.goal : "general") as TrainingGoal,
    currentStreak: Number(row.current_streak ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    weekCount: Number(row.week_count ?? 0),
    weekGoal: Number(row.week_goal ?? 3),
    lastWorkoutDate: typeof row.last_workout_date === "string" ? row.last_workout_date : null,
    recentDates: Array.isArray(row.recent_dates) ? row.recent_dates.map(String) : [],
  };
}

/** Shares this person's summary with friends. */
export async function publishFriendStats(client: SupabaseClient, stats: FriendStats): Promise<void> {
  const { error } = await client.from("friend_stats").upsert({
    user_id: stats.userId,
    display_name: stats.displayName.slice(0, 80),
    goal: stats.goal,
    current_streak: Math.min(2000, stats.currentStreak),
    best_streak: Math.min(2000, stats.bestStreak),
    week_count: Math.min(14, stats.weekCount),
    week_goal: stats.weekGoal,
    last_workout_date: stats.lastWorkoutDate,
    recent_dates: stats.recentDates.slice(-62),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

export interface FriendsData {
  friendIds: string[];
  /** Everyone whose summary this person may see: friends and fellow challenge members. */
  stats: Map<string, FriendStats>;
  challenges: Challenge[];
  /** Nudges this person sent today, by recipient. */
  nudgedToday: Set<string>;
  /** Unseen nudges sent to this person. */
  inbox: Nudge[];
}

export async function loadFriendsData(client: SupabaseClient, userId: string, today: string): Promise<FriendsData> {
  const [friendships, challengeRows, memberRows, sent, received] = await Promise.all([
    client.from("friendships").select("friend_id").eq("user_id", userId),
    client.from("challenges").select("*").order("starts_on", { ascending: false }).limit(40),
    client.from("challenge_members").select("challenge_id, user_id"),
    client.from("nudges").select("to_user").eq("from_user", userId).eq("sent_on", today),
    client.from("nudges").select("*").eq("to_user", userId).is("seen_at", null).order("created_at", { ascending: false }).limit(10),
  ]);
  for (const result of [friendships, challengeRows, memberRows, sent, received]) if (result.error) throw result.error;

  const friendIds = (friendships.data as Row[]).map((row) => String(row.friend_id));
  const members = new Map<string, string[]>();
  for (const row of memberRows.data as Row[]) {
    const key = String(row.challenge_id);
    members.set(key, [...(members.get(key) ?? []), String(row.user_id)]);
  }
  const challenges: Challenge[] = (challengeRows.data as Row[]).map((row) => ({
    id: String(row.id), creatorId: String(row.creator_id), title: String(row.title), period: row.period === "month" ? "month" : "week",
    target: Number(row.target), startsOn: String(row.starts_on), endsOn: String(row.ends_on), memberIds: members.get(String(row.id)) ?? [],
  }));

  const visible = [...new Set([userId, ...friendIds, ...challenges.flatMap((challenge) => challenge.memberIds)])];
  const statsResult = await client.from("friend_stats").select("*").in("user_id", visible);
  if (statsResult.error) throw statsResult.error;
  const stats = new Map((statsResult.data as Row[]).map((row) => [String(row.user_id), mapStats(row)]));

  return {
    friendIds,
    stats,
    challenges,
    nudgedToday: new Set((sent.data as Row[]).map((row) => String(row.to_user))),
    inbox: (received.data as Row[]).map((row) => ({
      id: String(row.id), fromUser: String(row.from_user), toUser: String(row.to_user), message: String(row.message ?? ""),
      sentOn: String(row.sent_on), seenAt: typeof row.seen_at === "string" ? row.seen_at : null,
    })),
  };
}

/** Creates a one-time code a friend can enter (or open as a link) to connect. */
export async function createFriendInvite(client: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateInviteCode();
    const { error } = await client.from("friend_invites").insert({ code });
    if (!error) return code;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not create a code. Please try again.");
}

export async function acceptFriendInvite(client: SupabaseClient, code: string): Promise<string> {
  const { data, error } = await client.rpc("accept_friend_invite", { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function removeFriend(client: SupabaseClient, userId: string, friendId: string): Promise<void> {
  const { error } = await client.from("friendships").delete().or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
  if (error) throw error;
}

export async function sendNudge(client: SupabaseClient, toUser: string, message: string): Promise<void> {
  const { error } = await client.from("nudges").insert({ to_user: toUser, message: message.slice(0, 120) });
  if (error) throw new Error(error.code === "23505" ? "You already nudged this friend today." : error.message);
}

export async function markNudgesSeen(client: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await client.from("nudges").update({ seen_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

export async function createChallenge(client: SupabaseClient, userId: string, input: Omit<Challenge, "id" | "creatorId">): Promise<void> {
  const { data, error } = await client.from("challenges").insert({
    title: input.title, period: input.period, target: input.target, starts_on: input.startsOn, ends_on: input.endsOn,
  }).select("id").single();
  if (error) throw error;
  const id = String((data as Row).id);
  const memberIds = [...new Set([userId, ...input.memberIds])];
  const { error: memberError } = await client.from("challenge_members").insert(memberIds.map((member) => ({ challenge_id: id, user_id: member })));
  if (memberError) {
    await client.from("challenges").delete().eq("id", id);
    throw memberError;
  }
}

export async function leaveChallenge(client: SupabaseClient, challengeId: string, userId: string): Promise<void> {
  const { error } = await client.from("challenge_members").delete().eq("challenge_id", challengeId).eq("user_id", userId);
  if (error) throw error;
}
