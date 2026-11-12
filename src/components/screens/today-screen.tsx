"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExerciseGuideModal, toGuideExercise } from "@/components/app/exercise-guide-modal";
import { ExerciseLogCard } from "@/components/app/exercise-log-card";
import { RestTimer } from "@/components/app/rest-timer";
import { lastPerformance } from "@/lib/logging";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { emptyCheckIn, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, describeNextDay, isIsoDate, nextTrainingDate, todayHref } from "@/lib/dates";
import { generateWorkout, preserveManualExerciseChoices } from "@/lib/planner";
import { createInitialExerciseLogs } from "@/lib/supabase-repository";
import type { CheckIn, ExerciseDefinition, ExerciseLog, WorkoutReview, WorkoutSession } from "@/lib/types";
import { createExerciseLog, createInFlightDeduper, statusForSets, validateCheckIn, validateWorkoutSession } from "@/lib/workout-tracking";

type FlowStep = "checkin" | "workout" | "review" | "done";

const emptyReview = (): WorkoutReview => ({ effort: 5, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "" });
const dedupeWorkoutSubmission = createInFlightDeduper<boolean>();

/** The workout page for today, or for the date in `?date=YYYY-MM-DD`. */
export function TodayScreen() {
  const { currentDate } = useFitTrack();
  const requested = useSearchParams().get("date");
  const date = isIsoDate(requested) ? requested : currentDate;
  // A new date starts a fresh check-in, logger, and review.
  return <WorkoutDayView key={date} date={date} />;
}

function WorkoutDayView({ date }: { date: string }) {
  const router = useRouter();
  const { state, getState, currentDate, recordedSessions, trainerRuleSettings, planningProfile, upsertSession, savingSession, saveError, weightUnit } = useFitTrack();
  const [flowStep, setFlowStep] = useState<FlowStep>("checkin");
  const [checkIn, setCheckIn] = useState<CheckIn>(emptyCheckIn);
  const [checkInEdited, setCheckInEdited] = useState(false);
  const [review, setReview] = useState<WorkoutReview>(emptyReview);
  const reviewRef = useRef(review);
  const [formError, setFormError] = useState("");
  const [guideExercise, setGuideExercise] = useState<ExerciseDefinition | null>(null);
  const { session: todaySession, plan } = useWorkoutDay(date, flowStep === "checkin" ? checkIn : undefined, checkInEdited);
  /** True while a saved session is reopened to correct its entries. */
  const [editing, setEditing] = useState(false);
  const [rest, setRest] = useState<{ endsAt: number; exerciseName: string } | null>(null);
  // On a phone the logger starts with one exercise on screen at a time.
  const [oneAtATime, setOneAtATime] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const displayReview = todaySession?.review ?? review;
  const displayFlowStep = todaySession?.status === "in_progress" && flowStep === "checkin" ? (todaySession.review ? "review" : "workout") : flowStep;
  const exerciseCount = todaySession?.plan.exercises.length ?? 0;
  // Until the person picks one, show the first exercise that still has sets to do.
  const firstOpenIndex = Math.max(0, (todaySession?.plan.exercises ?? []).findIndex((exercise) => {
    const status = todaySession?.exerciseLogs.find((item) => item.exerciseId === exercise.id)?.status ?? "not_started";
    return status === "not_started" || status === "partial";
  }));
  const shownIndex = Math.min(focusIndex ?? firstOpenIndex, Math.max(0, exerciseCount - 1));
  const dismissRest = useCallback(() => setRest(null), []);

  useEffect(() => { if (todaySession?.review) reviewRef.current = todaySession.review; }, [todaySession?.review]);

  function updateCheckIn(patch: Partial<CheckIn>) {
    setCheckInEdited(true);
    setCheckIn((current) => ({ ...current, ...patch }));
  }

  function openNextWorkout() {
    const next = nextTrainingDate(state.profile, currentDate);
    if (next) router.push(todayHref(next, currentDate));
  }

  function startWorkout() {
    const generatedForStart = todaySession?.status === "planned"
      ? generateWorkout({ date, profile: state.profile, sessions: recordedSessions, checkIn, trainerRuleSettings, trainerRuleRevision: state.trainerRuleRevision ?? 1 })
      : null;
    const startPlan = generatedForStart && todaySession?.status === "planned"
      ? preserveManualExerciseChoices(generatedForStart, todaySession.plan, planningProfile)
      : generatedForStart ?? plan;
    if (!startPlan) return;
    const checkInErrors = validateCheckIn(checkIn);
    if (checkInErrors.length) { setFormError(checkInErrors.join(" ")); return; }
    const baseSession: WorkoutSession = todaySession ?? {
      id: state.mode === "demo" ? `demo-${date}` : crypto.randomUUID(),
      date,
      status: "in_progress",
      plan: startPlan,
      checkIn,
      exerciseLogs: [],
    };
    const session: WorkoutSession = {
      ...baseSession,
      status: "in_progress",
      plan: startPlan,
      checkIn,
      exerciseLogs: todaySession?.status === "planned" || baseSession.exerciseLogs.length === 0
        ? createInitialExerciseLogs(startPlan)
        : baseSession.exerciseLogs,
    };
    setFormError("");
    void upsertSession(session);
    setFlowStep("workout");
  }

  function updateExercise(exerciseId: string, updater: (log: ExerciseLog) => ExerciseLog) {
    const currentState = getState();
    const session = sessionForDate(currentState, date);
    if (!session) return;
    const currentLog = session.exerciseLogs.find((log) => log.exerciseId === exerciseId);
    if (!currentLog) return;
    const updatedLog = updater(currentLog);
    if (updatedLog.status !== "skipped") updatedLog.status = statusForSets(updatedLog.sets);
    const nextSession = {
      ...session,
      exerciseLogs: session.exerciseLogs.map((log) => log.exerciseId === exerciseId ? updatedLog : log),
    };
    void upsertSession(nextSession, { debounce: true });
  }

  function updateReview(patch: Partial<WorkoutReview>) {
    const currentReview = sessionForDate(getState(), date)?.review ?? reviewRef.current;
    const nextReview = { ...currentReview, ...patch };
    reviewRef.current = nextReview;
    setReview(nextReview);
    const session = sessionForDate(getState(), date);
    if (session?.status === "in_progress" || session?.status === "completed") void upsertSession({ ...session, review: nextReview }, { debounce: true });
  }

  function addSet(exerciseId: string) {
    updateExercise(exerciseId, (log) => ({ ...log, sets: [...log.sets, { plannedReps: null, actualReps: null, loadKg: null, completed: false, extra: true }] }));
  }

  function finishLogging() {
    const session = sessionForDate(getState(), date);
    if (session) void upsertSession({ ...session, review: session.review ?? reviewRef.current });
    setFormError("");
    setFlowStep("review");
  }

  async function submitCompletedSession(sessionDate: string) {
    const session = sessionForDate(getState(), sessionDate);
    if (!session) return false;
    const completed = { ...session, status: "completed" as const, review: session.review ?? reviewRef.current, completedAt: session.completedAt ?? new Date().toISOString() };
    const errors = validateWorkoutSession(completed);
    if (errors.length) { setFormError(errors.join(" ")); return false; }
    setFormError("");
    const saved = await upsertSession(completed);
    if (saved) { setFlowStep("done"); setEditing(false); setRest(null); }
    return saved;
  }

  function completeWorkout() {
    const key = `${getState().profile.id}:${date}`;
    void dedupeWorkoutSubmission(key, () => submitCompletedSession(date)).catch((error: unknown) => {
      setFormError(error instanceof Error ? error.message : "The session could not be saved. Please try again.");
    });
  }

  return (
    <>
      <section className="today-page">
        <div className="page-intro"><div><span className="eyebrow">{dateLabel(date)}</span><h2>{plan?.title ?? "Rest and recover"}</h2><p>{plan?.description ?? `Your next training day is ${describeNextDay(state.profile, date)}. Take today for recovery.`}</p></div><span className="pill pill-outline">{plan ? `${plan.exercises.length} MOVEMENTS · ${plan.durationMinutes} MIN` : "RECOVERY DAY"}</span></div>
        {plan && <div className="version-strip"><span>{todaySession?.status === "planned" ? savingSession ? "Saving today’s plan…" : saveError ? "Plan saved on this device; cloud sync needs attention" : "This date’s plan is saved and reused. Check-in and equipment are applied when you begin." : "Plan versions are saved with each session"}</span><strong>Template {plan.templateVersion} <i>·</i> Rules {plan.ruleVersion}</strong></div>}
        {plan && <div className={`plan-explanation ${plan.sessionType === "recovery" ? "recovery-explanation" : ""}`}><strong>{plan.sessionType === "recovery" ? "Recovery recommendation" : "Why this plan"}</strong><p>{plan.generationReasons.join(" ")}</p></div>}
        {plan && <div className="workout-layout">
          <div className="workout-main-column">
            {(!todaySession || todaySession.status === "planned") && displayFlowStep === "checkin" && <article className="panel checkin-panel">
              <div className="panel-heading"><span className="panel-step">01</span><div><h3>Before you begin</h3><p>A quick check-in helps keep the session comfortable.</p></div></div>
              <div className="checkin-question"><label>How’s your energy today?</label><div className="choice-row">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => updateCheckIn({ energy: value })} className={`choice-chip ${checkIn.energy === value ? "selected" : ""}`} aria-pressed={checkIn.energy === value}><strong>{value}</strong><small>{["Low", "A little low", "Okay", "Good", "Great"][value - 1]}</small></button>)}</div></div>
              <div className="checkin-question"><label>Any muscle soreness?</label><div className="choice-row compact">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => updateCheckIn({ soreness: value })} className={`choice-dot ${checkIn.soreness === value ? "selected" : ""}`} aria-label={`Soreness ${value} out of 5`} aria-pressed={checkIn.soreness === value}>{value}</button>)}</div><small className="field-hint">1 is none · 5 is quite sore</small></div>
              <div className="checkin-question"><label>How recovered do you feel?</label><div className="choice-row compact">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => updateCheckIn({ recovery: value })} className={`choice-dot ${checkIn.recovery === value ? "selected" : ""}`} aria-label={`Recovery ${value} out of 5`} aria-pressed={checkIn.recovery === value}>{value}</button>)}</div><small className="field-hint">1 is not recovered · 5 is fully recovered</small></div>
              <label className="checkbox-row"><input type="checkbox" checked={checkIn.pain} onChange={(event) => updateCheckIn({ pain: event.target.checked })} /><span><strong>I have pain or an injury concern</strong><small>Skip any movement that does not feel comfortable.</small></span></label>
              {checkIn.pain && <><label className="field-label">Where or what feels uncomfortable? <textarea value={checkIn.discomfort} maxLength={1000} onChange={(event) => updateCheckIn({ discomfort: event.target.value })} placeholder="Optional details" rows={2} /></label><p className="safety-note" role="note">Today’s plan switches to optional recovery. Stop anything that causes pain. If pain is new, severe, persists, or limits normal activity, seek assessment from an appropriate health professional.</p></>}
              <label className="field-label">Anything else you want to note? <textarea value={checkIn.note} maxLength={2000} onChange={(event) => updateCheckIn({ note: event.target.value })} placeholder="Optional note for your session" rows={2} /></label>
              {formError && <p role="alert" className="form-error">{formError}</p>}
              <div className="panel-footer"><span className="muted small">Your answers shape today’s volume.</span><button className="button button-primary" onClick={startWorkout}>Continue to workout <span>→</span></button></div>
            </article>}

            {todaySession && todaySession.status === "completed" && !editing && <article className="panel complete-panel"><span className="complete-badge">✓</span><h3>Session complete. Nice work.</h3><p>{todaySession.review?.note || "You showed up and put in steady work."}</p><div className="complete-summary"><span><strong>{todaySession.plan.exercises.length}</strong><small>movements</small></span><span><strong>{todaySession.review?.effort ?? "—"}/10</strong><small>effort</small></span><span><strong>{todaySession.plan.durationMinutes} min</strong><small>planned</small></span></div><div className="account-card-actions"><button className="button button-subtle" onClick={() => router.push("/progress")}>See your progress <span>→</span></button><button className="text-button" onClick={() => { setEditing(true); setFlowStep("workout"); }}>Edit entries</button></div></article>}

            {todaySession && (todaySession.status !== "completed" || editing) && <>
              {displayFlowStep === "workout" && <article className="panel logger-panel">
                <div className="logger-top"><div className="panel-heading"><span className="panel-step">02</span><div><h3>Your workout</h3><p>Go at your own pace. Rest whenever you need.</p></div></div><span className="live-badge"><span /> {editing ? "EDITING" : "IN PROGRESS"}</span></div>
                <div className="logger-mode">
                  <span>{oneAtATime ? `Exercise ${shownIndex + 1} of ${exerciseCount}` : `${exerciseCount} exercises`}</span>
                  <button type="button" className="text-button" onClick={() => setOneAtATime((value) => !value)}>{oneAtATime ? "Show all exercises" : "One at a time"}</button>
                </div>
                {oneAtATime && <div className="logger-steps" role="tablist" aria-label="Exercises in this workout">{todaySession.plan.exercises.map((exercise, index) => {
                  const status = todaySession.exerciseLogs.find((item) => item.exerciseId === exercise.id)?.status ?? "not_started";
                  return <button key={exercise.id} type="button" role="tab" aria-selected={index === shownIndex} aria-label={`${exercise.name}, ${status.replaceAll("_", " ")}`} className={`logger-step ${status} ${index === shownIndex ? "current" : ""}`} onClick={() => setFocusIndex(index)}>{index + 1}</button>;
                })}</div>}
                <div className="exercise-log-list">
                  {todaySession.plan.exercises.map((exercise, index) => {
                    if (oneAtATime && index !== shownIndex) return null;
                    const log = todaySession.exerciseLogs.find((item) => item.exerciseId === exercise.id) ?? createExerciseLog(exercise.id, exercise.sets, exercise.reps);
                    return <ExerciseLogCard key={exercise.id} exercise={exercise} index={index} log={log} unit={weightUnit}
                      substitutedForName={exercise.substitutedFor ? plan.originalExercises.find((item) => item.id === exercise.substitutedFor)?.name ?? exercise.substitutedFor : undefined}
                      last={lastPerformance(exercise.id, recordedSessions, date)}
                      onUpdate={(updater) => updateExercise(exercise.id, updater)}
                      onAddSet={() => addSet(exercise.id)}
                      onOpenGuide={() => setGuideExercise(toGuideExercise(exercise))}
                      onSetCompleted={() => { if (!editing && exercise.restSeconds > 0) setRest({ endsAt: Date.now() + exercise.restSeconds * 1000, exerciseName: exercise.name }); }} />;
                  })}
                </div>
                {oneAtATime && exerciseCount > 1 && <div className="logger-nav">
                  <button type="button" className="button button-subtle" disabled={shownIndex === 0} onClick={() => setFocusIndex(shownIndex - 1)}><span>←</span> Previous</button>
                  {shownIndex < exerciseCount - 1 && <button type="button" className="button button-primary" onClick={() => setFocusIndex(shownIndex + 1)}>Next exercise <span>→</span></button>}
                </div>}
                <div className="logger-bottom"><span className="muted small">{savingSession ? "Saving your progress…" : saveError ? "Sync needs attention; your draft is on this device." : "Your entries save as you go."}</span><button className="button button-primary" onClick={finishLogging}>Finish & review <span>→</span></button></div>
              </article>}

              {displayFlowStep === "review" && <article className="panel review-panel">
                <div className="panel-heading"><span className="panel-step">03</span><div><h3>How did that feel?</h3><p>A short reflection helps you and your trainer tune the plan.</p></div></div>
                <div className="checkin-question"><label>Overall effort (1 feels easy · 10 feels maximal)</label><div className="effort-row">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} onClick={() => updateReview({ effort: value })} className={displayReview.effort === value ? "selected" : ""} aria-pressed={displayReview.effort === value}>{value}</button>)}</div></div>
                <div className="checkin-question"><label>Compared with what you expected?</label><div className="mood-row">{(["better", "same", "tougher"] as const).map((mood) => <button key={mood} onClick={() => updateReview({ mood })} className={displayReview.mood === mood ? "selected" : ""} aria-pressed={displayReview.mood === mood}>{mood === "better" ? "A little better" : mood === "same" ? "About the same" : "A bit tougher"}</button>)}</div></div>
                <div className="checkin-question"><label>How is your energy now?</label><div className="choice-row compact">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => updateReview({ energyAfter: value })} className={`choice-dot ${displayReview.energyAfter === value ? "selected" : ""}`} aria-label={`After-workout energy ${value} out of 5`} aria-pressed={displayReview.energyAfter === value}>{value}</button>)}</div></div>
                <label className="checkbox-row"><input type="checkbox" checked={displayReview.discomfort} onChange={(event) => updateReview({ discomfort: event.target.checked })} /><span><strong>Any discomfort during the workout?</strong><small>Share what happened so the next session can stay comfortable.</small></span></label>
                {displayReview.discomfort && <label className="field-label">Discomfort details <textarea maxLength={1000} value={displayReview.discomfortNote} onChange={(event) => updateReview({ discomfortNote: event.target.value })} placeholder="Optional details" rows={2} /></label>}
                <label className="field-label">Anything to remember next time? <textarea maxLength={2000} value={displayReview.note} onChange={(event) => updateReview({ note: event.target.value })} placeholder="Optional note" rows={3} /></label>
                {formError && <p role="alert" className="form-error">{formError}</p>}
                <div className="panel-footer"><button className="text-button" onClick={() => setFlowStep("workout")}>← Back to logger</button><button className="button button-primary" disabled={savingSession} onClick={completeWorkout}>{savingSession ? "Saving…" : "Save my session"} <span>✓</span></button></div>
              </article>}
            </>}
          </div>

          <aside className="workout-aside">
            <article className="panel movement-panel"><div className="side-card-title"><span className="side-card-icon purple-icon">✦</span><div><h3>Today’s movements</h3><p>{plan.exercises.length} simple steps</p></div></div><div className="movement-list">{plan.exercises.map((exercise, index) => <button key={exercise.id} onClick={() => setGuideExercise(toGuideExercise(exercise))} className="movement-item"><span className="movement-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{exercise.name}</strong><small>{exercise.sets} sets · {exercise.reps}</small></span><span className="row-arrow">↗</span></button>)}</div></article>
            <article className="mini-tip"><span>✦</span><p><strong>Keep it comfortable.</strong><br />Use a load that lets every rep feel controlled.</p></article>
          </aside>
        </div>}
        {!plan && <div className="rest-panel panel"><span className="rest-illustration">☼</span><h3>Rest is part of getting stronger.</h3><p>There’s no workout scheduled for this day. Your next session is {describeNextDay(state.profile, date)}.</p><button className="button button-primary" onClick={openNextWorkout}>View next session <span>→</span></button></div>}
      </section>
      {rest && displayFlowStep === "workout" && <RestTimer key={rest.endsAt} endsAt={rest.endsAt} exerciseName={rest.exerciseName} onAddTime={() => setRest((current) => current ? { ...current, endsAt: Math.max(current.endsAt, Date.now()) + 15_000 } : current)} onDismiss={dismissRest} />}
      {guideExercise && <ExerciseGuideModal exercise={guideExercise} workout={{ date, session: todaySession, plan }} onOpen={(exercise) => setGuideExercise(toGuideExercise(exercise))} onClose={() => setGuideExercise(null)} />}
    </>
  );
}
