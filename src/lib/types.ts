export type ExperienceLevel = "beginner" | "intermediate";
export type SessionStatus = "planned" | "in_progress" | "completed" | "skipped";
export type ExerciseStatus = "not_started" | "partial" | "completed" | "skipped";
export type WorkoutFocus = "Foundation A" | "Foundation B" | "Foundation C" | "Return to training" | "Recovery";
export type TrainingPhase = "foundation_1" | "foundation_2" | "return";
export type ExerciseDifficulty = "beginner" | "intermediate";
export type ExerciseRestriction = "trainer_deadlift_approval";
export type EquipmentKey = "dumbbells" | "bench" | "cable_machine" | "leg_press" | "leg_curl_machine" | "rack" | "mat" | "chair";
export type MovementPattern = "squat" | "single_leg" | "horizontal_push" | "vertical_push" | "horizontal_pull" | "vertical_pull" | "hip_extension" | "hamstring_curl" | "core" | "carry" | "recovery";
export type ProgressionAction = "choose_comfortable_load" | "hold_load_add_reps" | "consider_small_load_step" | "repeat_or_reduce" | "recovery";
export type FormQuality = "not_rated" | "sound" | "needs_practice";

export interface Profile {
  id: string;
  displayName: string;
  experience: ExperienceLevel;
  sessionsPerWeek: number;
  trainingDays: number[];
  trainingStartDate: string;
  timeZone: string;
  deadliftEnabled: boolean;
  trainerRole: boolean;
  preferredSessionMinutes: number;
  equipmentAvailability: "unknown" | "verified";
  availableEquipment: EquipmentKey[];
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
  /** Marks built-in demonstration fixtures so progress never treats them as trainee logs. */
  sampleData?: boolean;
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
  mode: "demo" | "supabase";
  userEmail?: string;
}
