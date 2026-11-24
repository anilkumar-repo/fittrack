"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Clock, Loader2, Pause, Target, X } from "lucide-react";
import type { RoziCard } from "@/lib/rozi-ai/cards";
import type { GoalStatus } from "@/lib/rozi-ai/planning/goal-types";
import { minutesLeft } from "@/lib/rozi-ai/actions/action-view";
import { shortDate } from "@/lib/dates";
import { useRoziGoal, type GoalOp } from "./use-rozi-goal";

type CardGoal = Extract<RoziCard, { type: "goal" }>["goal"];
type Tone = "waiting" | "working" | "done" | "closed";

const LABEL: Record<GoalStatus, string> = {
  awaiting_approval: "Needs your OK", active: "Active", paused: "Paused", cancelled: "Stopped", replaced: "Replaced by a newer goal",
  rejected: "Not started", expired: "Expired", completed: "Done",
};
const SHOWN_AT_FIRST = 3;

/**
 * A goal with a weekly plan Rozi proposed (Level 4): approve it once, then pause, resume or stop it. Status always
 * comes from the server; buttons lock while a tap is being handled, and a failed tap leaves the status as it was.
 */
export function RoziGoalCard({ goal }: { goal: CardGoal }) {
  const { act } = useRoziGoal();
  const [status, setStatus] = useState<GoalStatus | "working">(goal.status);
  const [before, setBefore] = useState<GoalStatus>(goal.status);
  const [problem, setProblem] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "awaiting_approval") return;
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(tick);
  }, [status]);

  const working = status === "working";
  const shown: GoalStatus = working ? before : status;
  const expired = shown === "expired" || (shown === "awaiting_approval" && minutesLeft(goal.expiresAt, now) === 0);
  const effective: GoalStatus = expired ? "expired" : shown;
  const tone: Tone = working ? "working" : effective === "awaiting_approval" ? "waiting" : effective === "active" || effective === "completed" ? "done" : "closed";
  const Icon = working ? Loader2 : tone === "waiting" ? Clock : effective === "paused" ? Pause : tone === "done" ? Check : effective === "rejected" || effective === "cancelled" ? X : CircleAlert;
  const label = working ? "Saving…" : LABEL[effective];

  async function run(op: GoalOp) {
    if (working) return;
    if (op === "cancel" && !window.confirm("Stop this goal? Your workouts stay as they are.")) return;
    setBefore(shown);
    setStatus("working");
    setProblem(null);
    const result = await act(goal.id, op, op === "approve" ? goal.planHash : undefined);
    if (result.ok) setStatus(result.goal.status);
    else { setStatus(shown); setProblem(result.message); }
  }

  const steps = showAll ? goal.steps : goal.steps.slice(0, SHOWN_AT_FIRST);
  const left = minutesLeft(goal.expiresAt, now);
  const note = effective === "awaiting_approval" ? `Approving starts this plan and replaces any current goal. Expires in ${left} min.`
    : effective === "active" ? "Aim for each week's target above." : "";
  const button = (op: GoalOp, text: string, primary = false) => (
    <button type="button" disabled={working} className={`button ${primary ? "button-primary" : "button-subtle"} small`} onClick={() => void run(op)}>
      {primary && <Check aria-hidden="true" />} {text}
    </button>
  );

  return (
    <section className={`rozi-card rozi-action tone-${tone}`} aria-label={`Goal: ${goal.title}`} aria-busy={working}>
      <header>
        <span className="rozi-action-kind"><Target aria-hidden="true" className="inline-icon" /> Goal</span>
        <span className={`rozi-chip rozi-action-status tone-${tone}`} role="status"><Icon aria-hidden="true" className={working ? "spin" : ""} /> {label}</span>
      </header>
      <strong className="rozi-action-title">{goal.title}</strong>
      {goal.reason && <p className="rozi-action-why">{goal.reason}</p>}
      <small className="rozi-action-note">{goal.steps.length} weeks · ends {shortDate(goal.endDate)}</small>
      {goal.steps.length > 0 && <ol className="rozi-goal-steps">{steps.map((step) => (
        <li key={step.week}><strong>Week {step.week}</strong> · {step.title}{step.note && <small>{step.note}</small>}</li>
      ))}</ol>}
      {goal.steps.length > SHOWN_AT_FIRST && <button type="button" className="rozi-goal-toggle" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
        {showAll ? "Show fewer" : `Show all ${goal.steps.length} weeks`}
      </button>}
      {problem && <p className="rozi-action-problem" role="alert">{problem}</p>}
      {effective === "awaiting_approval" && <div className="rozi-action-buttons">{button("approve", "Approve plan", true)}{button("reject", "Not now")}</div>}
      {effective === "active" && <div className="rozi-action-buttons">{button("pause", "Pause")}{button("cancel", "Stop goal")}</div>}
      {effective === "paused" && <div className="rozi-action-buttons">{button("resume", "Resume")}{button("cancel", "Stop goal")}</div>}
      {note && <small className="rozi-action-note">{note}</small>}
    </section>
  );
}
