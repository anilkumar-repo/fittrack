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
  | "barbell" | "smith_machine" | "gym_machines" | "pullup_bar" | "step" | "back_extension" | "cardio_machine";
export type MovementPattern = "squat" | "single_leg" | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull" | "hip_extension" | "hamstring_curl" | "core" | "carry" | "recovery"
  | "shoulder_raise" | "chest_fly" | "arm_curl" | "arm_extension" | "knee_extension" | "calf_raise" | "cardio";
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
  sex?: "female" | "male" | "other";
  /** Why the person started; quoted in comeback reminders. */
  why?: string;
  /** Optional muscle group to give a little extra attention ("balanced" = none). */
  focusArea?: import("./onboarding").FocusArea;
  /** Where the person usually trains; sets the starting equipment list. */
  gymType?: import("./onboarding").GymType;
  /** Profile picture: "photo:<url>", "rozi:<mood>" or "color:<hex>". */
  avatar?: string;
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
  difficulty: ExerciseDifficulty;
  cautionNotes: string[];
  restriction?: ExerciseRestriction;
  movementPattern?: MovementPattern;
  requiredEquipment?: EquipmentKey[];
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
  deadliftEnabled: boolean;
  profile: Profile;
  ruleSettings: TrainerRuleSettings;
  ruleRevision: number;
  audit: TrainerRuleAudit[];
}

export interface WorkoutPlan {
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
  /** Every fourth week is lighter: fewer sets, or a conditioning week for the muscle goal. */
  recoveryWeek?: boolean;
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
