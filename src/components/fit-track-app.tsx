"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDemoState, readDemoState, todayInTimeZone, writeDemoState } from "@/lib/demo-data";
import { deadliftAllowedForPlan, generateWorkout, preserveManualExerciseChoices, preserveOriginalPlan } from "@/lib/planner";
import { EQUIPMENT_OPTIONS, EXERCISE_LIBRARY, getExerciseDefinition, RULE_VERSION, TEMPLATE_VERSION } from "@/lib/templates";
import { exerciseEquipmentIsAvailable, filterExerciseLibrary, getExerciseLibraryFilterOptions, getExerciseReferenceInstructions, getSafeExerciseAlternatives, isDeadliftVariation, workoutPlanMatchesProfile } from "@/lib/exercise-library";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase-browser";
import { createInitialExerciseLogs, loadCloudState, saveCloudBodyWeightEntry, saveCloudProfile, saveCloudSession } from "@/lib/supabase-repository";
import { bodyWeightTrend, buildExercisePerformance, buildProgressTimeline, calculateConsistency, calculatePersonalRecords, calculateRecoveryMetrics, createProgressDateRange, recordedSessionStatus, upsertBodyWeightEntry, validateBodyWeightEntry } from "@/lib/progress";
import type { CheckIn, ExerciseDefinition, ExerciseLog, FitTrackState, Profile, WorkoutReview, WorkoutSession } from "@/lib/types";
import { createExerciseLog, createInFlightDeduper, normalizeWorkoutSession, statusForSets, validateCheckIn, validateWorkoutSession } from "@/lib/workout-tracking";
import { DEFAULT_TRAINER_RULE_SETTINGS, profileWithTrainerEquipment } from "@/lib/trainer-rules";
import { TrainerControls } from "@/components/trainer-controls";

type View = "overview" | "today" | "progress" | "library" | "trainer";
type FlowStep = "checkin" | "workout" | "review" | "done";

const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "today", label: "Today’s workout", icon: "◷" },
  { id: "progress", label: "Progress", icon: "↗" },
  { id: "library", label: "Exercise library", icon: "▦" },
  { id: "trainer", label: "Trainer settings", icon: "⚙" },
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const emptyCheckIn = (): CheckIn => ({ energy: 3, soreness: 1, pain: false, recovery: 3, discomfort: "", note: "" });
const emptyReview = (): WorkoutReview => ({ effort: 5, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "" });
const dedupeWorkoutSubmission = createInFlightDeduper<boolean>();
const dedupePlannedWorkout = createInFlightDeduper<boolean>();

function sessionForDate(state: FitTrackState, date: string): WorkoutSession | undefined {
  return state.sessions.find((session) => session.date === date);
}

function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

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

function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function describeNextDay(profile: Profile, date: string): string {
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = shiftDate(date, offset);
    if (profile.trainingDays.includes(new Date(`${next}T12:00:00Z`).getUTCDay())) return dateLabel(next);
  }
  return "your next scheduled day";
}

function adjustTrainingDays(days: number[], count: number): number[] {
  const order = [2, 4, 6, 1, 3, 5, 0];
  const selected = [...days];
  for (const day of order) {
    if (selected.length >= count) break;
    if (!selected.includes(day)) selected.push(day);
  }
  return selected.slice(0, count);
}

function pendingKey(userId: string) { return `fittrack-pending-sessions-v2-${userId}`; }
function readPendingSessions(userId: string): WorkoutSession[] {
  try {
    const raw = window.localStorage.getItem(pendingKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return parsed.map((session) => normalizeWorkoutSession(session as Record<string, unknown>)).filter((session): session is WorkoutSession => session !== null);
  } catch { return []; }
}
function writePendingSession(userId: string, session: WorkoutSession) {
  const remaining = readPendingSessions(userId).filter((item) => item.date !== session.date);
  try { window.localStorage.setItem(pendingKey(userId), JSON.stringify([...remaining, session])); } catch { /* Keep the in-memory draft available. */ }
}
function clearPendingSession(userId: string, date: string) {
  const remaining = readPendingSessions(userId).filter((item) => item.date !== date);
  try {
    if (remaining.length) window.localStorage.setItem(pendingKey(userId), JSON.stringify(remaining));
    else window.localStorage.removeItem(pendingKey(userId));
  } catch { /* A synced session is already safe in Supabase. */ }
}

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon" aria-hidden="true">{children}</span>;
}

export default function FitTrackApp() {
  const browserClient = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<FitTrackState>(() => createDemoState());
  const [view, setView] = useState<View>("overview");
  const [flowStep, setFlowStep] = useState<FlowStep>("checkin");
  const [checkIn, setCheckIn] = useState<CheckIn>(emptyCheckIn);
  const [checkInEdited, setCheckInEdited] = useState(false);
  const [review, setReview] = useState<WorkoutReview>(emptyReview);
  const reviewRef = useRef(review);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [formError, setFormError] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState<WorkoutSession | null>(null);
  const [progressExerciseId, setProgressExerciseId] = useState("");
  const [bodyWeightDate, setBodyWeightDate] = useState("");
  const [bodyWeightInput, setBodyWeightInput] = useState("");
  const [bodyWeightSaving, setBodyWeightSaving] = useState(false);
  const [bodyWeightError, setBodyWeightError] = useState("");
  const [bodyWeightNotice, setBodyWeightNotice] = useState("");
  const [pendingSessions, setPendingSessions] = useState<WorkoutSession[]>([]);
  const [authBusy, setAuthBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryMuscleFilter, setLibraryMuscleFilter] = useState("");
  const [libraryPatternFilter, setLibraryPatternFilter] = useState("");
  const [libraryEquipmentFilter, setLibraryEquipmentFilter] = useState("");
  const [libraryDifficultyFilter, setLibraryDifficultyFilter] = useState("");
  const stateRef = useRef(state);
  const sessionSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingSessionWrites = useRef(0);
  const profileSaveTimer = useRef<number | null>(null);

  const currentDate = todayInTimeZone(state.profile.timeZone);
  const date = state.selectedDate || currentDate;
  const trainerRuleSettings = state.trainerRuleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS;
  const planningProfile = useMemo(() => profileWithTrainerEquipment(state.profile, trainerRuleSettings), [state.profile, trainerRuleSettings]);
  const recordedSessions = useMemo(() => state.sessions.filter((session) => !session.sampleData), [state.sessions]);
  const todaySession = sessionForDate(state, date);
  const displayReview = todaySession?.review ?? review;
  const displayFlowStep = todaySession?.status === "in_progress" && flowStep === "checkin" ? (todaySession.review ? "review" : "workout") : flowStep;
  const generatedPlan = useMemo(() => {
    const generated = generateWorkout({
      date,
      profile: state.profile,
      sessions: recordedSessions,
      checkIn: todaySession?.checkIn ?? (flowStep === "checkin" ? checkIn : undefined),
      trainerRuleSettings,
      trainerRuleRevision: state.trainerRuleRevision ?? 1,
    });
    return generated && todaySession?.status === "planned"
      ? preserveManualExerciseChoices(generated, todaySession.plan, planningProfile)
      : generated;
  }, [date, state.profile, recordedSessions, todaySession, flowStep, checkIn, trainerRuleSettings, state.trainerRuleRevision, planningProfile]);
  const savedPlanCompatible = todaySession?.status !== "planned" || date < currentDate || workoutPlanMatchesProfile(todaySession.plan, planningProfile);
  const plan = todaySession?.status === "planned" && (checkInEdited || !savedPlanCompatible) ? generatedPlan : todaySession?.plan ?? generatedPlan;
  const completedSessions = recordedSessions.filter((session) => session.status === "completed");
  const historySessions = [...recordedSessions].sort((a, b) => b.date.localeCompare(a.date));
  const completedThisWeek = completedSessions.filter((session) => {
    const daysAgo = (Date.parse(`${currentDate}T12:00:00Z`) - Date.parse(`${session.date}T12:00:00Z`)) / 86_400_000;
    return daysAgo >= 0 && daysAgo < 7;
  }).length;
  const progressRange = createProgressDateRange(currentDate, 28);
  const progressTimeline = buildProgressTimeline(state.profile, recordedSessions, currentDate, 28);
  const consistency = calculateConsistency(state.profile, recordedSessions, currentDate, 28);
  const exerciseProgress = buildExercisePerformance(recordedSessions);
  const selectedProgressExercise = exerciseProgress.find((item) => item.exerciseId === progressExerciseId) ?? exerciseProgress[0];
  const performanceRecords = selectedProgressExercise?.records.filter((record) => record.completedSets > 0).slice(-8) ?? [];
  const maxActualReps = Math.max(1, ...performanceRecords.map((record) => record.completedReps));
  const personalRecords = calculatePersonalRecords(recordedSessions);
  const recoveryMetrics = calculateRecoveryMetrics(recordedSessions, currentDate, 28);
  const weightTrend = bodyWeightTrend(state.bodyWeightEntries);
  const recentWeightTrend = weightTrend.slice(-8);
  const minBodyWeight = recentWeightTrend.length ? Math.min(...recentWeightTrend.map((entry) => entry.weightKg)) : 0;
  const maxBodyWeight = Math.max(minBodyWeight + 0.01, ...recentWeightTrend.map((entry) => entry.weightKg));
  const recentSessions = recordedSessions.filter((session) => progressRange && session.date >= progressRange.startDate && session.date <= progressRange.endDate);
  const completedRecentSessions = recentSessions.filter((session) => session.status === "completed").length;

  useEffect(() => {
    let cancelled = false;
    const localState = readDemoState() ?? createDemoState();
    const today = todayInTimeZone(localState.profile.timeZone);
    if (localState.selectedDate !== today) localState.selectedDate = today;
    const hydrateTimer = window.setTimeout(() => {
      if (cancelled) return;
      setState((current) => current.mode === "supabase" ? current : localState);
      writeDemoState(localState);
      setReady(true);
    }, 0);

    if (browserClient) {
      browserClient.auth.getUser().then(async ({ data }) => {
        if (!data.user || cancelled) return;
        try {
          const cloud = await loadCloudState(browserClient, data.user);
          const drafts = readPendingSessions(data.user.id);
          if (!cancelled) {
            const sessions = [...cloud.sessions];
            for (const draft of drafts) {
              const index = sessions.findIndex((item) => item.date === draft.date);
              if (index >= 0) sessions[index] = draft;
              else sessions.push(draft);
            }
            setState({ ...cloud, sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)) });
            setPendingSessions(drafts);
            if (drafts.length) setSaveError("Some session changes are waiting to sync from this device.");
          }
        } catch (error) {
          if (!cancelled) setNotice(error instanceof Error ? error.message : "Could not load your saved profile yet.");
        }
      });
      const { data: listener } = browserClient.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setState((current) => ({ ...createDemoState(), selectedDate: todayInTimeZone(current.profile.timeZone) }));
          return;
        }
        if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          window.setTimeout(async () => {
            try {
              const cloud = await loadCloudState(browserClient, session.user);
              const drafts = readPendingSessions(session.user.id);
              if (!cancelled) {
                const sessions = [...cloud.sessions];
                for (const draft of drafts) {
                  const index = sessions.findIndex((item) => item.date === draft.date);
                  if (index >= 0) sessions[index] = draft;
                  else sessions.push(draft);
                }
                setState({ ...cloud, sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)) });
                setPendingSessions(drafts);
                if (drafts.length) setSaveError("Some session changes are waiting to sync from this device.");
              }
            } catch (error) {
              if (!cancelled) setNotice(error instanceof Error ? error.message : "Could not sync your account yet.");
            }
          }, 0);
        }
      });
      return () => { cancelled = true; window.clearTimeout(hydrateTimer); listener.subscription.unsubscribe(); };
    }
    return () => { cancelled = true; window.clearTimeout(hydrateTimer); };
  }, [browserClient]);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { if (todaySession?.review) reviewRef.current = todaySession.review; }, [todaySession?.review]);

  useEffect(() => () => {
    if (profileSaveTimer.current !== null) window.clearTimeout(profileSaveTimer.current);
  }, []);

  const updateState = useCallback((next: FitTrackState) => {
    stateRef.current = next;
    setState(next);
    if (next.mode === "demo") writeDemoState(next);
  }, []);

  const refreshTrainerClients = useCallback(async () => {
    if (!browserClient) throw new Error("Supabase is not connected.");
    const { data, error } = await browserClient.auth.getUser();
    if (error) throw error;
    if (!data.user || data.user.id !== stateRef.current.profile.id || data.user.app_metadata?.role !== "trainer") {
      throw new Error("Sign in again with an authorized trainer account to refresh these rules.");
    }
    const refreshed = await loadCloudState(browserClient, data.user);
    setState((current) => {
      const next = { ...current, trainerClients: refreshed.trainerClients };
      stateRef.current = next;
      return next;
    });
  }, [browserClient]);

  function updateCheckIn(patch: Partial<CheckIn>) {
    setCheckInEdited(true);
    setCheckIn((current) => ({ ...current, ...patch }));
  }

  const upsertSession = useCallback(async (session: WorkoutSession): Promise<boolean> => {
    const current = stateRef.current;
    const next = { ...current, sessions: [...current.sessions.filter((item) => item.date !== session.date), session].sort((a, b) => a.date.localeCompare(b.date)) };
    updateState(next);
    if (next.mode !== "supabase" || !browserClient) return true;
    pendingSessionWrites.current += 1;
    setSavingSession(true);
    setSaveError("");
    const write = sessionSaveQueue.current.catch(() => undefined).then(async () => {
      const saved = await saveCloudSession(browserClient, next.profile.id, session);
      const latest = stateRef.current;
      const persisted = { ...session, id: saved.id };
      const updated = { ...latest, sessions: latest.sessions.map((item) => item.date === persisted.date ? { ...item, id: persisted.id } : item) };
      stateRef.current = updated;
      setState(updated);
      clearPendingSession(next.profile.id, session.date);
      setPendingSessions((items) => items.filter((item) => item.date !== session.date));
      if (session.status === "completed") setNotice("Workout saved to your FitTrack account.");
      return true;
    }).catch((error: unknown) => {
      writePendingSession(next.profile.id, session);
      setPendingSessions(readPendingSessions(next.profile.id));
      setSaveError(error instanceof Error ? error.message : "FitTrack could not sync this session. Retry when you’re back online.");
      return false;
    }).finally(() => {
      pendingSessionWrites.current = Math.max(0, pendingSessionWrites.current - 1);
      if (pendingSessionWrites.current === 0) setSavingSession(false);
    });
    sessionSaveQueue.current = write.then(() => undefined);
    return write;
  }, [updateState, browserClient]);

  useEffect(() => {
    if (!ready || !generatedPlan || date < currentDate) return;
    if (todaySession?.status === "planned") {
      if (workoutPlanMatchesProfile(todaySession.plan, planningProfile)) return;
      const adapted = { ...todaySession, plan: generatedPlan };
      const planKey = JSON.stringify(generatedPlan.exercises.map((exercise) => [exercise.id, exercise.sets, exercise.reps]));
      const equipmentKey = state.profile.availableEquipment.slice().sort().join(",");
      void dedupePlannedWorkout(`${state.profile.id}:${date}:${planKey}:${state.profile.deadliftEnabled}:${state.profile.equipmentAvailability}:${equipmentKey}`, () => upsertSession(adapted));
      return;
    }
    if (todaySession) return;
    const planned: WorkoutSession = {
      id: state.mode === "demo" ? `demo-${date}-planned` : crypto.randomUUID(),
      date,
      status: "planned",
      plan: generatedPlan,
      exerciseLogs: [],
    };
    void dedupePlannedWorkout(`${state.profile.id}:${date}`, () => upsertSession(planned));
  }, [ready, generatedPlan, todaySession, date, currentDate, state.mode, state.profile, planningProfile, trainerRuleSettings, state.trainerRuleRevision, upsertSession]);

  useEffect(() => {
    const callbackStatus = new URLSearchParams(window.location.search).get("auth");
    if (callbackStatus !== "error") return;
    window.history.replaceState({}, "", window.location.pathname);
    const timer = window.setTimeout(() => setNotice("The sign-in link could not be completed. Request a new link and try again."), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function changePage(nextView: View) {
    setView(nextView);
    if (nextView === "today") {
      setState((current) => ({ ...current, selectedDate: todayInTimeZone(current.profile.timeZone) }));
      setFlowStep("checkin");
      setCheckIn(emptyCheckIn());
      setCheckInEdited(false);
      reviewRef.current = emptyReview();
      setReview(emptyReview());
      setFormError("");
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!browserClient) return;
    setAuthBusy(true);
    setNotice("");
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`;
    const { error } = await browserClient.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setAuthBusy(false);
    setNotice(error ? error.message : "Check your inbox for a secure sign-in link.");
  }

  async function signOut() {
    if (!browserClient) return;
    await browserClient.auth.signOut();
    setNotice("You’re signed out. Demo data is ready on this device.");
  }

  async function updateProfile(patch: Partial<Profile>) {
    const profile = { ...state.profile, ...patch };
    const next = { ...state, profile };
    updateState(next);
    if (next.mode === "supabase" && browserClient) {
      if (profileSaveTimer.current !== null) window.clearTimeout(profileSaveTimer.current);
      profileSaveTimer.current = window.setTimeout(async () => {
        try {
          await saveCloudProfile(browserClient, profile);
          setNotice("Profile settings saved.");
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Profile could not be saved.");
        }
      }, 400);
    }
  }

  function setEquipmentAvailability(availability: Profile["equipmentAvailability"]) {
    void updateProfile(availability === "unknown"
      ? { equipmentAvailability: "unknown", availableEquipment: [] }
      : { equipmentAvailability: "verified" });
  }

  function toggleAvailableEquipment(equipment: Profile["availableEquipment"][number]) {
    const availableEquipment = state.profile.availableEquipment.includes(equipment)
      ? state.profile.availableEquipment.filter((item) => item !== equipment)
      : [...state.profile.availableEquipment, equipment];
    void updateProfile({ equipmentAvailability: "verified", availableEquipment });
  }

  function openExerciseDetails(exercise: ExerciseDefinition) {
    const reference = getExerciseDefinition(exercise.id);
    setSelectedExercise(reference ? {
      ...reference,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
      substitutedFor: exercise.substitutedFor,
      manualOverride: exercise.manualOverride,
      selectionReason: exercise.selectionReason,
      progressionAdvice: exercise.progressionAdvice,
      loadGuidance: exercise.loadGuidance,
      progressionAction: exercise.progressionAction,
    } : exercise);
  }

  function applyLibraryAlternative(sourceId: string, alternativeId: string) {
    const activeSession = sessionForDate(stateRef.current, date);
    if (!activeSession || activeSession.status !== "planned" || !plan) return;
    const source = plan.exercises.find((exercise) => exercise.id === sourceId);
    if (!source) return;
    const currentState = stateRef.current;
    const effectiveProfile = profileWithTrainerEquipment(currentState.profile, currentState.trainerRuleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS);
    const alternatives = getSafeExerciseAlternatives(source, effectiveProfile, plan.exercises.filter((exercise) => exercise.id !== source.id));
    const alternative = alternatives.find((exercise) => exercise.id === alternativeId);
    if (!alternative) {
      setNotice("That alternative is not available with the current equipment or session rules.");
      return;
    }

    const basePlan = preserveOriginalPlan(plan, activeSession.plan);
    const reason = `${alternative.name} was selected as an equipment-checked alternative to ${source.name}.`;
    const replacement: ExerciseDefinition = {
      ...alternative,
      sets: source.sets,
      reps: source.reps,
      restSeconds: source.restSeconds,
      substitutedFor: source.substitutedFor ?? source.id,
      manualOverride: true,
      selectionReason: reason,
    };
    const updatedPlan = {
      ...basePlan,
      exercises: basePlan.exercises.map((exercise) => exercise.id === source.id ? replacement : exercise),
      generationReasons: [...basePlan.generationReasons, reason],
    };
    void upsertSession({ ...activeSession, plan: updatedPlan });
    setSelectedExercise(null);
    setNotice(`${alternative.name} is saved in this workout. The original template remains in its history.`);
  }

  async function toggleDeadlift(enabled: boolean) {
    if (state.mode !== "demo") return;
    if (!window.confirm(enabled
      ? "Enable the demo-only hinge variation? This does not change trainer approval in Supabase."
      : "Lock the hinge variation in this demo?")) return;
    const nextProfile = { ...state.profile, deadliftEnabled: enabled };
    updateState({ ...state, profile: nextProfile });
    setNotice(enabled ? "Demo-only hinge setting changed. A signed-in trainer must approve this for a client." : "Deadlift variations are locked in this demo.");
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
    const currentState = stateRef.current;
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
    void upsertSession(nextSession);
  }

  function updateReview(patch: Partial<WorkoutReview>) {
    const currentReview = sessionForDate(stateRef.current, date)?.review ?? reviewRef.current;
    const nextReview = { ...currentReview, ...patch };
    reviewRef.current = nextReview;
    setReview(nextReview);
    const session = sessionForDate(stateRef.current, date);
    if (session?.status === "in_progress") void upsertSession({ ...session, review: nextReview });
  }

  async function saveBodyWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bodyWeightSaving) return;
    setBodyWeightError("");
    setBodyWeightNotice("");
    const weightKg = Number(bodyWeightInput);
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
      const latest = stateRef.current;
      updateState({ ...latest, bodyWeightEntries: upsertBodyWeightEntry(latest.bodyWeightEntries, saved) });
      setBodyWeightInput("");
      setBodyWeightNotice(`Measurement saved for ${dateLabel(measuredOn, { month: "short", day: "numeric", year: "numeric" })}.`);
    } catch (error) {
      setBodyWeightError(error instanceof Error ? error.message : "The measurement could not be saved. Please try again.");
    } finally {
      setBodyWeightSaving(false);
    }
  }

  function addSet(exerciseId: string) {
    updateExercise(exerciseId, (log) => ({ ...log, sets: [...log.sets, { plannedReps: null, actualReps: null, loadKg: null, completed: false, extra: true }] }));
  }

  function finishLogging() {
    const session = sessionForDate(stateRef.current, date);
    if (session) void upsertSession({ ...session, review: session.review ?? reviewRef.current });
    setFormError("");
    setFlowStep("review");
  }

  async function submitCompletedSession(sessionDate: string) {
    const session = sessionForDate(stateRef.current, sessionDate);
    if (!session) return false;
    const completed = { ...session, status: "completed" as const, review: session.review ?? reviewRef.current, completedAt: new Date().toISOString() };
    const errors = validateWorkoutSession(completed);
    if (errors.length) { setFormError(errors.join(" ")); return false; }
    setFormError("");
    const saved = await upsertSession(completed);
    if (saved) setFlowStep("done");
    return saved;
  }

  function completeWorkout() {
    const key = `${stateRef.current.profile.id}:${date}`;
    void dedupeWorkoutSubmission(key, () => submitCompletedSession(date)).catch((error: unknown) => {
      setFormError(error instanceof Error ? error.message : "The session could not be saved. Please try again.");
    });
  }

  function retryPendingSessions() {
    for (const session of pendingSessions) void upsertSession(session);
  }

  function findNextWorkout() {
    for (let offset = 1; offset <= 7; offset += 1) {
      const next = shiftDate(currentDate, offset);
      if (state.profile.trainingDays.includes(new Date(`${next}T12:00:00Z`).getUTCDay())) {
        setState((current) => ({ ...current, selectedDate: next }));
        setView("today");
        setFlowStep("checkin");
        setCheckIn(emptyCheckIn());
        setCheckInEdited(false);
        reviewRef.current = emptyReview();
        setReview(emptyReview());
        return;
      }
    }
  }

  if (!ready) return <main className="app-loading"><div className="brand-mark">F</div><span>Getting your training space ready…</span></main>;

  const isDemo = state.mode === "demo";
  const dueToday = Boolean(generatedPlan || todaySession);
  const libraryOptions = getExerciseLibraryFilterOptions(EXERCISE_LIBRARY, planningProfile);
  const libraryResults = filterExerciseLibrary(EXERCISE_LIBRARY, planningProfile, {
    query: librarySearch,
    category: libraryFilter,
    muscleGroup: libraryMuscleFilter,
    movementPattern: libraryPatternFilter,
    equipment: libraryEquipmentFilter,
    difficulty: libraryDifficultyFilter,
  });
  const selectedExerciseRestricted = Boolean(selectedExercise && isDeadliftVariation(selectedExercise) && !deadliftAllowedForPlan(state.profile));
  const selectedExerciseInPlannedSession = Boolean(todaySession?.status === "planned" && plan?.exercises.some((exercise) => exercise.id === selectedExercise?.id));
  const selectedExerciseInCurrentWorkout = Boolean(todaySession && todaySession.plan.exercises.some((exercise) => exercise.id === selectedExercise?.id));
  const exercisesForAlternatives = selectedExerciseInCurrentWorkout
    ? todaySession?.status === "planned" ? plan?.exercises ?? [] : todaySession?.plan.exercises ?? []
    : [];
  const selectedExerciseAlternatives = selectedExercise && !selectedExerciseRestricted
    ? getSafeExerciseAlternatives(selectedExercise, state.profile, exercisesForAlternatives.filter((exercise) => exercise.id !== selectedExercise.id))
    : [];
  const selectedExerciseInstructions = selectedExercise ? getExerciseReferenceInstructions(selectedExercise) : [];
  const titleForView: Record<View, string> = {
    overview: "Your training space",
    today: "Today’s workout",
    progress: "Your progress",
    library: "Exercise library",
    trainer: "Trainer settings",
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); changePage("overview"); }}>
          <span className="brand-mark">F</span><span><strong>fittrack</strong><small>steady looks good on you</small></span>
        </a>
        <div className="side-caption">YOUR SPACE</div>
        <nav aria-label="Main navigation" className="side-nav">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-link ${view === item.id ? "active" : ""}`} onClick={() => changePage(item.id)}>
              <Icon>{item.icon}</Icon><span>{item.label}</span>{item.id === "today" && dueToday && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card"><span className="support-icon">✦</span><strong>Small steps count</strong><p>Your plan adapts as you build a steady routine.</p></div>
          <button className="profile-mini" onClick={() => changePage("trainer")}>
            <span className="avatar">{state.profile.displayName.slice(0, 1).toUpperCase()}</span>
            <span className="profile-mini-text"><strong>{state.profile.displayName}</strong><small>{isDemo ? "Demo profile" : state.userEmail ?? "Connected"}</small></span>
            <span className="mini-dots">···</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><span className="eyebrow">{dateLabel(currentDate, { month: "long", day: "numeric", year: "numeric" })}</span><h1>{titleForView[view]}</h1></div>
          <div className="topbar-actions"><span className={`save-state ${isDemo ? "demo" : saveError ? "sync-error" : "connected"}`}><span className="save-dot" />{isDemo ? "Saved on this device" : savingSession ? "Saving workout…" : saveError ? "Sync needs attention" : "Synced to your account"}</span><button className="round-avatar" aria-label="Open trainer settings" onClick={() => changePage("trainer")}>{state.profile.displayName.slice(0, 1).toUpperCase()}</button></div>
        </header>

        {notice && <div role="status" className="notice"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
        {saveError && <div role="alert" className="notice notice-error"><span>{saveError}</span><button className="retry-button" disabled={savingSession} onClick={retryPendingSessions}>{savingSession ? "Retrying…" : "Retry sync"}</button></div>}

        {view === "overview" && <section className="overview-page">
          <div className="welcome-row"><div><p className="welcome-kicker">You’re building a rhythm</p><h2>Good to see you, {state.profile.displayName} <span>✦</span></h2><p className="muted">A little consistency goes a long way. Let’s take today one step at a time.</p></div><div className="streak-pill"><span className="streak-icon">✧</span><div><strong>{completedThisWeek} / {state.profile.sessionsPerWeek}</strong><small>sessions this week</small></div></div></div>

          <div className="dashboard-grid">
            <div className="primary-column">
              <article className="today-card">
                <div className="today-card-top"><div><span className="pill pill-light">{dueToday ? "YOUR NEXT SESSION" : "REST & RECOVER"}</span><p className="card-date">{dateLabel(currentDate)}</p></div><span className="session-number">{todaySession?.status === "completed" ? "✓" : "01"}</span></div>
                <div className="today-card-content">
                  <div className="today-card-copy"><h3>{dueToday ? (todaySession?.plan.title ?? generatedPlan?.title) : "A rest day is part of the plan"}</h3><p>{dueToday ? (todaySession?.plan.description ?? generatedPlan?.description) : `Your next planned session is ${describeNextDay(state.profile, currentDate)}.`}</p><div className="today-meta"><span><b>◷</b> {todaySession?.plan.durationMinutes ?? generatedPlan?.durationMinutes ?? state.profile.preferredSessionMinutes} min</span><span><b>▦</b> {todaySession?.plan.exercises.length ?? generatedPlan?.exercises.length ?? 0} movements</span><span><b>⌁</b> Beginner friendly</span></div>
                    {dueToday ? <button className="button button-white" onClick={() => changePage("today")}>{todaySession?.status === "completed" ? "View session" : todaySession?.status === "in_progress" ? "Continue workout" : "Start today’s workout"}<span>→</span></button> : <button className="button button-white" onClick={findNextWorkout}>View next session <span>→</span></button>}
                  </div>
                  <div className="workout-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-disc"><span>✦</span></div><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">·</div><div className="art-spark spark-three">✧</div></div>
                </div>
                <div className="today-card-footer"><span><span className="footer-check">✓</span> Your plan follows your weekly rhythm</span><span>Template {todaySession?.plan.templateVersion ?? generatedPlan?.templateVersion ?? "1.0.0"}</span></div>
              </article>

              <div className="section-heading"><div><h3>This week</h3><p>A rhythm that fits your week</p></div><button className="text-button" onClick={() => changePage("progress")}>See progress <span>→</span></button></div>
              <div className="week-card">
                {Array.from({ length: 7 }, (_, index) => {
                  const weekday = (new Date(`${currentDate}T12:00:00Z`).getUTCDay() + index) % 7;
                  const itemDate = shiftDate(currentDate, index);
                  const session = sessionForDate(state, itemDate);
                  const scheduled = state.profile.trainingDays.includes(weekday);
                  const isToday = itemDate === currentDate;
                  return <button key={itemDate} className={`week-day ${isToday ? "today" : ""} ${scheduled ? "scheduled" : ""}`} onClick={() => { setState((current) => ({ ...current, selectedDate: itemDate })); setView("today"); setFlowStep("checkin"); setCheckIn(emptyCheckIn()); setCheckInEdited(false); setReview(emptyReview()); }} aria-label={`${dateLabel(itemDate)}, ${session?.status ?? (scheduled ? "planned workout" : "rest day")}`}>
                    <small>{weekdayLabels[weekday]}</small><strong>{Number(itemDate.slice(-2))}</strong><span className={`week-marker ${session?.status === "completed" ? "done" : scheduled ? "planned" : "rest"}`}>{session?.status === "completed" ? "✓" : scheduled ? "·" : ""}</span>
                  </button>;
                })}
              </div>

              <div className="section-heading section-heading-spaced"><div><h3>Pick up where you left off</h3><p>Your recent training at a glance</p></div></div>
              <div className="recent-list">
                {completedSessions.slice(-2).reverse().map((session) => <button className="recent-row" key={session.id} onClick={() => { setState((current) => ({ ...current, selectedDate: session.date })); setView("today"); }}>
                  <span className="recent-icon">✦</span><span className="recent-label"><strong>{session.plan.title}</strong><small>{dateLabel(session.date)} · {session.plan.exercises.length} movements</small></span><span className="status-complete">Completed</span><span className="row-arrow">→</span>
                </button>)}
                {completedSessions.length === 0 && <div className="empty-inline">Your first completed workout will show up here.</div>}
              </div>
            </div>

            <aside className="secondary-column">
              <article className="readiness-card"><div className="side-card-title"><span className="side-card-icon purple-icon">☼</span><div><h3>Today’s check-in</h3><p>A quick pause before you begin</p></div></div><div className="readiness-meter"><div className="meter-label"><span>Ready for training</span><strong>{todaySession?.checkIn ? `${Math.round(todaySession.checkIn.energy / 5 * 100)}%` : "—"}</strong></div><div className="meter-track"><span style={{ width: `${todaySession?.checkIn ? todaySession.checkIn.energy / 5 * 100 : 0}%` }} /></div><p>{todaySession?.checkIn ? `Energy ${todaySession.checkIn.energy}/5 · Soreness ${todaySession.checkIn.soreness}/5` : "Your plan will adjust to how you feel."}</p></div><button className="button button-subtle full-width" onClick={() => changePage("today")}>{todaySession?.checkIn ? "Review check-in" : "Do your check-in"}<span>→</span></button></article>

              <article className="goal-card"><div className="goal-head"><span className="side-card-icon green-icon">✧</span><span className="goal-caption">YOUR WEEKLY GOAL</span></div><strong className="goal-number">{Math.min(completedThisWeek, state.profile.sessionsPerWeek)}<span> / {state.profile.sessionsPerWeek}</span></strong><p>sessions completed</p><div className="goal-progress"><span style={{ width: `${Math.min(100, completedThisWeek / Math.max(1, state.profile.sessionsPerWeek) * 100)}%` }} /></div><div className="goal-footer"><span>{Math.max(0, state.profile.sessionsPerWeek - completedThisWeek)} to go this week</span><span>✦</span></div></article>

              <article className="tip-card"><span className="tip-spark">✦</span><span className="pill pill-tip">A GENTLE REMINDER</span><p>Leave a little energy in the tank. You can always do a bit more next time.</p><small>FITTRACK PRINCIPLE 01</small></article>

              <div className="rule-note"><span>⌁</span><p><strong>Made for steady progress</strong><br />No AI API or daily prompt needed. Your plan uses transparent rules and saved templates.</p></div>
            </aside>
          </div>
        </section>}

        {view === "today" && <section className="today-page">
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

              {todaySession && todaySession.status === "completed" && <article className="panel complete-panel"><span className="complete-badge">✓</span><h3>Session complete. Nice work.</h3><p>{todaySession.review?.note || "You showed up and put in steady work."}</p><div className="complete-summary"><span><strong>{todaySession.plan.exercises.length}</strong><small>movements</small></span><span><strong>{todaySession.review?.effort ?? "—"}/10</strong><small>effort</small></span><span><strong>{todaySession.plan.durationMinutes} min</strong><small>planned</small></span></div><button className="button button-subtle" onClick={() => changePage("progress")}>See your progress <span>→</span></button></article>}

              {todaySession && todaySession.status !== "completed" && <>
                {displayFlowStep === "workout" && <article className="panel logger-panel">
                  <div className="logger-top"><div className="panel-heading"><span className="panel-step">02</span><div><h3>Your workout</h3><p>Go at your own pace. Rest whenever you need.</p></div></div><span className="live-badge"><span /> IN PROGRESS</span></div>
                  <div className="exercise-log-list">
                    {todaySession.plan.exercises.map((exercise, index) => {
                      const log = todaySession.exerciseLogs.find((item) => item.exerciseId === exercise.id) ?? createExerciseLog(exercise.id, exercise.sets, exercise.reps);
                      return <div className={`exercise-log-card ${log.status === "completed" ? "logged" : ""}`} key={exercise.id}>
                        <div className="exercise-log-head"><span className="exercise-index">{String(index + 1).padStart(2, "0")}</span><div className="exercise-title"><button className="plain-link" onClick={() => openExerciseDetails(exercise)}>{exercise.name}<span> ↗</span></button><small>{exercise.equipment} · {log.plannedSets} planned sets × {log.plannedReps} reps</small>{exercise.substitutedFor && <small>Substituted for {plan.originalExercises.find((item) => item.id === exercise.substitutedFor)?.name ?? exercise.substitutedFor}</small>}</div><span className={`exercise-status ${log.status}`}>{log.status.replaceAll("_", " ")}</span></div>
                        {exercise.selectionReason && <p className="exercise-reason">{exercise.selectionReason}</p>}
                        {exercise.progressionAdvice && <div className="progression-note"><strong>{exercise.progressionAction === "consider_small_load_step" ? "Progression check" : exercise.progressionAction === "hold_load_add_reps" ? "Rep target" : "Load guidance"}</strong><p>{exercise.progressionAdvice} {exercise.loadGuidance}</p></div>}
                        <div className="set-grid set-grid-phase2"><span>SET</span><span>PLAN</span><span>ACTUAL REPS</span><span>LOAD (KG)</span><span>DONE</span>{log.sets.map((set, setIndex) => <div className="set-row" key={setIndex}><strong>{set.extra ? "＋" : String(setIndex + 1).padStart(2, "0")}</strong><span className="planned-reps">{set.plannedReps ?? "Extra"}</span><input aria-label={`${exercise.name} set ${setIndex + 1} actual reps`} type="number" min="1" max="1000" value={set.actualReps ?? ""} disabled={log.status === "skipped"} onChange={(event) => updateExercise(exercise.id, (current) => ({ ...current, sets: current.sets.map((item, i) => i === setIndex ? { ...item, actualReps: event.target.value === "" ? null : Number(event.target.value), completed: event.target.value === "" ? false : item.completed } : item) }))} /><input aria-label={`${exercise.name} set ${setIndex + 1} load in kilograms`} type="number" min="0" max="2000" step="0.5" placeholder="—" value={set.loadKg ?? ""} disabled={log.status === "skipped"} onChange={(event) => updateExercise(exercise.id, (current) => ({ ...current, sets: current.sets.map((item, i) => i === setIndex ? { ...item, loadKg: event.target.value === "" ? null : Number(event.target.value) } : item) }))} /><input className="set-complete" type="checkbox" aria-label={`Mark ${exercise.name} set ${setIndex + 1} complete`} checked={set.completed} disabled={log.status === "skipped"} onChange={(event) => updateExercise(exercise.id, (current) => ({ ...current, sets: current.sets.map((item, i) => i === setIndex ? { ...item, completed: event.target.checked, actualReps: event.target.checked ? item.actualReps ?? item.plannedReps ?? current.plannedReps : item.actualReps } : item) }))} /></div>)}</div>
                        <button className="add-set" disabled={log.status === "skipped"} onClick={() => addSet(exercise.id)}>＋ Add set</button>
                        <div className="exercise-extra-fields"><label className="field-label">Substituted movement <input maxLength={120} value={log.substitutionName} disabled={log.status === "skipped"} onChange={(event) => updateExercise(exercise.id, (current) => ({ ...current, substitutionName: event.target.value }))} placeholder="Optional movement name" /></label><label className="field-label">How did your form feel? <select value={log.formQuality} disabled={log.status === "skipped"} onChange={(event) => updateExercise(exercise.id, (current) => ({ ...current, formQuality: event.target.value as ExerciseLog["formQuality"] }))}><option value="not_rated">Not rated</option><option value="sound">Controlled and comfortable</option><option value="needs_practice">Needs more practice</option></select><small className="field-hint">Load progression requires controlled form and no pain.</small></label><label className="field-label">Exercise notes <textarea maxLength={2000} value={log.notes} disabled={log.status === "skipped"} onChange={(event) => updateExercise(exercise.id, (current) => ({ ...current, notes: event.target.value }))} placeholder="How it felt, setup changes, or anything to remember" rows={2} /></label></div>
                        <button className="skip-exercise" onClick={() => updateExercise(exercise.id, (current) => ({ ...current, status: current.status === "skipped" ? statusForSets(current.sets) : "skipped", sets: current.status === "skipped" ? current.sets : current.sets.map((set) => ({ ...set, completed: false })) }))}>{log.status === "skipped" ? "Undo skip" : "Skip this exercise"}</button>
                      </div>;
                    })}
                  </div>
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
              <article className="panel movement-panel"><div className="side-card-title"><span className="side-card-icon purple-icon">✦</span><div><h3>Today’s movements</h3><p>{plan.exercises.length} simple steps</p></div></div><div className="movement-list">{plan.exercises.map((exercise, index) => <button key={exercise.id} onClick={() => openExerciseDetails(exercise)} className="movement-item"><span className="movement-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{exercise.name}</strong><small>{exercise.sets} sets · {exercise.reps}</small></span><span className="row-arrow">↗</span></button>)}</div></article>
              <article className="mini-tip"><span>✦</span><p><strong>Keep it comfortable.</strong><br />Use a load that lets every rep feel controlled.</p></article>
            </aside>
          </div>}
          {!plan && <div className="rest-panel panel"><span className="rest-illustration">☼</span><h3>Rest is part of getting stronger.</h3><p>There’s no workout scheduled for this day. Your next session is {describeNextDay(state.profile, date)}.</p><button className="button button-primary" onClick={findNextWorkout}>View next session <span>→</span></button></div>}
        </section>}

        {view === "progress" && <section className="progress-page">
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
                  <p className="chart-caption">Total actual reps per workout (completed sets only). This chart is descriptive; it does not compare different exercises.</p>
                  <div className="progress-bars" role="img" aria-label={`Actual completed reps for ${selectedProgressExercise?.exerciseName} across ${performanceRecords.length} saved workouts`}>
                    {performanceRecords.map((record) => <div className="progress-bar-row" key={record.date}><span>{shortDate(record.date)}</span><div className="progress-bar-track"><span style={{ width: `${Math.max(4, record.completedReps / maxActualReps * 100)}%` }} /></div><strong>{record.completedReps} reps</strong></div>)}
                  </div>
                  <div className="progress-table-scroll"><table className="progress-table performance-table"><thead><tr><th scope="col">Date</th><th scope="col">Prescribed target</th><th scope="col">Completed actual</th><th scope="col">Recorded loads</th></tr></thead><tbody>{performanceRecords.slice().reverse().map((record) => <tr key={record.date}><th scope="row">{shortDate(record.date)}</th><td>{record.plannedSets} × {record.plannedReps} reps</td><td>{record.completedSets} sets · {record.completedReps} reps</td><td>{record.sets.filter((set) => set.completed && set.loadKg !== null).map((set) => `${set.loadKg} kg`).join(", ") || "No load recorded"}</td></tr>)}</tbody></table></div>
                </> : <div className="empty-inline">No completed set performance is recorded for this exercise yet.</div>}
              </> : <div className="empty-state compact-empty"><span>⌁</span><h3>No exercise results yet</h3><p>Actual set and rep trends will appear after you save workout logs.</p></div>}
            </article>
            <article className="panel progress-panel">
              <div className="section-heading"><div><h3>Personal records</h3><p>Record = highest positive load on a completed set with actual reps recorded in the loaded history.</p></div></div>
              {personalRecords.length ? <div className="record-list">{personalRecords.map((record) => <div className="record-row" key={record.exerciseId}><span className="record-icon">✦</span><div><strong>{record.exerciseName}</strong><small>{record.loadKg} kg × {record.reps} reps · {shortDate(record.date)}</small></div></div>)}</div> : <div className="empty-inline">No recorded weighted sets yet. Unweighted sets and missing loads do not create a weight record.</div>}
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
                  <label className="field-label">Weight (kg)<input type="number" min="20" max="500" step="0.01" inputMode="decimal" value={bodyWeightInput} onChange={(event) => setBodyWeightInput(event.target.value)} placeholder="Optional" /></label>
                  <button className="button button-primary" type="submit" disabled={bodyWeightSaving}>{bodyWeightSaving ? "Saving…" : "Save measurement"}</button>
                </form>
                {bodyWeightError && <p role="alert" className="form-error">{bodyWeightError}</p>}{bodyWeightNotice && <p role="status" className="success-note">{bodyWeightNotice}</p>}
                {weightTrend.length ? <><p className="chart-caption">Recent bar lengths are scaled to the measurements shown; exact values and dates are listed below.</p><div className="progress-bars" role="img" aria-label={`Recorded body-weight measurements across ${recentWeightTrend.length} recent dates`}>{recentWeightTrend.map((entry) => { const spread = maxBodyWeight - minBodyWeight; const width = spread < 0.02 ? 50 : Math.max(8, (entry.weightKg - minBodyWeight) / spread * 100); return <div className="progress-bar-row" key={entry.date}><span>{shortDate(entry.date)}</span><div className="progress-bar-track"><span style={{ width: `${width}%` }} /></div><strong>{entry.weightKg} kg</strong></div>; })}</div><div className="progress-table-scroll"><table className="progress-table"><thead><tr><th scope="col">Date</th><th scope="col">Recorded body weight</th></tr></thead><tbody>{weightTrend.slice().reverse().map((entry) => <tr key={entry.date}><th scope="row">{dateLabel(entry.date, { month: "short", day: "numeric", year: "numeric" })}</th><td>{entry.weightKg} kg</td></tr>)}</tbody></table></div></> : <div className="empty-inline">No body-weight measurements recorded. Add one only if it is useful to you.</div>}
              </>}
            </article>
          </div>

          <article className="panel history-panel"><div className="section-heading"><div><h3>Saved workout history</h3><p>Open a date to review its plan, actual logged sets, substitutions, and feedback.</p></div><span className="pill pill-outline">{historySessions.length} SAVED</span></div>{historySessions.length ? <div className="history-table"><div className="history-header"><span>SESSION</span><span>DATE</span><span>SETS DONE</span><span>EFFORT</span><span>STATUS</span></div>{historySessions.map((session) => { const status = recordedSessionStatus(session); const setsDone = session.exerciseLogs.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0); return <button key={session.id} className="history-row history-row-button" onClick={() => setSelectedHistorySession(session)}><span className="history-session"><span className="recent-icon">✦</span><strong>{session.plan.title}</strong></span><span>{shortDate(session.date)}</span><span>{setsDone} sets</span><span>{session.review?.effort ?? "—"} / 10</span><span className={status === "completed" ? "status-complete" : "status-pending"}>{progressStatusLabel(status)}</span></button>; })}</div> : <div className="empty-state"><span>✧</span><h3>No saved workouts yet</h3><p>FitTrack will show workouts here only after a session has been saved.</p><button className="button button-primary" onClick={() => changePage("today")}>Go to today’s workout <span>→</span></button></div>}</article>
          <p className="version-note">Each saved session keeps its original plan and rule version. Prescribed targets remain separate from the actual sets you logged. Supabase currently loads up to 300 recent sessions and 1,000 body-weight measurements; older saved entries may not appear in these charts or records.</p>
        </section>}

        {view === "library" && <section className="library-page">
          <div className="page-intro"><div><span className="eyebrow">Learn the movement before you lift</span><h2>Simple references, right when you need them.</h2><p>Search clear, beginner-friendly steps, equipment needs, target muscles, and comfortable alternatives.</p></div></div>
          <label className="library-search"><span aria-hidden="true">⌕</span><input type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search exercises, muscles, or equipment" aria-label="Search exercises, muscles, or equipment" />{librarySearch && <button type="button" onClick={() => setLibrarySearch("")} aria-label="Clear exercise search">×</button>}</label>
          <div className="filter-row">{["All", "Strength", "Core", "Conditioning"].map((filter) => <button key={filter} className={libraryFilter === filter ? "selected" : ""} onClick={() => setLibraryFilter(filter)}>{filter}</button>)}</div>
          <div className="library-filter-controls">
            <label>Muscle group<select value={libraryMuscleFilter} onChange={(event) => setLibraryMuscleFilter(event.target.value)}><option value="">All muscles</option>{libraryOptions.muscleGroups.map((muscle) => <option key={muscle} value={muscle}>{muscle}</option>)}</select></label>
            <label>Movement pattern<select value={libraryPatternFilter} onChange={(event) => setLibraryPatternFilter(event.target.value)}><option value="">All patterns</option>{libraryOptions.movementPatterns.map((pattern) => <option key={pattern.key} value={pattern.key}>{pattern.label}</option>)}</select></label>
            <label>Equipment<select value={libraryEquipmentFilter} onChange={(event) => setLibraryEquipmentFilter(event.target.value)}><option value="">Any equipment</option>{libraryOptions.equipment.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label>Difficulty<select value={libraryDifficultyFilter} onChange={(event) => setLibraryDifficultyFilter(event.target.value)}><option value="">All levels</option>{libraryOptions.difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty[0].toUpperCase() + difficulty.slice(1)}</option>)}</select></label>
          </div>
          <div className="library-results-heading"><span>{libraryResults.length} {libraryResults.length === 1 ? "exercise" : "exercises"}</span>{(librarySearch || libraryFilter !== "All" || libraryMuscleFilter || libraryPatternFilter || libraryEquipmentFilter || libraryDifficultyFilter) && <button type="button" className="text-button" onClick={() => { setLibrarySearch(""); setLibraryFilter("All"); setLibraryMuscleFilter(""); setLibraryPatternFilter(""); setLibraryEquipmentFilter(""); setLibraryDifficultyFilter(""); }}>Clear filters</button>}</div>
          {libraryResults.length ? <div className="library-grid">{libraryResults.map((exercise) => {
            const equipmentReady = exerciseEquipmentIsAvailable(exercise, planningProfile);
            return <button key={exercise.id} className="library-card" onClick={() => openExerciseDetails(exercise)}><span className="library-card-icon">{exercise.category === "core" ? "◉" : exercise.category === "conditioning" ? "↗" : "✦"}</span><span className="library-tag">{exercise.difficulty}</span><strong>{exercise.name}</strong><small>{exercise.equipment}</small><small className="library-muscles">{exercise.targetMuscles.join(" · ")}</small><span className={`equipment-ready ${equipmentReady ? "ready" : "needs-check"}`}>{equipmentReady ? "Equipment available" : state.profile.equipmentAvailability === "unknown" ? "Confirm equipment first" : "Not in confirmed equipment"}</span><span className="library-open">Open instructions ↗</span></button>;
          })}</div> : <div className="library-empty"><span>⌕</span><h3>No matching exercises</h3><p>Try a different search or clear one of the filters.</p><button type="button" className="button button-subtle" onClick={() => { setLibrarySearch(""); setLibraryFilter("All"); setLibraryMuscleFilter(""); setLibraryPatternFilter(""); setLibraryEquipmentFilter(""); setLibraryDifficultyFilter(""); }}>Reset library filters</button></div>}
        </section>}

        {view === "trainer" && <section className="trainer-page">
          <div className="page-intro"><div><span className="eyebrow">The plan behind your plan</span><h2>Keep the rules simple and clear.</h2><p>Update the weekly rhythm and see what is currently guiding the workouts.</p></div></div>
          <div className="trainer-grid">
            <article className="panel settings-panel"><div className="section-heading"><div><h3>Client profile</h3><p>Basic training preferences</p></div><span className="pill pill-outline">{isDemo ? "DEMO" : "SAVED"}</span></div><label className="field-label">Client name<input type="text" value={state.profile.displayName} onChange={(event) => updateProfile({ displayName: event.target.value })} /></label><label className="field-label">Sessions per week<select value={state.profile.sessionsPerWeek} onChange={(event) => { const count = Number(event.target.value); void updateProfile({ sessionsPerWeek: count, trainingDays: adjustTrainingDays(state.profile.trainingDays, count) }); }}><option value={2}>2 days</option><option value={3}>3 days</option><option value={4}>4 days</option></select></label><div className="field-label"><span>Training days</span><div className="training-days">{weekdayLabels.map((label, day) => <button key={label} className={state.profile.trainingDays.includes(day) ? "selected" : ""} onClick={() => {
              const next = state.profile.trainingDays.includes(day) ? state.profile.trainingDays.filter((value) => value !== day) : [...state.profile.trainingDays, day];
              if (next.length >= 2 && next.length <= 4) void updateProfile({ trainingDays: next, sessionsPerWeek: next.length });
            }}>{label}</button>)}</div><small className="field-hint">Choose 2–4 days. Missed sessions are not carried forward or crammed into the next day.</small></div><label className="field-label">Preferred session length<select value={state.profile.preferredSessionMinutes} onChange={(event) => updateProfile({ preferredSessionMinutes: Number(event.target.value) })}><option value={30}>About 30 minutes</option><option value={40}>About 40 minutes</option><option value={50}>About 50 minutes</option></select></label><div className="field-label"><span>Available equipment</span><div className="availability-buttons"><button type="button" className={state.profile.equipmentAvailability === "unknown" ? "selected" : ""} aria-pressed={state.profile.equipmentAvailability === "unknown"} onClick={() => setEquipmentAvailability("unknown")}>Not confirmed</button><button type="button" className={state.profile.equipmentAvailability === "verified" ? "selected" : ""} aria-pressed={state.profile.equipmentAvailability === "verified"} onClick={() => setEquipmentAvailability("verified")}>Confirm what is available</button></div><small className="field-hint">Unknown equipment uses safe alternatives. Confirmed equipment is used only when checked below.</small></div>{state.profile.equipmentAvailability === "verified" && <div className="equipment-options">{EQUIPMENT_OPTIONS.map((item) => <label className="checkbox-row" key={item.id}><input type="checkbox" checked={state.profile.availableEquipment.includes(item.id)} onChange={() => toggleAvailableEquipment(item.id)} /><span><strong>{item.label}</strong></span></label>)}{state.profile.availableEquipment.length === 0 && <small className="field-hint">No gym equipment selected. The plan will use bodyweight alternatives.</small>}</div>}</article>

            <div className="trainer-side-stack">{state.profile.trainerRole && !isDemo ? <TrainerControls client={browserClient} trainerId={state.profile.id} trainerRole={state.profile.trainerRole} clients={state.trainerClients ?? []} refresh={refreshTrainerClients} /> : <article className="panel trainer-rule-panel"><div className="side-card-title"><span className="side-card-icon peach-icon">⌁</span><div><h3>Deadlift variations</h3><p>Beginner ramp-up guardrail</p></div></div><div className="rule-setting"><div><strong>{state.profile.deadliftEnabled ? "Explicitly trainer-approved" : "Restricted by default"}</strong><small>{isDemo ? "Demo-only setting; no cloud trainer rule is changed." : "This rule never unlocks automatically by date or training phase."}</small></div>{isDemo && <button type="button" className={`toggle ${state.profile.deadliftEnabled ? "on" : ""}`} role="switch" aria-checked={state.profile.deadliftEnabled} onClick={() => void toggleDeadlift(!state.profile.deadliftEnabled)} aria-label={`${state.profile.deadliftEnabled ? "Lock" : "Approve demo"} deadlift variations`}><span /></button>}</div>{!isDemo && <div className="permission-note">Only an authenticated assigned trainer can change this restriction.</div>}<p className="rule-foot">The rule applies to future plans only. Existing workout snapshots keep their original rules.</p></article>}

              <article className="panel template-panel"><div className="section-heading"><div><h3>Active rules & templates</h3><p>Deterministic plan generation</p></div></div><div className="version-row"><span><strong>Beginner foundation</strong><small>Approved schedule · conservative rotation</small></span><span>{TEMPLATE_VERSION}</span></div><div className="version-row"><span><strong>Planning rules</strong><small>Progression, recovery, missed days, equipment</small></span><span>{RULE_VERSION}</span></div><div className="no-ai-chip"><span>✦</span> No paid AI API used</div></article>

              <article className="panel account-panel"><div className="side-card-title"><span className="side-card-icon green-icon">◎</span><div><h3>Account & sync</h3><p>{isDemo ? "Your demo data stays in this browser." : `Signed in as ${state.userEmail ?? "your account"}.`}</p></div></div>{!hasSupabaseConfig() ? <div className="setup-note">Add your Supabase URL and publishable key to <code>.env.local</code> to turn on account sync.</div> : isDemo ? <form onSubmit={sendMagicLink} className="sign-in-form"><label className="field-label">Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><button className="button button-primary full-width" disabled={authBusy}>{authBusy ? "Sending…" : "Email me a sign-in link"}</button><small>A secure sign-in link will arrive in your inbox.</small></form> : <button className="button button-subtle" onClick={signOut}>Sign out</button>}</article></div>
          </div>
        </section>}

        <footer className="app-footer"><span>FitTrack · Build a routine that fits your life</span><span>Rules {plan?.ruleVersion ?? "2026.10.1"} <i>·</i> {isDemo ? "Demo mode" : "Supabase connected"}</span></footer>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => changePage(item.id)} aria-label={item.label}><Icon>{item.icon}</Icon><small>{item.id === "overview" ? "Home" : item.id === "today" ? "Today" : item.id === "progress" ? "Progress" : item.id === "library" ? "Library" : "Settings"}</small></button>)}</nav>

      {selectedExercise && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedExercise(null); }}><section className="exercise-modal" role="dialog" aria-modal="true" aria-labelledby="exercise-modal-title"><button className="modal-close" aria-label="Close exercise details" onClick={() => setSelectedExercise(null)}>×</button><span className="modal-kicker">EXERCISE LIBRARY · TEXT GUIDE</span><span className="modal-art">{selectedExercise.category === "core" ? "◉" : selectedExercise.category === "conditioning" ? "↗" : "✦"}</span><h2 id="exercise-modal-title">{selectedExercise.name}</h2><p className="modal-subtitle">{selectedExercise.equipment} · {selectedExercise.sets} sets × {selectedExercise.reps} · {selectedExercise.restSeconds ? `${selectedExercise.restSeconds} sec rest` : "No timed rest"}</p>
        {selectedExerciseRestricted ? <div className="locked-note">This movement is currently restricted by the trainer rule. It is hidden from library search and its instructions are unavailable unless an authorized trainer explicitly approves it.</div> : <>
          <div className="exercise-detail-grid"><div><small>Target muscles</small><strong>{selectedExercise.targetMuscles.join(" · ")}</strong></div><div><small>Difficulty</small><strong>{selectedExercise.difficulty[0].toUpperCase() + selectedExercise.difficulty.slice(1)}</strong></div><div><small>Movement pattern</small><strong>{selectedExercise.movementPattern?.replaceAll("_", " ") ?? "General movement"}</strong></div><div><small>Equipment</small><strong>{selectedExercise.equipment}</strong><span className={exerciseEquipmentIsAvailable(selectedExercise, state.profile) ? "equipment-ready ready" : "equipment-ready needs-check"}>{exerciseEquipmentIsAvailable(selectedExercise, state.profile) ? "Available in your setup" : "Confirm equipment before using"}</span></div></div>
          {selectedExercise.selectionReason && <p className="exercise-reason">{selectedExercise.selectionReason}</p>}
          <h3>Step-by-step instructions</h3><ol className="instruction-list">{selectedExerciseInstructions.map((instruction, index) => <li key={`${index}-${instruction}`}><span>{index + 1}</span><p>{instruction}</p></li>)}</ol>
          {selectedExercise.cautionNotes.length > 0 && <div className="exercise-cautions"><strong>Comfort and safety</strong><ul>{selectedExercise.cautionNotes.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>}
          {selectedExerciseAlternatives.length > 0 && <div className="exercise-alternatives"><h3>Suitable alternatives</h3><p>Only equipment-free options or movements that match your confirmed equipment and the current restrictions are shown.</p>{selectedExerciseAlternatives.map((alternative) => <article key={alternative.id} className="alternative-choice"><div><strong>{alternative.name}</strong><small>{alternative.equipment} · {alternative.sets} sets × {alternative.reps}</small><p>{alternative.selectionReason}</p></div>{selectedExerciseInPlannedSession ? <button type="button" className="button button-subtle" onClick={() => applyLibraryAlternative(selectedExercise.id, alternative.id)}>Use in this workout</button> : <button type="button" className="text-button" onClick={() => openExerciseDetails(alternative)}>View guide</button>}</article>)}</div>}
          {selectedExerciseInCurrentWorkout && todaySession?.status === "in_progress" && <p className="field-hint">This workout has started. Keep its saved exercise history; record any actual substitution in the workout logger.</p>}
        </>}
        <button className="button button-primary full-width" onClick={() => setSelectedExercise(null)}>Close guide</button></section></div>}
      {selectedHistorySession && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedHistorySession(null); }}><section className="exercise-modal history-detail-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title"><button className="modal-close" aria-label="Close workout details" onClick={() => setSelectedHistorySession(null)}>×</button><span className="modal-kicker">WORKOUT HISTORY · {shortDate(selectedHistorySession.date)}</span><h2 id="history-detail-title">{selectedHistorySession.plan.title}</h2><p className="modal-subtitle">{selectedHistorySession.status.replaceAll("_", " ")} · Template {selectedHistorySession.plan.templateVersion} · Rules {selectedHistorySession.plan.ruleVersion}</p>
        <div className="history-feedback"><strong>Why this plan</strong>{selectedHistorySession.plan.generationReasons.map((reason) => <p key={reason}>{reason}</p>)}{selectedHistorySession.plan.originalExercises.length > 0 && <p>Original template: {selectedHistorySession.plan.originalExercises.map((exercise) => exercise.name).join(" · ")}</p>}</div>
        {selectedHistorySession.checkIn && <div className="history-feedback"><strong>Before the workout</strong><p>Energy {selectedHistorySession.checkIn.energy}/5 · Soreness {selectedHistorySession.checkIn.soreness}/5 · Recovery {selectedHistorySession.checkIn.recovery}/5 · Pain {selectedHistorySession.checkIn.pain ? "reported" : "none reported"}</p>{selectedHistorySession.checkIn.discomfort && <p>{selectedHistorySession.checkIn.discomfort}</p>}{selectedHistorySession.checkIn.note && <p>{selectedHistorySession.checkIn.note}</p>}</div>}
        <div className="history-detail-exercises"><h3>Exercise details</h3>{selectedHistorySession.exerciseLogs.map((log) => { const exercise = selectedHistorySession.plan.exercises.find((item) => item.id === log.exerciseId); return <article key={log.exerciseId} className="history-detail-exercise"><div><strong>{exercise?.name ?? log.exerciseId}</strong><span className={`exercise-status ${log.status}`}>{log.status.replaceAll("_", " ")}</span></div><p>{log.plannedSets} planned sets × {log.plannedReps} reps · {log.sets.filter((set) => set.completed).length} completed sets{log.substitutionName ? ` · Substituted with ${log.substitutionName}` : ""} · Form {log.formQuality.replaceAll("_", " ")}</p>{exercise?.selectionReason && <p>{exercise.selectionReason}</p>}{exercise?.progressionAdvice && <p>{exercise.progressionAdvice}</p>}{log.sets.length > 0 && <ul>{log.sets.map((set, index) => <li key={index}>Set {index + 1}: {set.completed ? `${set.actualReps} reps${set.loadKg === null ? "" : ` at ${set.loadKg} kg`}` : "not completed"}{set.extra ? " · extra" : ""}</li>)}</ul>}{log.notes && <p>{log.notes}</p>}</article>; })}</div>
        {selectedHistorySession.review && <div className="history-feedback"><strong>After the workout</strong><p>Effort {selectedHistorySession.review.effort}/10 · Energy {selectedHistorySession.review.energyAfter}/5 · Discomfort {selectedHistorySession.review.discomfort ? "reported" : "none reported"} · {selectedHistorySession.review.mood}</p>{selectedHistorySession.review.discomfortNote && <p>{selectedHistorySession.review.discomfortNote}</p>}{selectedHistorySession.review.note && <p>{selectedHistorySession.review.note}</p>}</div>}
        <button className="button button-primary full-width" onClick={() => setSelectedHistorySession(null)}>Close details</button></section></div>}
    </div>
  );
}
