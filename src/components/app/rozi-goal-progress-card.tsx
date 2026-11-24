"use client";

import { useState } from "react";
import { Check, TrendingUp, X } from "lucide-react";
import type { RoziCard } from "@/lib/rozi-ai/cards";
import type { GoalState, WeekProgress } from "@/lib/rozi-ai/planning/plan-monitor";
import { shortDate } from "@/lib/dates";

type CardProgress = Extract<RoziCard, { type: "goal_progress" }>["progress"];
type Tone = "done" | "problem" | "closed";

const STATE: Record<GoalState, { label: string; tone: Tone }> = {
  on_track: { label: "On track", tone: "done" },
  ahead: { label: "Ahead", tone: "done" },
  behind: { label: "Behind", tone: "problem" },
  paused: { label: "Paused", tone: "closed" },
  finished: { label: "Plan finished", tone: "closed" },
};
const MAX_AT_FIRST = 6;

function Marker({ state }: { state: WeekProgress["state"] }) {
  if (state === "met") return <span className="rozi-progress-mark is-met"><Check aria-hidden="true" /><span className="sr-only">met</span></span>;
  if (state === "missed") return <span className="rozi-progress-mark is-missed"><X aria-hidden="true" /><span className="sr-only">missed</span></span>;
  if (state === "no_data") return <span className="rozi-progress-mark">no log</span>;
  if (state === "in_progress") return <span className="rozi-progress-mark is-now">this week</span>;
  return <span className="rozi-progress-mark"><span className="sr-only">upcoming</span></span>;
}

/** How a goal is going, week by week. Read-only: the numbers come from the server's plan monitor. */
export function RoziGoalProgressCard({ progress }: { progress: CardProgress }) {
  const [showAll, setShowAll] = useState(false);
  const { weeks } = progress;
  const meta = STATE[progress.state];

  // Show the finished weeks before this one, this week, then one upcoming week (at most six rows).
  const found = weeks.findIndex((item) => item.week === progress.currentWeek);
  const current = found >= 0 ? found : Math.max(0, weeks.length - 1);
  const end = Math.min(weeks.length, current + 2);
  const start = Math.max(0, end - MAX_AT_FIRST);
  const rows = showAll ? weeks : weeks.slice(start, end);

  return (
    <section className="rozi-card rozi-action" aria-label={`Goal progress: ${progress.title}`}>
      <header>
        <span className="rozi-action-kind"><TrendingUp aria-hidden="true" className="inline-icon" /> Goal progress</span>
        <span className={`rozi-chip rozi-action-status tone-${meta.tone}`} role="status">{meta.label}</span>
      </header>
      <strong className="rozi-action-title">{progress.title}</strong>
      <p className="rozi-action-why">{progress.summary}</p>
      {rows.length > 0 && <ol className="rozi-goal-steps rozi-progress-weeks">{rows.map((item) => (
        <li key={item.week} className={item.state === "upcoming" ? "is-upcoming" : undefined}>
          <strong>Week {item.week}</strong>
          <span className="rozi-progress-target">{item.target}</span>
          <span className="rozi-progress-actual">{item.actual ?? "—"}</span>
          <Marker state={item.state} />
        </li>
      ))}</ol>}
      {(weeks.length > rows.length || showAll) && <button type="button" className="rozi-goal-toggle" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Show fewer" : `Show all ${weeks.length} weeks`}
      </button>}
      <small className="rozi-action-note">Ends {shortDate(progress.endDate)}</small>
    </section>
  );
}
