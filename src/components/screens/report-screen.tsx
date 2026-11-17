"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Repeat, Timer, Trophy } from "lucide-react";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { WeekRadar } from "@/components/app/recovery-carousel";
import { Rozi } from "@/components/app/rozi";
import { CountUp } from "@/components/ui/count-up";
import { dateLabel, isIsoDate, shiftDate, weekDates } from "@/lib/dates";
import { formatWeight } from "@/lib/logging";
import { missedReasonLabel } from "@/lib/missed-days";
import { GROUP_LABELS, MUSCLE_GROUPS, weeklyReport } from "@/lib/recovery";

/** "Your week with Rozi": a Monday–Sunday summary from saved workouts only, with older weeks a tap away. */
export function ReportScreen() {
  const { state, recordedSessions, currentDate, weightUnit } = useFitTrack();
  const router = useRouter();
  const params = useSearchParams();
  const thisMonday = weekDates(currentDate)[0];
  const asked = params.get("week");
  const weekStart = isIsoDate(asked) ? weekDates(asked)[0] : thisMonday;
  const report = useMemo(() => weeklyReport(state.profile, recordedSessions, weekStart, currentDate), [state.profile, recordedSessions, weekStart, currentDate]);
  const maxSets = Math.max(1, ...Object.values(report.groupSets));
  const label = `${dateLabel(report.weekStart, { day: "numeric", month: "short" })} – ${dateLabel(report.weekEnd, { day: "numeric", month: "short" })}`;
  const go = (start: string) => router.push(start === thisMonday ? "/report" : `/report?week=${start}`);
  return (
    <section className="report-page">
      <div className="report-nav">
        <button type="button" className="icon-button" aria-label="Previous week" onClick={() => go(shiftDate(weekStart, -7))}><ChevronLeft aria-hidden="true" /></button>
        <strong>{weekStart === thisMonday ? "This week" : label}</strong>
        <button type="button" className="icon-button" aria-label="Next week" disabled={weekStart >= thisMonday} onClick={() => go(shiftDate(weekStart, 7))}><ChevronRight aria-hidden="true" /></button>
      </div>

      <article className="panel report-hero">
        <Rozi mood={report.completed === 0 ? "rest-evening" : report.consistency !== null && report.consistency >= 100 ? "trophy" : "report-card"} size={104} eager />
        <div><small>{label}</small><h2>{report.rozi}</h2></div>
      </article>

      <div className="report-stats">
        <div className="panel"><Flame aria-hidden="true" /><strong><CountUp value={report.completed} /><small>/{report.planned}</small></strong><span>Workouts</span></div>
        <div className="panel"><Repeat aria-hidden="true" /><strong><CountUp value={report.sets} /></strong><span>Sets</span></div>
        <div className="panel"><Dumbbell aria-hidden="true" /><strong>{report.volumeKg ? formatWeight(report.volumeKg, weightUnit) : "—"}</strong><span>Lifted</span></div>
        <div className="panel"><Timer aria-hidden="true" /><strong><CountUp value={report.minutes} /></strong><span>Minutes</span></div>
      </div>

      <article className="panel report-block">
        <h3>Muscles this week</h3>
        <div className="report-muscles">
          <WeekRadar sets={report.groupSets} />
          <ul>{MUSCLE_GROUPS.map((group) => <li key={group}><span>{GROUP_LABELS[group]}</span><i><b style={{ width: `${(report.groupSets[group] / maxSets) * 100}%` }} /></i><em>{report.groupSets[group]}</em></li>)}</ul>
        </div>
      </article>

      <article className="panel report-block">
        <h3><Trophy aria-hidden="true" /> New records</h3>
        {report.newRecords.length
          ? <ul className="report-records">{report.newRecords.slice(0, 5).map((record) => <li key={record.exerciseId}><strong>{record.exerciseName}</strong><span>{formatWeight(record.loadKg, weightUnit)} × {record.reps}</span></li>)}{report.newRecords.length > 5 && <li className="report-more"><Link href="/progress">+{report.newRecords.length - 5} more on Progress</Link></li>}</ul>
          : <p className="card-note">No new records this week. Records come from sets logged with a weight.</p>}
      </article>

      <article className="panel report-block">
        <h3>How you felt</h3>
        <dl className="recovery-facts">
          <div><dt>Energy before</dt><dd>{report.avgEnergy ?? "—"}{report.avgEnergy ? "/5" : ""}</dd></div>
          <div><dt>Soreness</dt><dd>{report.avgSoreness ?? "—"}{report.avgSoreness ? "/5" : ""}</dd></div>
          <div><dt>Discomfort days</dt><dd>{report.discomfortDays}</dd></div>
          <div><dt>Consistency</dt><dd>{report.consistency === null ? "—" : `${report.consistency}%`}</dd></div>
        </dl>
        {report.missedReasons.length > 0 && <p className="card-note">Missed: {report.missedReasons.map(missedReasonLabel).join(" · ")}</p>}
      </article>

      <article className="panel report-block report-next">
        <h3>Next week</h3>
        <p>{report.nextWeekDays} workouts planned. {report.discomfortDays ? "Go gently where it felt uncomfortable — Rozi lightens the plan after a sore check-in." : "Reps go up first, then a small weight step."}</p>
        <Link href="/recovery" className="text-button">Check your recovery map <ChevronRight aria-hidden="true" /></Link>
      </article>
    </section>
  );
}
