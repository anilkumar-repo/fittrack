"use client";

import { useMemo } from "react";
import { Award, Dumbbell, Repeat, TrendingUp } from "lucide-react";
import { useFitTrack } from "./fit-track-provider";
import { LineChart } from "./line-chart";
import { shortDate } from "@/lib/dates";
import { formatWeight, kgToDisplay } from "@/lib/logging";
import { exerciseHistory, exerciseRecords, repMaxTable, setLabels } from "@/lib/pro-tracking";
import { formatAmount, formatDistance, trackingOf } from "@/lib/tracking";
import type { TrackingUnit } from "@/lib/types";

const TOTAL_LABEL: Record<TrackingUnit, string> = { reps: "Total reps", seconds: "Total time (seconds)", minutes: "Total time (minutes)", rounds: "Total rounds" };
const MOST_LABEL: Record<TrackingUnit, string> = { reps: "Most reps", seconds: "Longest hold", minutes: "Longest session", rounds: "Most rounds" };
import { EmptyState } from "@/components/ui/empty-state";

/** History, charts and records for one exercise (the exercise guide's tabs), from your own saved sets. */
export function ExerciseStats({ exerciseId, view }: { exerciseId: string; view: "history" | "charts" | "records" }) {
  const { recordedSessions, weightUnit } = useFitTrack();
  const history = useMemo(() => exerciseHistory(recordedSessions, exerciseId), [recordedSessions, exerciseId]);
  const records = useMemo(() => exerciseRecords(history), [history]);
  const counted = trackingOf(exerciseId).unit;
  if (!history.length) return <EmptyState mood="workout" title="Nothing logged yet" text="Log this exercise in a workout and its history, charts and records show up here." />;

  if (view === "history") return (
    <ol className="ex-history">{history.slice(0, 30).map((day) => {
      const labels = setLabels(day.sets.map((set) => (set.kind === "normal" ? {} : { kind: set.kind })));
      return (
        <li key={day.date} className="ex-history-day">
          <div className="ex-history-head"><strong>{shortDate(day.date)}</strong>{day.oneRepMax && <small>Est. 1RM {formatWeight(day.oneRepMax, weightUnit)}</small>}</div>
          <ul>{day.sets.map((set, i) => <li key={i} className={`kind-${set.kind}`}><b>{labels[i]}</b><span>{set.loadKg ? `${kgToDisplay(set.loadKg, weightUnit)} ${weightUnit} × ${counted === "reps" ? set.reps : formatAmount(set.reps, counted)}` : formatAmount(set.reps, counted)}{set.distanceKm ? ` · ${formatDistance(set.distanceKm)}` : ""}</span>{set.oneRepMax && <em>{kgToDisplay(set.oneRepMax, weightUnit)}</em>}</li>)}</ul>
        </li>
      );
    })}</ol>
  );

  const oldestFirst = [...history].reverse();
  if (view === "charts") {
    const best = oldestFirst.filter((day) => day.best).map((day) => ({ label: shortDate(day.date), value: kgToDisplay(day.best!.loadKg, weightUnit) }));
    const oneRm = oldestFirst.filter((day) => day.oneRepMax).map((day) => ({ label: shortDate(day.date), value: kgToDisplay(day.oneRepMax!, weightUnit) }));
    const volume = oldestFirst.filter((day) => day.volumeKg).map((day) => ({ label: shortDate(day.date), value: kgToDisplay(day.volumeKg, weightUnit) }));
    const reps = oldestFirst.map((day) => ({ label: shortDate(day.date), value: day.sets.filter((set) => set.kind !== "warmup").reduce((sum, set) => sum + set.reps, 0) }));
    return (
      <div className="ex-charts">
        {best.length > 0 && counted === "reps" ? <>
          <article className="ex-chart"><h4>Heaviest set</h4><LineChart points={best} formatValue={(value) => `${value} ${weightUnit}`} ariaLabel="Heaviest set by day" /></article>
          {oneRm.length > 0 && <article className="ex-chart"><h4>Estimated one-rep max</h4><LineChart points={oneRm} formatValue={(value) => `${value} ${weightUnit}`} ariaLabel="Estimated one-rep max by day" /></article>}
          <article className="ex-chart"><h4>Total volume</h4><LineChart points={volume} formatValue={(value) => `${value} ${weightUnit}`} ariaLabel="Total weight lifted by day" /></article>
        </> : <article className="ex-chart"><h4>{TOTAL_LABEL[counted]}</h4><LineChart points={reps} formatValue={(value) => formatAmount(value, counted)} ariaLabel={`${TOTAL_LABEL[counted]} by day`} /></article>}
      </div>
    );
  }

  const table = records.bestOneRepMax ? repMaxTable(records.bestOneRepMax.value) : [];
  return (
    <div className="ex-records">
      <div className="ex-record-tiles">
        <div><Dumbbell aria-hidden="true" /><small>Heaviest</small><strong>{records.heaviest ? `${formatWeight(records.heaviest.loadKg, weightUnit)} × ${counted === "reps" ? records.heaviest.reps : formatAmount(records.heaviest.reps, counted)}` : "—"}</strong>{records.heaviest && <em>{shortDate(records.heaviest.date)}</em>}</div>
        <div><TrendingUp aria-hidden="true" /><small>Est. 1RM</small><strong>{records.bestOneRepMax ? formatWeight(records.bestOneRepMax.value, weightUnit) : "—"}</strong>{records.bestOneRepMax && <em>{shortDate(records.bestOneRepMax.date)}</em>}</div>
        <div><Award aria-hidden="true" /><small>Best volume</small><strong>{records.bestVolume ? formatWeight(records.bestVolume.volumeKg, weightUnit) : "—"}</strong>{records.bestVolume && <em>{shortDate(records.bestVolume.date)}</em>}</div>
        <div><Repeat aria-hidden="true" /><small>{MOST_LABEL[counted]}</small><strong>{records.mostReps ? `${counted === "reps" ? records.mostReps.reps : formatAmount(records.mostReps.reps, counted)}${records.mostReps.loadKg ? ` @ ${formatWeight(records.mostReps.loadKg, weightUnit)}` : ""}` : "—"}</strong>{records.mostReps && <em>{shortDate(records.mostReps.date)}</em>}</div>
      </div>
      {table.length > 0 && <>
        <h4 className="ex-table-title">What you could lift (estimate)</h4>
        <table className="ex-rm-table"><thead><tr><th>Reps</th><th>Weight</th><th>Reps</th><th>Weight</th></tr></thead>
          <tbody>{table.slice(0, 5).map((row, i) => <tr key={row.reps}><td>{row.reps}</td><td>{formatWeight(row.loadKg, weightUnit)}</td><td>{table[i + 5].reps}</td><td>{formatWeight(table[i + 5].loadKg, weightUnit)}</td></tr>)}</tbody>
        </table>
        <p className="card-note">From your best set, using the Epley formula. A guide, not a target — never test a true max without a spotter.</p>
      </>}
      <p className="card-note">{records.sessions} {records.sessions === 1 ? "session" : "sessions"} logged. Warm-up sets (W) are not counted.</p>
    </div>
  );
}
