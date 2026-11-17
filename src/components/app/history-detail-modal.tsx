"use client";

import { useScrollLock } from "./use-scroll-lock";
import { shortDate } from "@/lib/dates";
import { formatWeight } from "@/lib/logging";
import { useFitTrack } from "./fit-track-provider";
import type { WorkoutSession } from "@/lib/types";
import { SheetGrip } from "@/components/ui/sheet-grip";

export function HistoryDetailModal({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const { weightUnit } = useFitTrack();
  useScrollLock();
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="exercise-modal history-detail-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><SheetGrip onClose={onClose} /><button className="modal-close" aria-label="Close workout details" onClick={() => onClose()}>×</button><span className="modal-kicker">WORKOUT HISTORY · {shortDate(session.date)}</span><h2 id="history-detail-title">{session.plan.title}</h2><p className="modal-subtitle">{session.status.replaceAll("_", " ")} · Template {session.plan.templateVersion} · Rules {session.plan.ruleVersion}</p>
      <div className="history-feedback"><strong>Why this plan</strong>{session.plan.generationReasons.map((reason) => <p key={reason}>{reason}</p>)}{session.plan.originalExercises.length > 0 && <p>Original template: {session.plan.originalExercises.map((exercise) => exercise.name).join(" · ")}</p>}</div>
      {session.checkIn && <div className="history-feedback"><strong>Before the workout</strong><p>Energy {session.checkIn.energy}/5 · Soreness {session.checkIn.soreness}/5 · Recovery {session.checkIn.recovery}/5 · Pain {session.checkIn.pain ? "reported" : "none reported"}</p>{session.checkIn.discomfort && <p>{session.checkIn.discomfort}</p>}{session.checkIn.note && <p>{session.checkIn.note}</p>}</div>}
      <div className="history-detail-exercises"><h3>Exercise details</h3>{session.exerciseLogs.map((log) => { const exercise = session.plan.exercises.find((item) => item.id === log.exerciseId); return <article key={log.exerciseId} className="history-detail-exercise"><div><strong>{exercise?.name ?? log.exerciseId}</strong><span className={`exercise-status ${log.status}`}>{log.status.replaceAll("_", " ")}</span></div><p>{log.plannedSets} planned sets × {log.plannedReps} reps · {log.sets.filter((set) => set.completed).length} completed sets{log.substitutionName ? ` · Substituted with ${log.substitutionName}` : ""} · Form {log.formQuality.replaceAll("_", " ")}</p>{exercise?.selectionReason && <p>{exercise.selectionReason}</p>}{exercise?.progressionAdvice && <p>{exercise.progressionAdvice}</p>}{log.sets.length > 0 && <ul>{log.sets.map((set, index) => <li key={index}>Set {index + 1}: {set.completed ? `${set.actualReps} reps${set.loadKg === null ? "" : ` at ${formatWeight(set.loadKg, weightUnit)}`}` : "not completed"}{set.extra ? " · extra" : ""}</li>)}</ul>}{log.notes && <p>{log.notes}</p>}</article>; })}</div>
      {session.review && <div className="history-feedback"><strong>After the workout</strong><p>Effort {session.review.effort}/10 · Energy {session.review.energyAfter}/5 · Discomfort {session.review.discomfort ? "reported" : "none reported"} · {session.review.mood}</p>{session.review.discomfortNote && <p>{session.review.discomfortNote}</p>}{session.review.note && <p>{session.review.note}</p>}</div>}
      <button className="button button-primary full-width" onClick={() => onClose()}>Close details</button></section></div>
  );
}
