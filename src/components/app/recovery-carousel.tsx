"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Maximize2 } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { RealBody } from "./real-body";
import { CountUp } from "@/components/ui/count-up";
import { weekDates } from "@/lib/dates";
import { mobilityRoutine, routinesDoneOn, stretchPicture, type MobilityRoutine } from "@/lib/mobility";
import { GROUP_LABELS, GROUP_REGIONS, MUSCLE_GROUPS, muscleRecovery, readyCount, recoveryLine, type MuscleGroup, type MuscleRecovery, type RecoveryStatus } from "@/lib/recovery";
import type { BodyRegion } from "@/lib/figure";

/** A stretch routine that suits each muscle group. */
export const GROUP_ROUTINE: Record<MuscleGroup, string> = {
  chest: "upper-body-mobility", shoulders: "upper-body-mobility", back: "back-day-mobility", arms: "triceps-and-arms-stretch", legs: "runners-legs", core: "posture-and-pelvis-reset",
};

/** Muscle colours for the body figure, from each group's status. */
export function recoveryTone(recovery: MuscleRecovery[]): Partial<Record<BodyRegion, RecoveryStatus>> {
  const tone: Partial<Record<BodyRegion, RecoveryStatus>> = {};
  for (const item of recovery) for (const region of GROUP_REGIONS[item.group]) tone[region] = item.status;
  return tone;
}

export function useRecovery() {
  const { state, recordedSessions, currentDate } = useFitTrack();
  const recovery = useMemo(() => muscleRecovery(recordedSessions, currentDate), [recordedSessions, currentDate]);
  return { recovery, today: currentDate, profile: state.profile, sessions: recordedSessions };
}

function Ring({ value, max, label, sub, tone }: { value: number; max: number; label: string; sub: string; tone: "green" | "coral" | "blue" }) {
  const r = 40;
  const length = 2 * Math.PI * r;
  const [grown, setGrown] = useState(0);
  const share = max > 0 ? Math.min(1, value / max) : 0;
  useEffect(() => { const timer = window.setTimeout(() => setGrown(share), 80); return () => window.clearTimeout(timer); }, [share]);
  return (
    <div className="rc-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="rc-ring-track" />
        <circle cx="50" cy="50" r={r} className={`rc-ring-value ${tone} ${grown === 0 ? "empty" : ""}`} strokeDasharray={`${grown * length} ${length}`} transform="rotate(-90 50 50)" />
      </svg>
      <span className="rc-ring-number"><strong><CountUp value={value} /></strong><small>/{max}</small></span>
      <b>{label}</b><small>{sub}</small>
    </div>
  );
}

/** Six-sided "this week" chart: how many sets each muscle group got. */
export function WeekRadar({ sets }: { sets: Record<MuscleGroup, number> }) {
  const max = Math.max(6, ...Object.values(sets));
  const point = (i: number, scale: number) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return [100 + Math.cos(angle) * 70 * scale, 92 + Math.sin(angle) * 70 * scale];
  };
  const shape = MUSCLE_GROUPS.map((group, i) => point(i, Math.max(0.04, sets[group] / max)).join(",")).join(" ");
  return (
    <svg viewBox="-24 0 248 184" className="rc-radar" role="img" aria-label={`Sets this week: ${MUSCLE_GROUPS.map((group) => `${GROUP_LABELS[group]} ${sets[group]}`).join(", ")}`}>
      {[1, 0.66, 0.33].map((scale) => <polygon key={scale} points={MUSCLE_GROUPS.map((_, i) => point(i, scale).join(",")).join(" ")} className="rc-radar-grid" />)}
      {MUSCLE_GROUPS.map((group, i) => { const [x, y] = point(i, 1); return <line key={group} x1="100" y1="92" x2={x} y2={y} className="rc-radar-grid" />; })}
      <polygon points={shape} className="rc-radar-shape" />
      {MUSCLE_GROUPS.map((group, i) => { const [x, y] = point(i, 1.22); return <text key={group} x={x} y={y + 4} className="rc-radar-label">{GROUP_LABELS[group]}</text>; })}
    </svg>
  );
}

/**
 * Home: "Recovery status", a swipeable card (from the reference recording). Slides:
 * today's rings → this week's muscles → stretch & recover → readiness body.
 */
export function RecoveryCarousel() {
  const { recovery, today, profile, sessions } = useRecovery();
  const { figure } = useFitTrack();
  const track = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const [stretched, setStretched] = useState(0);
  const week = weekDates(today);
  const workouts = sessions.filter((session) => session.status === "completed" && week.includes(session.date)).length;
  useEffect(() => {
    const timer = window.setTimeout(() => setStretched(week.filter((date) => date <= today).reduce((sum, date) => sum + routinesDoneOn(date).length, 0)), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- week follows today
  }, [today]);
  const weekSets = Object.fromEntries(recovery.map((item) => [item.group, item.weekSets])) as Record<MuscleGroup, number>;
  const busiest = recovery.filter((item) => item.status === "fresh" || item.status === "recovering" || item.status === "sore").sort((a, b) => b.lastSets - a.lastSets)[0];
  const routine: MobilityRoutine | undefined = mobilityRoutine(busiest ? GROUP_ROUTINE[busiest.group] : "morning-wake-up");
  const trainedAny = recovery.some((item) => item.status !== "no_data");
  const slides = ["Today", "This week", "Stretch & recover", "Readiness"];

  return (
    <section className="panel recovery-card" aria-label="Recovery status">
      <header className="rc-head">
        <h3>Recovery status</h3>
        <span className="rc-dots" aria-hidden="true">{slides.map((name, i) => <span key={name} className={i === slide ? "on" : ""} />)}</span>
        <Link href="/recovery" className="icon-button rc-open" aria-label="Open the recovery map"><Maximize2 aria-hidden="true" /></Link>
      </header>
      <div ref={track} className="rc-track" onScroll={(event) => { const el = event.currentTarget; const width = (el.firstElementChild as HTMLElement | null)?.offsetWidth || el.clientWidth; setSlide(Math.round(el.scrollLeft / width)); }}>
        <div className="rc-slide">
          <small className="rc-kicker">{slides[0]}</small>
          <div className="rc-rings">
            <Ring value={readyCount(recovery)} max={6} label="Muscles" sub={readyCount(recovery) === 6 ? "All ready" : "ready"} tone="green" />
            <Ring value={workouts} max={profile.sessionsPerWeek} label="Train" sub={workouts >= profile.sessionsPerWeek ? "Goal met" : `${profile.sessionsPerWeek - workouts} to go`} tone="coral" />
            <Ring value={stretched} max={3} label="Stretch" sub="this week" tone="blue" />
          </div>
          <p className="rc-line">{recoveryLine(recovery)}</p>
        </div>
        <div className="rc-slide">
          <small className="rc-kicker">{slides[1]}</small>
          {trainedAny || Object.values(weekSets).some(Boolean)
            ? <div className="rc-week"><WeekRadar sets={weekSets} /><div className="rc-week-figure"><RealBody figure={figure} side="front" tone={Object.fromEntries(MUSCLE_GROUPS.filter((group) => weekSets[group] > 0).flatMap((group) => GROUP_REGIONS[group]).map((region) => [region, "week"]))} sizes="140px" /></div></div>
            : <div className="rc-empty"><strong>Nothing trained yet</strong><small>Fills in as you log sets</small><WeekRadar sets={weekSets} /></div>}
          <Link href="/report" className="text-button rc-link">Your week with Rozi <ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className="rc-slide">
          <small className="rc-kicker">{slides[2]}</small>
          {routine && <Link href={`/mobility?routine=${routine.id}`} className="rc-stretch">
            <span className="rc-stretch-art"><Image src={stretchPicture(routine.moves[0])} alt="" width={420} height={210} sizes="300px" /></span>
            <strong>{routine.title}</strong>
            <small>{busiest ? `For your ${GROUP_LABELS[busiest.group].toLowerCase()} · tap to start` : "Tap to explore"}</small>
          </Link>}
        </div>
        <div className="rc-slide">
          <small className="rc-kicker">{slides[3]}</small>
          <Link href="/recovery" className="rc-ready">
            <div className="real-pair">
              <RealBody figure={figure} side="front" tone={recoveryTone(recovery)} sizes="160px" />
              <RealBody figure={figure} side="back" tone={recoveryTone(recovery)} sizes="160px" />
            </div>
            <RecoveryLegend compact />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function RecoveryLegend({ compact = false }: { compact?: boolean }) {
  const items: Array<[RecoveryStatus, string]> = [["fresh", "Just trained"], ["recovering", "Recovering"], ["ready", "Ready"], ["sore", "Sore"]];
  return <div className={`rc-legend ${compact ? "compact" : ""}`}>{items.map(([status, label]) => <span key={status}><i className={`dot tone-${status}`} />{label}</span>)}</div>;
}
