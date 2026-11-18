"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Dumbbell, Feather, Flame, MapPin, Shield, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { Rozi } from "@/components/app/rozi";
import { MessageButton } from "@/components/app/message-button";
import { EmptyState } from "@/components/ui/empty-state";
import { buddyStreak, buddyToday, carryableDay, missedRecently, type BuddyToday } from "@/lib/buddies";
import {
  carryBuddyStreak, leaveBuddyGroup, loadBuddyOverview, proposeBuddyPlan, respondBuddyInvite, respondBuddyProposal, setAtGym, setBuddyShareReasons,
  type BuddyOverview,
} from "@/lib/buddies-repository";
import { shiftDate, shortDate, WEEKDAY_LABELS } from "@/lib/dates";
import { missedReasonLabel } from "@/lib/missed-days";
import { GOAL_OPTIONS, goalTitle } from "@/lib/program";
import { trainerSetLightWeek } from "@/lib/trainers-repository";
import type { MissedReason, TrainingGoal } from "@/lib/types";

export const TODAY_LABEL: Record<BuddyToday, string> = { done: "Done ✓", training: "Training now", skipped: "Resting today", "to-do": "Still to do", rest: "Rest day" };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const daysLabel = (days: number[]) => DAY_ORDER.filter((day) => days.includes(day)).map((day) => WEEKDAY_LABELS[day]).join(" · ");

/** Loads the buddy overview (shared by this page and the Home card). */
export function useBuddies() {
  const { isDemo, browserClient, currentDate } = useFitTrack();
  const [overview, setOverview] = useState<BuddyOverview | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    if (isDemo || !browserClient) { setOverview(null); return; }
    try { setOverview(await loadBuddyOverview(browserClient, shiftDate(currentDate, -35))); } catch { setOverview(null); }
  }, [isDemo, browserClient, currentDate]);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  return { overview, refresh };
}

/**
 * Train together: your buddy group (you + up to 3 friends) on one synced plan — the same days and the same session,
 * your own weights. Shows everyone's day, the buddy streak (with one carry a week), plan changes to accept, and
 * your buddy settings. Invites are sent from the Friends page.
 */
export function BuddiesScreen() {
  const { state, isDemo, browserClient, currentDate, setNotice } = useFitTrack();
  const { overview, refresh } = useBuddies();
  const me = state.profile.id;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [proposing, setProposing] = useState(false);
  const [goal, setGoal] = useState<TrainingGoal>("general");
  const [days, setDays] = useState<number[]>([]);

  async function run(label: string, action: () => Promise<string | void>) {
    if (busy || !browserClient) return;
    setBusy(label); setError("");
    try { const done = await action(); await refresh(); if (done) setNotice(done); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again."); }
    finally { setBusy(""); }
  }

  const group = overview?.group ?? null;
  const active = useMemo(() => (overview?.members ?? []).filter((member) => member.status === "active"), [overview]);
  const invited = (overview?.members ?? []).filter((member) => member.status === "invited");
  const streakInput = group ? { trainingDays: group.trainingDays, since: group.anchorDate, members: active.map((member) => member.userId), days: overview?.days ?? [], carried: overview?.carried ?? [], today: currentDate } : null;
  const streak = streakInput && active.length >= 2 ? buddyStreak(streakInput) : 0;
  const carryDay = streakInput && active.length >= 2 ? carryableDay(streakInput) : null;
  const meMember = active.find((member) => member.userId === me);
  // Coach: a member who is every other member's trainer. Their plan changes apply straight away.
  const coach = group?.coach ?? null;
  const iCoach = coach !== null && coach === me && active.length >= 2;
  const coachName = active.find((member) => member.userId === coach)?.name;
  const lightOn = active.some((member) => member.lightWeek);
  const allLight = active.length >= 2 && active.every((member) => member.lightWeek);
  const struggling = iCoach && group ? active.filter((member) => member.userId !== me && missedRecently(overview?.days ?? [], member.userId, currentDate, group.trainingDays, group.anchorDate) >= 2) : [];
  const anyClient = active.find((member) => member.userId !== me)?.userId;

  if (isDemo || !browserClient) return <section className="buddies-page"><EmptyState mood="hello" title="Sign in to train together" text="Train with up to 3 friends on one plan: the same days and the same session, your own weights." action={{ label: "Sign in", href: "/settings?section=account" }} /></section>;
  if (overview === undefined) return <section className="buddies-page"><p className="card-note" role="status">Loading your buddies…</p></section>;
  if (overview === null) return <section className="buddies-page"><EmptyState mood="chat-thinking" title="Almost ready" text="Train together needs the latest update. Please check back soon." /></section>;

  return (
    <section className="buddies-page">
      {overview.invites.map((invite) => (
        <article key={invite.groupId} className="panel buddy-invite">
          <Avatar value={invite.fromAvatar} name={invite.from} size={48} />
          <div>
            <h3>{invite.from} wants to train together</h3>
            <p>{goalTitle(invite.goal)} · {daysLabel(invite.trainingDays)}{invite.members > 1 ? ` · ${invite.members} people` : ""}</p>
            <small>Joining switches your plan to theirs: the same days and the same session each day. Your weights and level stay yours.</small>
          </div>
          <div className="buddy-invite-actions">
            <button type="button" className="button button-primary small" disabled={Boolean(busy)} onClick={() => void run(`join-${invite.groupId}`, async () => { await respondBuddyInvite(browserClient, invite.groupId, true); return `You’re training with ${invite.from} now. Reload Train to see the shared plan.`; })}><Check aria-hidden="true" /> Join</button>
            <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => void run(`decline-${invite.groupId}`, async () => { await respondBuddyInvite(browserClient, invite.groupId, false); return "Invite declined."; })}>No thanks</button>
          </div>
        </article>
      ))}

      {!group ? (
        <article className="panel buddies-empty">
          <Rozi mood="cheer" size={110} eager />
          <h2>Train together</h2>
          <p>Pick up to 3 friends. You’ll all follow one plan — the same days and the same session — with your own weights. You’ll see who’s done, get a nudge when a buddy finishes, and keep a buddy streak.</p>
          <Link href="/friends" className="button button-primary"><UserPlus aria-hidden="true" /> Invite from Friends</Link>
        </article>
      ) : <>
        <article className="panel buddy-hero">
          <span className="buddy-flame"><Flame aria-hidden="true" /> {streak}</span>
          <div>
            <h2>{active.length >= 2 ? `${streak}-day buddy streak` : "Waiting for your buddies"}</h2>
            <p>{active.length >= 2 ? "Days you all trained. Today counts once everyone’s done." : `Invites sent to ${invited.map((member) => member.name).join(", ") || "your friends"}. Your plan stays as it is until someone joins.`}</p>
          </div>
          {active.length >= 2 && <MessageButton group label="Group chat" className="button button-primary small" />}
          {carryDay && <button type="button" className="button button-subtle small" disabled={Boolean(busy)} onClick={() => void run("carry", async () => { await carryBuddyStreak(browserClient, carryDay); return `${shortDate(carryDay)} carried — the streak lives on. One carry a week.`; })}><Shield aria-hidden="true" /> Carry {shortDate(carryDay)}</button>}
        </article>

        <article className="panel">
          <div className="panel-title"><h3>Your shared plan</h3></div>
          <p className="buddy-plan"><strong>{goalTitle(group.goal)}</strong><span>{daysLabel(group.trainingDays)}</span></p>
          <p className="card-note">Everyone does the same session each training day, with their own weights and level. {iCoach
            ? "You’re everyone’s trainer here, so your changes apply straight away."
            : coach && coachName ? `${coachName} is everyone’s trainer here: their changes apply straight away; other changes need everyone’s OK.`
            : "Changes need everyone’s OK."}</p>
          {allLight && !iCoach && <p className="light-note"><Feather aria-hidden="true" /> Lighter week until Sunday{coachName ? `, set by ${coachName}` : ""}: the same sessions with fewer sets.</p>}
          {overview.proposal ? (() => {
            const proposal = overview.proposal;
            const byName = active.find((member) => member.userId === proposal.by)?.name ?? "A buddy";
            const mineAccepted = proposal.acceptedBy.includes(me);
            const waitingFor = active.filter((member) => !proposal.acceptedBy.includes(member.userId)).map((member) => member.userId === me ? "you" : member.name);
            return (
              <div className="buddy-proposal">
                <strong>{proposal.by === me ? "You proposed" : `${byName} proposed`}: {goalTitle(proposal.goal)} · {daysLabel(proposal.trainingDays)}</strong>
                <small>Waiting for {waitingFor.join(", ")}</small>
                {!mineAccepted && <div className="account-card-actions">
                  <button type="button" className="button button-primary small" disabled={Boolean(busy)} onClick={() => void run("accept-plan", async () => { const result = await respondBuddyProposal(browserClient, proposal.id, true); return result === "accepted" ? "New plan starts today for everyone." : "Accepted — waiting for the others."; })}>Accept</button>
                  <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => void run("decline-plan", async () => { await respondBuddyProposal(browserClient, proposal.id, false); return "Change declined."; })}>Decline</button>
                </div>}
              </div>
            );
          })() : !proposing ? (
            <button type="button" className="button button-subtle small" disabled={active.length < 2} onClick={() => { setGoal(group.goal); setDays(group.trainingDays); setProposing(true); }}>{iCoach ? "Change the plan" : "Propose a change"}</button>
          ) : (
            <form className="buddy-propose" onSubmit={(event) => { event.preventDefault(); void run("propose", async () => { await proposeBuddyPlan(browserClient, goal, days); setProposing(false); return iCoach ? "New plan starts today for everyone." : "Sent to your buddies. It starts once everyone accepts."; }); }}>
              <label className="field-label">Goal
                <select value={goal} onChange={(event) => setGoal(event.target.value as TrainingGoal)}>{GOAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</select>
              </label>
              <div className="field-label">Training days <small className="field-hint">3 to 6</small></div>
              <div className="buddy-days">{DAY_ORDER.map((day) => {
                const on = days.includes(day);
                return <button key={day} type="button" className={`buddy-day ${on ? "selected" : ""}`} aria-pressed={on} onClick={() => setDays((list) => on ? list.filter((item) => item !== day) : [...list, day])}>{WEEKDAY_LABELS[day]}</button>;
              })}</div>
              <div className="account-card-actions">
                <button className="button button-primary small" disabled={Boolean(busy) || days.length < 3 || days.length > 6}>{iCoach ? "Change for everyone" : "Send to buddies"}</button>
                <button type="button" className="text-button" onClick={() => setProposing(false)}>Cancel</button>
              </div>
            </form>
          )}
        </article>

        {iCoach && anyClient && (lightOn || struggling.length > 0) && <article className={`panel coach-light ${lightOn ? "on" : ""}`}>
          <Feather aria-hidden="true" />
          <div>
            {lightOn ? <>
              <h3>Lighter week on</h3>
              <p>Everyone does the same sessions with about a third fewer sets until Sunday.</p>
            </> : <>
              <h3>{struggling.map((member) => member.name.split(" ")[0]).join(" and ")} {struggling.length === 1 ? "has" : "have"} missed 2+ sessions in the last week</h3>
              <p>Make this week lighter for the group? Same sessions, about a third fewer sets — easier to get back on track together.</p>
            </>}
          </div>
          <button type="button" className={`button small ${lightOn ? "button-subtle" : "button-primary"}`} disabled={Boolean(busy)} onClick={() => void run("light", async () => {
            await trainerSetLightWeek(browserClient, struggling[0]?.userId ?? anyClient, !lightOn);
            return lightOn ? "Back to normal sets from the next session." : "This week is lighter for everyone. Plans update on their next session.";
          })}>{lightOn ? "Back to normal" : "Make it lighter"}</button>
        </article>}

        <article className="panel">
          <div className="panel-title"><h3>Today</h3><span className="panel-count">{active.length}</span></div>
          <ul className="buddy-list">
            {active.map((member) => {
              const status = buddyToday(overview.days, member.userId, currentDate, group.trainingDays);
              const reason = overview.days.find((day) => day.userId === member.userId && day.date === currentDate)?.reason;
              return (
                <li key={member.userId} className={`buddy-row today-${status}`}>
                  <Avatar value={member.avatar} name={member.name} size={42} />
                  <span><strong>{member.userId === me ? "You" : member.name}{member.userId === coach && <span className="coach-badge">Trainer</span>}{member.atGym && <span className="at-gym-badge"><MapPin aria-hidden="true" /> At the gym</span>}{member.lightWeek && !allLight && <span className="light-badge"><Feather aria-hidden="true" /> Lighter week</span>}</strong>
                    <small>{TODAY_LABEL[status]}{status === "skipped" && reason ? ` · ${missedReasonLabel(reason as MissedReason)}` : ""}</small></span>
                  <span className={`buddy-status status-${status}`} aria-hidden="true">{status === "done" ? <Check /> : status === "training" ? <Dumbbell /> : status === "skipped" ? "–" : ""}</span>
                </li>
              );
            })}
            {invited.map((member) => (
              <li key={member.userId} className="buddy-row invited">
                <Avatar value={member.avatar} name={member.name} size={42} />
                <span><strong>{member.name}</strong><small>Invited · hasn’t answered yet</small></span>
                <button type="button" className="icon-button" aria-label={`Cancel ${member.name}’s invite`} disabled={Boolean(busy)} onClick={() => void run(`cancel-${member.userId}`, async () => { await leaveBuddyGroup(browserClient, member.userId); return "Invite cancelled."; })}><X aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          {active.length + invited.length < 4 && <Link href="/friends" className="text-button"><UserPlus aria-hidden="true" /> Invite another friend</Link>}
        </article>

        {meMember && <article className="panel buddy-settings">
          <div className="settings-toggle-row">
            <span><strong>I’m at the gym</strong><small>Buddies see it for the next 2 hours</small></span>
            <button type="button" role="switch" aria-checked={meMember.atGym} aria-label="I’m at the gym" className={`toggle ${meMember.atGym ? "on" : ""}`} disabled={Boolean(busy)} onClick={() => void run("gym", async () => { await setAtGym(browserClient, !meMember.atGym); })}><span /></button>
          </div>
          <div className="settings-toggle-row">
            <span><strong>Share why I skip</strong><small>Off: buddies only see “resting today”</small></span>
            <button type="button" role="switch" aria-checked={meMember.shareReasons} aria-label="Share why I skip" className={`toggle ${meMember.shareReasons ? "on" : ""}`} disabled={Boolean(busy)} onClick={() => void run("reasons", async () => { await setBuddyShareReasons(browserClient, !meMember.shareReasons); })}><span /></button>
          </div>
          <button type="button" className="text-button danger-text" disabled={Boolean(busy)} onClick={() => {
            if (window.confirm("Leave this buddy group? Your plan keeps the same days and goal, and the session order goes back to your own.")) void run("leave", async () => { await leaveBuddyGroup(browserClient); return "You left the group."; });
          }}>Leave group</button>
        </article>}
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
  );
}
