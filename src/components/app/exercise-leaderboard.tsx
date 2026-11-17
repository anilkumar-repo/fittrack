"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Trophy } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { Avatar } from "./avatar";
import { liftBests, liftLeaderboard, sharesLifts, type LiftRow } from "@/lib/friends";
import { loadFriendsData, type FriendsData } from "@/lib/friends-repository";
import { shortDate } from "@/lib/dates";
import { kgToDisplay } from "@/lib/logging";
import { EmptyState } from "@/components/ui/empty-state";

/** Friends' summaries, kept for a minute so switching tabs or exercises doesn't reload them every time. */
let cached: { userId: string; at: number; data: FriendsData } | null = null;

/**
 * The exercise guide's "Friends" tab: you and your friends ranked by best set (estimated one-rep max; bodyweight
 * moves by reps). Friends appear only if they share their best lifts; your own row always comes from this phone.
 */
export function ExerciseLeaderboard({ exerciseId }: { exerciseId: string }) {
  const { state, isDemo, browserClient, currentDate, recordedSessions, weightUnit } = useFitTrack();
  const userId = state.profile.id;
  const [data, setData] = useState<FriendsData | null>(() => (cached && cached.userId === userId ? cached.data : null));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isDemo || !browserClient) return;
    if (cached && cached.userId === userId && Date.now() - cached.at < 60_000) return;
    let live = true;
    loadFriendsData(browserClient, userId, currentDate)
      .then((loaded) => { cached = { userId, at: Date.now(), data: loaded }; if (live) setData(loaded); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [isDemo, browserClient, userId, currentDate]);

  const mine = useMemo(() => liftBests(recordedSessions), [recordedSessions]);
  const sharing = sharesLifts(state.profile, currentDate);
  const rows = useMemo(() => {
    const friends = (data?.friendIds ?? []).flatMap((id) => {
      const stats = data?.stats.get(id);
      return stats ? [{ userId: id, name: stats.displayName, ...(stats.avatar ? { avatar: stats.avatar } : {}), bests: stats.liftBests }] : [];
    });
    return liftLeaderboard(exerciseId, [{ userId, name: "You", ...(state.profile.avatar ? { avatar: state.profile.avatar } : {}), bests: mine }, ...friends], userId);
  }, [data, exerciseId, mine, userId, state.profile.avatar]);

  if (isDemo || !browserClient) return <EmptyState mood="hello" title="Compare with friends" text="Sign in and add friends to see who lifts the most on this exercise." />;
  if (failed && !data) return <EmptyState mood="grumpy" title="Couldn’t load friends" text="Check your connection and open this tab again." />;
  if (!data) return <p className="card-note" role="status">Loading friends…</p>;
  if (!data.friendIds.length) return <EmptyState mood="hello" title="No friends yet" text="Add a friend to compare your best sets on every exercise." action={{ label: "Add friends", href: "/friends" }} />;

  const label = (row: LiftRow) => row.best.kg > 0 ? `${kgToDisplay(row.best.kg, weightUnit)} ${weightUnit} × ${row.best.reps}` : `${row.best.reps} reps`;
  return (
    <div className="lift-board">
      {rows.length ? <ol>
        {rows.map((row) => (
          <li key={row.userId} className={`lift-row ${row.you ? "you" : ""}`}>
            <span className={`lift-rank rank-${row.rank}`}>{row.rank === 1 ? <Trophy aria-label="First" /> : row.rank}</span>
            <Avatar value={row.avatar} name={row.name} size={36} />
            <span className="lift-who"><strong>{row.name}</strong><small>{shortDate(row.best.date)}</small></span>
            <span className="lift-best"><strong>{label(row)}</strong>{row.best.e1rm && <small>Est. 1RM {kgToDisplay(row.best.e1rm, weightUnit)} {weightUnit}</small>}</span>
          </li>
        ))}
      </ol> : <EmptyState mood="workout" title="No one has logged this yet" text="Be the first: log it in a workout and your best set shows here." />}
      <p className="card-note lift-note">
        {sharing
          ? <>Your friends see your best set of each exercise. <Link href="/settings?section=data">Change</Link></>
          : <><Lock aria-hidden="true" /> You’re not sharing your lifts, so only you see your row. <Link href="/settings?section=data">Share them</Link></>}
        {" "}Friends who don’t share aren’t listed. Warm-ups never count.
      </p>
    </div>
  );
}
