export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "pro";
export type SessionStatus = "planned" | "in_progress" | "completed" | "skipped";
export type ExerciseStatus = "not_started" | "partial" | "completed" | "skipped";
export type WorkoutFocus =
  | "Foundation A" | "Foundation B" | "Foundation C"
  | "Push A" | "Pull A" | "Legs A" | "Push B" | "Pull B" | "Legs B"
  | "Lower A" | "Upper A" | "Lower B" | "Upper B"
  | "Conditioning circuit" | "Core and cardio"
  | "Burn A" | "Cardio and core" | "Burn B" | "Intervals and core"
  | "Return to training" | "Recovery" | "Your routine";
/** What the client wants from training; it picks the weekly split. */
export type TrainingGoal = "general" | "muscle" | "tone" | "fatloss";
export type TrainingPhase = "foundation_1" | "foundation_2" | "return";
export type ExerciseDifficulty = "beginner" | "intermediate";
export type ExerciseRestriction = "trainer_deadlift_approval";
export type EquipmentKey = "dumbbells" | "bench" | "cable_machine" | "leg_press" | "leg_curl_machine" | "rack" | "mat" | "chair"
  | "barbell" | "smith_machine" | "gym_machines" | "pullup_bar" | "step" | "back_extension" | "cardio_machine"
  | "resistance_band" | "kettlebell";
export type MovementPattern = "squat" | "single_leg" | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull" | "hip_extension" | "hamstring_curl" | "core" | "carry" | "recovery"
  | "shoulder_raise" | "chest_fly" | "arm_curl" | "arm_extension" | "knee_extension" | "calf_raise" | "cardio";
/**
 * What a set's number means for an exercise: reps, seconds (holds such as a plank), minutes (cardio such as a walk) or
 * rounds (intervals). The number is stored the same way for all of them (actualReps / plannedReps).
 */
export type TrackingUnit = "reps" | "seconds" | "minutes" | "rounds";
export interface ExerciseTracking {
  unit: TrackingUnit;
  /** Cardio that can also log a distance (walk, run, ride). */
  distance?: boolean;
}

/** Controlled muscle values for filters and Rozi; `targetMuscles` keeps the friendly display text. */
export type TargetMuscle = "chest" | "lats" | "upper_back" | "traps" | "lower_back" | "shoulders" | "rear_shoulders" | "biceps" | "triceps"
  | "forearms" | "abs" | "obliques" | "core" | "glutes" | "quads" | "hamstrings" | "hips" | "calves" | "cardio" | "relaxation";
export type ProgressionAction = "choose_comfortable_load" | "hold_load_add_reps" | "consider_small_load_step" | "repeat_or_reduce" | "recovery";
export type FormQuality = "not_rated" | "sound" | "needs_practice";

export interface Profile {
  id: string;
  displayName: string;
  /** Fitness level; it moves up by itself with steady training (see levels.ts). */
  experience: ExperienceLevel;
  /** Day the current level started. Missing means the training start date. */
  levelSince?: string;
  sessionsPerWeek: number;
  trainingDays: number[];
  trainingStartDate: string;
  timeZone: string;
  deadliftEnabled: boolean;
  trainerRole: boolean;
  preferredSessionMinutes: number;
  equipmentAvailability: "unknown" | "verified";
  availableEquipment: EquipmentKey[];
  /** Missing on older saved profiles; treated as "general". */
  goal?: TrainingGoal;
  /** Body stats from Get started (for BMI and targets). Weight lives in body-weight entries. */
  heightCm?: number;
  birthYear?: number;
  /** Optional full date of birth (YYYY-MM-DD). Confirms 18+ when the birth year alone can't (see isAdultOn). */
  birthDate?: string;
  sex?: "female" | "male" | "other";
  /** Why the person started; quoted in comeback reminders. */
  why?: string;
  /** Optional muscle group to give a little extra attention ("balanced" = none). */
  focusArea?: import("./onboarding").FocusArea;
  /** How active a typical day is, outside workouts (onboarding question; see onboarding.ts ACTIVITY_OPTIONS). */
  dailyActivity?: import("./onboarding").DailyActivity;
  /** Where the person usually trains; sets the starting equipment list. */
  gymType?: import("./onboarding").GymType;
  /**
   * Set while in a buddy group (Train together): sessions follow the calendar from this date, so every buddy
   * gets the same session on the same day even if someone skipped. Managed by the database.
   */
  buddyAnchor?: string;
  /** Public profile (Phase 7): @username, short bio, and whether people can find you (always off under 18). */
  username?: string;
  bio?: string;
  findable?: boolean;
  /** Monday of a week your trainer made lighter: fewer sets, the same session (Train together stays in step). */
  lightWeekStart?: string;
  /** R14 coach review: plan changes you approved (or let Rozi apply). See src/lib/coach-plan.ts. */
  planAdjustments?: import("./coach-plan").PlanAdjustments;
  /** Profile picture: "photo:<url>", "rozi:<mood>" or "color:<hex>". */
  avatar?: string;
  /** Share best lifts with friends (exercise leaderboard). Unset = on, or off for anyone under 18. */
  shareLifts?: boolean;
}

export interface TrainerRuleSettings {
  exerciseTemplates: Array<{
    exerciseId: string;
    sets: number;
    minReps: number;
    maxReps: number;
    restSeconds: number;
  }>;
  progression: {
    repIncrement: number;
    smallLoadStepKg: number;
  };
  recovery: {
    stopEnergyThreshold: number;
    stopRecoveryThreshold: number;
    stopSorenessThreshold: number;
    lowEnergyVolumeThreshold: number;
    highSorenessVolumeThreshold: number;
    repeatedHighSorenessSessions: number;
    volumeReductionSets: number;
  };
  equipment: {
    mode: "inherit" | "unknown" | "verified";
    availableEquipment: EquipmentKey[];
  };
}

export interface TrainerRuleAudit {
  id: string;
  trainerId: string;
  clientId: string;
  changedAt: string;
  oldSettings: TrainerRuleSettings;
  newSettings: TrainerRuleSettings;
  oldDeadliftEnabled: boolean;
  newDeadliftEnabled: boolean;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  equipment: string;
  category: "strength" | "core" | "conditioning";
  sets: number;
  reps: string;
  restSeconds: number;
  cues: string[];
  instructions: string[];
  targetMuscles: string[];
  /** `targetMuscles` as controlled values, main muscle first. Set on every library exercise; may be missing on old saved copies. */
  muscles?: TargetMuscle[];
  /** Other names people use ("RDL", "military press"). Searched like the name. */
  aliases?: string[];
  /** How sets are counted (reps, seconds, minutes or rounds). Set on every library exercise; missing on old saved copies means reps. */
  tracking?: ExerciseTracking;
  /** Exercises that are versions of the same movement share a group ("bench_press", "squat"). */
  variationGroup?: string;
  difficulty: ExerciseDifficulty;
  cautionNotes: string[];
  restriction?: ExerciseRestriction;
  movementPattern?: MovementPattern;
  requiredEquipment?: EquipmentKey[];
  /** Other equipment that works instead of `requiredEquipment` (each entry is a full set), e.g. a kettlebell for a goblet squat. */
  equipmentAlternatives?: EquipmentKey[][];
  fallbackId?: string;
  substitutedFor?: string;
  manualOverride?: boolean;
  selectionReason?: string;
  progressionAdvice?: string;
  loadGuidance?: string;
  progressionAction?: ProgressionAction;
}

export interface ExerciseLog {
  exerciseId: string;
  plannedSets: number;
  plannedReps: number;
  status: ExerciseStatus;
  substitutionName: string;
  formQuality: FormQuality;
  sets: Array<{
    plannedReps: number | null;
    actualReps: number | null;
    loadKg: number | null;
    completed: boolean;
    extra: boolean;
    /** Distance in kilometres, for cardio that tracks it (R5). Missing or null means none. */
    distanceKm?: number | null;
    /** Set type (Phase 4): warm-up, drop set or to failure. Missing means a normal working set. */
    kind?: "warmup" | "drop" | "failure";
  }>;
  notes: string;
}

export interface CheckIn {
  energy: number;
  soreness: number;
  pain: boolean;
  recovery: number;
  discomfort: string;
  note: string;
}

export interface WorkoutReview {
  effort: number;
  mood: "better" | "same" | "tougher";
  energyAfter: number;
  discomfort: boolean;
  discomfortNote: string;
  note: string;
}

export interface TrainerClient {
  id: string;
  displayName: string;
  avatar?: string;
  /** What this client lets the trainer see (Phase 6). */
  shares?: import("./trainers").TrainerShares;
  /** Latest body weight, only when the client shares body details. */
  weightKg?: number;
  deadliftEnabled: boolean;
  profile: Profile;
  ruleSettings: TrainerRuleSettings;
  ruleRevision: number;
  audit: TrainerRuleAudit[];
}

export interface WorkoutPlan {
  /** R14: the lighter week is one the person accepted in their coach review (not the trainer's). */
  ownLightWeek?: boolean;
  /** R14: the coach changes this plan was built with (coach-key.ts); absent = none. */
  coachKey?: string;
  id: string;
  date: string;
  focus: WorkoutFocus;
  title: string;
  description: string;
  durationMinutes: number;
  exercises: ExerciseDefinition[];
  isReturnSession: boolean;
  sessionNumber: number;
  templateVersion: string;
  ruleVersion: string;
  phase: TrainingPhase;
  sessionType: "training" | "recovery";
  sourceExerciseIds: string[];
  originalExercises: Array<{ id: string; name: string; sets: number; reps: string; equipment: string }>;
  generationReasons: string[];
  trainerRuleRevision?: number;
  trainerRuleSettings?: TrainerRuleSettings;
  /** Goal-based programs: the goal, week of the training year (1–52) and its stage name. */
  goal?: TrainingGoal;
  weekNumber?: number;
  stage?: string;
  /** Fitness level the plan was made for. */
  level?: ExperienceLevel;
  /** A shortened "Quick 20-min version" of the day's session (Train together catch-up). */
  quick?: boolean;
  /** Every fourth week is lighter: fewer sets, or a conditioning week for the muscle goal. */
  recoveryWeek?: boolean;
  /** Your trainer made this week lighter. */
  lightWeek?: boolean;
}

export interface WorkoutSession {
  id: string;
  date: string;
  status: SessionStatus;
  plan: WorkoutPlan;
  checkIn?: CheckIn;
  exerciseLogs: ExerciseLog[];
  review?: WorkoutReview;
  completedAt?: string;
  /** Why a planned day was missed; only on sessions with status "skipped". */
  missedReason?: MissedReasonEntry;
  /** Marks built-in demonstration fixtures so progress never treats them as trainee logs. */
  sampleData?: boolean;
}

export type MissedReason = "busy" | "unwell" | "tired" | "sore" | "travel" | "forgot" | "other";

export interface MissedReasonEntry {
  reason: MissedReason;
  /** Optional detail; required when the reason is "other". */
  note: string;
}

export interface BodyWeightEntry {
  id: string;
  measuredOn: string;
  weightKg: number;
}

export interface FitTrackState {
  profile: Profile;
  sessions: WorkoutSession[];
  bodyWeightEntries: BodyWeightEntry[];
  bodyWeightAvailable: boolean;
  trainerClients?: TrainerClient[];
  trainerRuleSettings?: TrainerRuleSettings;
  trainerRuleRevision?: number;
  selectedDate: string;
  /** False until the welcome steps are finished (or skipped) for this profile. */
  onboarded?: boolean;
  /** True when a trainer has an active link to this signed-in account. */
  trainerLinked?: boolean;
  mode: "demo" | "supabase";
  userEmail?: string;
}
