"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, Check, Copy, Flame, Share2, Trophy, UserPlus, X } from "lucide-react";
import { Rozi } from "@/components/app/rozi";
import { useFitTrack } from "@/components/app/fit-track-provider";
import {
  challengeIsActive, challengeLeaderboard, challengeWindow, computeFriendStats, daysLeft, isInviteCode, lastWorkoutLabel, NUDGE_MESSAGES,
  type Challenge, type FriendStats,
} from "@/lib/friends";
import {
  acceptFriendInvite, createChallenge, createFriendInvite, leaveChallenge, loadFriendsData, removeFriend, sendNudge, type FriendsData,
} from "@/lib/friends-repository";
import { goalTitle } from "@/lib/program";
import { shortDate } from "@/lib/dates";

export function FriendsScreen() {
  const { state, isDemo, browserClient, currentDate, recordedSessions } = useFitTrack();
  const searchParams = useSearchParams();
  const linkCode = (searchParams.get("invite") ?? "").toUpperCase();
  const [data, setData] = useState<FriendsData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [linkHandled, setLinkHandled] = useState(false);
  const userId = state.profile.id;
  const me = useMemo(() => computeFriendStats(state.profile, recordedSessions, currentDate), [state.profile, recordedSessions, currentDate]);

  const refresh = useCallback(async () => {
    if (!browserClient || isDemo) return;
    try {
      setData(await loadFriendsData(browserClient, userId, currentDate));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Friends could not be loaded.");
    }
  }, [browserClient, isDemo, userId, currentDate]);

  useEffect(() => {
    if (!browserClient || isDemo) return;
    let cancelled = false;
    loadFriendsData(browserClient, userId, currentDate)
      .then((loaded) => { if (!cancelled) { setData(loaded); setLoadError(""); } })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Friends could not be loaded."); });
    return () => { cancelled = true; };
  }, [browserClient, isDemo, userId, currentDate]);

  async function run(label: string, action: () => Promise<string | void>) {
    setBusy(label);
    setMessage("");
    try {
      const done = await action();
      if (done) setMessage(done);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy("");
    }
  }

  if (isDemo) {
    return (
      <section className="friends">
        <article className="panel friends-empty">
          <Rozi mood="hello" size={150} />
          <h2>Train together</h2>
          <p>Invite friends to see each other’s streaks, send a nudge on lazy days, and start weekly or monthly challenges. Friends need an account so your progress can be shared safely.</p>
          <Link className="button button-primary" href="/sign-in">Sign in to add friends</Link>
        </article>
      </section>
    );
  }

  const client = browserClient;
  const friends = (data?.friendIds ?? []).map((id) => data?.stats.get(id) ?? { userId: id, displayName: "Friend", goal: "general", currentStreak: 0, bestStreak: 0, weekCount: 0, weekGoal: 3, lastWorkoutDate: null, recentDates: [] } as FriendStats);
  const stats = new Map(data?.stats ?? []);
  stats.set(userId, me);
  const challenges = data?.challenges ?? [];
  const active = challenges.filter((challenge) => challengeIsActive(challenge, currentDate));
  const past = challenges.filter((challenge) => challenge.endsOn < currentDate).slice(0, 5);
  const inviteLink = inviteCode && typeof window !== "undefined" ? `${window.location.origin}/friends?invite=${inviteCode}` : "";

  return (
    <section className="friends">
      <header className="friends-head">
        <Rozi mood="cheer" size={96} priority />
        <div><h2>Friends</h2><p>Streaks, nudges and challenges. Friends see your streak and workout days — never your weights or notes.</p></div>
      </header>

      {loadError && <p className="error-inline" role="alert">{loadError}</p>}
      {message && <p className="friends-message" role="status">{message}</p>}

      {linkCode && !linkHandled && isInviteCode(linkCode) && <article className="panel friends-accept">
        <UserPlus aria-hidden="true" />
        <div><h3>Friend invite</h3><p>Someone invited you with code <strong>{linkCode}</strong>.</p></div>
        <button type="button" className="button button-primary" disabled={!client || busy === "accept"} onClick={() => void run("accept", async () => { await acceptFriendInvite(client!, linkCode); setLinkHandled(true); return "You’re now friends! 🎉"; })}>Accept</button>
        <button type="button" className="text-button" onClick={() => setLinkHandled(true)}>Not now</button>
      </article>}

      <article className="panel friends-invite">
        <h3><UserPlus aria-hidden="true" /> Add a friend</h3>
        {inviteCode ? <div className="invite-code">
          <span>Share this code (works once, for 7 days)</span>
          <strong>{inviteCode}</strong>
          <div className="invite-actions">
            <button type="button" className="button button-primary" onClick={() => {
              const text = `Join me on RozFit! Open ${inviteLink} or enter code ${inviteCode} in Friends.`;
              if (navigator.share) void navigator.share({ title: "Train with me on RozFit", text, url: inviteLink }).catch(() => undefined);
              else void navigator.clipboard.writeText(text).then(() => setMessage("Invite copied. Paste it in a message to your friend."));
            }}><Share2 aria-hidden="true" /> Share invite</button>
            <button type="button" className="button button-subtle" onClick={() => void navigator.clipboard.writeText(inviteCode).then(() => setMessage("Code copied."))}><Copy aria-hidden="true" /> Copy code</button>
          </div>
        </div> : <button type="button" className="button button-primary" disabled={!client || busy === "invite"} onClick={() => void run("invite", async () => { setInviteCode(await createFriendInvite(client!)); })}>{busy === "invite" ? "Creating…" : "Create an invite"}</button>}
        <form className="code-entry" onSubmit={(event) => { event.preventDefault(); if (!isInviteCode(enteredCode)) { setMessage("Codes are 8 letters and numbers."); return; } void run("enter", async () => { await acceptFriendInvite(client!, enteredCode); setEnteredCode(""); return "You’re now friends! 🎉"; }); }}>
          <label htmlFor="friend-code">Got a code?</label>
          <div><input id="friend-code" value={enteredCode} onChange={(event) => setEnteredCode(event.target.value.toUpperCase())} maxLength={8} placeholder="ABCD2345" autoCapitalize="characters" autoComplete="off" /><button type="submit" className="button button-subtle" disabled={busy === "enter"}>Add</button></div>
        </form>
      </article>

      <article className="panel">
        <div className="panel-title"><h3>Your friends</h3><span className="panel-count">{friends.length}</span></div>
        {!data && !loadError ? <p className="loading-inline" role="status">Loading friends…</p> : friends.length === 0 ? <p className="field-hint">No friends yet. Create an invite and send it to someone you’d like to train with.</p> : <ul className="friend-list">
          {friends.map((friend) => {
            const nudged = data?.nudgedToday.has(friend.userId) ?? false;
            return (
              <li key={friend.userId} className="friend-card">
                <span className="friend-avatar" aria-hidden="true">{friend.displayName.slice(0, 1).toUpperCase()}</span>
                <div className="friend-main">
                  <strong>{friend.displayName}</strong>
                  <small>{goalTitle(friend.goal)} · {lastWorkoutLabel(friend.lastWorkoutDate, currentDate)}</small>
                  <div className="friend-week" aria-label={`${friend.weekCount} of ${friend.weekGoal} workouts this week`}><span style={{ width: `${Math.min(100, (friend.weekCount / friend.weekGoal) * 100)}%` }} /></div>
                  <small>{friend.weekCount} / {friend.weekGoal} this week</small>
                </div>
                <span className="friend-streak"><Flame aria-hidden="true" /> {friend.currentStreak}</span>
                <div className="friend-actions">
                  <button type="button" className="button button-subtle small" disabled={nudged || busy === `nudge-${friend.userId}`} onClick={() => void run(`nudge-${friend.userId}`, async () => {
                    await sendNudge(client!, friend.userId, NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)]);
                    return `Nudge sent to ${friend.displayName}.`;
                  })}>{nudged ? <><Check aria-hidden="true" /> Nudged</> : <><Bell aria-hidden="true" /> Nudge</>}</button>
                  <button type="button" className="icon-button" aria-label={`Remove ${friend.displayName}`} onClick={() => {
                    if (window.confirm(`Remove ${friend.displayName} from your friends? You’ll stop seeing each other’s streaks.`)) void run(`remove-${friend.userId}`, async () => { await removeFriend(client!, userId, friend.userId); return `${friend.displayName} was removed.`; });
                  }}><X aria-hidden="true" /></button>
                </div>
              </li>
            );
          })}
        </ul>}
      </article>

      <ChallengeSection friends={friends} me={me} challenges={active} past={past} stats={stats} today={currentDate} userId={userId} busy={busy}
        onCreate={(input) => void run("challenge", async () => { await createChallenge(client!, userId, input); return "Challenge started! Good luck 🏆"; })}
        onLeave={(id) => void run(`leave-${id}`, async () => { await leaveChallenge(client!, id, userId); return "You left the challenge."; })} />
    </section>
  );
}

function ChallengeSection({ friends, me, challenges, past, stats, today, userId, busy, onCreate, onLeave }: {
  friends: FriendStats[]; me: FriendStats; challenges: Challenge[]; past: Challenge[]; stats: Map<string, FriendStats>; today: string; userId: string; busy: string;
  onCreate: (input: Omit<Challenge, "id" | "creatorId">) => void; onLeave: (id: string) => void;
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [target, setTarget] = useState(me.weekGoal);
  const [picked, setPicked] = useState<string[]>([]);
  const range = challengeWindow(period, today);

  return (
    <article className="panel">
      <div className="panel-title"><h3><Trophy aria-hidden="true" /> Challenges</h3><span className="panel-count">{challenges.length} active</span></div>
      {challenges.length > 0 && <ul className="challenge-list">{challenges.map((challenge) => (
        <li key={challenge.id} className="challenge-card">
          <div className="challenge-top"><strong>{challenge.title}</strong><small>{daysLeft(challenge, today)} days left · ends {shortDate(challenge.endsOn)}</small></div>
          <ol className="leaderboard">{challengeLeaderboard(challenge, stats).map((row, index) => (
            <li key={row.userId} className={row.userId === userId ? "me" : ""}>
              <span className="rank">{index + 1}</span>
              <span className="who">{row.userId === userId ? "You" : row.name}{row.finished ? " ✓" : ""}</span>
              <span className="bar"><span style={{ width: `${row.percent}%` }} /></span>
              <span className="count">{row.done}/{challenge.target}</span>
            </li>
          ))}</ol>
          <button type="button" className="text-button" disabled={busy === `leave-${challenge.id}`} onClick={() => onLeave(challenge.id)}>Leave challenge</button>
        </li>
      ))}</ul>}

      {friends.length === 0 ? <p className="field-hint">Add a friend first, then challenge each other to a weekly or monthly goal.</p> : <form className="challenge-form" onSubmit={(event) => {
        event.preventDefault();
        if (!picked.length) return;
        onCreate({ title: `${target} workouts this ${period}`, period, target, startsOn: range.startsOn, endsOn: range.endsOn, memberIds: picked });
        setPicked([]);
      }}>
        <h4>Start a challenge</h4>
        <div className="segmented">{(["week", "month"] as const).map((value) => <button key={value} type="button" className={period === value ? "selected" : ""} aria-pressed={period === value} onClick={() => { setPeriod(value); setTarget(value === "week" ? me.weekGoal : me.weekGoal * 4); }}>{value === "week" ? "This week" : "This month"}</button>)}</div>
        <label className="challenge-target">Workouts to finish
          <input type="number" min={1} max={period === "week" ? 7 : 31} value={target} onChange={(event) => setTarget(Math.max(1, Math.min(period === "week" ? 7 : 31, Number(event.target.value) || 1)))} />
        </label>
        <fieldset className="challenge-friends"><legend>Who’s in?</legend>
          {friends.map((friend) => <label key={friend.userId}><input type="checkbox" checked={picked.includes(friend.userId)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, friend.userId] : current.filter((id) => id !== friend.userId))} /> {friend.displayName}</label>)}
        </fieldset>
        <p className="field-hint">{shortDate(range.startsOn)} – {shortDate(range.endsOn)}. Workouts already done this {period} count.</p>
        <button type="submit" className="button button-primary" disabled={!picked.length || busy === "challenge"}>{busy === "challenge" ? "Starting…" : `Start: ${target} workouts this ${period}`}</button>
      </form>}

      {past.length > 0 && <details className="past-challenges"><summary>Finished challenges</summary><ul>{past.map((challenge) => {
        const top = challengeLeaderboard(challenge, stats)[0];
        return <li key={challenge.id}>{challenge.title} ({shortDate(challenge.startsOn)}) · top: {top ? `${top.userId === userId ? "You" : top.name} (${top.done})` : "—"}</li>;
      })}</ul></details>}
    </article>
  );
}
