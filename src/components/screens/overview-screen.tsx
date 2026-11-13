"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Clock, ListChecks, Moon, Repeat, Trophy } from "lucide-react";
import { MusclePicture } from "@/components/app/muscle-picture";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { DEFAULT_CHECK_IN, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, greetingFor, nextTrainingDate, shortDate, todayHref, weekDates, weekdayOf } from "@/lib/dates";
import { REGION_LABELS, regionsForExercises } from "@/lib/figure";

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/** A ring that fills as the week's sessions are completed. */
function GoalRing({ done, goal }: { done: number; goal: number }) {
  const radius = 42;
  const length = 2 * Math.PI * radius;
  const share = goal > 0 ? Math.min(1, done / goal) : 0;
  return (
    <svg viewBox="0 0 100 100" className="goal-ring" role="img" aria-label={`${done} of ${goal} sessions completed this week`}>
      <circle cx="50" cy="50" r={radius} className="goal-ring-track" />
      <circle cx="50" cy="50" r={radius} className="goal-ring-value" strokeDasharray={`${share * length} ${length}`} transform="rotate(-90 50 50)" />
      <text x="50" y="49" className="goal-ring-number">{done}/{goal}</text>
      <text x="50" y="64" className="goal-ring-caption">this week</text>
    </svg>
  );
}

export function OverviewScreen() {
  const router = useRouter();
  const { state, currentDate, recordedSessions, figure } = useFitTrack();
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
  const recent = completed.slice(-3).reverse();
  const openDay = (date: string) => router.push(todayHref(date, currentDate));

  return (
    <section className="home">
      <header className="home-greet">
        <p>{dateLabel(currentDate)}</p>
        <h2>{greetingFor(state.profile.timeZone)}, {state.profile.displayName}</h2>
      </header>

      <div className="home-grid">
        <article className={`hero-card panel ${status === "completed" ? "is-done" : ""}`}>
          {plan ? <>
            <div className="hero-copy">
              <span className="hero-tag">{status === "completed" ? <><Check aria-hidden="true" /> Done today</> : status === "in_progress" ? "In progress" : plan.sessionType === "recovery" ? "Recovery today" : "Today’s workout"}</span>
              <h3>{plan.title}</h3>
              <div className="chip-row">
                <span className="chip"><Clock aria-hidden="true" /> {plan.durationMinutes} min</span>
                <span className="chip"><ListChecks aria-hidden="true" /> {plan.exercises.length} moves</span>
                <span className="chip"><Repeat aria-hidden="true" /> {totalSets} sets</span>
              </div>
              {regions.length > 0 && <p className="hero-targets"><strong>Targets</strong> {regions.map((region) => REGION_LABELS[region]).join(" · ")}</p>}
              <button className="button button-primary hero-cta" onClick={() => router.push("/today")}>{status === "completed" ? "View session" : status === "in_progress" ? "Continue workout" : "Start workout"} <ArrowRight aria-hidden="true" /></button>
            </div>
            <div className="hero-figure"><MusclePicture figure={figure} region={regions[0]} highlight={regions} priority /></div>
          </> : <>
            <div className="hero-copy">
              <span className="hero-tag"><Moon aria-hidden="true" /> Rest day</span>
              <h3>Rest is part of the plan</h3>
              <p className="hero-rest">{nextDate ? `Your next session is ${dateLabel(nextDate)}.` : "No training days are set yet. Choose them in Settings."}</p>
              {nextDate
                ? <button className="button button-primary hero-cta" onClick={() => openDay(nextDate)}>See next session <ArrowRight aria-hidden="true" /></button>
                : <button className="button button-primary hero-cta" onClick={() => router.push("/settings")}>Open Settings <ArrowRight aria-hidden="true" /></button>}
            </div>
            <div className="hero-figure"><MusclePicture figure={figure} priority /></div>
          </>}
        </article>

        <article className="goal-panel panel">
          <GoalRing done={doneThisWeek} goal={goal} />
          <div className="goal-copy">
            <h3>{doneThisWeek >= goal ? "Weekly goal reached" : `${goal - doneThisWeek} to go this week`}</h3>
            <p>{doneThisWeek >= goal ? "Nicely done. Rest well before next week." : "Each session you finish fills the ring."}</p>
            <dl className="mini-stats">
              <div><dt><Trophy aria-hidden="true" /> Workouts</dt><dd>{completed.length}</dd></div>
              <div><dt><CalendarDays aria-hidden="true" /> Next</dt><dd>{plan && status !== "completed" ? "Today" : nextDate ? shortDate(nextDate) : "—"}</dd></div>
            </dl>
          </div>
        </article>

        <article className="week-panel panel">
          <div className="panel-title"><h3>This week</h3><button className="text-button" onClick={() => router.push("/progress")}>Progress <ArrowRight aria-hidden="true" /></button></div>
          <div className="week-strip">
            {week.map((date) => {
              const session = sessionForDate(state, date);
              const scheduled = state.profile.trainingDays.includes(weekdayOf(date));
              const done = session?.status === "completed";
              const mark = done ? "done" : scheduled ? (date < currentDate ? "missed" : "planned") : "rest";
              const description = done ? "completed" : scheduled ? (date < currentDate ? "no session recorded" : "training day") : "rest day";
              return (
                <button key={date} className={`day-pill ${mark} ${date === currentDate ? "today" : ""}`} onClick={() => openDay(date)} aria-label={`${dateLabel(date)}, ${description}`} aria-current={date === currentDate ? "date" : undefined}>
                  <small>{DAY_INITIALS[weekdayOf(date)]}</small>
                  <strong>{Number(date.slice(-2))}</strong>
                  <span className="day-mark">{done && <Check aria-hidden="true" />}</span>
                </button>
              );
            })}
          </div>
          <p className="week-key"><span className="key done" /> Done <span className="key planned" /> Training day <span className="key missed" /> Not logged <span className="key rest" /> Rest</p>
        </article>

        <article className="recent-panel panel">
          <div className="panel-title"><h3>Recent workouts</h3></div>
          {recent.length ? <div className="recent-rows">{recent.map((session) => {
            const setsDone = session.exerciseLogs.reduce((sum, log) => sum + log.sets.filter((set) => set.completed).length, 0);
            return (
              <button key={session.id} className="recent-item" onClick={() => openDay(session.date)}>
                <span className="recent-check"><Check aria-hidden="true" /></span>
                <span className="recent-text"><strong>{session.plan.title}</strong><small>{dateLabel(session.date, { weekday: "short", month: "short", day: "numeric" })} · {setsDone} {setsDone === 1 ? "set" : "sets"} done</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            );
          })}</div> : <p className="recent-empty">Your first finished workout will show up here.</p>}
        </article>
      </div>
    </section>
  );
}
