"use client";

import { Check } from "lucide-react";
import { levelProgress, levelTitle, programWeek } from "@/lib/levels";
import { useFitTrack } from "./fit-track-provider";
import { LevelSteps } from "./level-change";

const LEVEL_EFFECT = {
  beginner: "Gentle volume and simple moves while your body learns the patterns.",
  intermediate: "Your program starts at the strength stage and skips the two-set foundation weeks.",
  advanced: "Later program stage, plus an extra set on your two main exercises.",
  pro: "The top stage, plus an extra set on your three main exercises.",
} as const;

/** Progress page: the person's level, what it changes, and how close the next level is. */
export function LevelPanel() {
  const { state, recordedSessions, currentDate } = useFitTrack();
  const progress = levelProgress(state.profile, recordedSessions, currentDate);
  const week = programWeek(state.profile, currentDate);
  return (
    <article className="panel level-panel" id="level">
      <div className="panel-title"><h3>Your level</h3><span className="panel-count">Program week {week} of 52</span></div>
      <LevelSteps level={progress.level} />
      <p className="level-effect"><strong>{levelTitle(progress.level)}:</strong> {LEVEL_EFFECT[progress.level]}</p>
      {progress.next ? <>
        <div className="level-meter" role="progressbar" aria-label={`Progress to ${levelTitle(progress.next)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.share * 100)}><span style={{ width: `${Math.round(progress.share * 100)}%` }} /></div>
        <p className="level-next">To reach <strong>{levelTitle(progress.next)}</strong>, RozFit checks:</p>
        <ul className="level-reqs">{progress.requirements.map((item) => <li key={item.label} className={item.met ? "met" : ""}>
          <span className="level-tick" aria-hidden="true">{item.met && <Check />}</span>
          <span>{item.label}</span>
          <strong>{item.needed === 1 ? (item.met ? "Yes" : "Not yet") : `${item.done} / ${item.needed}`}</strong>
        </li>)}</ul>
        <small className="level-note">You move up by yourself when all four are done. Six weeks without a workout moves you down one level so the comeback is gentle.</small>
      </> : <p className="level-next">You’re at the top level. RozFit keeps your plan moving through the 52-week program.</p>}
    </article>
  );
}
