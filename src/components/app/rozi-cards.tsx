"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Check, Dumbbell } from "lucide-react";
import { isInAppLink, type RoziCard } from "@/lib/rozi-ai/cards";
import { shortDate } from "@/lib/dates";
import { getExerciseDefinition } from "@/lib/templates";
import type { ExerciseDefinition } from "@/lib/types";
import { sessionForDate, useFitTrack } from "./fit-track-provider";
import { SwapSheet, useExerciseSwap } from "./swap-sheet";
import { RoziActionCard } from "./rozi-action-card";
import { RoziGoalCard } from "./rozi-goal-card";
import { RoziGoalProgressCard } from "./rozi-goal-progress-card";
import { RoziMemoryCard } from "./rozi-memory-card";

/**
 * Cards under an AI answer. Everything here comes from RozFit's own tools on the server (never from the model's
 * text), so the numbers are real. Plan cards are shown by the chat itself (they have Start now / Save buttons).
 */
export function RoziCards({ cards }: { cards: RoziCard[] }) {
  const shown = cards.filter((card) => card.type !== "plan");
  if (!shown.length) return null;
  return <div className="rozi-cards">{shown.map((card, index) => <RoziCardView key={`${card.type}-${index}`} card={card} />)}</div>;
}

const WORKOUT_STATUS: Record<string, string> = { planned: "Planned", in_progress: "In progress", completed: "Done", partial: "Partly done", skipped: "Skipped", rest_day: "Rest day" };

function CardLink({ link }: { link?: { href: string; label: string } }) {
  if (!link || !isInAppLink(link.href)) return null;
  return <Link href={link.href} className="chat-link">{link.label} <ArrowRight aria-hidden="true" /></Link>;
}

function RoziCardView({ card }: { card: RoziCard }) {
  switch (card.type) {
    case "workout":
      return (
        <section className="rozi-card" aria-label={`Workout: ${card.title}`}>
          <header><strong>{card.title}</strong><span className={`rozi-chip status-${card.status}`}>{WORKOUT_STATUS[card.status] ?? card.status}</span></header>
          <small>{shortDate(card.date)}{card.minutes ? ` · about ${card.minutes} min` : ""}</small>
          {card.exercises.length > 0 && <ol className="rozi-card-list">{card.exercises.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}</span><small>{item.sets} × {item.reps}</small></li>)}</ol>}
          <CardLink link={card.link} />
        </section>
      );
    case "progress": {
      const loads = card.trend.map((item) => item.kg).filter((kg): kg is number => kg !== null);
      const top = loads.length ? Math.max(...loads) : 0;
      return (
        <section className="rozi-card" aria-label={card.exercise ? `Progress: ${card.exercise}` : "Your best sets"}>
          <header><strong>{card.exercise ?? "Your best sets"}</strong></header>
          {card.records.length > 0 && <ol className="rozi-card-list">{card.records.map((record) => <li key={`${record.exercise}-${record.date}`}><span>{record.exercise}</span><small>{record.kg} kg × {record.reps} · {shortDate(record.date)}</small></li>)}</ol>}
          {top > 0 && card.trend.length > 1 && <div className="rozi-trend" role="img" aria-label={`Heaviest load per workout: ${card.trend.map((item) => `${shortDate(item.date)} ${item.kg ?? "no weight"}${item.kg ? " kg" : ""}`).join(", ")}`}>
            {card.trend.map((item) => <span key={item.date} className="rozi-trend-bar" style={{ height: `${Math.max(8, ((item.kg ?? 0) / top) * 100)}%` }} title={`${shortDate(item.date)}: ${item.kg ?? "—"} kg`} />)}
          </div>}
          {top > 0 && card.trend.length > 1 && <small className="rozi-trend-caption">{shortDate(card.trend[0].date)} {card.trend[0].kg ?? "—"} kg → {shortDate(card.trend[card.trend.length - 1].date)} {card.trend[card.trend.length - 1].kg ?? "—"} kg</small>}
          <CardLink link={card.link} />
        </section>
      );
    }
    case "recovery":
      return (
        <section className="rozi-card" aria-label="Muscle recovery">
          <header><strong>Recovery</strong><span className="rozi-chip">{card.readyCount} of {card.groups.length} ready</span></header>
          <ul className="rozi-recovery">{card.groups.map((group) => (
            <li key={group.group} className={`recovery-${group.status}`}><span className="dot" aria-hidden="true" /><strong>{group.label}</strong><small>{group.statusLabel}{group.readyOn ? ` · ready ${shortDate(group.readyOn)}` : ""}</small></li>
          ))}</ul>
          <CardLink link={card.link} />
        </section>
      );
    case "exercise":
      return (
        <section className="rozi-card" aria-label={`How to: ${card.name}`}>
          <header><strong>{card.name}</strong>{!card.allowed && <span className="rozi-chip status-skipped">Not in your setup</span>}</header>
          <small><Dumbbell aria-hidden="true" className="inline-icon" /> {card.equipment}{card.muscles.length ? ` · ${card.muscles.slice(0, 3).join(", ")}` : ""}</small>
          {card.steps.length > 0 && <ol className="rozi-steps">{card.steps.slice(0, 6).map((step, index) => <li key={index}>{step}</li>)}</ol>}
          {card.alternatives.length > 0 && <p className="rozi-alternatives"><small>Alternatives:</small> {card.alternatives.map((item) => item.name).join(" · ")}</p>}
        </section>
      );
    case "swap":
      return <SwapCard card={card} />;
    case "action":
      return <RoziActionCard action={card.action} />;
    case "goal":
      return <RoziGoalCard goal={card.goal} />;
    case "goal_progress":
      return <RoziGoalProgressCard progress={card.progress} />;
    case "memory":
      return <RoziMemoryCard memory={card.memory} />;
    case "stat":
      return (
        <section className="rozi-card rozi-stat" aria-label={card.title}>
          <small>{card.title}</small>
          <strong>{card.value}</strong>
          {card.detail && <small>{card.detail}</small>}
          <CardLink link={card.link} />
        </section>
      );
    default:
      return null;
  }
}

/**
 * Rozi's swap card: tap an option to use it instead, or "More choices" for the full Swap sheet. Without a named
 * exercise, the workout's exercises are listed, each with Swap. The swap runs in the app with the same checks as the
 * Swap button (a stale card can't swap something that's no longer allowed).
 */
function SwapCard({ card }: { card: Extract<RoziCard, { type: "swap" }> }) {
  const { getState } = useFitTrack();
  const swap = useExerciseSwap(card.date);
  const [done, setDone] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<ExerciseDefinition | null>(null);
  const workoutExercises = () => sessionForDate(getState(), card.date)?.plan.exercises ?? [];
  const open = (id: string) => { const exercise = workoutExercises().find((item) => item.id === id) ?? getExerciseDefinition(id); if (exercise) setSheetFor(exercise); };
  const use = (fromId: string, toId: string, toName: string) => { if (swap(fromId, toId)) setDone(toName); };
  return (
    <section className="rozi-card rozi-swap" aria-label={card.from ? `Swap ${card.from.name}` : "Swap an exercise"}>
      <header><strong><ArrowLeftRight aria-hidden="true" className="inline-icon" /> {card.from ? `Instead of ${card.from.name}` : "Pick one to swap"}</strong><small>{shortDate(card.date)}</small></header>
      {done ? <p className="rozi-swap-done"><Check aria-hidden="true" /> {done} is in your workout now.</p>
        : card.from ? <>
          <ul className="rozi-swap-list">{card.options.map((option) => <li key={option.id}><span><strong>{option.name}</strong><small>{option.equipment}</small></span><button type="button" className="button button-subtle small" onClick={() => use(card.from!.id, option.id, option.name)}>Use instead</button></li>)}</ul>
          <button type="button" className="text-button" onClick={() => open(card.from!.id)}>More choices</button>
        </> : <ul className="rozi-swap-list">{card.exercises.map((exercise) => <li key={exercise.id}><span><strong>{exercise.name}</strong></span><button type="button" className="button button-subtle small" onClick={() => open(exercise.id)}><ArrowLeftRight aria-hidden="true" /> Swap</button></li>)}</ul>}
      {sheetFor && <SwapSheet exercise={sheetFor} workoutExercises={workoutExercises()} onClose={() => setSheetFor(null)}
        onPick={(replacement) => { if (swap(sheetFor.id, replacement.id)) { setDone(replacement.name); setSheetFor(null); } }} />}
    </section>
  );
}
