"use client";

import { CoolDownCard, WarmUpCard } from "@/components/app/mobility-suggestion";
import { clearWorkoutNotification, notifyWorkoutStarted, updateWorkoutNotification, workoutStartedAt } from "@/lib/session-notify";
import { notifyBuddies } from "@/lib/buddies-repository";
import { levelTitle } from "@/lib/levels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ChevronRight, MessageCircle, Pencil, Play, Timer, X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import Link from "next/link";
import { ShareWorkoutSheet } from "./chats-screen";
import { PostWorkoutSheet } from "./feed-screen";
import { canPostDate } from "@/lib/feed";
import { loadPostedDates } from "@/lib/feed-repository";
import { Rozi, RoziEnergy } from "@/components/app/rozi";
import { WorkoutCelebration } from "@/components/app/workout-celebration";
import { MusclePicture } from "@/components/app/muscle-picture";
import { MuscleThumb } from "@/components/app/muscle-thumb";
import { ExerciseGuideModal, toGuideExercise } from "@/components/app/exercise-guide-modal";
import { ExerciseLogCard } from "@/components/app/exercise-log-card";
import { RestTimer } from "@/components/app/rest-timer";
import { SwapSheet, useExerciseSwap } from "@/components/app/swap-sheet";
import { REGION_LABELS, regionsForExercises } from "@/lib/figure";
import { calculateStreak, roziMoment, winsForWorkout } from "@/lib/rozi";
import { lastPerformance } from "@/lib/logging";
import { explainWorkout } from "@/lib/insights";
import { sessionForDate, useFitTrack } from "@/components/app/fit-track-provider";
import { emptyCheckIn, useWorkoutDay } from "@/components/app/use-workout-day";
import { dateLabel, describeNextDay, isIsoDate, nextTrainingDate, shiftDate, todayHref, hourIn, weekdayOf } from "@/lib/dates";
import { generateWorkout, preserveManualExerciseChoices } from "@/lib/planner";
import { createInitialExerciseLogs } from "@/lib/supabase-repository";
import type { CheckIn, ExerciseDefinition, ExerciseLog, WorkoutReview, WorkoutSession } from "@/lib/types";
import { createExerciseLog, createInFlightDeduper, statusForSets, validateCheckIn, validateWorkoutSession } from "@/lib/workout-tracking";

type FlowStep = "preview" | "checkin" | "workout" | "review" | "done";

const emptyReview = (): WorkoutReview => ({ effort: 5, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "" });
const dedupeWorkoutSubmission = createInFlightDeduper<boolean>();

/** The workout page for today, or for the date in `?date=YYYY-MM-DD`. */
export function TodayScreen() {
  const { currentDate, state } = useFitTrack();
  const params = useSearchParams();
  const requested = params.get("date");
  const date = isIsoDate(requested) ? requested : currentDate;
  // A new date starts a fresh check-in, logger, and review. "?step=review" (Finish on Home) opens the rating step.
  // "?extra=1" plans a workout today even though it is a rest day ("Train today anyway").
  // A workout already saved today on a rest day stays an extra day after a reload.
  const extraDay = date === currentDate && (params.get("extra") === "1" || (Boolean(sessionForDate(state, date)) && !state.profile.trainingDays.includes(weekdayOf(date))));
  return <WorkoutDayView key={`${date}${extraDay ? "-extra" : ""}`} date={date} extraDay={extraDay} startAtReview={params.get("step") === "review"} />;
}

function WorkoutDayView({ date, extraDay = false, startAtReview = false }: { date: string; extraDay?: boolean; startAtReview?: boolean }) {
  const router = useRouter();
  const { state, getState, currentDate, recordedSessions, trainerRuleSettings, planningProfile, upsertSession, savingSession, saveError, weightUnit, figure, browserClient, isDemo } = useFitTrack();
  const [flowStep, setFlowStep] = useState<FlowStep>(startAtReview ? "review" : "preview");
  const [checkIn, setCheckIn] = useState<CheckIn>(emptyCheckIn);
  const [checkInEdited, setCheckInEdited] = useState(false);
  const [review, setReview] = useState<WorkoutReview>(emptyReview);
  const reviewRef = useRef(review);
  const [formError, setFormError] = useState("");
  const [guideExercise, setGuideExercise] = useState<ExerciseDefinition | null>(null);
  /** The exercise being swapped for another (Swap exercise sheet). */
  const [swapping, setSwapping] = useState<ExerciseDefinition | null>(null);
  const swapExercise = useExerciseSwap(date);
  const { session: todaySession, plan } = useWorkoutDay(date, flowStep === "preview" || flowStep === "checkin" ? checkIn : undefined, checkInEdited, extraDay);
  // A future day can be looked at, not logged: workouts are saved on the day they are done.
  const isFuture = date > currentDate;
  /** True while a saved session is reopened to correct its entries. */
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  // "Post to feed?" after a finished workout (signed in, last week only); which days are already posted.
  const [posting, setPosting] = useState(false);
  const [postedDates, setPostedDates] = useState<Set<string>>(new Set());
  const refreshPosted = useCallback(() => {
    if (isDemo || !browserClient) return;
    void loadPostedDates(browserClient, shiftDate(currentDate, -8)).then(setPostedDates);
  }, [isDemo, browserClient, currentDate]);
  useEffect(() => { const timer = window.setTimeout(refreshPosted, 0); return () => window.clearTimeout(timer); }, [refreshPosted]);
  const [rest, setRest] = useState<{ id: number; endsAt: number; total: number; exerciseName: string } | null>(null);
  // Rest timer on/off, remembered on this device.
  const [restOn, setRestOn] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => { try { if (window.localStorage.getItem("rozfit-rest-on") === "0") setRestOn(false); } catch { /* default on */ } }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  // On a phone the logger starts with one exercise on screen at a time.
  const [oneAtATime, setOneAtATime] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const displayReview = todaySession?.review ?? review;
  const displayFlowStep = todaySession?.status === "in_progress" && (flowStep === "preview" || flowStep === "checkin") ? (todaySession.review ? "review" : "workout") : flowStep;
  const exerciseCount = todaySession?.plan.exercises.length ?? 0;
  // Until the person picks one, show the first exercise that still has sets to do.
  const firstOpenIndex = Math.max(0, (todaySession?.plan.exercises ?? []).findIndex((exercise) => {
    const status = todaySession?.exerciseLogs.find((item) => item.exerciseId === exercise.id)?.status ?? "not_started";
    return status === "not_started" || status === "partial";
  }));
  const shownIndex = Math.min(focusIndex ?? firstOpenIndex, Math.max(0, exerciseCount - 1));
  const dismissRest = useCallback(() => setRest(null), []);

  useEffect(() => { if (todaySession?.review) reviewRef.current = todaySession.review; }, [todaySession?.review]);
  // Each step of the workout starts at the top of the page.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [displayFlowStep]);

  function updateCheckIn(patch: Partial<CheckIn>) {
    setCheckInEdited(true);
    setCheckIn((current) => ({ ...current, ...patch }));
  }

  function openNextWorkout() {
    const next = nextTrainingDate(state.profile, currentDate);
    if (next) router.push(todayHref(next, currentDate));
  }

  function startWorkout() {
    if (isFuture) return;
    // Your own routine stays as you built it — unless the check-in reports pain, which always means recovery.
    const ownRoutine = todaySession?.plan.focus === "Your routine" && !checkIn.pain;
    const generatedForStart = todaySession?.status === "planned" && !ownRoutine
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
    void notifyWorkoutStarted(startPlan.title, date);
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
    if (saved) {
      setFlowStep("done"); setEditing(false); setRest(null); void clearWorkoutNotification(sessionDate);
      // Train together: "Ravi just finished — your turn?" for buddies who haven't trained yet (today's workout only).
      if (sessionDate === currentDate && getState().profile.buddyAnchor && browserClient) void notifyBuddies(browserClient, "finished");
    }
    return saved;
  }

  function completeWorkout() {
    const key = `${getState().profile.id}:${date}`;
    void dedupeWorkoutSubmission(key, () => submitCompletedSession(date)).catch((error: unknown) => {
      setFormError(error instanceof Error ? error.message : "The session could not be saved. Please try again.");
    });
  }

  const preStart = !todaySession || todaySession.status === "planned";
  const isDone = todaySession?.status === "completed" && !editing;
  const logging = Boolean(todaySession) && !preStart && !isDone;
  // Workout mode: while you're logging sets, the phone dock slides away (a small handle brings it back).
  const workoutMode = logging && displayFlowStep === "workout";
  useEffect(() => {
    if (!workoutMode) return;
    document.body.classList.add("workout-mode");
    return () => document.body.classList.remove("workout-mode", "dock-peek");
  }, [workoutMode]);
  const regions = plan ? regionsForExercises(plan.exercises).slice(0, 4) : [];
  const totalSets = plan?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const setsPlanned = todaySession?.exerciseLogs.reduce((sum, log) => sum + (log.status === "skipped" ? 0 : log.sets.length), 0) ?? 0;
  const setsDone = todaySession?.exerciseLogs.reduce((sum, log) => sum + log.sets.filter((set) => set.completed).length, 0) ?? 0;
  // Keep the "workout in progress" notification current whenever you leave the app (lock the phone or switch apps),
  // so the lock screen shows your progress, when you started and when your rest ends. Only on leaving: refreshing it
  // while the app is open could pop a banner on every set.
  const workoutTitle = todaySession?.plan.title ?? "";
  const restEndsAt = rest?.endsAt ?? null;
  const restName = rest?.exerciseName ?? "";
  useEffect(() => {
    if (!workoutMode || !workoutTitle) return;
    const refresh = () => void updateWorkoutNotification({
      title: workoutTitle, startedAt: workoutStartedAt(date), setsDone, setsTotal: setsPlanned,
      rest: restEndsAt ? { endsAt: restEndsAt, exerciseName: restName } : null,
    });
    const onHide = () => { if (document.visibilityState === "hidden") refresh(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", refresh);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", refresh); };
  }, [workoutMode, workoutTitle, date, setsDone, setsPlanned, restEndsAt, restName]);
  const doneMoment = todaySession?.status === "completed"
    ? roziMoment({ streak: calculateStreak(state.profile, recordedSessions, date), todaySession, hour: 12, name: state.profile.displayName, wins: winsForWorkout(recordedSessions, date, state.profile.sessionsPerWeek) })
    : null;
  const whyLines = useMemo(() => (plan ? explainWorkout(plan, date, recordedSessions, state.profile, currentDate) : []), [plan, date, recordedSessions, state.profile, currentDate]);
  const saveNote = savingSession ? "Saving…" : saveError ? "Saved on this device; sync needs attention" : "Saved as you go";

  return (
    <>
      <section className="train">
        {workoutMode && todaySession && <div className="workout-bar">
          <Link href="/" className="icon-button" aria-label="Leave the workout (it stays saved, continue any time)"><X aria-hidden="true" /></Link>
          <div className="workout-bar-text">
            <strong>{todaySession.plan.title}</strong>
            <span>{editing ? "Editing your entries" : `${setsDone} of ${setsPlanned} sets · ${saveNote}`}</span>
            <div className="logger-progress-bar" role="progressbar" aria-label="Sets completed" aria-valuemin={0} aria-valuemax={setsPlanned} aria-valuenow={Math.min(setsDone, setsPlanned)}><span style={{ width: `${setsPlanned ? Math.min(100, (setsDone / setsPlanned) * 100) : 0}%` }} /></div>
          </div>
          <button type="button" role="switch" aria-checked={restOn} aria-label="Rest timer" className={`icon-button workout-bar-rest ${restOn ? "on" : ""}`} onClick={() => { const next = !restOn; setRestOn(next); if (!next) setRest(null); try { window.localStorage.setItem("rozfit-rest-on", next ? "1" : "0"); } catch { /* remembered for this visit */ } }}><Timer aria-hidden="true" /></button>
        </div>}
        {!workoutMode && <header className="train-head">
          <p>{date === currentDate ? "Today" : dateLabel(date)}</p>
          <h2>{plan?.title ?? "Rest day"}</h2>
          {plan?.stage ? <span className={`stage-chip ${plan.recoveryWeek ? "light" : ""}`}>{plan.level ? `${levelTitle(plan.level)} · ` : ""}Week {plan.weekNumber} of 52 · {plan.stage}</span>
            : plan?.level && plan.sessionType !== "recovery" && <span className="stage-chip">{levelTitle(plan.level)} level</span>}
          {plan?.lightWeek && <span className="stage-chip light">Lighter week from your trainer · fewer sets</span>}
        </header>}

        {!plan && <article className="panel train-rest">
          <Rozi mood={hourIn(state.profile.timeZone) >= 21 ? "night" : "rest"} size={150} />
          <h3>Rest is part of getting stronger</h3>
          <p>No workout is planned for this day. Your next session is {describeNextDay(state.profile, date)}.</p>
          {date === currentDate && <button className="button button-primary" onClick={() => router.push("/today?extra=1")}>Train today anyway <Play aria-hidden="true" /></button>}
          <button className={`button ${date === currentDate ? "button-subtle" : "button-primary"}`} onClick={openNextWorkout}>See next session <ArrowRight aria-hidden="true" /></button>
          <button type="button" className="text-button" onClick={() => router.push("/routines")}>Or start one of your own routines</button>
        </article>}

        {plan && preStart && displayFlowStep === "preview" && <>
          {regions.length > 0 ? <article className="panel train-summary">
            <div className="train-summary-copy">
              <h3>Today’s targets</h3>
              <div className="today-chips">{regions.map((region) => <Chip key={region}>{REGION_LABELS[region]}</Chip>)}</div>
              <p className="today-meta">About {plan.durationMinutes} min · {plan.exercises.length} moves · {totalSets} sets</p>
            </div>
            <div className="train-summary-figure"><MusclePicture figure={figure} region={regions[0]} highlight={regions} priority /></div>
          </article> : <article className="panel target-card">
            <div className="target-figure">{plan.sessionType === "recovery" ? <Rozi mood={checkIn.pain ? "care" : "stretch"} size={180} /> : <MusclePicture figure={figure} />}</div>
            <div className="target-copy">
              <h3>{plan.sessionType === "recovery" ? "Recovery session" : "Today’s targets"}</h3>
              {regions.length > 0
                ? <ul className="target-list">{regions.map((region) => <li key={region}><span className="target-dot" />{REGION_LABELS[region]}</li>)}</ul>
                : <p>Easy movement only. Skip anything that does not feel comfortable.</p>}
            </div>
          </article>}
          {regions.length === 0 && <p className="today-meta">About {plan.durationMinutes} min · {plan.exercises.length} moves · {totalSets} sets</p>}
          <p className="train-description">{plan.description}</p>

          {/* Warm up first: offered before the list and the Start button, not after them. */}
          {plan.sessionType !== "recovery" && <WarmUpCard focus={`${plan.focus} ${plan.title}`} date={date} />}

          <h3 className="train-subhead">Exercises</h3>
          <ol className="exercise-list">
            {plan.exercises.map((exercise, index) => {
              const area = regionsForExercises([exercise])[0];
              return (
                <li key={exercise.id}>
                  <button className="exercise-row" onClick={() => setGuideExercise(toGuideExercise(exercise))} aria-label={`${exercise.name}, ${exercise.sets} sets of ${exercise.reps}. Open guide`}>
                    <span className="exercise-num">{index + 1}</span>
                    <span className="exercise-thumb"><MuscleThumb exercise={exercise} /></span>
                    <span className="exercise-text"><strong>{exercise.name}</strong><small>{exercise.sets} × {exercise.reps}{area ? ` · ${REGION_LABELS[area]}` : ""}</small></span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                  {!isFuture && todaySession?.status === "planned" && <button type="button" className="exercise-row-swap" aria-label={`Swap ${exercise.name} for another exercise`} onClick={() => setSwapping(exercise)}><ArrowLeftRight aria-hidden="true" /></button>}
                </li>
              );
            })}
          </ol>

          <details className="why-plan">
            <summary>Why this workout</summary>
            <ul className="why-plan-list">{whyLines.map((line) => <li key={line}>{line}</li>)}</ul>
            <details className="why-plan-notes">
              <summary>Planner notes</summary>
              <p>{plan.generationReasons.join(" ")}</p>
            </details>
            <small>Template {plan.templateVersion} · Rules {plan.ruleVersion}</small>
          </details>

          {isFuture ? <div className="train-cta future-note">
            <p>This workout is planned for <strong>{dateLabel(date)}</strong>. It opens for logging on that day, so it is saved on the right date.</p>
            <button className="button button-primary" onClick={() => router.push(state.profile.trainingDays.includes(weekdayOf(currentDate)) ? "/today" : "/today?extra=1")}>Train today instead <Play aria-hidden="true" /></button>
          </div>
            : <div className="train-cta wide"><button className="button button-primary" aria-label="Start workout" onClick={() => { setFormError(""); setFlowStep("checkin"); }}><span className="train-cta-label">Start workout</span> <Play aria-hidden="true" /></button></div>}
        </>}

        {plan && preStart && displayFlowStep === "checkin" && <article className="panel flow-card">
          <div className="flow-head"><button type="button" className="onb-back" aria-label="Back to the workout" onClick={() => setFlowStep("preview")}><ArrowLeft aria-hidden="true" /></button><div><h3>Before you begin</h3><p>Four quick taps so today’s plan fits how you feel.</p></div></div>
          <RoziEnergy value={checkIn.energy} onChange={(energy) => updateCheckIn({ energy })} />
          <Scale label="Any muscle soreness?" low="None" high="Very sore" value={checkIn.soreness} onChange={(soreness) => updateCheckIn({ soreness })} />
          <Scale label="How recovered do you feel?" low="Not at all" high="Fully" value={checkIn.recovery} onChange={(recovery) => updateCheckIn({ recovery })} />
          <label className="flow-check"><input type="checkbox" checked={checkIn.pain} onChange={(event) => updateCheckIn({ pain: event.target.checked })} /><span><strong>I have pain or an injury concern</strong><small>Today switches to gentle recovery.</small></span></label>
          {checkIn.pain && <>
            <label className="field-label">Where, or what feels uncomfortable?<textarea value={checkIn.discomfort} maxLength={1000} rows={2} placeholder="Optional details" onChange={(event) => updateCheckIn({ discomfort: event.target.value })} /></label>
            <p className="safety-note" role="note">Stop anything that causes pain. If pain is new, severe, persists, or limits normal activity, see an appropriate health professional.</p>
          </>}
          <label className="field-label">Anything else to note?<textarea value={checkIn.note} maxLength={2000} rows={2} placeholder="Optional" onChange={(event) => updateCheckIn({ note: event.target.value })} /></label>
          {plan.sessionType === "recovery" && <p className="flow-note">With these answers, today is a recovery session: {plan.exercises.map((exercise) => exercise.name).join(", ")}.</p>}
          {formError && <p role="alert" className="form-error">{formError}</p>}
          <button className="button button-primary flow-cta" onClick={startWorkout}>Begin workout <ArrowRight aria-hidden="true" /></button>
        </article>}

        {isDone && todaySession && doneMoment && <WorkoutCelebration session={todaySession} setsDone={setsDone} roziMood={doneMoment.mood} />}
        {isDone && todaySession && doneMoment && <article className="panel done-card">
          <Rozi mood={doneMoment.mood} size={170} />
          <h3>{doneMoment.title}</h3>
          <p>{doneMoment.message}</p>
          <dl className="done-stats">
            <div><dd>{todaySession.exerciseLogs.filter((log) => log.status === "completed" || log.status === "partial").length}</dd><dt>moves done</dt></div>
            <div><dd>{setsDone}</dd><dt>sets done</dt></div>
            <div><dd>{todaySession.review?.effort ?? "—"}<small>/10</small></dd><dt>effort</dt></div>
          </dl>
          <CoolDownCard focus={`${todaySession.plan.focus} ${todaySession.plan.title}`} />
          <div className="done-actions"><button className="button button-primary" onClick={() => router.push("/streak")}>See my streak <ArrowRight aria-hidden="true" /></button><button className="button button-subtle" onClick={() => { setEditing(true); setFlowStep("workout"); }}><Pencil aria-hidden="true" /> Edit entries</button>{!isDemo && browserClient && <button className="button button-subtle" onClick={() => setSharing(true)}><MessageCircle aria-hidden="true" /> Share to chat</button>}</div>
          {sharing && <ShareWorkoutSheet session={todaySession} onClose={() => setSharing(false)} />}
          {!isDemo && browserClient && canPostDate(todaySession.date, currentDate) && <div className={`post-ask ${postedDates.has(todaySession.date) ? "done" : ""}`}>
            {postedDates.has(todaySession.date)
              ? <><Check aria-hidden="true" /><span><strong>Posted to your feed</strong><small>Your friends can send a 💪</small></span><Link href="/feed" className="text-button">See feed</Link></>
              : <><span className="post-ask-emoji" aria-hidden="true">💪</span><span><strong>Share it with your friends?</strong><small>Post this workout to the feed — add a photo if you like.</small></span><button type="button" className="button button-primary small" onClick={() => setPosting(true)}>Post to feed</button></>}
          </div>}
          {posting && <PostWorkoutSheet session={todaySession} onClose={() => setPosting(false)} onPosted={refreshPosted} />}
        </article>}

        {logging && todaySession && plan && displayFlowStep !== "review" && <article className="logger">
          {!workoutMode && <div className="logger-progress">
            <div className="logger-progress-text"><strong>{editing ? "Editing your entries" : `${setsDone} of ${setsPlanned} sets done`}</strong><span>{saveNote}</span></div>
            <div className="logger-progress-bar" role="progressbar" aria-label="Sets completed" aria-valuemin={0} aria-valuemax={setsPlanned} aria-valuenow={Math.min(setsDone, setsPlanned)}><span style={{ width: `${setsPlanned ? Math.min(100, (setsDone / setsPlanned) * 100) : 0}%` }} /></div>
          </div>}
          <div className="logger-mode">
            <span>{oneAtATime ? `Exercise ${shownIndex + 1} of ${exerciseCount}` : `${exerciseCount} exercises`}</span>
            {!workoutMode && <button type="button" role="switch" aria-checked={restOn} className="rest-switch" onClick={() => { const next = !restOn; setRestOn(next); if (!next) setRest(null); try { window.localStorage.setItem("rozfit-rest-on", next ? "1" : "0"); } catch { /* remembered for this visit */ } }}><span className={`switch ${restOn ? "on" : ""}`} aria-hidden="true" /> Rest timer</button>}
            <button type="button" className="text-button" onClick={() => setOneAtATime((value) => !value)}>{oneAtATime ? "Show all exercises" : "One at a time"}</button>
          </div>
          {oneAtATime && <div className="logger-steps" role="tablist" aria-label="Exercises in this workout">{todaySession.plan.exercises.map((exercise, index) => {
            const status = todaySession.exerciseLogs.find((item) => item.exerciseId === exercise.id)?.status ?? "not_started";
            return <button key={exercise.id} type="button" role="tab" aria-selected={index === shownIndex} aria-label={`${exercise.name}, ${status.replaceAll("_", " ")}`} className={`logger-step ${status} ${index === shownIndex ? "current" : ""}`} onClick={() => setFocusIndex(index)}>{status === "completed" ? <Check aria-hidden="true" /> : index + 1}</button>;
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
                onSwap={!editing && todaySession.status === "in_progress" ? () => setSwapping(exercise) : undefined}
                onSetCompleted={() => { if (!editing && restOn && exercise.restSeconds > 0) setRest({ id: Date.now(), endsAt: Date.now() + exercise.restSeconds * 1000, total: exercise.restSeconds, exerciseName: exercise.name }); }} />;
            })}
          </div>
          {/* Bottom of the logger (2026-11-25): a round "back" button and one wide primary button that names what's next,
              so the label never wraps onto two lines. "Finish workout early" stays a quiet link under them. */}
          <div className={`logger-nav ${oneAtATime && exerciseCount > 1 ? "has-prev" : ""}`}>
            {oneAtATime && exerciseCount > 1 && <button type="button" className="logger-prev" disabled={shownIndex === 0} onClick={() => setFocusIndex(shownIndex - 1)} aria-label="Previous exercise"><ArrowLeft aria-hidden="true" /></button>}
            {oneAtATime && shownIndex < exerciseCount - 1
              ? <button type="button" className="button button-primary logger-next" onClick={() => setFocusIndex(shownIndex + 1)}>
                <span className="logger-next-text"><small>Next</small><strong>{todaySession?.plan.exercises[shownIndex + 1]?.name ?? "Next exercise"}</strong></span>
                <ArrowRight aria-hidden="true" />
              </button>
              : <button type="button" className="button button-primary logger-next" onClick={finishLogging}>
                <span className="logger-next-text"><small>All done?</small><strong>Finish and review</strong></span>
                <ArrowRight aria-hidden="true" />
              </button>}
          </div>
          {oneAtATime && shownIndex < exerciseCount - 1 && <button type="button" className="text-button logger-finish-early" onClick={finishLogging}>Finish workout early</button>}
        </article>}

        {logging && todaySession && displayFlowStep === "review" && <article className="panel flow-card">
          <div className="flow-head"><button type="button" className="onb-back" aria-label="Back to the exercises" onClick={() => setFlowStep("workout")}><ArrowLeft aria-hidden="true" /></button><div><h3>How did that feel?</h3><p>A short reflection helps tune your next session.</p></div></div>
          <Scale label="Overall effort" low="Easy" high="Maximal" max={10} value={displayReview.effort} onChange={(effort) => updateReview({ effort })} />
          <div className="scale"><span className="scale-label">Compared with what you expected</span><div className="flow-options">{(["better", "same", "tougher"] as const).map((mood) => <button key={mood} type="button" className={displayReview.mood === mood ? "selected" : ""} aria-pressed={displayReview.mood === mood} onClick={() => updateReview({ mood })}>{mood === "better" ? "A little better" : mood === "same" ? "About the same" : "A bit tougher"}</button>)}</div></div>
          <Scale label="How is your energy now?" low="Drained" high="Great" value={displayReview.energyAfter} onChange={(energyAfter) => updateReview({ energyAfter })} />
          <label className="flow-check"><input type="checkbox" checked={displayReview.discomfort} onChange={(event) => updateReview({ discomfort: event.target.checked })} /><span><strong>I felt discomfort during the workout</strong><small>Your next session will be lighter.</small></span></label>
          {displayReview.discomfort && <label className="field-label">What happened?<textarea maxLength={1000} rows={2} placeholder="Optional details" value={displayReview.discomfortNote} onChange={(event) => updateReview({ discomfortNote: event.target.value })} /></label>}
          <label className="field-label">Anything to remember next time?<textarea maxLength={2000} rows={2} placeholder="Optional" value={displayReview.note} onChange={(event) => updateReview({ note: event.target.value })} /></label>
          {formError && <p role="alert" className="form-error">{formError}</p>}
          <button className="button button-primary flow-cta" disabled={savingSession} onClick={completeWorkout}>{savingSession ? "Saving…" : "Save my session"} <Check aria-hidden="true" /></button>
        </article>}
      </section>
      {rest && logging && displayFlowStep === "workout" && <RestTimer key={rest.id} endsAt={rest.endsAt} totalSeconds={rest.total} exerciseName={rest.exerciseName}
        onAdjust={(seconds) => setRest((current) => current ? { ...current, endsAt: Math.max(Date.now() + 1000, current.endsAt + seconds * 1000), total: Math.max(1, current.total + seconds) } : current)} onDismiss={dismissRest} />}
      {swapping && <SwapSheet exercise={swapping} workoutExercises={(todaySession && todaySession.status !== "planned" ? todaySession.plan : plan)?.exercises ?? []}
        onPick={(replacement) => { if (swapExercise(swapping.id, replacement.id, plan)) setSwapping(null); }} onClose={() => setSwapping(null)} />}
      {guideExercise && <ExerciseGuideModal exercise={guideExercise} workout={{ date, session: todaySession, plan }} onOpen={(exercise) => setGuideExercise(toGuideExercise(exercise))} onClose={() => setGuideExercise(null)} />}
    </>
  );
}

/** A row of numbered buttons for a 1-to-5 (or 1-to-10) answer, with words at each end. */
function Scale({ label, low, high, value, onChange, max = 5 }: { label: string; low: string; high: string; value: number; onChange: (value: number) => void; max?: number }) {
  return (
    <div className="scale">
      <span className="scale-label">{label}</span>
      <div className={`scale-buttons ${max > 5 ? "wide" : ""}`} role="radiogroup" aria-label={label}>
        {Array.from({ length: max }, (_, index) => index + 1).map((option) => <button key={option} type="button" role="radio" aria-checked={value === option} aria-label={`${option} out of ${max}`} className={value === option ? "selected" : ""} onClick={() => onChange(option)}>{option}</button>)}
      </div>
      <div className="scale-ends"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}
