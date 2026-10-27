import type { EquipmentKey, ExerciseDefinition, MovementPattern, WorkoutFocus } from "./types";

export const TEMPLATE_VERSION = "2.1.0";
export const RULE_VERSION = "2026.10.27.1";

export const EQUIPMENT_OPTIONS: Array<{ id: EquipmentKey; label: string }> = [
  { id: "dumbbells", label: "Dumbbells" },
  { id: "bench", label: "Bench" },
  { id: "cable_machine", label: "Cable machine" },
  { id: "leg_press", label: "Leg press machine" },
  { id: "leg_curl_machine", label: "Leg curl machine" },
  { id: "rack", label: "Rack" },
  { id: "mat", label: "Exercise mat" },
  { id: "chair", label: "Sturdy chair" },
];

type ExerciseSource = Omit<ExerciseDefinition, "movementPattern" | "requiredEquipment" | "fallbackId" | "instructions" | "targetMuscles" | "difficulty" | "cautionNotes" | "restriction">;

const sourceLibrary: Record<string, ExerciseSource> = {
  goblet_squat: {
    id: "goblet_squat", name: "Goblet squat", equipment: "Dumbbell", category: "strength", sets: 3, reps: "8–10", restSeconds: 90,
    cues: ["Hold the weight close to your chest.", "Sit between your hips and keep your whole foot grounded.", "Stand tall without rushing the last few inches."],
  },
  dumbbell_bench: {
    id: "dumbbell_bench", name: "Dumbbell bench press", equipment: "Bench + dumbbells", category: "strength", sets: 3, reps: "8–10", restSeconds: 90,
    cues: ["Set your feet before you lift.", "Lower the weights beside your chest with control.", "Press up smoothly; keep your wrists stacked over elbows."],
  },
  lat_pulldown: {
    id: "lat_pulldown", name: "Lat pulldown", equipment: "Cable machine", category: "strength", sets: 3, reps: "10–12", restSeconds: 75,
    cues: ["Start with shoulders relaxed, away from your ears.", "Pull the bar toward your upper chest.", "Let the weight return slowly without leaning back."],
  },
  glute_bridge: {
    id: "glute_bridge", name: "Glute bridge", equipment: "No equipment", category: "strength", sets: 2, reps: "10–12", restSeconds: 60,
    cues: ["Keep your ribs relaxed and feet planted.", "Drive through your heels and squeeze your glutes.", "Stop when hips and shoulders form a straight line."],
  },
  dead_bug: {
    id: "dead_bug", name: "Dead bug", equipment: "No equipment", category: "core", sets: 2, reps: "8 each side", restSeconds: 45,
    cues: ["Press your lower back gently into the floor.", "Move one arm and the opposite leg slowly.", "Shorten the range if your back lifts."],
  },
  leg_press: {
    id: "leg_press", name: "Leg press", equipment: "Leg press machine", category: "strength", sets: 3, reps: "10", restSeconds: 90,
    cues: ["Set the seat so knees begin comfortably bent.", "Keep knees tracking in the same direction as toes.", "Lower only as far as your hips stay on the pad."],
  },
  seated_row: {
    id: "seated_row", name: "Seated cable row", equipment: "Cable machine", category: "strength", sets: 3, reps: "10–12", restSeconds: 75,
    cues: ["Sit tall with a soft bend in your knees.", "Pull elbows toward your sides.", "Return until arms are long without rounding your back."],
  },
  shoulder_press: {
    id: "shoulder_press", name: "Seated dumbbell press", equipment: "Bench + dumbbells", category: "strength", sets: 2, reps: "8–10", restSeconds: 75,
    cues: ["Use a comfortable range that feels smooth.", "Keep ribs stacked over hips.", "Press without shrugging your shoulders."],
  },
  hamstring_curl: {
    id: "hamstring_curl", name: "Hamstring curl", equipment: "Leg curl machine", category: "strength", sets: 2, reps: "10–12", restSeconds: 60,
    cues: ["Align the machine pivot with your knee.", "Curl slowly and pause for a moment.", "Return the weight without letting it drop."],
  },
  plank: {
    id: "plank", name: "Incline plank", equipment: "Bench", category: "core", sets: 2, reps: "20–30 sec", restSeconds: 45,
    cues: ["Place hands on a sturdy bench.", "Make a straight line from head to heels.", "Breathe normally and stop before your back sags."],
  },
  split_squat: {
    id: "split_squat", name: "Supported split squat", equipment: "Rack or wall", category: "strength", sets: 2, reps: "8 each side", restSeconds: 75,
    cues: ["Hold a support lightly for balance.", "Take a comfortable split stance.", "Lower straight down only as far as feels controlled."],
  },
  incline_pushup: {
    id: "incline_pushup", name: "Incline push-up", equipment: "Bench or bar", category: "strength", sets: 3, reps: "8–12", restSeconds: 60,
    cues: ["Choose a height that lets you move with control.", "Keep your body in one long line.", "Lower your chest toward your hands and press away."],
  },
  chest_row: {
    id: "chest_row", name: "Chest-supported row", equipment: "Bench + dumbbells", category: "strength", sets: 3, reps: "10", restSeconds: 75,
    cues: ["Set the bench to a slight incline.", "Let arms hang, then draw elbows toward your ribs.", "Keep your chest in contact with the bench."],
  },
  hip_thrust: {
    id: "hip_thrust", name: "Bodyweight hip thrust", equipment: "Bench", category: "strength", sets: 2, reps: "10–12", restSeconds: 60,
    cues: ["Set your upper back against the bench.", "Keep chin gently tucked as hips rise.", "Pause at the top without arching your back."],
  },
  farmer_carry: {
    id: "farmer_carry", name: "Farmer carry", equipment: "Dumbbells", category: "conditioning", sets: 2, reps: "30 sec", restSeconds: 60,
    cues: ["Choose a light load you can hold steadily.", "Walk tall with relaxed shoulders.", "Take short, quiet steps and keep breathing."],
  },
  dumbbell_rdl: {
    id: "dumbbell_rdl", name: "Dumbbell Romanian deadlift", equipment: "Dumbbells", category: "strength", sets: 2, reps: "8", restSeconds: 90,
    cues: ["Use this only after explicit trainer approval.", "Slide weights down your thighs with a soft knee bend.", "Stop at the first comfortable hamstring stretch."],
  },
  bodyweight_squat: {
    id: "bodyweight_squat", name: "Bodyweight squat", equipment: "No equipment", category: "strength", sets: 2, reps: "8–10", restSeconds: 75,
    cues: ["Stand with feet at a comfortable width.", "Lower only through a smooth, comfortable range.", "Stand without rushing."],
  },
  sit_to_stand: {
    id: "sit_to_stand", name: "Sit to stand", equipment: "Sturdy chair", category: "strength", sets: 2, reps: "8–10", restSeconds: 75,
    cues: ["Use a stable chair placed against a wall.", "Lean forward slightly and stand smoothly.", "Sit back down with control."],
  },
  wall_pushup: {
    id: "wall_pushup", name: "Wall push-up", equipment: "Wall", category: "strength", sets: 2, reps: "8–12", restSeconds: 60,
    cues: ["Place hands at chest height on a stable wall.", "Keep your body in one line as you lean in.", "Press away smoothly."],
  },
  prone_lat_pull: {
    id: "prone_lat_pull", name: "Prone arm pull-down", equipment: "No equipment", category: "strength", sets: 2, reps: "8–10", restSeconds: 60,
    cues: ["Lie face down only if that is comfortable.", "Reach overhead, then draw elbows toward your sides.", "Keep the movement small and relaxed."],
  },
  prone_w_raise: {
    id: "prone_w_raise", name: "Prone W raise", equipment: "No equipment", category: "strength", sets: 2, reps: "8–10", restSeconds: 60,
    cues: ["Lie face down only if comfortable.", "Make a W shape with your arms.", "Lift gently without shrugging."],
  },
  wall_slide: {
    id: "wall_slide", name: "Wall slide", equipment: "Wall", category: "strength", sets: 2, reps: "8–10", restSeconds: 60,
    cues: ["Stand comfortably with your back near a wall.", "Slide arms upward only through a pain-free range.", "Keep the motion slow and easy."],
  },
  heel_dig_bridge: {
    id: "heel_dig_bridge", name: "Bridge heel dig", equipment: "No equipment", category: "strength", sets: 2, reps: "8 each side", restSeconds: 60,
    cues: ["Lie on your back with knees comfortably bent.", "Press one heel gently into the floor.", "Stop if the effort causes discomfort."],
  },
  wall_plank: {
    id: "wall_plank", name: "Wall plank", equipment: "Wall", category: "core", sets: 2, reps: "20 sec", restSeconds: 45,
    cues: ["Place forearms on a stable wall at chest height.", "Step back to a comfortable angle.", "Breathe normally and stop before form changes."],
  },
  bodyweight_split_squat: {
    id: "bodyweight_split_squat", name: "Supported bodyweight split squat", equipment: "Wall for balance", category: "strength", sets: 2, reps: "6 each side", restSeconds: 75,
    cues: ["Use a wall lightly for balance.", "Keep your stance comfortable and stable.", "Use a short range and stop if uncomfortable."],
  },
  prone_y_raise: {
    id: "prone_y_raise", name: "Prone Y raise", equipment: "No equipment", category: "strength", sets: 2, reps: "8–10", restSeconds: 60,
    cues: ["Lie face down only if comfortable.", "Reach arms into a relaxed Y shape.", "Lift gently without shrugging."],
  },
  march_in_place: {
    id: "march_in_place", name: "Easy march in place", equipment: "No equipment", category: "conditioning", sets: 2, reps: "30 sec", restSeconds: 45,
    cues: ["Choose a comfortable pace.", "Keep steps quiet and easy.", "Stop if you feel pain, dizziness, or unusual shortness of breath."],
  },
  comfortable_walk: {
    id: "comfortable_walk", name: "Comfortable walk", equipment: "No equipment", category: "conditioning", sets: 1, reps: "10 min", restSeconds: 0,
    cues: ["Keep the pace easy and conversational.", "Choose a familiar, level route if convenient.", "Stop if walking causes discomfort."],
  },
  relaxed_breathing: {
    id: "relaxed_breathing", name: "Relaxed breathing", equipment: "No equipment", category: "core", sets: 1, reps: "2 min", restSeconds: 0,
    cues: ["Sit or lie in a comfortable position.", "Let each breath stay easy; do not force it.", "Stop if the exercise feels uncomfortable."],
  },
};

interface ExerciseMetadata {
  pattern: MovementPattern;
  equipment?: EquipmentKey[];
  fallback?: string;
  targetMuscles: string[];
  difficulty: "beginner" | "intermediate";
  instructions: string[];
  cautions?: string[];
  restriction?: "trainer_deadlift_approval";
}

const metadata: Record<string, ExerciseMetadata> = {
  goblet_squat: {
    pattern: "squat", equipment: ["dumbbells"], fallback: "bodyweight_squat", targetMuscles: ["Quadriceps", "Glutes", "Core"], difficulty: "beginner",
    instructions: ["Stand with feet about shoulder width and hold one dumbbell close to your chest.", "Brace gently and sit your hips down between your feet, keeping your whole foot grounded.", "Lower only as far as you can keep a comfortable, steady position.", "Press through the floor to stand; keep the weight close throughout."],
    cautions: ["Use a comfortable depth and stop if the movement causes pain or dizziness."],
  },
  dumbbell_bench: {
    pattern: "horizontal_push", equipment: ["bench", "dumbbells"], fallback: "wall_pushup", targetMuscles: ["Chest", "Triceps", "Front shoulders"], difficulty: "beginner",
    instructions: ["Sit on a stable bench with the dumbbells resting on your thighs; lie back with feet planted.", "Hold the weights beside your chest with wrists above elbows.", "Press upward smoothly without letting the weights meet forcefully.", "Lower with control until elbows are near the bench, then repeat."],
    cautions: ["Use a load you can control and ask for help setting up if getting into position feels unsafe."],
  },
  lat_pulldown: {
    pattern: "vertical_pull", equipment: ["cable_machine"], fallback: "prone_lat_pull", targetMuscles: ["Lats", "Upper back", "Biceps"], difficulty: "beginner",
    instructions: ["Adjust the thigh pad so it holds you comfortably and sit facing the machine.", "Take a comfortable grip slightly wider than shoulder width and sit tall.", "Pull the bar toward the upper chest while keeping shoulders relaxed.", "Let the bar return slowly until arms are comfortably long."],
    cautions: ["Do not pull behind the neck or lean back to move a heavy load."],
  },
  glute_bridge: {
    pattern: "hip_extension", targetMuscles: ["Glutes", "Hamstrings"], difficulty: "beginner",
    instructions: ["Lie on your back with knees bent and feet flat about hip width apart.", "Gently brace your middle and press through your feet.", "Lift your hips until your body forms a comfortable line from shoulders to knees.", "Pause briefly, then lower slowly without dropping."],
    cautions: ["Stop at a comfortable height; avoid arching your lower back to lift higher."],
  },
  dead_bug: {
    pattern: "core", targetMuscles: ["Core", "Deep abdominals"], difficulty: "beginner",
    instructions: ["Lie on your back with knees above hips and arms reaching toward the ceiling.", "Gently brace so your lower back stays comfortably settled against the floor.", "Slowly lower one arm and the opposite leg only as far as you can keep that position.", "Return to the start and alternate sides with an easy pace."],
    cautions: ["Shorten the range or stop if your back feels uncomfortable."],
  },
  leg_press: {
    pattern: "squat", equipment: ["leg_press"], fallback: "bodyweight_squat", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    instructions: ["Adjust the seat so you can sit with your back supported and knees comfortably bent.", "Place feet about shoulder width on the platform and release the safety handles as instructed by the machine.", "Lower the platform until your hips stay against the pad and the range feels comfortable.", "Press through your feet to return without locking your knees."],
    cautions: ["Use the machine's safety stops and do not let the knees collapse inward or lock at the top."],
  },
  seated_row: {
    pattern: "horizontal_pull", equipment: ["cable_machine"], fallback: "prone_w_raise", targetMuscles: ["Mid back", "Lats", "Biceps"], difficulty: "beginner",
    instructions: ["Sit facing the cable with feet supported and knees softly bent.", "Hold the handle and sit tall with shoulders relaxed.", "Draw elbows toward your sides without rocking your torso.", "Reach forward slowly until arms are comfortably long."],
    cautions: ["Choose a load that lets you stay upright without jerking or rounding your back."],
  },
  shoulder_press: {
    pattern: "vertical_push", equipment: ["bench", "dumbbells"], fallback: "wall_slide", targetMuscles: ["Shoulders", "Triceps"], difficulty: "beginner",
    instructions: ["Sit with back supported and feet on the floor, holding light dumbbells beside your shoulders.", "Keep ribs comfortably stacked over hips and wrists above elbows.", "Press the weights upward through a range that feels smooth.", "Lower slowly to the starting position without shrugging."],
    cautions: ["Use only a comfortable shoulder range; stop if pressing brings on pain."],
  },
  hamstring_curl: {
    pattern: "hamstring_curl", equipment: ["leg_curl_machine"], fallback: "heel_dig_bridge", targetMuscles: ["Hamstrings"], difficulty: "beginner",
    instructions: ["Adjust the machine so its pivot lines up near your knee and the pad rests comfortably above your heel.", "Hold the handles and begin with the leg nearly straight, not forced.", "Bend your knee to bring the pad through a comfortable range.", "Return slowly without letting the weight stack drop."],
    cautions: ["Follow the machine's setup instructions and stop if the knee or hamstring hurts."],
  },
  plank: {
    pattern: "core", equipment: ["bench"], fallback: "wall_plank", targetMuscles: ["Core", "Shoulders"], difficulty: "beginner",
    instructions: ["Place forearms or hands on a stable bench that will not slide.", "Step back until your body makes a comfortable straight line from head to heels.", "Gently brace and breathe normally while holding the position.", "End the hold before your hips sag or your breath becomes strained."],
    cautions: ["Use a wall version if the bench position is too difficult; stop if you feel pain."],
  },
  split_squat: {
    pattern: "single_leg", equipment: ["rack"], fallback: "bodyweight_split_squat", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    instructions: ["Stand beside a stable rack and hold it lightly for balance.", "Step one foot back into a comfortable split stance, feet about hip width apart.", "Bend both knees a small amount while keeping your front foot planted.", "Press through the front foot to stand, then switch sides."],
    cautions: ["Use a short range and stable support; stop if balance or discomfort makes the movement feel unsafe."],
  },
  incline_pushup: {
    pattern: "horizontal_push", equipment: ["bench"], fallback: "wall_pushup", targetMuscles: ["Chest", "Triceps", "Front shoulders"], difficulty: "beginner",
    instructions: ["Place hands on a stable bench about shoulder width apart.", "Walk your feet back until your body forms a straight, comfortable line.", "Bend elbows and lower your chest toward the bench with control.", "Press the bench away and keep your body moving as one unit."],
    cautions: ["Check that the bench cannot tip or slide before starting."],
  },
  chest_row: {
    pattern: "horizontal_pull", equipment: ["bench", "dumbbells"], fallback: "prone_y_raise", targetMuscles: ["Upper back", "Lats", "Biceps"], difficulty: "beginner",
    instructions: ["Set a bench to a slight incline and lie chest-down with feet steady.", "Hold light dumbbells with arms hanging comfortably.", "Draw elbows toward your ribs without lifting your chest off the pad.", "Lower the weights slowly until arms are relaxed again."],
    cautions: ["Use a small, controlled load and stop if lying face down feels uncomfortable."],
  },
  hip_thrust: {
    pattern: "hip_extension", equipment: ["bench"], fallback: "glute_bridge", targetMuscles: ["Glutes", "Hamstrings"], difficulty: "beginner",
    instructions: ["Sit on the floor with your upper back against a stable bench and feet planted.", "Keep chin gently tucked and knees bent comfortably.", "Press through your feet to lift hips until your torso is nearly level.", "Pause, then lower with control without over-arching."],
    cautions: ["Make sure the bench is stable and use a floor bridge if this setup feels uncomfortable."],
  },
  farmer_carry: {
    pattern: "carry", equipment: ["dumbbells"], fallback: "march_in_place", targetMuscles: ["Grip", "Traps", "Core"], difficulty: "beginner",
    instructions: ["Place two light dumbbells beside you and stand with feet steady.", "Pick them up by bending comfortably at your hips and knees, then stand tall.", "Walk with short, quiet steps and shoulders relaxed.", "Set the weights down with control before resting."],
    cautions: ["Start very light and use a clear walking path; stop if grip, back, or balance feels uncomfortable."],
  },
  dumbbell_rdl: {
    pattern: "hip_extension", equipment: ["dumbbells"], targetMuscles: ["Hamstrings", "Glutes", "Back stabilizers"], difficulty: "intermediate", restriction: "trainer_deadlift_approval",
    instructions: ["This movement is only available after explicit trainer approval.", "Stand with light dumbbells close to your thighs and knees softly bent.", "Move hips back while the weights travel close to your legs; keep the range small and controlled.", "Stand by bringing hips forward without leaning back."],
    cautions: ["This is a deadlift variation and remains restricted until a trainer explicitly approves it. Stop if there is pain; do not use this guide as a substitute for trainer instruction."],
  },
  bodyweight_squat: {
    pattern: "squat", targetMuscles: ["Quadriceps", "Glutes", "Core"], difficulty: "beginner",
    instructions: ["Stand with feet at a comfortable width and arms relaxed in front.", "Sit hips back and bend knees while keeping your whole foot on the floor.", "Pause at a depth where you feel steady and comfortable.", "Press through the floor to stand smoothly."],
    cautions: ["Hold a stable support if helpful and use a comfortable range."],
  },
  sit_to_stand: {
    pattern: "squat", equipment: ["chair"], targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    instructions: ["Place a sturdy chair against a wall and sit near the front with feet under your knees.", "Lean your chest forward slightly while keeping your back comfortable.", "Press through your feet to stand without rushing.", "Reach hips back and sit down slowly."],
    cautions: ["Check that the chair cannot slide; use your hands for support if needed."],
  },
  wall_pushup: {
    pattern: "horizontal_push", targetMuscles: ["Chest", "Triceps", "Front shoulders"], difficulty: "beginner",
    instructions: ["Stand an arm's length from a stable wall and place hands at chest height.", "Step back slightly and keep your body in one comfortable line.", "Bend elbows to bring your chest toward the wall.", "Press through your hands to return smoothly."],
    cautions: ["Use a distance that feels easy to control; stop if the movement causes pain."],
  },
  prone_lat_pull: {
    pattern: "vertical_pull", targetMuscles: ["Lats", "Upper back"], difficulty: "beginner",
    instructions: ["Lie face down only if that position is comfortable, with arms reaching overhead.", "Gently draw elbows down toward your sides while keeping shoulders away from your ears.", "Pause briefly without straining your neck.", "Reach overhead slowly to return."],
    cautions: ["Skip this version if lying face down is uncomfortable; choose a standing wall slide or trainer-approved alternative."],
  },
  prone_w_raise: {
    pattern: "horizontal_pull", targetMuscles: ["Upper back", "Rear shoulders"], difficulty: "beginner",
    instructions: ["Lie face down only if comfortable, with forehead resting on a folded towel if available.", "Bend elbows so your arms make a relaxed W shape.", "Lift hands and elbows a small distance while drawing shoulder blades gently together.", "Lower slowly and relax between repetitions."],
    cautions: ["Keep the lift small; skip if lying face down causes discomfort."],
  },
  wall_slide: {
    pattern: "vertical_push", targetMuscles: ["Shoulders", "Upper back"], difficulty: "beginner",
    instructions: ["Stand comfortably with your back near a wall and arms bent in a goalpost shape.", "Keep ribs relaxed and slide hands upward only as far as comfortable.", "Pause without forcing the shoulders against the wall.", "Slide arms down slowly to the start."],
    cautions: ["Do not force the arms overhead; use a smaller range if needed."],
  },
  heel_dig_bridge: {
    pattern: "hamstring_curl", targetMuscles: ["Hamstrings", "Glutes"], difficulty: "beginner",
    instructions: ["Lie on your back with knees bent and heels resting on the floor.", "Press one heel gently into the floor as if drawing it toward you without moving it.", "Hold briefly while breathing normally, then release.", "Alternate sides; keep the effort comfortable."],
    cautions: ["Use light pressure and stop if the hamstring or back feels uncomfortable."],
  },
  wall_plank: {
    pattern: "core", targetMuscles: ["Core", "Shoulders"], difficulty: "beginner",
    instructions: ["Place forearms on a stable wall at chest height.", "Step back until your body forms a comfortable straight line.", "Gently brace and keep breathing while you hold.", "Step closer to the wall or finish before your position changes."],
    cautions: ["Use a stable, clear wall area and stop if you feel pain or dizziness."],
  },
  bodyweight_split_squat: {
    pattern: "single_leg", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    instructions: ["Stand beside a wall and use it lightly for balance.", "Step one foot back into a comfortable split stance.", "Bend both knees a small amount while keeping the front foot grounded.", "Press through the front foot to stand, then switch sides."],
    cautions: ["Use a short range and stop if balance or discomfort makes this feel unsafe."],
  },
  prone_y_raise: {
    pattern: "horizontal_pull", targetMuscles: ["Upper back", "Rear shoulders"], difficulty: "beginner",
    instructions: ["Lie face down only if comfortable, arms reaching in a relaxed Y shape.", "Keep your forehead supported and shoulders away from your ears.", "Lift your hands a small distance without arching your back.", "Lower slowly and rest between repetitions."],
    cautions: ["Skip if lying face down is uncomfortable; keep the lift small and easy."],
  },
  march_in_place: {
    pattern: "carry", targetMuscles: ["Calves", "Hip flexors"], difficulty: "beginner",
    instructions: ["Stand near a sturdy support if you would like balance assistance.", "March slowly, lifting each foot only as high as comfortable.", "Keep steps quiet and breathe normally.", "Continue at an easy pace, then slow down before stopping."],
    cautions: ["Stop if you feel pain, dizziness, or unusual shortness of breath."],
  },
  comfortable_walk: {
    pattern: "carry", targetMuscles: ["Legs", "Calves"], difficulty: "beginner",
    instructions: ["Choose a familiar, level route or a clear indoor path.", "Walk at a pace that lets you speak comfortably.", "Keep steps natural and shoulders relaxed.", "Slow down or stop if the walk no longer feels comfortable."],
    cautions: ["Stop for pain, dizziness, or unusual shortness of breath."],
  },
  relaxed_breathing: {
    pattern: "core", targetMuscles: ["No specific muscle focus"], difficulty: "beginner",
    instructions: ["Sit or lie in a position that feels comfortable.", "Let your shoulders and jaw relax.", "Breathe gently at your own pace without forcing a deep breath.", "Stop whenever the exercise feels uncomfortable."],
  },
};

function decorate(id: string): ExerciseDefinition {
  const exercise = sourceLibrary[id];
  const data = metadata[id];
  return {
    ...exercise,
    cues: [...exercise.cues],
    instructions: [...data.instructions],
    targetMuscles: [...data.targetMuscles],
    difficulty: data.difficulty,
    cautionNotes: [...(data.cautions ?? [])],
    restriction: data.restriction,
    movementPattern: data.pattern,
    requiredEquipment: [...(data.equipment ?? [])],
    fallbackId: data.fallback,
  };
}

export const EXERCISE_LIBRARY: ExerciseDefinition[] = Object.keys(sourceLibrary).map(decorate);

const sessionTemplates: Record<Exclude<WorkoutFocus, "Return to training" | "Recovery">, string[]> = {
  "Foundation A": ["goblet_squat", "dumbbell_bench", "lat_pulldown", "glute_bridge", "dead_bug"],
  "Foundation B": ["leg_press", "seated_row", "shoulder_press", "hamstring_curl", "plank"],
  "Foundation C": ["split_squat", "incline_pushup", "chest_row", "hip_thrust", "farmer_carry"],
};

export function getExerciseDefinition(id: string): ExerciseDefinition | undefined {
  return sourceLibrary[id] ? decorate(id) : undefined;
}

export function getTemplateExercises(focus: Exclude<WorkoutFocus, "Return to training" | "Recovery">): ExerciseDefinition[] {
  return sessionTemplates[focus].map(decorate);
}

export function getOptionalDeadliftExercise(): ExerciseDefinition {
  return decorate("dumbbell_rdl");
}

export function getRecoveryExercises(): ExerciseDefinition[] {
  return [decorate("comfortable_walk"), decorate("relaxed_breathing")];
}
