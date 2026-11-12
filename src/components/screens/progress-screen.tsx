"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFitTrack } from "@/components/app/fit-track-provider";
import { HistoryDetailModal } from "@/components/app/history-detail-modal";
import { dateLabel, shortDate } from "@/lib/dates";
import { LineChart } from "@/components/app/line-chart";
import { displayToKg, formatWeight, kgToDisplay } from "@/lib/logging";
import { bodyWeightTrend, buildExercisePerformance, buildProgressTimeline, calculateConsistency, calculatePersonalRecords, calculateRecoveryMetrics, createProgressDateRange, recordedSessionStatus, upsertBodyWeightEntry, validateBodyWeightEntry } from "@/lib/progress";
import { saveCloudBodyWeightEntry } from "@/lib/supabase-repository";
import type { WorkoutSession } from "@/lib/types";

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
  const router = useRouter();
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
      <section className="progress-page">
        <div className="page-intro"><div><span className="eyebrow">Built from saved workouts and logged results</span><h2>Your progress, as recorded.</h2><p>Only saved sessions and completed sets count. Missing dates stay visible as missing data.</p></div></div>
        <div className="stats-grid progress-stats">
          <article className="stat-card stat-purple"><span className="stat-icon">✦</span><small>CONSISTENCY · LAST 28 DAYS</small><strong>{consistency?.percent === null || consistency?.percent === undefined ? "—" : `${consistency.percent}%`}</strong><span className="stat-foot">{consistency?.completedScheduledDays ?? 0} completed / {consistency?.scheduledDays ?? 0} scheduled days</span></article>
          <article className="stat-card"><span className="stat-icon soft">◷</span><small>COMPLETED · LAST 28 DAYS</small><strong>{completedRecentSessions}</strong><span className="stat-foot">Explicitly saved as completed</span></article>
          <article className="stat-card"><span className="stat-icon soft">⌁</span><small>RECORDED PERSONAL RECORDS</small><strong>{personalRecords.length}</strong><span className="stat-foot">Heaviest completed set with recorded load</span></article>
        </div>
        <p className="metric-definition">Consistency = explicitly completed sessions on scheduled training days ÷ scheduled training days on or after your training start date, using your current weekly schedule in the inclusive 28 days ending {dateLabel(currentDate, { month: "short", day: "numeric", year: "numeric" })}. Partial, planned, skipped, and unrecorded days do not count as completed.</p>

        <article className="panel progress-panel">
          <div className="section-heading"><div><h3>Last 28 days</h3><p>Saved session status by date. Rest days are inferred from your current weekly schedule.</p></div><span className="pill pill-outline">{progressTimeline.length} DAYS</span></div>
          <div className="progress-table-scroll"><table className="progress-table"><thead><tr><th scope="col">Date</th><th scope="col">Scheduled?</th><th scope="col">Recorded status</th><th scope="col">Session</th></tr></thead><tbody>{progressTimeline.map((day) => <tr key={day.date}><th scope="row">{dateLabel(day.date, { weekday: "short", month: "short", day: "numeric" })}</th><td>{day.status === "not_started" ? "—" : day.isScheduledTrainingDay ? "Training day" : "Rest day"}</td><td><span className={`progress-status status-${day.status}`}>{progressStatusLabel(day.status)}</span></td><td>{day.session ? <button type="button" className="text-button timeline-open" onClick={() => setSelectedHistorySession(day.session!)}>Review saved workout</button> : "—"}</td></tr>)}</tbody></table></div>
          {!recentSessions.length && <div className="empty-inline">No workout sessions are saved in this date range. A scheduled day without a saved session is shown as “No session recorded,” not as a completed or missed workout.</div>}
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
            </> : <div className="empty-state compact-empty"><span>⌁</span><h3>No exercise results yet</h3><p>Actual set and rep trends will appear after you save workout logs.</p></div>}
          </article>
          <article className="panel progress-panel">
            <div className="section-heading"><div><h3>Personal records</h3><p>Record = highest positive load on a completed set with actual reps recorded in the loaded history.</p></div></div>
            {personalRecords.length ? <div className="record-list">{personalRecords.map((record) => <div className="record-row" key={record.exerciseId}><span className="record-icon">✦</span><div><strong>{record.exerciseName}</strong><small>{formatWeight(record.loadKg, weightUnit)} × {record.reps} reps · {shortDate(record.date)}</small></div></div>)}</div> : <div className="empty-inline">No recorded weighted sets yet. Unweighted sets and missing loads do not create a weight record.</div>}
            <p className="metric-definition">These are recorded load records, not estimated one-rep maxes. Substituted exercises are tracked under the substituted movement’s name.</p>
          </article>
        </div>

        <div className="progress-two-column">
          <article className="panel progress-panel">
            <div className="section-heading"><div><h3>Recovery & exercise patterns</h3><p>Available check-ins, post-workout feedback, and explicit skips · last 28 days</p></div></div>
            {recoveryMetrics && (recoveryMetrics.checkInCount || recoveryMetrics.reviewCount || recoveryMetrics.skippedExercises.length) ? <>
              <div className="recovery-grid"><div><small>PRE-WORKOUT CHECK-INS</small><strong>{recoveryMetrics.checkInCount}</strong></div><div><small>AVERAGE ENERGY · CHECK-INS</small><strong>{recoveryMetrics.averageEnergy ?? "—"}{recoveryMetrics.averageEnergy === null ? "" : " / 5"}</strong></div><div><small>AVERAGE SORENESS · CHECK-INS</small><strong>{recoveryMetrics.averageSoreness ?? "—"}{recoveryMetrics.averageSoreness === null ? "" : " / 5"}</strong></div><div><small>ENERGY AFTER · {recoveryMetrics.reviewCount} REVIEWS</small><strong>{recoveryMetrics.averageEnergyAfter ?? "—"}{recoveryMetrics.averageEnergyAfter === null ? "" : " / 5"}</strong></div><div><small>PAIN REPORTED BEFORE</small><strong>{recoveryMetrics.painCheckIns} / {recoveryMetrics.checkInCount}</strong></div><div><small>DISCOMFORT AFTER · {recoveryMetrics.reviewCount} REVIEWS</small><strong>{recoveryMetrics.postWorkoutDiscomfortReports}</strong></div></div>
              {recoveryMetrics.skippedExercises.length > 0 && <div className="skip-patterns"><h4>Exercises marked skipped</h4>{recoveryMetrics.skippedExercises.map((item) => <p key={item.exerciseId}>{item.exerciseName} · {item.count} {item.count === 1 ? "time" : "times"}, last {shortDate(item.latestDate)}</p>)}</div>}
              {recoveryMetrics.painCheckIns > 0 && <p className="pain-note">Pain was reported before one or more workouts. FitTrack does not diagnose the cause; stop any painful movement and consider professional assessment when appropriate.</p>}
            </> : <div className="empty-inline">No check-in, recovery, or skipped-exercise feedback is recorded for this date range.</div>}
          </article>
          <article className="panel progress-panel bodyweight-panel">
            <div className="section-heading"><div><h3>Body weight <span className="optional-tag">OPTIONAL</span></h3><p>Private dated measurements. Leaving this blank does not affect your plan.</p></div></div>
            {state.mode === "supabase" && !state.bodyWeightAvailable ? <div className="empty-inline">Body-weight tracking is unavailable until the Phase 5 database migration is applied. Existing workout tracking continues to work.</div> : <>
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

        <article className="panel history-panel"><div className="section-heading"><div><h3>Saved workout history</h3><p>Open a date to review its plan, actual logged sets, substitutions, and feedback.</p></div><span className="pill pill-outline">{historySessions.length} SAVED</span></div>{historySessions.length ? <div className="history-table"><div className="history-header"><span>SESSION</span><span>DATE</span><span>SETS DONE</span><span>EFFORT</span><span>STATUS</span></div>{historySessions.map((session) => { const status = recordedSessionStatus(session); const setsDone = session.exerciseLogs.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0); return <button key={session.id} className="history-row history-row-button" onClick={() => setSelectedHistorySession(session)}><span className="history-session"><span className="recent-icon">✦</span><strong>{session.plan.title}</strong></span><span>{shortDate(session.date)}</span><span>{setsDone} sets</span><span>{session.review?.effort ?? "—"} / 10</span><span className={status === "completed" ? "status-complete" : "status-pending"}>{progressStatusLabel(status)}</span></button>; })}</div> : <div className="empty-state"><span>✧</span><h3>No saved workouts yet</h3><p>FitTrack will show workouts here only after a session has been saved.</p><button className="button button-primary" onClick={() => router.push("/today")}>Go to today’s workout <span>→</span></button></div>}</article>
        <p className="version-note">Each saved session keeps its original plan and rule version. Prescribed targets remain separate from the actual sets you logged. Supabase currently loads up to 300 recent sessions and 1,000 body-weight measurements; older saved entries may not appear in these charts or records.</p>
      </section>
      {selectedHistorySession && <HistoryDetailModal session={selectedHistorySession} onClose={() => setSelectedHistorySession(null)} />}
    </>
  );
}
