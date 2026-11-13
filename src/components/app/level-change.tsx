"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { LEVELS, levelTitle } from "@/lib/levels";
import type { ExperienceLevel } from "@/lib/types";
import { useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

/** The four levels as steps, the current one lit. */
export function LevelSteps({ level }: { level: ExperienceLevel }) {
  const at = LEVELS.indexOf(level);
  return (
    <ol className="level-steps" aria-label={`Level: ${levelTitle(level)}`}>
      {LEVELS.map((item, index) => <li key={item} className={index < at ? "past" : index === at ? "now" : ""} aria-current={index === at ? "step" : undefined}><span />{levelTitle(item)}</li>)}
    </ol>
  );
}

/** Rozi tells the person their level changed by itself (up after steady training, down after a long break). */
export function LevelChangePopup() {
  const { levelChange, dismissLevelChange } = useFitTrack();
  if (!levelChange || typeof document === "undefined") return null;
  const up = levelChange.direction === "up";
  return createPortal(
    <div className="celebrate-backdrop" role="dialog" aria-modal="true" aria-labelledby="level-title">
      <section className="celebrate-card level-card">
        {up && <span className="celebrate-burst" aria-hidden="true" />}
        <Rozi mood={up ? "trophy" : "comeback"} size={150} eager className="celebrate-rozi" />
        <span className="level-kicker">{up ? "Level up!" : "Welcome back"}</span>
        <h2 id="level-title">You’re now {levelTitle(levelChange.to)}</h2>
        <p>{levelChange.reason}</p>
        <LevelSteps level={levelChange.to} />
        <button type="button" className="button button-primary full-width" onClick={dismissLevelChange}>{up ? "Let’s go" : "Okay"}</button>
        <Link className="text-button" href="/progress#level" onClick={dismissLevelChange}>See what changed</Link>
      </section>
    </div>,
    document.body,
  );
}
