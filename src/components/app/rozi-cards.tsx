"use client";

import Link from "next/link";
import { ArrowRight, Dumbbell } from "lucide-react";
import type { RoziCard } from "@/lib/rozi-ai/cards";
import { shortDate } from "@/lib/dates";

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
  if (!link || !link.href.startsWith("/")) return null;
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
