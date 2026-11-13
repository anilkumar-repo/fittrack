import { shortDate } from "@/lib/dates";
import { MISSED_REASONS, missedDayHistory, missedReasonLabel } from "@/lib/missed-days";
import type { WorkoutSession } from "@/lib/types";

/** Missed training days with the reason given, newest first, plus a count per reason. */
export function MissedDaysList({ sessions, limit = 8 }: { sessions: WorkoutSession[]; limit?: number }) {
  const history = missedDayHistory(sessions);
  if (!history.length) return <p className="field-hint">No missed days. Nice consistency!</p>;
  const counts = MISSED_REASONS.map((item) => ({ ...item, count: history.filter((day) => day.entry.reason === item.id).length })).filter((item) => item.count > 0);
  return (
    <>
      <div className="missed-counts">{counts.map((item) => <span key={item.id}>{item.label}: {item.count}</span>)}</div>
      <ul className="missed-list">{history.slice(0, limit).map((day) => (
        <li key={day.date}><strong>{shortDate(day.date)} · {missedReasonLabel(day.entry.reason)}</strong>{day.entry.note && <span>“{day.entry.note}”</span>}</li>
      ))}</ul>
    </>
  );
}
