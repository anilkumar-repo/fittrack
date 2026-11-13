"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createDemoState, readDemoState, todayInTimeZone, writeDemoState } from "@/lib/demo-data";
import { isDeadliftVariation } from "@/lib/exercise-library";
import { clearPendingSession, readPendingSessions, writePendingSession } from "@/lib/pending-sessions";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { computeFriendStats } from "@/lib/friends";
import { publishFriendStats } from "@/lib/friends-repository";
import { loadCloudState, saveCloudMissedDay, saveCloudProfile, saveCloudSession } from "@/lib/supabase-repository";
import { DEFAULT_TRAINER_RULE_SETTINGS, profileWithTrainerEquipment } from "@/lib/trainer-rules";
import { isFigureChoice, type FigureChoice } from "@/lib/figure";
import type { WeightUnit } from "@/lib/logging";
import type { FitTrackState, Profile, TrainerRuleSettings, WorkoutSession } from "@/lib/types";
import { validateWorkoutSession } from "@/lib/workout-tracking";

const SESSION_SAVE_DELAY_MS = 800;
const WEIGHT_UNIT_KEY = "fittrack-weight-unit";
const THEME_KEY = "fittrack-theme";
const FIGURE_KEY = "fittrack-figure";
/** "pastel" is the default Soft pastel look; "light" is Liquid glass. */
export type Theme = "pastel" | "light";

/** Puts the chosen look on the page. */
function applyTheme(theme: Theme) {
  const glass = theme === "light";
  if (glass) document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", glass ? "#ece9f8" : "#eceae6");
}

interface FitTrackContextValue {
  state: FitTrackState;
  /** The latest state, for handlers that run after an await or several quick edits. */
  getState: () => FitTrackState;
  updateState: (next: FitTrackState) => void;
  ready: boolean;
  isDemo: boolean;
  accountLoading: boolean;
  /** True once we know whether someone is signed in on this device. */
  authChecked: boolean;
  browserClient: SupabaseClient | null;
  /** Today's date in the profile's time zone. */
  currentDate: string;
  trainerRuleSettings: TrainerRuleSettings;
  planningProfile: Profile;
  /** Saved sessions, without built-in demonstration fixtures. */
  recordedSessions: WorkoutSession[];
  notice: string;
  setNotice: (message: string) => void;
  saveError: string;
  savingSession: boolean;
  retryPendingSessions: () => void;
  upsertSession: (session: WorkoutSession, options?: { debounce?: boolean }) => Promise<boolean>;
  /** Saves skipped sessions with a reason for missed days. Resolves false if the account could not be updated. */
  recordMissedDays: (sessions: WorkoutSession[]) => Promise<boolean>;
  updateProfile: (patch: Partial<Profile>) => void;
  /** Saves the answers from the welcome steps and opens the app. */
  completeOnboarding: (patch: Partial<Profile>) => void;
  /** Saves the welcome answers on this device without leaving the welcome steps, so signing in carries them into the new account. */
  stageOnboarding: (patch: Partial<Profile>) => void;
  signOut: () => Promise<void>;
  refreshTrainerClients: () => Promise<void>;
  /** How weights are shown and typed on this device. They are always stored in kilograms. */
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
  /** Midnight green (dark), Liquid glass (light), or automatic; remembered on this device. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Which body drawing to show, remembered on this device. */
  figure: FigureChoice;
  setFigure: (figure: FigureChoice) => void;
}

const FitTrackContext = createContext<FitTrackContextValue | null>(null);

export function useFitTrack(): FitTrackContextValue {
  const value = useContext(FitTrackContext);
  if (!value) throw new Error("useFitTrack must be used inside FitTrackProvider.");
  return value;
}

export function sessionForDate(state: FitTrackState, date: string): WorkoutSession | undefined {
  return state.sessions.find((session) => session.date === date);
}

/** Real workouts logged in demo mode that are complete enough to keep when the person signs in. */
function sessionsToCarryIntoAccount(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter((session) => !session.sampleData
    && (session.status === "completed" || session.status === "in_progress")
    && !session.plan.exercises.some((exercise) => isDeadliftVariation(exercise))
    && validateWorkoutSession(session).length === 0);
}

export function FitTrackProvider({ children }: { children: React.ReactNode }) {
  const browserClient = useMemo(() => getSupabaseBrowserClient(), []);
  const [state, setState] = useState<FitTrackState>(() => createDemoState());
  const [ready, setReady] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(() => getSupabaseBrowserClient() === null);
  const [notice, setNotice] = useState("");
  // Information messages close by themselves after 12 seconds; errors (saveError) stay until handled.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 12_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [saveError, setSaveError] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [pendingSessions, setPendingSessions] = useState<WorkoutSession[]>([]);
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>("kg");
  const [theme, setThemeState] = useState<Theme>("pastel");
  const [figure, setFigureState] = useState<FigureChoice>("neutral");
  const stateRef = useRef(state);
  const sessionSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingSessionWrites = useRef(0);
  const profileSaveTimer = useRef<number | null>(null);
  /** Cloud writes waiting for a pause in typing, keyed by workout date. */
  const delayedCloudWrites = useRef(new Map<string, { timer: number; run: () => void; waiters: Array<(saved: boolean) => void> }>());
  /** The account whose data is loaded or loading, so repeated auth events never reload over unsaved edits. */
  const accountInView = useRef<string | null>(null);

  const currentDate = todayInTimeZone(state.profile.timeZone);
  const trainerRuleSettings = state.trainerRuleSettings ?? DEFAULT_TRAINER_RULE_SETTINGS;
  const planningProfile = useMemo(() => profileWithTrainerEquipment(state.profile, trainerRuleSettings), [state.profile, trainerRuleSettings]);
  const recordedSessions = useMemo(() => state.sessions.filter((session) => !session.sampleData), [state.sessions]);

  useEffect(() => {
    let cancelled = false;
    const localState = readDemoState() ?? createDemoState();
    const hydrateTimer = window.setTimeout(() => {
      if (cancelled) return;
      // The ref is updated here, not in a later effect: page components save from their own effects in
      // the same render, and must never see (and write back) the placeholder state from before loading.
      if (stateRef.current.mode !== "supabase") {
        stateRef.current = localState;
        setState(localState);
      }
      try { if (window.localStorage.getItem(WEIGHT_UNIT_KEY) === "lb") setWeightUnitState("lb"); } catch { /* Kilograms remain the default. */ }
      // The page already shows the saved theme (set before first paint in app/layout.tsx).
      try {
        const saved = window.localStorage.getItem(THEME_KEY);
        // Earlier choices ("dark", "auto") now fall back to the default Soft pastel look.
        if (saved === "light") setThemeState("light");
        const savedFigure = window.localStorage.getItem(FIGURE_KEY);
        if (isFigureChoice(savedFigure)) setFigureState(savedFigure);
      } catch { /* Soft pastel remains the default. */ }
      writeDemoState(localState);
      setReady(true);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(hydrateTimer); };
  }, []);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => () => {
    if (profileSaveTimer.current !== null) window.clearTimeout(profileSaveTimer.current);
  }, []);

  const getState = useCallback(() => stateRef.current, []);

  const updateState = useCallback((next: FitTrackState) => {
    stateRef.current = next;
    setState(next);
    if (next.mode === "demo") writeDemoState(next);
  }, []);

  const writeCloudSession = useCallback((userId: string, session: WorkoutSession): Promise<boolean> => {
    if (!browserClient) return Promise.resolve(false);
    pendingSessionWrites.current += 1;
    setSavingSession(true);
    setSaveError("");
    const write = sessionSaveQueue.current.catch(() => undefined).then(async () => {
      const saved = await saveCloudSession(browserClient, userId, session);
      const latest = stateRef.current;
      if (latest.profile.id === userId) {
        const updated = { ...latest, sessions: latest.sessions.map((item) => item.date === session.date ? { ...item, id: saved.id } : item) };
        stateRef.current = updated;
        setState(updated);
      }
      // A newer edit for this date may already be waiting; its device draft must survive until it is saved.
      if (!delayedCloudWrites.current.has(session.date)) clearPendingSession(userId, session.date);
      setPendingSessions((items) => items.filter((item) => item.date !== session.date));
      if (session.status === "completed") setNotice("Workout saved to your RozFit account.");
      return true;
    }).catch((error: unknown) => {
      writePendingSession(userId, session);
      setPendingSessions(readPendingSessions(userId));
      setSaveError(error instanceof Error ? error.message : "RozFit could not sync this session. Retry when you’re back online.");
      return false;
    }).finally(() => {
      pendingSessionWrites.current = Math.max(0, pendingSessionWrites.current - 1);
      if (pendingSessionWrites.current === 0) setSavingSession(false);
    });
    sessionSaveQueue.current = write.then(() => undefined);
    return write;
  }, [browserClient]);

  /**
   * Updates the session on screen at once. Cloud saves marked `debounce` wait for a short pause in typing,
   * so one logged set is one save instead of one per keystroke; a device draft covers the gap.
   */
  const upsertSession = useCallback((session: WorkoutSession, options: { debounce?: boolean } = {}): Promise<boolean> => {
    const current = stateRef.current;
    const next = { ...current, sessions: [...current.sessions.filter((item) => item.date !== session.date), session].sort((a, b) => a.date.localeCompare(b.date)) };
    updateState(next);
    if (next.mode !== "supabase" || !browserClient) return Promise.resolve(true);
    const userId = next.profile.id;
    writePendingSession(userId, session);
    const waiting = delayedCloudWrites.current.get(session.date);
    if (waiting) window.clearTimeout(waiting.timer);
    const waiters = waiting?.waiters ?? [];
    return new Promise<boolean>((resolve) => {
      waiters.push(resolve);
      const run = () => {
        delayedCloudWrites.current.delete(session.date);
        void writeCloudSession(userId, session).then((saved) => waiters.forEach((done) => done(saved)));
      };
      if (options.debounce) delayedCloudWrites.current.set(session.date, { timer: window.setTimeout(run, SESSION_SAVE_DELAY_MS), run, waiters });
      else run();
    });
  }, [updateState, browserClient, writeCloudSession]);

  const flushDelayedCloudWrites = useCallback(() => {
    for (const waiting of [...delayedCloudWrites.current.values()]) {
      window.clearTimeout(waiting.timer);
      waiting.run();
    }
  }, []);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushDelayedCloudWrites(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDelayedCloudWrites);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDelayedCloudWrites);
      flushDelayedCloudWrites();
    };
  }, [flushDelayedCloudWrites]);

  const loadAccount = useCallback(async (user: User) => {
    if (!browserClient || accountInView.current === user.id) return;
    accountInView.current = user.id;
    setAccountLoading(true);
    try {
      const local = readDemoState();
      const carried = sessionsToCarryIntoAccount(local?.sessions ?? []);
      const cloud = await loadCloudState(browserClient, user, {
        profile: local?.profile,
        earliestSessionDate: carried.map((session) => session.date).sort()[0],
        onboarded: local?.onboarded === true,
      });
      if (accountInView.current !== user.id) return;
      const drafts = readPendingSessions(user.id);
      const sessions = [...cloud.sessions];
      for (const draft of drafts) {
        const index = sessions.findIndex((item) => item.date === draft.date);
        if (index >= 0) sessions[index] = draft;
        else sessions.push(draft);
      }
      // Workouts logged on this device before signing in move into the account, unless that date is already saved there.
      const imported = carried.filter((session) => !sessions.some((item) => item.date === session.date && item.status !== "planned"));
      const merged = { ...cloud, sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)) };
      stateRef.current = merged;
      setState(merged);
      for (const session of [...drafts, ...imported]) void upsertSession(session);
      if (local && carried.length) writeDemoState({ ...local, sessions: local.sessions.filter((session) => !carried.includes(session)) });
      if (imported.length) setNotice(`${imported.length} ${imported.length === 1 ? "workout" : "workouts"} logged on this device ${imported.length === 1 ? "was" : "were"} added to your account.`);
    } catch (error) {
      if (accountInView.current === user.id) accountInView.current = null;
      setNotice(error instanceof Error ? error.message : "Could not load your saved profile yet.");
    } finally {
      setAccountLoading(false);
    }
  }, [browserClient, upsertSession]);

  useEffect(() => {
    if (!browserClient) return;
    void browserClient.auth.getUser().then(({ data }) => { if (data.user) void loadAccount(data.user); })
      .catch(() => undefined).finally(() => setAuthChecked(true));
    const { data: listener } = browserClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        accountInView.current = null;
        const local = readDemoState() ?? createDemoState();
        stateRef.current = local;
        setState(local);
        return;
      }
      // Token refreshes and tab refocus repeat SIGNED_IN for the same person; only a new account loads data.
      const user = session?.user;
      if (user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) window.setTimeout(() => void loadAccount(user), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [browserClient, loadAccount]);

  useEffect(() => {
    const callbackStatus = new URLSearchParams(window.location.search).get("auth");
    if (callbackStatus !== "error") return;
    window.history.replaceState({}, "", window.location.pathname);
    const timer = window.setTimeout(() => setNotice("The sign-in link could not be completed. Request a new link and try again."), 0);
    return () => window.clearTimeout(timer);
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

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    const current = stateRef.current;
    const profile = { ...current.profile, ...patch };
    const next = { ...current, profile };
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
  }, [browserClient, updateState]);

  const completeOnboarding = useCallback((patch: Partial<Profile>) => {
    const current = stateRef.current;
    const hasHistory = current.sessions.some((session) => !session.sampleData && session.status !== "planned");
    // Day one of training is the day the plan is set up, unless workouts were already logged.
    const profile = { ...current.profile, ...patch, ...(hasHistory ? {} : { trainingStartDate: todayInTimeZone(current.profile.timeZone) }) };
    updateState({ ...current, profile, onboarded: true });
    if (current.mode === "supabase" && browserClient) {
      void saveCloudProfile(browserClient, profile).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : "Your profile could not be saved yet.");
      });
    }
  }, [browserClient, updateState]);

  const stageOnboarding = useCallback((patch: Partial<Profile>) => {
    const current = stateRef.current;
    if (current.mode !== "demo") return;
    const hasHistory = current.sessions.some((session) => !session.sampleData && session.status !== "planned");
    const profile = { ...current.profile, ...patch, ...(hasHistory ? {} : { trainingStartDate: todayInTimeZone(current.profile.timeZone) }) };
    writeDemoState({ ...current, profile, onboarded: true });
  }, []);

  const signOut = useCallback(async () => {
    if (!browserClient) return;
    flushDelayedCloudWrites();
    await sessionSaveQueue.current.catch(() => undefined);
    await browserClient.auth.signOut();
    setNotice("You’re signed out. RozFit now saves on this device only.");
  }, [browserClient, flushDelayedCloudWrites]);

  const retryPendingSessions = useCallback(() => {
    for (const session of pendingSessions) void upsertSession(session);
  }, [pendingSessions, upsertSession]);

  const setWeightUnit = useCallback((unit: WeightUnit) => {
    setWeightUnitState(unit);
    try { window.localStorage.setItem(WEIGHT_UNIT_KEY, unit); } catch { /* The choice still applies until the page closes. */ }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* The choice still applies until the page closes. */ }
  }, []);

  const setFigure = useCallback((next: FigureChoice) => {
    setFigureState(next);
    try { window.localStorage.setItem(FIGURE_KEY, next); } catch { /* The choice still applies until the page closes. */ }
  }, []);

  // Sessions that could not sync while offline are sent again as soon as the connection returns.
  useEffect(() => {
    window.addEventListener("online", retryPendingSessions);
    return () => window.removeEventListener("online", retryPendingSessions);
  }, [retryPendingSessions]);

  // Share a small summary (streak, workouts this week, recent workout dates) with friends. Signed-in accounts only.
  const publishedStats = useRef("");
  useEffect(() => {
    if (!ready || state.mode !== "supabase" || !browserClient || !state.profile.id) return;
    const stats = computeFriendStats(state.profile, recordedSessions, currentDate);
    const key = JSON.stringify(stats);
    if (key === publishedStats.current) return;
    const timer = window.setTimeout(() => {
      publishFriendStats(browserClient, stats).then(() => { publishedStats.current = key; }).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [ready, state.mode, state.profile, recordedSessions, currentDate, browserClient]);

  const recordMissedDays = useCallback(async (missed: WorkoutSession[]): Promise<boolean> => {
    const current = stateRef.current;
    let saved = missed;
    if (current.mode === "supabase" && browserClient) {
      try {
        const ids = await Promise.all(missed.map((session) => saveCloudMissedDay(browserClient, session)));
        // A null id means a workout was logged for that day elsewhere; keep the local copy out of the way.
        saved = missed.flatMap((session, index) => ids[index] ? [{ ...session, id: ids[index] as string }] : []);
      } catch (error) {
        // If the database function is not deployed yet, keep the answer on this device so the client is never stuck.
        const code = (error as { code?: string })?.code;
        if (code !== "PGRST202" && code !== "42883") {
          setSaveError(error instanceof Error ? error.message : "RozFit could not save the reason. Try again when you’re back online.");
          return false;
        }
      }
    }
    const latest = stateRef.current;
    const dates = new Set(saved.map((session) => session.date));
    updateState({ ...latest, sessions: [...latest.sessions.filter((session) => !dates.has(session.date)), ...saved].sort((a, b) => a.date.localeCompare(b.date)) });
    return true;
  }, [browserClient, updateState]);

  const value = useMemo<FitTrackContextValue>(() => ({
    state, getState, updateState, ready, isDemo: state.mode === "demo", accountLoading, authChecked, browserClient, currentDate,
    trainerRuleSettings, planningProfile, recordedSessions, notice, setNotice, saveError, savingSession,
    retryPendingSessions, upsertSession, recordMissedDays, updateProfile, completeOnboarding, stageOnboarding, signOut, refreshTrainerClients, weightUnit, setWeightUnit, theme, setTheme, figure, setFigure,
  }), [stageOnboarding, recordMissedDays, state, getState, updateState, ready, accountLoading, authChecked, browserClient, currentDate, trainerRuleSettings, planningProfile,
    recordedSessions, notice, saveError, savingSession, retryPendingSessions, upsertSession, updateProfile, completeOnboarding, signOut, refreshTrainerClients, weightUnit, setWeightUnit, theme, setTheme, figure, setFigure]);

  return <FitTrackContext.Provider value={value}>{children}</FitTrackContext.Provider>;
}
