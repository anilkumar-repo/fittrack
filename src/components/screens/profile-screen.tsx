"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Dumbbell, ListChecks, Plus, UserRound, X } from "lucide-react";
import { AvatarPicker } from "@/components/app/avatar";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { HistoryDetailModal } from "@/components/app/history-detail-modal";
import { calculateStreak } from "@/lib/rozi";
import { levelTitle } from "@/lib/levels";
import { bmi } from "@/lib/body";
import { dateLabel } from "@/lib/dates";
import { profileChecklist } from "@/lib/discover";
import { loadPersonProfile } from "@/lib/discover-repository";
import { loadRoutines } from "@/lib/routines-store";
import type { Routine } from "@/lib/pro-tracking";
import type { WorkoutSession } from "@/lib/types";
import { CountUp } from "@/components/ui/count-up";
import { PublicProfileCard } from "./discover-screen";

type Tab = "overview" | "routines" | "public";
const TABS: Array<{ id: Tab; label: string }> = [{ id: "overview", label: "Overview" }, { id: "routines", label: "Routines" }, { id: "public", label: "Public" }];
const HIDE_COMPLETION_KEY = "rozfit-hide-profile-completion";

/**
 * Profile (redesigned 2026-11-26 after the owner's reference recording): picture, name and @username in the middle,
 * a row of plain numbers, a "Complete your profile" card (progress ring + swipeable chips), then three tabs on the
 * sliding-glass segmented control (GlassGlider): Overview (recent workouts), Routines, Public (username, bio, search).
 * The ☰ button (in the top bar's right corner, app-shell.tsx) opens Settings and everything else.
 */
export function ProfileScreen() {
  const { state, isDemo, browserClient, recordedSessions, currentDate } = useFitTrack();
  const profile = state.profile;
  const [tab, setTab] = useState<Tab>("overview");
  const completed = useMemo(() => recordedSessions.filter((session) => session.status === "completed"), [recordedSessions]);
  const streak = calculateStreak(profile, recordedSessions, currentDate);
  const latestWeight = state.bodyWeightEntries.at(-1)?.weightKg;
  const bodyMass = profile.heightCm && latestWeight ? bmi(profile.heightCm, latestWeight) : null;
  const signedIn = !isDemo && Boolean(browserClient);

  return (
    <section className="profile-page">
      <header className="pf-head">
        <AvatarPicker size={96} />
        <h2>{profile.displayName}</h2>
        <p className="pf-handle">{profile.username ? `@${profile.username}` : isDemo ? "Saved on this device" : state.userEmail ?? "Signed in"} · {levelTitle(profile.experience)}</p>
        <div className="pf-stats">
          <div><strong><CountUp value={completed.length} /></strong><small>Workouts</small></div>
          <div><strong><CountUp value={streak.current} /></strong><small>In a row</small></div>
          <div><strong>{bodyMass ? <CountUp value={bodyMass} decimals={1} /> : "—"}</strong><small>BMI</small></div>
        </div>
      </header>

      <ProfileCompletion signedIn={signedIn} workouts={completed.length} onPublic={() => setTab("public")} />

      <div className="segmented pf-tabs" role="tablist" aria-label="Profile sections">
        {TABS.map((item) => <button key={item.id} type="button" role="tab" id={`pf-tab-${item.id}`} aria-selected={tab === item.id} aria-controls="pf-panel" className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </div>

      <div id="pf-panel" role="tabpanel" aria-labelledby={`pf-tab-${tab}`} className="pf-panel">
        {tab === "overview" && <RecentWorkouts sessions={completed} />}
        {tab === "routines" && <MyRoutines />}
        {tab === "public" && (signedIn ? <PublicProfileCard /> : <PanelEmpty icon={<UserRound />} title="No public profile yet" text="Sign in to choose a @username, write a bio and let friends find you." action={<Link href="/sign-in" className="button button-primary small">Sign in</Link>} />)}
      </div>
    </section>
  );
}

/** "Complete your profile": a ring with how many are done, and the missing items as chips you can swipe through. */
function ProfileCompletion({ signedIn, workouts, onPublic }: { signedIn: boolean; workouts: number; onPublic: () => void }) {
  const { state, browserClient } = useFitTrack();
  const profile = state.profile;
  const [posts, setPosts] = useState(0);
  const [hidden, setHidden] = useState(() => { try { return typeof window !== "undefined" && window.localStorage.getItem(HIDE_COMPLETION_KEY) === "1"; } catch { return false; } });
  useEffect(() => {
    if (!signedIn || !browserClient) return;
    void loadPersonProfile(browserClient, profile.id).then((found) => setPosts(found?.postCount ?? 0)).catch(() => undefined);
  }, [signedIn, browserClient, profile.id]);
  const full = profileChecklist({ avatar: profile.avatar, username: profile.username, bio: profile.bio, birthYear: profile.birthYear, workouts, posts });
  // On this device only: the picture and first workout count, and signing in is the next step (username, bio and posts need an account).
  const checklist = signedIn ? full : [...full.filter((item) => item.id === "picture" || item.id === "workout"), { id: "sign-in", label: "Sign in to keep your plan safe", done: false, href: "/sign-in" }];
  const missing = checklist.filter((item) => !item.done);
  if (hidden || missing.length === 0) return null;
  const done = checklist.length - missing.length;
  const ring = 2 * Math.PI * 16;

  function act(id: string) {
    // The picture is changed on the avatar itself; username and bio live on the Public tab.
    if (id === "picture") document.querySelector<HTMLButtonElement>(".pf-head .avatar-edit")?.click();
    else onPublic();
  }
  return (
    <article className="panel pf-complete">
      <div className="pf-complete-head">
        <svg className="pf-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="16" />
          <circle cx="20" cy="20" r="16" className="fill" strokeDasharray={ring} strokeDashoffset={ring * (1 - done / checklist.length)} />
          <text x="20" y="24" textAnchor="middle">{done}/{checklist.length}</text>
        </svg>
        <span><strong>Complete your profile</strong><small>{missing.length} {missing.length === 1 ? "item" : "items"} remaining</small></span>
        <button type="button" className="icon-button pf-complete-close" aria-label="Hide for now" onClick={() => { setHidden(true); try { window.localStorage.setItem(HIDE_COMPLETION_KEY, "1"); } catch { /* storage blocked: hidden until reload */ } }}><X aria-hidden="true" /></button>
      </div>
      <div className="pf-chips">
        {missing.map((item) => item.href
          ? <Link key={item.id} href={item.href} className="pf-chip">{item.label.replace(/ \(.*\)$/, "")}<Plus aria-hidden="true" /></Link>
          : <button key={item.id} type="button" className="pf-chip" onClick={() => act(item.id)}>{item.label}<Plus aria-hidden="true" /></button>)}
      </div>
    </article>
  );
}

/** Overview: your last few finished workouts; tap one for the details. */
function RecentWorkouts({ sessions }: { sessions: WorkoutSession[] }) {
  const [open, setOpen] = useState<WorkoutSession | null>(null);
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (recent.length === 0) return <PanelEmpty icon={<Dumbbell />} title="No workouts yet" text="Finish your first workout and it shows up here." action={<Link href="/today" className="button button-primary small">Start today’s workout</Link>} />;
  return (
    <>
      <ul className="pf-list">
        {recent.map((session) => (
          <li key={session.id}><button type="button" onClick={() => setOpen(session)}>
            <span className="pf-list-icon"><Dumbbell aria-hidden="true" /></span>
            <span><strong>{session.plan.title}</strong><small>{dateLabel(session.date, { weekday: "short", month: "short", day: "numeric" })} · {session.exerciseLogs.length} exercises</small></span>
            <ChevronRight aria-hidden="true" />
          </button></li>
        ))}
      </ul>
      {open && <HistoryDetailModal session={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Routines: the workouts you built yourself. */
function MyRoutines() {
  const { browserClient, isDemo } = useFitTrack();
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  useEffect(() => { void loadRoutines(isDemo ? null : browserClient).then(setRoutines).catch(() => setRoutines([])); }, [browserClient, isDemo]);
  if (routines === null) return <p className="pf-loading">Loading your routines…</p>;
  if (routines.length === 0) return <PanelEmpty icon={<ListChecks />} title="No routines yet" text="Build your own workout from any exercises and start it any day." action={<Link href="/routines" className="button button-primary small"><Plus aria-hidden="true" /> New routine</Link>} />;
  return (
    <>
      <div className="pf-panel-head"><strong>My routines</strong><Link href="/routines" className="text-button"><Plus aria-hidden="true" /> New routine</Link></div>
      <ul className="pf-list">
        {routines.map((routine) => (
          <li key={routine.id}><Link href="/routines">
            <span className="pf-list-icon"><ListChecks aria-hidden="true" /></span>
            <span><strong>{routine.name}</strong><small>{routine.exercises.length} {routine.exercises.length === 1 ? "exercise" : "exercises"}</small></span>
            <ChevronRight aria-hidden="true" />
          </Link></li>
        ))}
      </ul>
    </>
  );
}

function PanelEmpty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="pf-empty">
      <span className="pf-empty-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}
