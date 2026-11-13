"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bandage, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { Rozi } from "@/components/app/rozi";
import { STREAK_LABELS, StreakDayMark } from "@/components/app/streak-day";
import { REPAIR_WINDOW_DAYS, REPAIRS_PER_STREAK, buildStreakTimeline, monthGrid, type StreakDay } from "@/lib/streak";
import type { RoziMood } from "@/lib/rozi";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const LEGEND: StreakDay[] = ["done", "rest", "repaired", "paused", "missed"];

function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

/** The streak calendar: every day marked, the repair offer when a streak breaks, and repairs left. */
export function StreakScreen() {
  const { state, recordedSessions, currentDate } = useFitTrack();
  const timeline = useMemo(() => buildStreakTimeline(state.profile, recordedSessions, currentDate), [state.profile, recordedSessions, currentDate]);
  const [nowYear, nowMonth] = currentDate.split("-").map(Number);
  const [firstYear, firstMonth] = timeline.firstDate.split("-").map(Number);
  const [view, setView] = useState({ year: nowYear, month: nowMonth });
  const atStart = view.year < firstYear || (view.year === firstYear && view.month <= firstMonth);
  const atEnd = view.year > nowYear || (view.year === nowYear && view.month >= nowMonth);
  const move = (step: number) => setView(({ year, month }) => {
    const next = month + step;
    return next < 1 ? { year: year - 1, month: 12 } : next > 12 ? { year: year + 1, month: 1 } : { year, month: next };
  });

  const started = Object.values(timeline.days).includes("done");
  const mood: RoziMood = !started ? "hello" : timeline.repair ? "care" : timeline.broken ? "comeback" : timeline.current >= 10 ? "trophy" : "cheer";
  const say = !started ? "Finish your first workout and a streak is born!"
    : timeline.repair ? "Streak broke? Hmm… how about one chance to fix it?"
      : timeline.broken ? "No streak right now. Your next workout starts a fresh one!"
        : timeline.current === 1 ? "A streak is born! Keep showing up to help it grow."
          : `${timeline.current} workouts in a row. I’m so proud of you!`;

  return (
    <section className="streak-page">
      <article className="streak-hero panel">
        <p className="streak-say">{say}</p>
        <div className="streak-hero-row">
          <div className="streak-count">
            {timeline.repair
              ? <><span className="streak-big lost">{timeline.repair.lostStreak}</span><Flame className="streak-flame broken" aria-hidden="true" /></>
              : <><span className="streak-big">{timeline.current}</span><Flame className="streak-flame" aria-hidden="true" /></>}
            <strong>{timeline.repair ? "workout streak — on hold" : `workout${timeline.current === 1 ? "" : "s"} in a row`}</strong>
            <small>Best: {timeline.best}</small>
          </div>
          <Rozi mood={mood} size={140} priority />
        </div>
        <div className="repairs" aria-label={`${timeline.repairsLeft} of ${REPAIRS_PER_STREAK} repairs left`}>
          {Array.from({ length: REPAIRS_PER_STREAK }, (_, index) => <Bandage key={index} className={index < timeline.repairsLeft ? "left" : "used"} aria-hidden="true" />)}
          <small>{timeline.repairsLeft} of {REPAIRS_PER_STREAK} repairs left</small>
        </div>
      </article>

      {timeline.repair && <article className="repair-card panel">
        <span className="repair-tag">Repair your streak</span>
        <h2>Do a workout by {shortDay(timeline.repair.deadline)} and get your {timeline.repair.lostStreak}-workout streak back!</h2>
        <p>This uses 1 repair. When all {REPAIRS_PER_STREAK} are used, the next break starts a new streak from day one.</p>
        <Link className="button button-primary" href="/today">Start a workout <ArrowRight aria-hidden="true" /></Link>
      </article>}

      <article className="streak-calendar panel">
        <div className="streak-month">
          <h2>{monthName(view.year, view.month)}</h2>
          <div><button type="button" className="icon-button" onClick={() => move(-1)} disabled={atStart} aria-label="Previous month"><ChevronLeft /></button>
            <button type="button" className="icon-button" onClick={() => move(1)} disabled={atEnd} aria-label="Next month"><ChevronRight /></button></div>
        </div>
        <div className="streak-grid" role="grid" aria-label={`Streak calendar, ${monthName(view.year, view.month)}`}>
          {WEEKDAYS.map((day, index) => <span key={index} className="streak-weekday" aria-hidden="true">{day}</span>)}
          {monthGrid(view.year, view.month).flat().map((date, index) => {
            if (!date) return <span key={`pad-${index}`} />;
            const status: StreakDay = timeline.days[date] ?? (date > currentDate ? "upcoming" : "before");
            return <span key={date} role="gridcell" className={`streak-cell ${date === currentDate ? "is-today" : ""}`} aria-label={`${shortDay(date)}: ${STREAK_LABELS[status]}`}>
              <StreakDayMark status={status} label={String(Number(date.slice(8)))} />
            </span>;
          })}
        </div>
        <ul className="streak-legend">{LEGEND.map((status) => <li key={status}><StreakDayMark status={status} size="sm" /> {STREAK_LABELS[status]}</li>)}</ul>
      </article>

      <details className="why-plan">
        <summary>How streaks work</summary>
        <p>Each finished workout adds one. Rest days never break it. Missing a training day breaks it — unless you do any workout within {REPAIR_WINDOW_DAYS} days, which repairs it (you get {REPAIRS_PER_STREAK} repairs per streak). Missing because you were unwell, sore or travelling only pauses it.</p>
      </details>
    </section>
  );
}
