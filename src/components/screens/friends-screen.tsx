"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bell, Check, ChevronRight, Copy, Dumbbell, Flame, MessageCircle, MoreHorizontal, Search, Share2, Trophy, UserMinus, UserPlus, UserRound, Users } from "lucide-react";
import { Rozi } from "@/components/app/rozi";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import {
  challengeIsActive, challengeLeaderboard, challengeWindow, computeFriendStats, daysLeft, isInviteCode, lastWorkoutLabel, NUDGE_MESSAGES,
  type Challenge, type FriendStats,
} from "@/lib/friends";
import {
  acceptFriendInvite, createChallenge, createFriendInvite, leaveChallenge, loadFriendsData, removeFriend, sendNudge, type FriendsData,
} from "@/lib/friends-repository";
import { goalTitle } from "@/lib/program";
import { pushNudge } from "@/lib/push-client";
import { loadMyTrainers } from "@/lib/supabase-repository";
import { loadFriendTrainers, loadTrainerProfiles, requestTrainer, type TrainerProfile } from "@/lib/trainers-repository";
import { inviteBuddy } from "@/lib/buddies-repository";
import { MAX_GROUP } from "@/lib/buddies";
import { useBuddies } from "@/components/screens/buddies-screen";
import { shortDate } from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageButton } from "@/components/app/message-button";
import { useChats } from "@/components/screens/chats-screen";
import { useScrollLock } from "@/components/app/use-scroll-lock";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { loadFriendRequests } from "@/lib/discover-repository";

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
  const [tab, setTab] = useState<"friends" | "challenges" | "invite">("friends");
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [requestsWaiting, setRequestsWaiting] = useState(0);
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

  // Friends who are trainers can be asked "Be my trainer"; remember who's already linked or asked.
  const [trainerFriends, setTrainerFriends] = useState<Set<string>>(new Set());
  const [trainerStatus, setTrainerStatus] = useState<Map<string, "active" | "requested">>(new Map());
  const [trainerInfo, setTrainerInfo] = useState<Map<string, TrainerProfile>>(new Map());
  // Train together: who's already in your group or invited, and whether there's room for one more.
  const { overview: buddies, refresh: refreshBuddies } = useBuddies();
  const { unread: unreadChats } = useChats();
  const buddyStatus = new Map((buddies?.members ?? []).map((member) => [member.userId, member.status]));
  const groupFull = (buddies?.members.length ?? 0) >= MAX_GROUP;
  useEffect(() => {
    if (!browserClient || isDemo) return;
    let cancelled = false;
    Promise.all([loadFriendTrainers(browserClient), loadMyTrainers(browserClient).catch(() => [])]).then(async ([ids, mine]) => {
      if (cancelled) return;
      setTrainerFriends(ids);
      setTrainerStatus(new Map(mine.map((item) => [item.id, item.status])));
      const profiles = await loadTrainerProfiles(browserClient, [...ids]);
      if (!cancelled) setTrainerInfo(profiles);
    });
    return () => { cancelled = true; };
  }, [browserClient, isDemo, userId]);

  useEffect(() => {
    if (!browserClient || isDemo) return;
    void loadFriendRequests(browserClient).then((requests) => setRequestsWaiting(requests.incoming.length));
  }, [browserClient, isDemo]);

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

  // This week's most active friends first, then by streak.
  const sorted = [...friends].sort((a, b) => (b.weekCount / b.weekGoal) - (a.weekCount / a.weekGoal) || b.currentStreak - a.currentStreak || a.displayName.localeCompare(b.displayName));
  const acting = friends.find((friend) => friend.userId === sheetFor) ?? null;

  return (
    <section className="friends friends-v2">
      <article className="panel friends-me">
        <Avatar value={state.profile.avatar} name={state.profile.displayName} size={56} />
        <div>
          <span className="onb-kicker">Your week</span>
          <strong>{me.weekCount} of {me.weekGoal} workouts</strong>
          <div className="friend-week" aria-hidden="true"><span style={{ width: `${Math.min(100, (me.weekCount / Math.max(1, me.weekGoal)) * 100)}%` }} /></div>
        </div>
        <span className="friends-me-streak" aria-label={`${me.currentStreak} day streak`}><Flame aria-hidden="true" />{me.currentStreak}</span>
      </article>

      <nav className="friends-hub" aria-label="Friends hub">
        <HubTile href="/chats" icon={<MessageCircle aria-hidden="true" />} title="Chats" note={unreadChats ? `${unreadChats} unread` : "Friends & group"} badge={unreadChats} />
        <HubTile href="/feed" icon={<span className="hub-emoji" aria-hidden="true">💪</span>} title="Feed" note="Workouts" />
        <HubTile href="/discover" icon={<UserPlus aria-hidden="true" />} title="Find friends" note={requestsWaiting ? `${requestsWaiting} ${requestsWaiting === 1 ? "request" : "requests"}` : "Search people"} badge={requestsWaiting} />
        <HubTile href="/buddies" icon={<Users aria-hidden="true" />} title="Train together" note={buddies?.group ? `${buddies.members.filter((member) => member.status === "active").length} on one plan` : buddies?.invites.length ? `${buddies.invites.length} ${buddies.invites.length === 1 ? "invite" : "invites"}` : "Same plan"} badge={buddies?.invites.length ?? 0} />
      </nav>

      {loadError && <p className="error-inline" role="alert">{loadError}</p>}
      {message && <p className="friends-message" role="status">{message}</p>}

      {linkCode && !linkHandled && isInviteCode(linkCode) && <article className="panel friends-accept">
        <UserPlus aria-hidden="true" />
        <div><h3>Friend invite</h3><p>Someone invited you with code <strong>{linkCode}</strong>.</p></div>
        <button type="button" className="button button-primary" disabled={!client || busy === "accept"} onClick={() => void run("accept", async () => { await acceptFriendInvite(client!, linkCode); setLinkHandled(true); return "You’re now friends! 🎉"; })}>Accept</button>
        <button type="button" className="text-button" onClick={() => setLinkHandled(true)}>Not now</button>
      </article>}

      <div className="segmented friends-tabs" role="tablist" aria-label="Friends sections">
        {([["friends", "Friends", friends.length], ["challenges", "Challenges", active.length], ["invite", "Invite", 0]] as const).map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "selected" : ""} onClick={() => setTab(id)}>{label}{count > 0 && <span className="tab-count">{count}</span>}</button>
        ))}
      </div>

      {tab === "friends" && <article className="panel friends-list-panel">
        {!data && !loadError ? <p className="loading-inline" role="status">Loading friends…</p> : friends.length === 0
          ? <EmptyState mood="hello" title="No friends yet" text="Training is more fun together. Find people by name, or send an invite." action={{ label: "Find friends", href: "/discover" }} />
          : <ul className="friend-rows">{sorted.map((friend) => {
            const nudged = data?.nudgedToday.has(friend.userId) ?? false;
            const isTrainer = trainerFriends.has(friend.userId);
            const buddy = buddyStatus.get(friend.userId);
            return (
              <li key={friend.userId} className="friend-row">
                <Link href={`/people/${friend.userId}`} className="friend-row-main">
                  <Avatar value={friend.avatar} name={friend.displayName} size={46} className="friend-avatar" />
                  <span className="friend-row-text">
                    <strong>{friend.displayName}{isTrainer && <span className="trainer-badge"><Dumbbell aria-hidden="true" /> Trainer</span>}{buddy === "active" && <span className="buddy-badge"><Users aria-hidden="true" /> Buddy</span>}<span className={`friend-streak ${friend.currentStreak ? "" : "zero"}`} aria-label={`${friend.currentStreak} day streak`}><Flame aria-hidden="true" />{friend.currentStreak}</span></strong>
                    <small>{friend.weekCount}/{friend.weekGoal} this week · {lastWorkoutLabel(friend.lastWorkoutDate, currentDate, true)}</small>
                    <span className="friend-week" aria-hidden="true"><span style={{ width: `${Math.min(100, (friend.weekCount / Math.max(1, friend.weekGoal)) * 100)}%` }} /></span>
                  </span>
                </Link>
                <button type="button" className={`icon-button friend-nudge ${nudged ? "done" : ""}`} aria-label={nudged ? `Nudged ${friend.displayName} today` : `Nudge ${friend.displayName}`} disabled={nudged || busy === `nudge-${friend.userId}`}
                  onClick={() => void run(`nudge-${friend.userId}`, async () => {
                    const nudgeId = await sendNudge(client!, friend.userId, NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)]);
                    void pushNudge(client!, nudgeId);
                    return `Nudge sent to ${friend.displayName}.`;
                  })}>{nudged ? <Check aria-hidden="true" /> : <Bell aria-hidden="true" />}</button>
                <button type="button" className="icon-button friend-more" aria-label={`More for ${friend.displayName}`} onClick={() => setSheetFor(friend.userId)}><MoreHorizontal aria-hidden="true" /></button>
              </li>
            );
          })}</ul>}
      </article>}

      {tab === "challenges" && <ChallengeSection friends={friends} me={me} challenges={active} past={past} stats={stats} today={currentDate} userId={userId} busy={busy}
        onCreate={(input) => void run("challenge", async () => { await createChallenge(client!, userId, input); return "Challenge started! Good luck 🏆"; })}
        onLeave={(id) => void run(`leave-${id}`, async () => { await leaveChallenge(client!, id, userId); return "You left the challenge."; })} />}

      {tab === "invite" && <>
        <Link href="/discover" className="panel friends-search-cta">
          <Search aria-hidden="true" />
          <span><strong>Find by name or @username</strong><small>People who turned on “Let people find me”</small></span>
          <ChevronRight aria-hidden="true" />
        </Link>
        <article className="panel friends-invite">
          <h3><Share2 aria-hidden="true" /> Invite with a code</h3>
          <p className="card-note">Works for anyone — even if they can’t be found in search.</p>
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
      </>}

      {acting && <FriendSheet friend={acting} onClose={() => setSheetFor(null)} busy={busy}
        trainer={trainerFriends.has(acting.userId) ? { status: trainerStatus.get(acting.userId), specialties: trainerInfo.get(acting.userId)?.specialties ?? [] } : null}
        buddy={buddies === null || buddies === undefined ? null : { status: buddyStatus.get(acting.userId), full: groupFull }}
        onAskTrainer={() => void run(`trainer-${acting.userId}`, async () => {
          const result = await requestTrainer(client!, acting.userId);
          setTrainerStatus((map) => new Map(map).set(acting.userId, result));
          return result === "active" ? `${acting.displayName} is already your trainer.` : `Asked ${acting.displayName} to be your trainer. You’ll see them in Settings → Trainers once they accept.`;
        })}
        onTrainTogether={() => void run(`buddy-${acting.userId}`, async () => {
          await inviteBuddy(client!, acting.userId);
          await refreshBuddies();
          return `Invited ${acting.displayName} to train together. Your plans sync once they join.`;
        })}
        onRemove={() => {
          if (window.confirm(`Remove ${acting.displayName} from your friends? You’ll stop seeing each other’s streaks.`)) {
            setSheetFor(null);
            void run(`remove-${acting.userId}`, async () => { await removeFriend(client!, userId, acting.userId); return `${acting.displayName} was removed.`; });
          }
        }} />}
    </section>
  );
}

/** One tile in the Friends hub (Chats, Feed, Find friends, Train together). */
function HubTile({ href, icon, title, note, badge = 0 }: { href: string; icon: React.ReactNode; title: string; note: string; badge?: number }) {
  return (
    <Link href={href} className="hub-tile">
      <span className="hub-icon">{icon}{badge > 0 && <span className="hub-badge" aria-label={`${badge} new`}>{badge > 99 ? "99+" : badge}</span>}</span>
      <strong>{title}</strong>
      <small>{note}</small>
    </Link>
  );
}

/** "···" on a friend: message, profile, train together, ask to be my trainer, remove. */
function FriendSheet({ friend, onClose, busy, trainer, buddy, onAskTrainer, onTrainTogether, onRemove }: {
  friend: FriendStats; onClose: () => void; busy: string;
  trainer: { status?: "active" | "requested"; specialties: string[] } | null;
  buddy: { status?: string; full: boolean } | null;
  onAskTrainer: () => void; onTrainTogether: () => void; onRemove: () => void;
}) {
  useScrollLock();
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={friend.displayName} onClick={onClose}>
      <section className="modal chat-sheet friend-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="friend-sheet-head">
          <Avatar value={friend.avatar} name={friend.displayName} size={56} />
          <div><h2>{friend.displayName}</h2><small>{goalTitle(friend.goal)} · best streak {friend.bestStreak}</small>{trainer?.specialties.length ? <small>{trainer.specialties.slice(0, 3).join(" · ")}</small> : null}</div>
        </div>
        <div className="friend-sheet-actions">
          <MessageButton userId={friend.userId} className="sheet-action" />
          <Link href={`/people/${friend.userId}`} className="sheet-action"><UserRound aria-hidden="true" /> View profile</Link>
          {buddy && !(buddy.full && !buddy.status) && <button type="button" className="sheet-action" disabled={Boolean(buddy.status) || busy === `buddy-${friend.userId}`} onClick={onTrainTogether}>
            {buddy.status === "active" ? <><Check aria-hidden="true" /> Training together</> : buddy.status === "invited" ? <><Check aria-hidden="true" /> Invited to train together</> : <><Users aria-hidden="true" /> Train together</>}
          </button>}
          {trainer && <button type="button" className="sheet-action" disabled={Boolean(trainer.status) || busy === `trainer-${friend.userId}`} onClick={onAskTrainer}>
            {trainer.status === "active" ? <><Check aria-hidden="true" /> Your trainer</> : trainer.status === "requested" ? <><Check aria-hidden="true" /> Trainer request sent</> : <><Dumbbell aria-hidden="true" /> Ask to be my trainer</>}
          </button>}
          <button type="button" className="sheet-action danger-text" onClick={onRemove}><UserMinus aria-hidden="true" /> Remove friend</button>
        </div>
      </section>
    </div>,
    document.body,
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
