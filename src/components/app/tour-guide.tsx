"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import type { RoziMood } from "@/lib/rozi";
import { Rozi } from "./rozi";

const TOUR_KEY = "rozfit-tour-done";
const REPLAY_EVENT = "rozfit-replay-tour";

/**
 * The tour follows the dock left to right (2026-11-25 redesign): Today · Workouts · Rozi · Progress · Together, then
 * your picture (Profile, whose ☰ holds the plan and settings). `target` is what gets the highlight ring.
 */
const STEPS: Array<{ target?: string; mood: RoziMood; title: string; text: string }> = [
  { mood: "hello", title: "Hi, I’m Rozi!", text: "I’m your workout buddy. Here’s a 30-second tour of RozFit." },
  { target: '.mobile-nav a[href="/"], .side-nav a[href="/"]', mood: "morning", title: "Today", text: "Your workout for today, your streak, water and the week — start every day here." },
  { target: '.mobile-nav a[href="/library"], .side-nav a[href="/library"]', mood: "upper-body", title: "Workouts", text: "Every exercise with muscle pictures and how-to, stretches, and the routines you save." },
  { target: '.mobile-nav a[href="/rozi"], .side-nav a[href="/rozi"]', mood: "chat-hello", title: "Ask me", text: "Ask about your training. I can plan a workout, explain your plan, or suggest changes for you to approve." },
  { target: '.mobile-nav a[href="/progress"], .side-nav a[href="/progress"]', mood: "trophy", title: "Progress", text: "Workouts, personal records, badges, body weight and recovery, week by week." },
  { target: '.mobile-nav a[href="/friends"], .side-nav a[href="/friends"]', mood: "cheer", title: "Together", text: "Friends, a feed, chats and training buddies — streaks, nudges and challenges." },
  { target: 'a.round-avatar[href="/profile"], .topbar-actions a[href="/profile"]', mood: "signin", title: "You", text: "Tap your picture for your profile. The ☰ there holds your plan, reminders, theme and the rest." },
];

export function tourDone(): boolean {
  try { return window.localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; }
}

/** Starts the tour again (from Settings). */
export function replayTour() {
  try { window.localStorage.removeItem(TOUR_KEY); } catch { /* still replays this time */ }
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

/** A short first-time tour of the dock, shown once after sign-up. The matching button is highlighted. */
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
    if (!current?.target) return;
    const links = [...document.querySelectorAll<HTMLElement>(current.target)];
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
      <section key={step} className="tour-card panel" role="dialog" aria-modal="true" aria-labelledby="tour-title" onClick={(event) => event.stopPropagation()}>
        <Rozi key={current.mood} mood={current.mood} size={104} eager />
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
