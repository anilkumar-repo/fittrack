import type { SupabaseClient } from "@supabase/supabase-js";
import { createDemoState } from "./demo-data";
import { canAccessOwnerProgress } from "./progress";
import type { BodyWeightEntry, EquipmentKey, ExerciseLog, FitTrackState, Profile, TrainerClient, TrainerRuleAudit, TrainerRuleSettings, WorkoutReview, WorkoutSession } from "./types";
import { createExerciseLog, normalizeWorkoutSession, persistWorkoutSession, type WorkoutPersistencePort } from "./workout-tracking";
import { DEFAULT_TRAINER_RULE_SETTINGS, normalizeTrainerRuleSettings, validateTrainerRuleSettings } from "./trainer-rules";

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };
type DbRow = Record<string, unknown>;

function mapProfile(row: DbRow, id: string, trainerRole: boolean, deadliftEnabled: boolean): Profile {
  const defaults = createDemoState().profile;
  const validEquipment = new Set<EquipmentKey>(["dumbbells", "bench", "cable_machine", "leg_press", "leg_curl_machine", "rack", "mat", "chair"]);
  return {
    id,
    displayName: typeof row.display_name === "string" ? row.display_name : defaults.displayName,
    experience: row.experience === "intermediate" ? "intermediate" : "beginner",
    sessionsPerWeek: Number(row.sessions_per_week ?? defaults.sessionsPerWeek),
    trainingDays: Array.isArray(row.training_days) ? row.training_days.map(Number) : defaults.trainingDays,
    trainingStartDate: typeof row.training_start_date === "string" ? row.training_start_date : defaults.trainingStartDate,
    timeZone: typeof row.time_zone === "string" ? row.time_zone : defaults.timeZone,
    deadliftEnabled,
    trainerRole,
    preferredSessionMinutes: Number(row.preferred_session_minutes ?? defaults.preferredSessionMinutes),
    equipmentAvailability: row.equipment_availability === "verified" ? "verified" : "unknown",
    availableEquipment: Array.isArray(row.available_equipment) ? row.available_equipment.filter((item): item is EquipmentKey => typeof item === "string" && validEquipment.has(item as EquipmentKey)) : [],
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

function createSupabaseWorkoutPort(client: SupabaseClient): WorkoutPersistencePort {
  return {
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
      const { error } = await client.from("workout_set_logs").upsert(log.sets.map((set, index) => ({
        exercise_log_id: exerciseLogId,
        session_id: sessionId,
        user_id: ownerId,
        set_number: index + 1,
        planned_reps: set.plannedReps,
        actual_reps: set.actualReps,
        load_kg: set.loadKg,
        completed: set.completed,
        is_extra: set.extra,
        updated_at: new Date().toISOString(),
      })), { onConflict: "exercise_log_id,set_number" });
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

export async function loadCloudState(client: SupabaseClient, user: AuthUser): Promise<FitTrackState> {
  const trainerRole = user.app_metadata?.role === "trainer";
  const defaults = createDemoState();
  const [{ data: profileRow, error: profileError }, { data: ruleRow, error: ruleError }, sessions, bodyWeight] = await Promise.all([
    client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client.from("trainer_rules").select("deadlift_enabled,rule_settings,rule_revision").eq("user_id", user.id).maybeSingle(),
    createSupabaseWorkoutPort(client).readSessions(user.id),
    readCloudBodyWeightEntries(client, user.id),
  ]);
  if (profileError) throw profileError;
  if (ruleError) throw ruleError;

  const ownRules = normalizeTrainerRuleSettings(ruleRow?.rule_settings ?? DEFAULT_TRAINER_RULE_SETTINGS);
  const profile = mapProfile((profileRow ?? {}) as DbRow, user.id, trainerRole, ruleRow?.deadlift_enabled === true);
  const { error: upsertError } = await client.from("profiles").upsert({
    id: user.id,
    display_name: profile.displayName,
    experience: profile.experience,
    sessions_per_week: profile.sessionsPerWeek,
    training_days: profile.trainingDays,
    training_start_date: profile.trainingStartDate,
    time_zone: profile.timeZone,
    preferred_session_minutes: profile.preferredSessionMinutes,
    equipment_availability: profile.equipmentAvailability,
    available_equipment: profile.availableEquipment,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id", ignoreDuplicates: true });
  if (upsertError) throw upsertError;

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
    selectedDate: defaults.selectedDate,
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
  const { error } = await client.from("profiles").upsert({
    id: profile.id,
    display_name: profile.displayName,
    experience: profile.experience,
    sessions_per_week: profile.sessionsPerWeek,
    training_days: profile.trainingDays,
    training_start_date: profile.trainingStartDate,
    time_zone: profile.timeZone,
    preferred_session_minutes: profile.preferredSessionMinutes,
    equipment_availability: profile.equipmentAvailability,
    available_equipment: profile.availableEquipment,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (error) throw error;
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
