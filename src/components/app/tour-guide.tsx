"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import type { RoziMood } from "@/lib/rozi";
import { Rozi } from "./rozi";

const TOUR_KEY = "rozfit-tour-done";
const REPLAY_EVENT = "rozfit-replay-tour";

const STEPS: Array<{ href?: string; mood: RoziMood; title: string; text: string }> = [
  { mood: "hello", title: "Hi, I’m Rozi!", text: "I’ll be your workout buddy. Here’s a 30-second tour of RozFit." },
  { href: "/", mood: "morning", title: "Home", text: "Today’s plan, your streak, a daily thought and nudges from friends — all at a glance." },
  { href: "/today", mood: "full-body", title: "Train", text: "Check in, see each exercise with muscle pictures and a demo video, then log your sets. I adjust the plan to how you feel." },
  { href: "/progress", mood: "trophy", title: "Progress", text: "Workouts, personal records, badges, body weight and missed days, week by week." },
  { href: "/friends", mood: "cheer", title: "Friends", text: "Invite friends, see each other’s streaks, send a nudge and start weekly or monthly challenges." },
  { href: "/library", mood: "upper-body", title: "Library", text: "Every exercise with steps, safety tips and the muscles it works." },
  { href: "/settings", mood: "signin", title: "Settings", text: "Change your goal and days, turn on reminders, pick a theme and add your photo or avatar." },
];

export function tourDone(): boolean {
  try { return window.localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; }
}

/** Starts the tour again (from Settings). */
export function replayTour() {
  try { window.localStorage.removeItem(TOUR_KEY); } catch { /* still replays this time */ }
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

/** A short first-time tour of the tabs, shown once after sign-up. The matching menu button is highlighted. */
export function TourGuide({ blocked }: { blocked: boolean }) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const open = () => setStep(0);
    const timer = window.setTimeout(() => { if (!tourDone()) open(); }, 600);
    window.addEventListener(REPLAY_EVENT, open);
    return () => { window.clearTimeout(timer); window.removeEventListener(REPLAY_EVENT, open); };
  }, []);

  const current = step === null ? null : STEPS[step];

  useEffect(() => {
    if (!current?.href) return;
    const links = [...document.querySelectorAll<HTMLAnchorElement>(`.mobile-nav a[href="${current.href}"], .side-nav a[href="${current.href}"]`)];
    links.forEach((link) => link.classList.add("tour-highlight"));
    return () => links.forEach((link) => link.classList.remove("tour-highlight"));
  }, [current]);

  if (step === null || !current || blocked || typeof document === "undefined") return null;

  function close() {
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch { /* the tour may show again next time */ }
    setStep(null);
  }
  const last = step === STEPS.length - 1;

  return createPortal(
    <div className="tour-backdrop" onClick={close}>
      <section className="tour-card panel" role="dialog" aria-modal="true" aria-labelledby="tour-title" onClick={(event) => event.stopPropagation()}>
        <Rozi mood={current.mood} size={110} eager />
        <h2 id="tour-title">{current.title}</h2>
        <p>{current.text}</p>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((item, index) => <span key={item.title} className={index === step ? "on" : ""} />)}</div>
        <div className="tour-actions">
          <button type="button" className="text-button" onClick={close}>{last ? "" : "Skip"}</button>
          <button type="button" className="button button-primary" onClick={() => (last ? close() : setStep(step + 1))}>{last ? "Let’s go!" : "Next"} <ArrowRight aria-hidden="true" /></button>
        </div>
        <span className="sr-only" aria-live="polite">Step {step + 1} of {STEPS.length}</span>
      </section>
    </div>,
    document.body,
  );
}
