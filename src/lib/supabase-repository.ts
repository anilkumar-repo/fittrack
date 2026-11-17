import type { SupabaseClient } from "@supabase/supabase-js";
import { createDemoState, defaultDisplayName, localTimeZone, todayInTimeZone } from "./demo-data";
import { canAccessOwnerProgress } from "./progress";
import type { BodyWeightEntry, EquipmentKey, ExerciseLog, FitTrackState, MissedReason, Profile, TrainerClient, TrainerRuleAudit, TrainerRuleSettings, WorkoutReview, WorkoutSession } from "./types";
import { createExerciseLog, normalizeWorkoutSession, persistWorkoutSession, type WorkoutPersistencePort } from "./workout-tracking";
import { DEFAULT_TRAINER_RULE_SETTINGS, normalizeTrainerRuleSettings, validateTrainerRuleSettings } from "./trainer-rules";
import { EQUIPMENT_OPTIONS } from "./templates";
import { FOCUS_OPTIONS, GYM_OPTIONS, type FocusArea, type GymType } from "./onboarding";

const FOCUS_IDS = new Set<string>(FOCUS_OPTIONS.map((option) => option.id));
const GYM_IDS = new Set<string>(GYM_OPTIONS.map((option) => option.id));

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
type DbRow = Record<string, unknown>;

/** Starting values for an account with no saved profile yet: the person's own name, time zone, and today as day one. */
export function newAccountProfileDefaults(user: AuthUser, seed?: NewAccountSeed): Profile {
  const base = createDemoState().profile;
  const timeZone = localTimeZone();
  const today = todayInTimeZone(timeZone);
  const earliest = seed?.earliestSessionDate && seed.earliestSessionDate < today ? seed.earliestSessionDate : today;
  const local = seed?.profile;
  return {
    ...base,
    id: user.id,
    displayName: local && local.displayName.trim() && local.displayName !== base.displayName ? local.displayName : defaultDisplayName(user.email),
    timeZone,
    trainingStartDate: earliest,
    sessionsPerWeek: local?.sessionsPerWeek ?? base.sessionsPerWeek,
    trainingDays: local?.trainingDays ?? base.trainingDays,
    preferredSessionMinutes: local?.preferredSessionMinutes ?? base.preferredSessionMinutes,
    equipmentAvailability: local?.equipmentAvailability ?? base.equipmentAvailability,
    availableEquipment: local?.availableEquipment ?? base.availableEquipment,
    goal: local?.goal ?? base.goal,
    experience: local?.experience ?? base.experience,
    // Body details and the "why" from the welcome steps come along too, so the BMI step isn't asked twice.
    ...(local?.heightCm ? { heightCm: local.heightCm } : {}),
    ...(local?.birthYear ? { birthYear: local.birthYear } : {}),
    ...(local?.sex ? { sex: local.sex } : {}),
    ...(local?.why ? { why: local.why } : {}),
    ...(local?.focusArea ? { focusArea: local.focusArea } : {}),
    ...(local?.gymType ? { gymType: local.gymType } : {}),
    ...(typeof local?.shareLifts === "boolean" ? { shareLifts: local.shareLifts } : {}),
    ...(local?.avatar && !local.avatar.startsWith("photo:data:") ? { avatar: local.avatar } : {}),
    deadliftEnabled: false,
    trainerRole: false,
  };
}

/**
 * The profile for a signed-in account: the saved row when there is one; for a brand-new account, the answers
 * from Get started on this device, kept whole. (Running them through mapProfile used to drop everything mapProfile
 * only reads from a database row (height, age, sex, "why", focus, gym, goal, level), so new accounts were saved
 * with defaults and asked for their body details again.)
 */
export function accountProfile(row: DbRow | null, user: AuthUser, trainerRole: boolean, deadliftEnabled: boolean, seed?: NewAccountSeed): Profile {
  if (row) return mapProfile(row, user.id, trainerRole, deadliftEnabled);
  return { ...newAccountProfileDefaults(user, seed), trainerRole, deadliftEnabled };
}

export interface NewAccountSeed {
  /** Settings chosen on this device before signing in. */
  profile?: Profile;
  /** Earliest workout logged on this device that will be carried into the account. */
  earliestSessionDate?: string;
  /** True when the welcome steps were already finished on this device before signing in. */
  onboarded?: boolean;
}

function mapProfile(row: DbRow, id: string, trainerRole: boolean, deadliftEnabled: boolean, defaults: Profile = createDemoState().profile): Profile {
  const validEquipment = new Set<EquipmentKey>(EQUIPMENT_OPTIONS.map((item) => item.id));
  return {
    id,
    displayName: typeof row.display_name === "string" ? row.display_name : defaults.displayName,
    experience: row.experience === "intermediate" || row.experience === "advanced" || row.experience === "pro" ? row.experience : "beginner",
    ...(typeof row.level_since === "string" ? { levelSince: row.level_since } : {}),
    sessionsPerWeek: Number(row.sessions_per_week ?? defaults.sessionsPerWeek),
    trainingDays: Array.isArray(row.training_days) ? row.training_days.map(Number) : defaults.trainingDays,
    trainingStartDate: typeof row.training_start_date === "string" ? row.training_start_date : defaults.trainingStartDate,
    timeZone: typeof row.time_zone === "string" ? row.time_zone : defaults.timeZone,
    deadliftEnabled,
    trainerRole,
    preferredSessionMinutes: Number(row.preferred_session_minutes ?? defaults.preferredSessionMinutes),
    equipmentAvailability: row.equipment_availability === undefined ? defaults.equipmentAvailability : row.equipment_availability === "verified" ? "verified" : "unknown",
    availableEquipment: Array.isArray(row.available_equipment) ? row.available_equipment.filter((item): item is EquipmentKey => typeof item === "string" && validEquipment.has(item as EquipmentKey)) : row.available_equipment === undefined ? defaults.availableEquipment : [],
    goal: row.goal === "muscle" || row.goal === "tone" || row.goal === "fatloss" ? row.goal : "general",
    ...(typeof row.avatar === "string" && row.avatar ? { avatar: row.avatar } : {}),
    ...(row.height_cm !== null && row.height_cm !== undefined ? { heightCm: Number(row.height_cm) } : {}),
    ...(row.birth_year !== null && row.birth_year !== undefined ? { birthYear: Number(row.birth_year) } : {}),
    ...(row.sex === "female" || row.sex === "male" || row.sex === "other" ? { sex: row.sex } : {}),
    ...(typeof row.why === "string" && row.why ? { why: row.why } : {}),
    ...(typeof row.focus_area === "string" && FOCUS_IDS.has(row.focus_area) ? { focusArea: row.focus_area as FocusArea } : {}),
    ...(typeof row.gym_type === "string" && GYM_IDS.has(row.gym_type) ? { gymType: row.gym_type as GymType } : {}),
    ...(typeof row.share_lifts === "boolean" ? { shareLifts: row.share_lifts } : {}),
  };
}

function exerciseLogRow(ownerId: string, sessionId: string, log: ExerciseLog) {
  return {
    session_id: sessionId,
    user_id: ownerId,
    exercise_id: log.exerciseId,
    planned_sets: log.plannedSets,
    planned_reps: log.plannedReps,
    status: log.status,
    substitution_name: log.substitutionName,
    form_quality: log.formQuality,
    notes: log.notes,
    updated_at: new Date().toISOString(),
  };
}

/** Set once the database reports that `save_workout_session` is not deployed, to skip the extra request. */
let atomicSaveUnavailable = false;

function createSupabaseWorkoutPort(client: SupabaseClient): WorkoutPersistencePort {
  return {
    async saveSessionAtomically(_ownerId, session) {
      if (atomicSaveUnavailable) return null;
      const { data, error } = await client.rpc("save_workout_session", {
        p_session: {
          workout_date: session.date,
          status: session.status,
          template_key: session.plan.focus.toLowerCase().replaceAll(" ", "_"),
          template_version: session.plan.templateVersion,
          rule_version: session.plan.ruleVersion,
          plan_snapshot: session.plan,
          check_in: session.checkIn ?? null,
          exercise_logs: session.exerciseLogs,
          review: session.review ?? null,
          completed_at: session.status === "completed" ? session.completedAt ?? new Date().toISOString() : null,
        },
      });
      if (error) {
        // PGRST202: the function is not in the API schema yet. 42883: it does not exist in the database.
        if (error.code === "PGRST202" || error.code === "42883") { atomicSaveUnavailable = true; return null; }
        throw error;
      }
      return typeof data === "string" ? data : null;
    },
    async upsertSession(ownerId, session, status) {
      const { data, error } = await client.from("workout_sessions").upsert({
        user_id: ownerId,
        workout_date: session.date,
        status,
        template_key: session.plan.focus.toLowerCase().replaceAll(" ", "_"),
        template_version: session.plan.templateVersion,
        rule_version: session.plan.ruleVersion,
        plan_snapshot: session.plan,
        check_in: session.checkIn ?? null,
        exercise_logs: session.exerciseLogs,
        review: session.review ?? null,
        completed_at: status === "completed" ? session.completedAt ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,workout_date" }).select("id").single();
      if (error) throw error;
      return String(data.id);
    },
    async upsertCheckIn(ownerId, sessionId, checkIn) {
      const { error } = await client.from("workout_check_ins").upsert({
        session_id: sessionId, user_id: ownerId, energy: checkIn.energy, soreness: checkIn.soreness,
        pain: checkIn.pain, recovery: checkIn.recovery, discomfort_note: checkIn.discomfort, note: checkIn.note,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      if (error) throw error;
    },
    async upsertExerciseLog(ownerId, sessionId, log) {
      const { data, error } = await client.from("workout_exercise_logs").upsert(exerciseLogRow(ownerId, sessionId, log), {
        onConflict: "session_id,exercise_id",
      }).select("id").single();
      if (error) throw error;
      return String(data.id);
    },
    async upsertSets(ownerId, sessionId, exerciseLogId, log) {
      if (!log.sets.length) return;
      const rows = log.sets.map((set, index) => ({
        exercise_log_id: exerciseLogId,
        session_id: sessionId,
        user_id: ownerId,
        set_number: index + 1,
        planned_reps: set.plannedReps,
        actual_reps: set.actualReps,
        load_kg: set.loadKg,
        completed: set.completed,
        is_extra: set.extra,
        set_type: set.kind ?? "normal",
        updated_at: new Date().toISOString(),
      }));
      let { error } = await client.from("workout_set_logs").upsert(rows, { onConflict: "exercise_log_id,set_number" });
      // Before the Phase 4 migration there is no set_type column: save the sets without it.
      if (error && (error.code === "PGRST204" || error.code === "42703")) {
        ({ error } = await client.from("workout_set_logs").upsert(rows.map(({ set_type: _type, ...rest }) => { void _type; return rest; }), { onConflict: "exercise_log_id,set_number" }));
      }
      if (error) throw error;
    },
    async upsertReview(ownerId, sessionId, review) {
      const { error } = await client.from("workout_reviews").upsert({
        session_id: sessionId, user_id: ownerId, effort: review.effort, mood: review.mood,
        energy_after: review.energyAfter, discomfort: review.discomfort,
        discomfort_note: review.discomfortNote, note: review.note, updated_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      if (error) throw error;
    },
    async finalizeSession(ownerId, sessionId, session) {
      const { error } = await client.from("workout_sessions").update({
        status: session.status,
        completed_at: session.status === "completed" ? session.completedAt ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId).eq("user_id", ownerId).select("id").single();
      if (error) throw error;
    },
    async readSessions(ownerId) {
      const { data: sessionRows, error: sessionError } = await client.from("workout_sessions")
        .select("*").eq("user_id", ownerId).order("workout_date", { ascending: false }).limit(300);
      if (sessionError) throw sessionError;
      if (!sessionRows?.length) return [];
      const sessionIds = sessionRows.map((row) => String(row.id));
      const [checkInResult, exerciseResult, setResult, reviewResult] = await Promise.all([
        client.from("workout_check_ins").select("*").eq("user_id", ownerId).in("session_id", sessionIds),
        client.from("workout_exercise_logs").select("*").eq("user_id", ownerId).in("session_id", sessionIds),
        client.from("workout_set_logs").select("*").eq("user_id", ownerId).in("session_id", sessionIds),
        client.from("workout_reviews").select("*").eq("user_id", ownerId).in("session_id", sessionIds),
      ]);
      for (const result of [checkInResult, exerciseResult, setResult, reviewResult]) if (result.error) throw result.error;

      const checkIns = new Map((checkInResult.data ?? []).map((row) => [String(row.session_id), row as DbRow]));
      const reviews = new Map((reviewResult.data ?? []).map((row) => [String(row.session_id), row as DbRow]));
      const setsByExerciseLog = new Map<string, DbRow[]>();
      for (const row of (setResult.data ?? []) as DbRow[]) {
        const key = String(row.exercise_log_id);
        setsByExerciseLog.set(key, [...(setsByExerciseLog.get(key) ?? []), row]);
      }
      const logsBySession = new Map<string, ExerciseLog[]>();
      for (const row of (exerciseResult.data ?? []) as DbRow[]) {
        const sets = (setsByExerciseLog.get(String(row.id)) ?? []).sort((a, b) => Number(a.set_number) - Number(b.set_number));
        const log: ExerciseLog = {
          exerciseId: String(row.exercise_id),
          plannedSets: Number(row.planned_sets),
          plannedReps: Number(row.planned_reps),
          status: row.status as ExerciseLog["status"],
          substitutionName: String(row.substitution_name ?? ""),
          formQuality: row.form_quality === "sound" || row.form_quality === "needs_practice" ? row.form_quality : "not_rated",
          notes: String(row.notes ?? ""),
          sets: sets.map((set) => ({
            plannedReps: set.planned_reps === null ? null : Number(set.planned_reps),
            actualReps: set.actual_reps === null ? null : Number(set.actual_reps),
            loadKg: set.load_kg === null ? null : Number(set.load_kg),
            completed: set.completed === true,
            extra: set.is_extra === true,
            ...(set.set_type === "warmup" || set.set_type === "drop" || set.set_type === "failure" ? { kind: set.set_type } : {}),
          })),
        };
        const key = String(row.session_id);
        logsBySession.set(key, [...(logsBySession.get(key) ?? []), log]);
      }

      return (sessionRows as DbRow[]).map((row) => {
        const plan = row.plan_snapshot as WorkoutSession["plan"];
        const checkInRow = checkIns.get(String(row.id));
        const reviewRow = reviews.get(String(row.id));
        const session: WorkoutSession = {
          id: String(row.id), date: String(row.workout_date), status: row.status as WorkoutSession["status"], plan,
          exerciseLogs: logsBySession.get(String(row.id)) ?? [],
          ...(checkInRow ? { checkIn: {
            energy: Number(checkInRow.energy), soreness: Number(checkInRow.soreness), pain: checkInRow.pain === true,
            recovery: Number(checkInRow.recovery ?? 3), discomfort: String(checkInRow.discomfort_note ?? ""), note: String(checkInRow.note ?? ""),
          } } : {}),
          ...(reviewRow ? { review: {
            effort: Number(reviewRow.effort), mood: reviewRow.mood as WorkoutReview["mood"], energyAfter: Number(reviewRow.energy_after),
            discomfort: reviewRow.discomfort === true, discomfortNote: String(reviewRow.discomfort_note ?? ""), note: String(reviewRow.note ?? ""),
          } } : {}),
          ...(typeof row.completed_at === "string" ? { completedAt: row.completed_at } : {}),
          ...(row.status === "skipped" && typeof row.missed_reason === "string"
            ? { missedReason: { reason: row.missed_reason as MissedReason, note: String(row.missed_note ?? "") } }
            : {}),
        };
        return normalizeWorkoutSession(session);
      }).filter((session): session is WorkoutSession => session !== null);
    },
  };
}

function isMissingBodyWeightTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01";
}

async function readCloudBodyWeightEntries(client: SupabaseClient, ownerId: string): Promise<{ entries: BodyWeightEntry[]; available: boolean }> {
  const { data, error } = await client.from("body_weight_entries").select("id,measured_on,weight_kg")
    .eq("user_id", ownerId).order("measured_on", { ascending: true }).limit(1000);
  if (error) {
    if (isMissingBodyWeightTable(error)) return { entries: [], available: false };
    throw error;
  }
  return {
    entries: (data ?? []).map((row) => ({ id: String(row.id), measuredOn: String(row.measured_on), weightKg: Number(row.weight_kg) })),
    available: true,
  };
}

export async function loadCloudState(client: SupabaseClient, user: AuthUser, seed?: NewAccountSeed): Promise<FitTrackState> {
  const trainerRole = user.app_metadata?.role === "trainer";
  const [{ data: profileRow, error: profileError }, { data: ruleRow, error: ruleError }, sessions, bodyWeight, { data: trainerLinks }] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client.from("trainer_rules").select("deadlift_enabled,rule_settings,rule_revision").eq("user_id", user.id).maybeSingle(),
    createSupabaseWorkoutPort(client).readSessions(user.id),
    readCloudBodyWeightEntries(client, user.id),
    client.from("trainer_clients").select("trainer_id").eq("client_id", user.id).eq("status", "active").limit(1),
  ]);
  if (profileError) throw profileError;
  if (ruleError) throw ruleError;

  const ownRules = normalizeTrainerRuleSettings(ruleRow?.rule_settings ?? DEFAULT_TRAINER_RULE_SETTINGS);
  const profile = accountProfile(profileRow as DbRow | null, user, trainerRole, ruleRow?.deadlift_enabled === true, seed);
  // A saved profile means the welcome steps are done. A brand-new account saves its profile when the
  // person finishes them, or straight away if they already finished them on this device before signing in.
  const onboarded = Boolean(profileRow) || seed?.onboarded === true;
  if (!profileRow && onboarded) await saveCloudProfile(client, profile);

  let trainerClients: TrainerClient[] = [];
  let trainerClientAudit: TrainerRuleAudit[] = [];
  if (trainerRole) {
    const { data: relationships, error: relationshipError } = await client.from("trainer_clients")
      .select("client_id").eq("trainer_id", user.id).eq("status", "active");
    if (relationshipError) throw relationshipError;
    const clientIds = (relationships ?? []).map((row) => String(row.client_id));
    if (clientIds.length) {
      const [{ data: clientProfiles, error: clientProfilesError }, { data: clientRules, error: clientRulesError }, { data: auditRows, error: auditError }] = await Promise.all([
        client.from("profiles").select("*").in("id", clientIds),
        client.from("trainer_rules").select("user_id,deadlift_enabled,rule_settings,rule_revision").in("user_id", clientIds),
        client.from("trainer_rule_audit").select("id,trainer_id,client_id,changed_at,old_rule_settings,new_rule_settings,old_deadlift_enabled,new_deadlift_enabled").in("client_id", clientIds).order("changed_at", { ascending: false }).limit(100),
      ]);
      if (clientProfilesError) throw clientProfilesError;
      if (clientRulesError) throw clientRulesError;
      if (auditError && auditError.code !== "42P01" && auditError.code !== "PGRST205") throw auditError;
      const rules = new Map((clientRules ?? []).map((row) => [String(row.user_id), row as DbRow]));
      trainerClientAudit = ((auditRows ?? []) as DbRow[]).map((row) => ({
        id: String(row.id), trainerId: String(row.trainer_id), clientId: String(row.client_id), changedAt: String(row.changed_at),
        oldSettings: normalizeTrainerRuleSettings(row.old_rule_settings), newSettings: normalizeTrainerRuleSettings(row.new_rule_settings),
        oldDeadliftEnabled: row.old_deadlift_enabled === true, newDeadliftEnabled: row.new_deadlift_enabled === true,
      }));
      trainerClients = (clientProfiles ?? []).map((row) => {
        const id = String(row.id);
        const rule = rules.get(id);
        const ruleSettings = normalizeTrainerRuleSettings(rule?.rule_settings ?? DEFAULT_TRAINER_RULE_SETTINGS);
        const clientProfile = mapProfile(row as DbRow, id, false, rule?.deadlift_enabled === true);
        return {
          id,
          displayName: String(row.display_name ?? "Client"),
          deadliftEnabled: rule?.deadlift_enabled === true,
          profile: clientProfile,
          ruleSettings,
          ruleRevision: Number(rule?.rule_revision ?? 1),
          audit: trainerClientAudit.filter((entry) => entry.clientId === id),
        };
      });
    }
  }

  return {
    profile,
    sessions,
    bodyWeightEntries: bodyWeight.entries,
    bodyWeightAvailable: bodyWeight.available,
    trainerClients,
    trainerRuleSettings: ownRules,
    trainerRuleRevision: Number(ruleRow?.rule_revision ?? 1),
    selectedDate: todayInTimeZone(profile.timeZone),
    onboarded,
    trainerLinked: Boolean(trainerLinks?.length),
    mode: "supabase",
    userEmail: user.email,
  };
}

export async function saveCloudBodyWeightEntry(client: SupabaseClient, userId: string, entry: BodyWeightEntry): Promise<BodyWeightEntry> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user || !canAccessOwnerProgress(userData.user.id, userId)) throw new Error("Your sign-in has expired. Please sign in again.");
  const { data, error } = await client.from("body_weight_entries").upsert({
    user_id: userId,
    measured_on: entry.measuredOn,
    weight_kg: entry.weightKg,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,measured_on" }).select("id,measured_on,weight_kg").single();
  if (error) {
    if (isMissingBodyWeightTable(error)) throw new Error("Apply the Phase 5 Supabase migration before saving body-weight entries.");
    throw error;
  }
  return { id: String(data.id), measuredOn: String(data.measured_on), weightKg: Number(data.weight_kg) };
}

export async function saveCloudProfile(client: SupabaseClient, profile: Profile): Promise<void> {
  const row: Record<string, unknown> = {
    id: profile.id,
    display_name: profile.displayName,
    experience: profile.experience,
    level_since: profile.levelSince ?? null,
    height_cm: profile.heightCm ?? null,
    birth_year: profile.birthYear ?? null,
    sex: profile.sex ?? null,
    why: (profile.why ?? "").slice(0, 200),
    sessions_per_week: profile.sessionsPerWeek,
    training_days: profile.trainingDays,
    training_start_date: profile.trainingStartDate,
    time_zone: profile.timeZone,
    preferred_session_minutes: profile.preferredSessionMinutes,
    equipment_availability: profile.equipmentAvailability,
    available_equipment: profile.availableEquipment,
    goal: profile.goal ?? "general",
    // A device-only photo (data URL) is never sent to the account; cloud photos are stored as links.
    avatar: profile.avatar && !profile.avatar.startsWith("photo:data:") ? profile.avatar : "",
    updated_at: new Date().toISOString(),
    ...(profile.focusArea ? { focus_area: profile.focusArea } : {}),
    ...(profile.gymType ? { gym_type: profile.gymType } : {}),
    ...(typeof profile.shareLifts === "boolean" ? { share_lifts: profile.shareLifts } : {}),
  };
  const { error } = await client.from("profiles").upsert(row, { onConflict: "id" });
  // Before a migration adds the newer optional columns (focus_area, gym_type, share_lifts), save everything else rather than fail.
  if (error && (error.code === "PGRST204" || error.code === "42703") && (row.focus_area || row.gym_type || row.share_lifts !== undefined)) {
    const { focus_area: _focus, gym_type: _gym, share_lifts: _share, ...rest } = row;
    void _focus; void _gym; void _share;
    const { error: retryError } = await client.from("profiles").upsert(rest, { onConflict: "id" });
    if (retryError) throw retryError;
    return;
  }
  if (error) throw error;
}

/** A linked trainer changes a client's goal, training days and session length (checked on the server). */
export async function saveCloudClientPlan(client: SupabaseClient, clientId: string, goal: string, trainingDays: number[], minutes: number, experience?: string): Promise<void> {
  const { error } = await client.rpc("trainer_update_client_plan", { p_client: clientId, p_goal: goal, p_training_days: trainingDays, p_minutes: minutes, ...(experience ? { p_experience: experience } : {}) });
  if (error) throw new Error(error.message);
}

/** Saves the reason for a missed day. Returns the session id, or null if a logged workout already exists for that day. */
export async function saveCloudMissedDay(client: SupabaseClient, session: WorkoutSession): Promise<string | null> {
  if (!session.missedReason) throw new Error("A missed day needs a reason.");
  const { data, error } = await client.rpc("record_missed_workout", {
    p_date: session.date,
    p_reason: session.missedReason.reason,
    p_note: session.missedReason.note,
    p_plan: session.plan,
    p_template_key: session.plan.focus.toLowerCase().replaceAll(" ", "_"),
    p_template_version: session.plan.templateVersion,
    p_rule_version: session.plan.ruleVersion,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}

export async function saveCloudSession(client: SupabaseClient, userId: string, session: WorkoutSession): Promise<WorkoutSession> {
  return persistWorkoutSession(createSupabaseWorkoutPort(client), { id: userId, role: "client" }, userId, session);
}

export async function loadCloudSessions(client: SupabaseClient, actorId: string, ownerId: string): Promise<WorkoutSession[]> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user || userData.user.id !== actorId) throw new Error("Your sign-in has expired. Please sign in again.");
  if (actorId !== ownerId) {
    if (userData.user.app_metadata?.role !== "trainer") throw new Error("Only an authorized trainer can review another account’s workouts.");
    const { data: relationship, error: relationshipError } = await client.from("trainer_clients").select("client_id")
      .eq("trainer_id", actorId).eq("client_id", ownerId).eq("status", "active").maybeSingle();
    if (relationshipError) throw relationshipError;
    if (!relationship) throw new Error("This client is not linked to your trainer account.");
  }
  return createSupabaseWorkoutPort(client).readSessions(ownerId);
}

export async function saveCloudDeadliftRule(client: SupabaseClient, trainerId: string, clientId: string, enabled: boolean): Promise<void> {
  const actor = await authorizeTrainerClientChange(client, trainerId, clientId);
  if (!actor) throw new Error("Only an authenticated trainer with an active client relationship can change this restriction.");
  const { error } = await client.from("trainer_rules").upsert({
    user_id: clientId,
    deadlift_enabled: enabled,
    updated_by: trainerId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

async function authorizeTrainerClientChange(client: SupabaseClient, trainerId: string, clientId: string): Promise<AuthUser | null> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const user = data.user as AuthUser | null;
  if (!user || user.id !== trainerId || user.app_metadata?.role !== "trainer" || trainerId === clientId) return null;
  const { data: relationship, error: relationshipError } = await client.from("trainer_clients").select("client_id")
    .eq("trainer_id", trainerId).eq("client_id", clientId).eq("status", "active").maybeSingle();
  if (relationshipError) throw relationshipError;
  return relationship ? user : null;
}

export async function saveCloudTrainerRuleSettings(
  client: SupabaseClient,
  trainerId: string,
  target: Pick<TrainerClient, "id">,
  settings: TrainerRuleSettings,
): Promise<void> {
  const errors = validateTrainerRuleSettings(settings);
  if (errors.length) throw new Error(errors.join(" "));
  const actor = await authorizeTrainerClientChange(client, trainerId, target.id);
  if (!actor) throw new Error("Only an authenticated trainer with an active client relationship can edit these rules.");
  const { data, error } = await client.from("trainer_rules").update({
    rule_settings: settings,
    updated_by: trainerId,
    updated_at: new Date().toISOString(),
  }).eq("user_id", target.id).select("user_id").maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await client.from("trainer_rules").insert({
    user_id: target.id,
    deadlift_enabled: false,
    rule_settings: settings,
    updated_by: trainerId,
  });
  if (insertError) throw insertError;
}

export function createInitialExerciseLogs(plan: WorkoutSession["plan"]): ExerciseLog[] {
  return plan.exercises.map((exercise) => createExerciseLog(exercise.id, exercise.sets, exercise.reps));
}

function isMissingFunction(error: { code?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883";
}
const NOT_DEPLOYED = "This feature is not switched on for this RozFit database yet. Ask your trainer to apply the latest database update.";

export async function createTrainerInvite(client: SupabaseClient): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await client.rpc("create_trainer_invite");
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { code?: unknown; expires_at?: unknown } | null;
  if (!row || typeof row.code !== "string") throw new Error("The invite code could not be created. Please try again.");
  return { code: row.code, expiresAt: String(row.expires_at ?? "") };
}

export async function acceptTrainerInvite(client: SupabaseClient, code: string): Promise<void> {
  const { error } = await client.rpc("accept_trainer_invite", { p_code: code });
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
}

export async function removeMyTrainers(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("remove_my_trainers");
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
}

export async function deleteMyWorkoutData(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc("delete_my_workout_data");
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
}

// ---------- Water ----------

export interface WaterLog { id: string; ml: number; at: string }

export async function loadCloudWater(client: SupabaseClient, date: string): Promise<WaterLog[]> {
  const { data, error } = await client.from("water_logs").select("id, ml, created_at").eq("logged_on", date).order("created_at");
  if (error) throw new Error(isMissingTable(error) ? NOT_DEPLOYED : error.message);
  return (data ?? []).map((row) => ({ id: String(row.id), ml: Number(row.ml), at: String(row.created_at) }));
}

export async function addCloudWater(client: SupabaseClient, date: string, ml: number): Promise<WaterLog> {
  const { data, error } = await client.from("water_logs").insert({ logged_on: date, ml }).select("id, ml, created_at").single();
  if (error) throw new Error(isMissingTable(error) ? NOT_DEPLOYED : error.message);
  return { id: String(data.id), ml: Number(data.ml), at: String(data.created_at) };
}

export async function removeCloudWater(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("water_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

// ---------- Clients add their own trainers ----------

export async function createClientShareCode(client: SupabaseClient): Promise<{ code: string; expiresAt: string }> {
  const { data, error } = await client.rpc("create_client_share_code");
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { code?: unknown; expires_at?: unknown } | null;
  if (!row || typeof row.code !== "string") throw new Error("The code could not be created. Please try again.");
  return { code: row.code, expiresAt: String(row.expires_at ?? "") };
}

export async function trainerAddClientByCode(client: SupabaseClient, code: string): Promise<void> {
  const { error } = await client.rpc("trainer_add_client_by_code", { p_code: code });
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
}

export interface MyTrainer { id: string; name: string; since: string }

export async function loadMyTrainers(client: SupabaseClient): Promise<MyTrainer[]> {
  const { data, error } = await client.rpc("my_trainers");
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
  return ((data ?? []) as Array<{ trainer_id: string; display_name: string; linked_at: string }>).map((row) => ({ id: row.trainer_id, name: row.display_name, since: row.linked_at }));
}

export async function removeMyTrainer(client: SupabaseClient, trainerId: string): Promise<void> {
  const { error } = await client.rpc("remove_my_trainer", { p_trainer: trainerId });
  if (error) throw new Error(isMissingFunction(error) ? NOT_DEPLOYED : error.message);
}
