"use client";

import { MissedDaysList } from "@/components/app/missed-days-card";
import { LevelPanel } from "@/components/app/level-panel";
import { BodyPanel } from "@/components/app/body-panel";

import { useState } from "react";
import { Award, CalendarCheck, Check, ChevronRight, Clock, Dumbbell, Flame, Lock, Medal, Sparkles, Target, Trophy, Zap, type LucideIcon } from "lucide-react";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { HistoryDetailModal } from "@/components/app/history-detail-modal";
import { calculateAchievements, type AchievementId } from "@/lib/achievements";
import { dateLabel, shortDate, weekdayOf } from "@/lib/dates";
import { LineChart } from "@/components/app/line-chart";
import { displayToKg, formatWeight, kgToDisplay } from "@/lib/logging";
import { bodyWeightTrend, buildExercisePerformance, buildProgressTimeline, calculateConsistency, calculatePersonalRecords, calculateRecoveryMetrics, createProgressDateRange, recordedSessionStatus, upsertBodyWeightEntry, validateBodyWeightEntry } from "@/lib/progress";
import { saveCloudBodyWeightEntry } from "@/lib/supabase-repository";
import type { WorkoutSession } from "@/lib/types";

const BADGE_ICONS: Record<AchievementId, LucideIcon> = {
  "first-workout": Sparkles, "full-week": CalendarCheck, "five-workouts": Medal, "two-weeks": Flame,
  "ten-workouts": Award, "first-load": Dumbbell, "four-weeks": Zap, "twenty-five-workouts": Trophy,
};

function progressStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: "Completed",
    partial: "Partial workout",
    skipped: "Skipped",
    planned: "Planned · no workout logged",
    in_progress: "In progress",
    rest_day: "Scheduled rest · inferred",
    no_record: "No session recorded",
    not_started: "Before training start",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function ProgressScreen() {
  const { state, getState, updateState, browserClient, currentDate, recordedSessions, weightUnit } = useFitTrack();
  const [selectedHistorySession, setSelectedHistorySession] = useState<WorkoutSession | null>(null);
  const [progressExerciseId, setProgressExerciseId] = useState("");
  const [bodyWeightDate, setBodyWeightDate] = useState("");
  const [bodyWeightInput, setBodyWeightInput] = useState("");
  const [bodyWeightSaving, setBodyWeightSaving] = useState(false);
  const [bodyWeightError, setBodyWeightError] = useState("");
  const [bodyWeightNotice, setBodyWeightNotice] = useState("");

  const historySessions = [...recordedSessions].sort((a, b) => b.date.localeCompare(a.date));
  const progressRange = createProgressDateRange(currentDate, 28);
  const progressTimeline = buildProgressTimeline(state.profile, recordedSessions, currentDate, 28);
  const consistency = calculateConsistency(state.profile, recordedSessions, currentDate, 28);
  const exerciseProgress = buildExercisePerformance(recordedSessions);
  const selectedProgressExercise = exerciseProgress.find((item) => item.exerciseId === progressExerciseId) ?? exerciseProgress[0];
  const performanceRecords = selectedProgressExercise?.records.filter((record) => record.completedSets > 0).slice(-8) ?? [];
  const loadPoints = performanceRecords.flatMap((record) => {
    const loads = record.sets.filter((set) => set.completed && set.loadKg !== null && set.loadKg > 0).map((set) => set.loadKg as number);
    return loads.length ? [{ label: shortDate(record.date), value: kgToDisplay(Math.max(...loads), weightUnit) }] : [];
  });
  const personalRecords = calculatePersonalRecords(recordedSessions);
  const recoveryMetrics = calculateRecoveryMetrics(recordedSessions, currentDate, 28);
  const weightTrend = bodyWeightTrend(state.bodyWeightEntries);
  const recentWeightTrend = weightTrend.slice(-8);
  const recentSessions = recordedSessions.filter((session) => progressRange && session.date >= progressRange.startDate && session.date <= progressRange.endDate);
  const completedRecentSessions = recentSessions.filter((session) => session.status === "completed").length;
  const achievements = calculateAchievements(recordedSessions, state.profile.sessionsPerWeek, personalRecords.length);

  async function saveBodyWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bodyWeightSaving) return;
    setBodyWeightError("");
    setBodyWeightNotice("");
    const weightKg = bodyWeightInput.trim() === "" ? Number.NaN : displayToKg(Number(bodyWeightInput), weightUnit);
    const errors = validateBodyWeightEntry(bodyWeightDate || currentDate, weightKg, currentDate);
    if (errors.length) {
      setBodyWeightError(errors.join(" "));
      return;
    }
    const measuredOn = bodyWeightDate || currentDate;
    const draft = { id: `weight-${state.profile.id}-${measuredOn}`, measuredOn, weightKg };
    setBodyWeightSaving(true);
    try {
      if (state.mode === "supabase" && !browserClient) throw new Error("Supabase is unavailable. Refresh the page and try again.");
      const saved = state.mode === "supabase" ? await saveCloudBodyWeightEntry(browserClient as NonNullable<typeof browserClient>, state.profile.id, draft) : draft;
      const latest = getState();
      updateState({ ...latest, bodyWeightEntries: upsertBodyWeightEntry(latest.bodyWeightEntries, saved) });
      setBodyWeightInput("");
      setBodyWeightNotice(`Measurement saved for ${dateLabel(measuredOn, { month: "short", day: "numeric", year: "numeric" })}.`);
    } catch (error) {
      setBodyWeightError(error instanceof Error ? error.message : "The measurement could not be saved. Please try again.");
    } finally {
      setBodyWeightSaving(false);
    }
  }

  return (
    <>
      <section className="progress">
        <div className="stat-row">
          <article className="panel stat"><span className="stat-ico"><Target aria-hidden="true" /></span><strong>{consistency?.percent === null || consistency?.percent === undefined ? "—" : `${consistency.percent}%`}</strong><small>Consistency</small><em>{consistency?.completedScheduledDays ?? 0} of {consistency?.scheduledDays ?? 0} planned days · 4 weeks</em></article>
          <article className="panel stat"><span className="stat-ico"><CalendarCheck aria-hidden="true" /></span><strong>{completedRecentSessions}</strong><small>Workouts</small><em>Finished in the last 4 weeks</em></article>
          <article className="panel stat"><span className="stat-ico"><Trophy aria-hidden="true" /></span><strong>{personalRecords.length}</strong><small>Personal records</small><em>Heaviest logged set per exercise</em></article>
        </div>

        <BodyPanel />

        <LevelPanel />

        <article className="panel">
          <div className="panel-title"><h3>Achievements</h3><span className="panel-count">{achievements.filter((item) => item.earned).length} of {achievements.length} earned</span></div>
          <ul className="badge-grid">{achievements.map((item) => {
            const BadgeIcon = BADGE_ICONS[item.id];
            return (
              <li key={item.id} className={`badge ${item.earned ? "earned" : ""}`}>
                <span className="badge-icon">{item.earned ? <BadgeIcon aria-hidden="true" /> : <Lock aria-hidden="true" />}</span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
                {item.earned
                  ? <span className="badge-state"><Check aria-hidden="true" /> Earned</span>
                  : <span className="badge-progress" role="progressbar" aria-label={`${item.title} progress`} aria-valuemin={0} aria-valuemax={item.target} aria-valuenow={item.current}><span style={{ width: `${(item.current / item.target) * 100}%` }} /><em>{item.current} / {item.target}</em></span>}
              </li>
            );
          })}</ul>
        </article>

        <article className="panel">
          <div className="panel-title"><h3>Last 4 weeks</h3><span className="panel-count">Tap a marked day to review it</span></div>
          <div className="activity-grid" role="list">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`} className="activity-head" aria-hidden="true">{day}</span>)}
            {Array.from({ length: progressTimeline.length ? (weekdayOf(progressTimeline[0].date) + 6) % 7 : 0 }, (_, index) => <span key={`blank-${index}`} />)}
            {progressTimeline.map((day) => {
              const label = `${dateLabel(day.date, { weekday: "long", month: "long", day: "numeric" })}: ${progressStatusLabel(day.status)}`;
              const content = <>{day.status === "completed" ? <Check aria-hidden="true" /> : Number(day.date.slice(-2))}</>;
              return day.session
                ? <button key={day.date} role="listitem" className={`activity-day ${day.status} ${day.date === currentDate ? "today" : ""}`} aria-label={`${label}. Open details`} onClick={() => setSelectedHistorySession(day.session!)}>{content}</button>
                : <span key={day.date} role="listitem" className={`activity-day ${day.status} ${day.date === currentDate ? "today" : ""}`} aria-label={label}>{content}</span>;
            })}
          </div>
          <p className="week-key"><span className="key done" /> Done <span className="key partial" /> Started <span className="key missed" /> Planned day, nothing logged <span className="key rest" /> Rest</p>
        </article>

        <div className="progress-two-column">
          <article className="panel progress-panel">
            <div className="section-heading"><div><h3>Exercise performance</h3><p>Actual completed sets and reps, with prescribed targets shown separately.</p></div></div>
            {exerciseProgress.length ? <>
              <label className="progress-select">Exercise<select aria-label="Choose exercise performance" value={selectedProgressExercise?.exerciseId ?? ""} onChange={(event) => setProgressExerciseId(event.target.value)}>{exerciseProgress.map((item) => <option key={item.exerciseId} value={item.exerciseId}>{item.exerciseName}</option>)}</select></label>
              {performanceRecords.length ? <>
                <p className="chart-caption">Total reps completed per workout for this exercise. Move over the chart to read each session; exact numbers are in the table below.</p>
                <LineChart points={performanceRecords.map((record) => ({ label: shortDate(record.date), value: record.completedReps }))} formatValue={(value) => `${value} reps`} ariaLabel={`Reps completed for ${selectedProgressExercise?.exerciseName} across ${performanceRecords.length} saved workouts`} />
                {loadPoints.length > 1 && <>
                  <p className="chart-caption">Heaviest recorded load per workout.</p>
                  <LineChart points={loadPoints} formatValue={(value) => `${value} ${weightUnit}`} ariaLabel={`Heaviest recorded load for ${selectedProgressExercise?.exerciseName} across ${loadPoints.length} saved workouts`} />
                </>}
                <div className="progress-table-scroll"><table className="progress-table performance-table"><thead><tr><th scope="col">Date</th><th scope="col">Prescribed target</th><th scope="col">Completed actual</th><th scope="col">Recorded loads</th></tr></thead><tbody>{performanceRecords.slice().reverse().map((record) => <tr key={record.date}><th scope="row">{shortDate(record.date)}</th><td>{record.plannedSets} × {record.plannedReps} reps</td><td>{record.completedSets} sets · {record.completedReps} reps</td><td>{record.sets.filter((set) => set.completed && set.loadKg !== null).map((set) => formatWeight(set.loadKg as number, weightUnit)).join(", ") || "No load recorded"}</td></tr>)}</tbody></table></div>
              </> : <div className="empty-inline">No completed set performance is recorded for this exercise yet.</div>}
            </> : <div className="empty-state compact-empty"><h3>No exercise results yet</h3><p>Actual set and rep trends will appear after you save workout logs.</p></div>}
          </article>
          <article className="panel progress-panel">
            <div className="section-heading"><div><h3>Personal records</h3><p>Record = highest positive load on a completed set with actual reps recorded in the loaded history.</p></div></div>
            {personalRecords.length ? <div className="record-list">{personalRecords.map((record) => <div className="record-row" key={record.exerciseId}><span className="record-icon"><Trophy aria-hidden="true" /></span><div><strong>{record.exerciseName}</strong><small>{formatWeight(record.loadKg, weightUnit)} × {record.reps} reps · {shortDate(record.date)}</small></div></div>)}</div> : <div className="empty-inline">No recorded weighted sets yet. Unweighted sets and missing loads do not create a weight record.</div>}
            <p className="metric-definition">These are recorded load records, not estimated one-rep maxes. Substituted exercises are tracked under the substituted movement’s name.</p>
          </article>
        </div>

        <div className="progress-two-column">
          <article className="panel progress-panel">
            <div className="section-heading"><div><h3>Recovery & exercise patterns</h3><p>Available check-ins, post-workout feedback, and explicit skips · last 28 days</p></div></div>
            {recoveryMetrics && (recoveryMetrics.checkInCount || recoveryMetrics.reviewCount || recoveryMetrics.skippedExercises.length) ? <>
              <div className="recovery-grid"><div><small>PRE-WORKOUT CHECK-INS</small><strong>{recoveryMetrics.checkInCount}</strong></div><div><small>AVERAGE ENERGY · CHECK-INS</small><strong>{recoveryMetrics.averageEnergy ?? "—"}{recoveryMetrics.averageEnergy === null ? "" : " / 5"}</strong></div><div><small>AVERAGE SORENESS · CHECK-INS</small><strong>{recoveryMetrics.averageSoreness ?? "—"}{recoveryMetrics.averageSoreness === null ? "" : " / 5"}</strong></div><div><small>ENERGY AFTER · {recoveryMetrics.reviewCount} REVIEWS</small><strong>{recoveryMetrics.averageEnergyAfter ?? "—"}{recoveryMetrics.averageEnergyAfter === null ? "" : " / 5"}</strong></div><div><small>PAIN REPORTED BEFORE</small><strong>{recoveryMetrics.painCheckIns} / {recoveryMetrics.checkInCount}</strong></div><div><small>DISCOMFORT AFTER · {recoveryMetrics.reviewCount} REVIEWS</small><strong>{recoveryMetrics.postWorkoutDiscomfortReports}</strong></div></div>
              {recoveryMetrics.skippedExercises.length > 0 && <div className="skip-patterns"><h4>Exercises marked skipped</h4>{recoveryMetrics.skippedExercises.map((item) => <p key={item.exerciseId}>{item.exerciseName} · {item.count} {item.count === 1 ? "time" : "times"}, last {shortDate(item.latestDate)}</p>)}</div>}
              {recoveryMetrics.painCheckIns > 0 && <p className="pain-note">Pain was reported before one or more workouts. RozFit does not diagnose the cause; stop any painful movement and consider professional assessment when appropriate.</p>}
            </> : <div className="empty-inline">No check-in, recovery, or skipped-exercise feedback is recorded for this date range.</div>}
          </article>
          <article className="panel progress-panel bodyweight-panel">
            <div className="section-heading"><div><h3>Body weight <span className="optional-tag">OPTIONAL</span></h3><p>Private dated measurements. Leaving this blank does not affect your plan.</p></div></div>
            {state.mode === "supabase" && !state.bodyWeightAvailable ? <div className="empty-inline">Body-weight tracking isn’t available right now. Your workouts still save normally.</div> : <>
              <form className="bodyweight-form" onSubmit={saveBodyWeight}>
                <label className="field-label">Date<input type="date" max={currentDate} value={bodyWeightDate || currentDate} onChange={(event) => setBodyWeightDate(event.target.value)} /></label>
                <label className="field-label">Weight ({weightUnit})<input type="number" min={weightUnit === "lb" ? 44 : 20} max={weightUnit === "lb" ? 1102 : 500} step={weightUnit === "lb" ? 0.1 : 0.01} inputMode="decimal" value={bodyWeightInput} onChange={(event) => setBodyWeightInput(event.target.value)} placeholder="Optional" /></label>
                <button className="button button-primary" type="submit" disabled={bodyWeightSaving}>{bodyWeightSaving ? "Saving…" : "Save measurement"}</button>
              </form>
              {bodyWeightError && <p role="alert" className="form-error">{bodyWeightError}</p>}{bodyWeightNotice && <p role="status" className="success-note">{bodyWeightNotice}</p>}
              {weightTrend.length ? <><p className="chart-caption">Your recent measurements. Exact values and dates are listed below.</p><LineChart points={recentWeightTrend.map((entry) => ({ label: shortDate(entry.date), value: kgToDisplay(entry.weightKg, weightUnit) }))} formatValue={(value) => `${value} ${weightUnit}`} ariaLabel={`Recorded body weight across ${recentWeightTrend.length} recent dates`} /><div className="progress-table-scroll"><table className="progress-table"><thead><tr><th scope="col">Date</th><th scope="col">Recorded body weight</th></tr></thead><tbody>{weightTrend.slice().reverse().map((entry) => <tr key={entry.date}><th scope="row">{dateLabel(entry.date, { month: "short", day: "numeric", year: "numeric" })}</th><td>{formatWeight(entry.weightKg, weightUnit)}</td></tr>)}</tbody></table></div></> : <div className="empty-inline">No body-weight measurements recorded. Add one only if it is useful to you.</div>}
            </>}
          </article>
        </div>

        <article className="panel">
          <div className="panel-title"><h3>Missed workouts</h3><span className="panel-count">Reasons you gave</span></div>
          <MissedDaysList sessions={recordedSessions} />
        </article>

        <article className="panel">
          <div className="panel-title"><h3>Workout history</h3><span className="panel-count">{historySessions.length} saved</span></div>
          {historySessions.length ? <div className="recent-rows">{historySessions.map((session) => {
            const status = recordedSessionStatus(session);
            const setsDone = session.exerciseLogs.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0);
            return (
              <button key={session.id} className="recent-item" onClick={() => setSelectedHistorySession(session)}>
                <span className={`recent-check ${status === "completed" ? "" : "pending"}`}>{status === "completed" ? <Check aria-hidden="true" /> : <Clock aria-hidden="true" />}</span>
                <span className="recent-text"><strong>{session.plan.title}</strong><small>{dateLabel(session.date, { weekday: "short", month: "short", day: "numeric" })} · {progressStatusLabel(status)}{setsDone ? ` · ${setsDone} ${setsDone === 1 ? "set" : "sets"}` : ""}{session.review ? ` · effort ${session.review.effort}/10` : ""}</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
            );
          })}</div> : <p className="recent-empty">Workouts appear here after you save a session.</p>}
        </article>

        <details className="why-plan">
          <summary>How these numbers are worked out</summary>
          <p>Consistency is the number of planned training days with a completed session, divided by all planned training days since you started, over the 28 days ending today. Started, planned, and unlogged days do not count as completed.</p>
          <p>A personal record is the heaviest load you logged on a completed set. Nothing is estimated. Achievements count only completed, saved sessions.</p>
          <small>Each saved session keeps the plan and rule version it was made with. Signed-in accounts load the most recent 300 sessions and 1,000 body-weight entries.</small>
        </details>
      </section>
      {selectedHistorySession && <HistoryDetailModal session={selectedHistorySession} onClose={() => setSelectedHistorySession(null)} />}
    </>
  );
}
