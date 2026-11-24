"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Check, ChevronRight, Flame } from "lucide-react";
import { NudgeBanner } from "@/components/app/nudge-banner";
import { SessionLiveCard } from "@/components/app/session-live-card";
import { WaterCard } from "@/components/app/water-card";
import { MobilitySuggestion } from "@/components/app/mobility-suggestion";
import { WeighInCard } from "@/components/app/weigh-in-card";
import { Rozi } from "@/components/app/rozi";
import { Avatar } from "@/components/app/avatar";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { calculateStreak, roziMoment, winsForWorkout } from "@/lib/rozi";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, hourIn, nextTrainingDate, todayHref, weekDates, weekdayOf } from "@/lib/dates";
import { REGION_LABELS, regionsForExercises } from "@/lib/figure";
import { muscleRecovery, readyCount, recoveryLine } from "@/lib/recovery";
import { TrainerHomeCard } from "@/components/app/trainer-home-card";
import { BuddyHomeCard } from "@/components/app/buddy-home-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

function greetingFor(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Today (docs/UI_REDESIGN_PLAN.md, Phase 3): one clear next step. The workout card with Rozi and the one big button
 * comes first; cards that only matter sometimes (live session, weigh-in, buddy, trainer, nudges) show when they do;
 * the week is shown once; recovery is one row.
 */
export function OverviewScreen() {
  const router = useRouter();
  const { state, currentDate, recordedSessions, isDemo } = useFitTrack();
  const { session: todaySession, generatedPlan } = useWorkoutDay(currentDate, DEFAULT_CHECK_IN);
  const plan = todaySession?.plan ?? generatedPlan;
  const status = todaySession?.status;
  const goal = state.profile.sessionsPerWeek;
  const week = weekDates(currentDate);
  const completed = recordedSessions.filter((session) => session.status === "completed");
  const doneThisWeek = completed.filter((session) => week.includes(session.date)).length;
  const nextDate = nextTrainingDate(state.profile, currentDate);
  const regions = plan ? regionsForExercises(plan.exercises).slice(0, 4) : [];
  const totalSets = plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const openDay = (date: string) => router.push(todayHref(date, currentDate));
  const hour = hourIn(state.profile.timeZone);
  const streak = calculateStreak(state.profile, recordedSessions, currentDate);
  const moment = roziMoment({
    streak, todaySession, hour, name: state.profile.displayName, why: state.profile.why,
    wins: status === "completed" ? winsForWorkout(recordedSessions, currentDate, state.profile.sessionsPerWeek) : undefined,
  });
  // The header already says "Good evening, Asha": skip Rozi's title when it's the same greeting.
  const sayTitle = moment.title.startsWith("Good ") ? null : moment.title;
  const recovery = muscleRecovery(recordedSessions, currentDate);
  const ready = readyCount(recovery);
  const tag = status === "completed" ? "Done today" : status === "in_progress" ? "In progress" : plan?.sessionType === "recovery" ? "Recovery today" : "Today's workout";
  // "Pull B · Back, biceps, forearms": the short name is the title, the muscles go on their own line, so a long
  // title never runs into Rozi.
  const [titleMain, ...titleRest] = (plan?.title ?? "").split(" · ");
  const titleSub = titleRest.join(" · ");
  const streakLink = streak.started && <Link className="today-streak" href="/streak">
    <span className="today-streak-flame"><Flame aria-hidden="true" /></span>
    <span className="today-streak-text">{streak.repair ? <strong>Win back your {streak.repair.lostStreak}-day streak</strong> : <><strong>{streak.current} in a row</strong>{streak.best > streak.current && <small>Best {streak.best}</small>}</>}</span>
    <ChevronRight aria-hidden="true" />
  </Link>;
  const cta = status === "completed" ? "View session" : status === "in_progress" ? "Continue workout" : "Start workout";

  return (
    <section className="home today-home">
      <header className="today-head">
        <div className="today-head-text">
          <p className="today-date">{dateLabel(currentDate)}</p>
          <h2 className="today-hello">{greetingFor(hour)}, {state.profile.displayName}</h2>
        </div>
        <div className="today-head-actions">
          {isDemo && hasSupabaseConfig() && <Link className="glass-pill" href="/sign-in">Sign in</Link>}
          <Link className="round-avatar has-picture" href="/profile" aria-label="Open your profile"><Avatar value={state.profile.avatar} name={state.profile.displayName} size={40} /></Link>
        </div>
      </header>

      {/* The streak is the card's footer: a full-width row under a hairline, below the buttons, never touching them. */}
      <Card padding="lg" className={`today-hero ${status === "completed" ? "is-done" : ""}`} aria-labelledby="today-title">
        <Rozi mood={moment.mood} size={120} priority className="today-rozi" />
        {plan ? <>
          <div className="today-hero-copy">
            <p className="today-tag">{status === "completed" && <Check aria-hidden="true" />}{tag}</p>
            <h3 id="today-title" className="today-title">{titleMain}</h3>
            {titleSub && <p className="today-sub">{titleSub}</p>}
            <p className="today-meta">{plan.durationMinutes} min · {plan.exercises.length} moves · {totalSets} sets</p>
          </div>
          <p className="today-say">{sayTitle && <strong>{sayTitle} </strong>}{moment.message}</p>
          {regions.length > 0 && <div className="today-chips" aria-label="Targets">{regions.map((region) => <Chip key={region}>{REGION_LABELS[region]}</Chip>)}</div>}
          <Button variant="primary" size="lg" block icon={<ArrowRight aria-hidden="true" />} onClick={() => router.push("/today")}>{cta}</Button>
        </> : <>
          <div className="today-hero-copy">
            <p className="today-tag">Rest day</p>
            <h3 id="today-title" className="today-title">Rest is part of the plan</h3>
            <p className="today-meta">{nextDate ? `Next session ${dateLabel(nextDate)}` : "No training days set yet"}</p>
          </div>
          <p className="today-say">{sayTitle && <strong>{sayTitle} </strong>}{moment.message}</p>
          {nextDate
            ? <div className="today-actions">
              <Button variant="primary" size="lg" block onClick={() => router.push("/today?extra=1")}>Train today anyway</Button>
              <Button variant="glass" block onClick={() => openDay(nextDate)}>See next session</Button>
            </div>
            : <ButtonLink href="/settings?section=plan" variant="primary" size="lg" block>Choose your training days</ButtonLink>}
        </>}
        {streakLink}
      </Card>

      <SessionLiveCard />
      <WeighInCard />
      <BuddyHomeCard />
      <TrainerHomeCard />
      <NudgeBanner />
      <WaterCard />

      <Card className="today-week" aria-labelledby="today-week-title">
        <div className="today-row-head">
          <h3 id="today-week-title">This week</h3>
          <Link href="/progress" className="today-row-link">{doneThisWeek >= goal ? "Goal reached" : `${doneThisWeek} of ${goal} done`}<ChevronRight aria-hidden="true" /></Link>
        </div>
        <div className="week-strip">
          {week.map((date) => {
            const session = sessionForDate(state, date);
            const scheduled = state.profile.trainingDays.includes(weekdayOf(date));
            const done = session?.status === "completed";
            const mark = done ? "done" : scheduled ? (date < currentDate ? "missed" : "planned") : "rest";
            const description = done ? "completed" : scheduled ? (date < currentDate ? "no session recorded" : "training day") : "rest day";
            return (
              <button key={date} type="button" className={`day-pill ${mark} ${date === currentDate ? "today" : ""}`} onClick={() => openDay(date)} aria-label={`${dateLabel(date)}, ${description}`} aria-current={date === currentDate ? "date" : undefined}>
                <small>{DAY_INITIALS[weekdayOf(date)]}</small>
                <strong>{Number(date.slice(-2))}</strong>
                <span className="day-mark">{done && <Check aria-hidden="true" />}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Link href="/recovery" className="today-recovery ui-card ui-card--pad-md">
        <span className="today-recovery-icon"><Activity aria-hidden="true" /></span>
        <span className="today-recovery-text"><strong>{completed.length ? `${ready} of ${recovery.length} muscle groups ready` : "Fresh start"}</strong><small>{completed.length ? recoveryLine(recovery) : "Every muscle is ready to train."}</small></span>
        <ChevronRight aria-hidden="true" />
      </Link>

      <MobilitySuggestion />
    </section>
  );
}
