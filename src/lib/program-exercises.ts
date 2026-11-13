import type { EquipmentKey, ExerciseDefinition, MovementPattern } from "./types";

/**
 * Exercises added for the goal-based programs (Build muscle and Get fit & toned), including extra core work.
 * Each one lists a fallback so the plan still works when its equipment is missing.
 */
export interface ProgramExercise {
  id: string;
  name: string;
  equipment: string;
  category: ExerciseDefinition["category"];
  sets: number;
  reps: string;
  restSeconds: number;
  pattern: MovementPattern;
  needs?: EquipmentKey[];
  fallback?: string;
  targetMuscles: string[];
  difficulty: "beginner" | "intermediate";
  cues: string[];
  instructions: string[];
  cautions?: string[];
  restriction?: "trainer_deadlift_approval";
}

const PAIN_STOP = "Stop if the movement causes pain, dizziness or unusual symptoms.";

export const PROGRAM_EXERCISES: ProgramExercise[] = [
  // Push
  {
    id: "barbell_bench", name: "Barbell bench press", equipment: "Barbell + bench", category: "strength", sets: 3, reps: "6–10", restSeconds: 150,
    pattern: "horizontal_push", needs: ["barbell", "bench"], fallback: "dumbbell_bench", targetMuscles: ["Chest", "Triceps", "Front shoulders"], difficulty: "intermediate",
    cues: ["Feet planted, shoulder blades pulled back.", "Lower the bar to mid-chest with control.", "Press up and slightly back over your shoulders."],
    instructions: ["Lie on the bench with eyes under the bar and feet flat.", "Grip slightly wider than shoulder width and unrack with straight arms.", "Lower the bar to your mid-chest, elbows about 45° from your body.", "Press back up to straight arms without bouncing off the chest."],
    cautions: ["Use safety bars or a spotter for working sets.", PAIN_STOP],
  },
  {
    id: "incline_db_press", name: "Incline dumbbell press", equipment: "Bench + dumbbells", category: "strength", sets: 3, reps: "8–12", restSeconds: 90,
    pattern: "horizontal_push", needs: ["bench", "dumbbells"], fallback: "pushup", targetMuscles: ["Upper chest", "Front shoulders", "Triceps"], difficulty: "beginner",
    cues: ["Set the bench to a low incline.", "Lower the weights beside your upper chest.", "Press up and slightly together."],
    instructions: ["Set the bench to about 30° and sit with the dumbbells on your thighs.", "Lie back and hold the weights beside your upper chest.", "Press up until arms are straight without clanking the weights.", "Lower slowly to the start."],
    cautions: [PAIN_STOP],
  },
  {
    id: "machine_shoulder_press", name: "Machine shoulder press", equipment: "Shoulder press machine", category: "strength", sets: 3, reps: "8–12", restSeconds: 90,
    pattern: "vertical_push", needs: ["gym_machines"], fallback: "shoulder_press", targetMuscles: ["Shoulders", "Triceps"], difficulty: "beginner",
    cues: ["Handles start at shoulder height.", "Press up without shrugging.", "Lower under control."],
    instructions: ["Adjust the seat so the handles sit at shoulder height.", "Sit tall with your back on the pad.", "Press the handles up until arms are nearly straight.", "Lower slowly to the start."],
    cautions: [PAIN_STOP],
  },
  {
    id: "lateral_raise", name: "Dumbbell lateral raise", equipment: "Dumbbells", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "shoulder_raise", needs: ["dumbbells"], fallback: "wall_slide", targetMuscles: ["Side shoulders"], difficulty: "beginner",
    cues: ["Light weights, soft elbows.", "Lift out to the side to shoulder height.", "Lower slowly; no swinging."],
    instructions: ["Stand tall holding light dumbbells at your sides.", "Keep a slight bend in your elbows.", "Raise the weights out to the side until they reach shoulder height.", "Lower slowly over two to three seconds."],
    cautions: ["Use light weights; stop if you feel a pinch at the top of the shoulder."],
  },
  {
    id: "cable_lateral_raise", name: "Cable lateral raise", equipment: "Cable machine", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "shoulder_raise", needs: ["cable_machine"], fallback: "lateral_raise", targetMuscles: ["Side shoulders"], difficulty: "beginner",
    cues: ["Stand side-on to a low pulley.", "Lead with the elbow.", "Stop at shoulder height."],
    instructions: ["Set the pulley low and hold the handle with the far hand.", "Stand side-on with a slight lean away from the machine.", "Raise the arm out to the side up to shoulder height.", "Lower slowly, then switch sides."],
    cautions: [PAIN_STOP],
  },
  {
    id: "cable_fly", name: "Cable chest fly", equipment: "Cable machine", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "chest_fly", needs: ["cable_machine"], fallback: "dumbbell_fly", targetMuscles: ["Chest", "Front shoulders"], difficulty: "beginner",
    cues: ["Soft bend in the elbows throughout.", "Bring hands together in front of your chest.", "Feel the stretch, but don't force it."],
    instructions: ["Set both pulleys at shoulder height and take a handle in each hand.", "Step forward into a split stance with a slight forward lean.", "Bring your hands together in a wide arc in front of your chest.", "Open slowly until you feel a comfortable chest stretch."],
    cautions: [PAIN_STOP],
  },
  {
    id: "pec_deck", name: "Pec deck", equipment: "Pec deck machine", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "chest_fly", needs: ["gym_machines"], fallback: "cable_fly", targetMuscles: ["Chest"], difficulty: "beginner",
    cues: ["Handles at chest height.", "Squeeze together, pause.", "Return slowly."],
    instructions: ["Adjust the seat so the handles line up with your chest.", "Sit tall with your back on the pad.", "Bring the handles together in front of you.", "Return slowly until you feel a comfortable stretch."],
    cautions: [PAIN_STOP],
  },
  {
    id: "dumbbell_fly", name: "Dumbbell fly", equipment: "Bench + dumbbells", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "chest_fly", needs: ["bench", "dumbbells"], fallback: "wall_pushup", targetMuscles: ["Chest"], difficulty: "beginner",
    cues: ["Light weights, soft elbows.", "Open in a wide arc.", "Stop at a comfortable stretch."],
    instructions: ["Lie on a flat bench with light dumbbells above your chest, palms facing.", "Keep a slight bend in your elbows.", "Open your arms in a wide arc until you feel a mild chest stretch.", "Bring the weights back together over your chest."],
    cautions: ["Keep the weights light; stop if the shoulder feels strained."],
  },
  {
    id: "triceps_pushdown", name: "Cable triceps pushdown", equipment: "Cable machine", category: "strength", sets: 3, reps: "10–15", restSeconds: 60,
    pattern: "arm_extension", needs: ["cable_machine"], fallback: "db_triceps_extension", targetMuscles: ["Triceps"], difficulty: "beginner",
    cues: ["Elbows pinned to your sides.", "Push down until arms are straight.", "Let it rise slowly."],
    instructions: ["Set the pulley high and hold the bar with palms down.", "Stand tall with elbows tucked at your sides.", "Push the bar down until your arms are straight.", "Let it rise slowly to about chest height."],
    cautions: [PAIN_STOP],
  },
  {
    id: "rope_pushdown", name: "Rope triceps pushdown", equipment: "Cable machine + rope", category: "strength", sets: 3, reps: "10–15", restSeconds: 60,
    pattern: "arm_extension", needs: ["cable_machine"], fallback: "db_triceps_extension", targetMuscles: ["Triceps"], difficulty: "beginner",
    cues: ["Elbows stay still.", "Split the rope at the bottom.", "Control the way up."],
    instructions: ["Attach a rope to a high pulley and hold both ends.", "Keep elbows close to your sides.", "Push down and spread the rope ends apart at the bottom.", "Return slowly to the start."],
    cautions: [PAIN_STOP],
  },
  {
    id: "overhead_cable_extension", name: "Overhead cable triceps extension", equipment: "Cable machine", category: "strength", sets: 2, reps: "10–15", restSeconds: 60,
    pattern: "arm_extension", needs: ["cable_machine"], fallback: "db_triceps_extension", targetMuscles: ["Triceps (long head)"], difficulty: "beginner",
    cues: ["Face away from the machine.", "Elbows point forward.", "Straighten fully, return slowly."],
    instructions: ["Hold a rope from a low or mid pulley and turn to face away.", "Bring your hands behind your head, elbows pointing forward.", "Straighten your arms overhead.", "Bend slowly back to the start."],
    cautions: [PAIN_STOP],
  },
  {
    id: "db_triceps_extension", name: "Dumbbell overhead triceps extension", equipment: "Dumbbell", category: "strength", sets: 2, reps: "10–15", restSeconds: 60,
    pattern: "arm_extension", needs: ["dumbbells"], fallback: "wall_pushup", targetMuscles: ["Triceps"], difficulty: "beginner",
    cues: ["Hold one dumbbell with both hands.", "Elbows point up.", "Lower behind your head slowly."],
    instructions: ["Sit or stand tall holding one dumbbell overhead with both hands.", "Keep elbows pointing up and close to your head.", "Lower the weight behind your head by bending the elbows.", "Straighten your arms to lift it back up."],
    cautions: [PAIN_STOP],
  },
  {
    id: "pushup", name: "Push-up", equipment: "No equipment", category: "strength", sets: 3, reps: "10", restSeconds: 60,
    pattern: "horizontal_push", fallback: "incline_pushup", targetMuscles: ["Chest", "Triceps", "Front shoulders", "Core"], difficulty: "beginner",
    cues: ["Body in one straight line.", "Chest toward the floor.", "Raise your hands on a bench if needed."],
    instructions: ["Place hands slightly wider than your shoulders.", "Step back into a straight line from head to heels.", "Lower your chest toward the floor with elbows angled back.", "Press away to straight arms."],
    cautions: ["Elevate your hands on a bench or wall to make it easier."],
  },
  // Pull
  {
    id: "barbell_row", name: "Barbell row", equipment: "Barbell", category: "strength", sets: 3, reps: "8–12", restSeconds: 120,
    pattern: "horizontal_pull", needs: ["barbell"], fallback: "chest_row", targetMuscles: ["Mid back", "Lats", "Biceps"], difficulty: "intermediate",
    cues: ["Hinge forward with a flat back.", "Pull the bar to your lower ribs.", "Lower without rounding."],
    instructions: ["Hold the bar with an overhand grip, hands just wider than your knees.", "Push hips back and lean forward with a flat, braced back.", "Pull the bar to your lower ribs, squeezing your shoulder blades.", "Lower it under control without rounding your back."],
    cautions: ["Use the chest-supported row if your lower back gets tired.", PAIN_STOP],
  },
  {
    id: "face_pull", name: "Cable face pull", equipment: "Cable machine + rope", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "horizontal_pull", needs: ["cable_machine"], fallback: "prone_y_raise", targetMuscles: ["Rear shoulders", "Upper back"], difficulty: "beginner",
    cues: ["Rope at face height.", "Pull toward your forehead, elbows high.", "Squeeze, then return slowly."],
    instructions: ["Set a rope at about face height and hold the ends with palms facing down.", "Step back until arms are straight.", "Pull the rope toward your forehead, elbows high and wide.", "Return slowly to the start."],
    cautions: [PAIN_STOP],
  },
  {
    id: "single_arm_cable_row", name: "Single-arm cable row", equipment: "Cable machine", category: "strength", sets: 2, reps: "10–12 each side", restSeconds: 60,
    pattern: "horizontal_pull", needs: ["cable_machine"], fallback: "one_arm_db_row", targetMuscles: ["Lats", "Mid back", "Biceps"], difficulty: "beginner",
    cues: ["Stay square to the machine.", "Pull elbow back past your ribs.", "Reach long at the front."],
    instructions: ["Set a pulley at chest height and hold the handle in one hand.", "Stand or sit tall facing the machine.", "Pull your elbow back past your side without twisting.", "Reach forward slowly, then switch sides."],
    cautions: [PAIN_STOP],
  },
  {
    id: "one_arm_db_row", name: "One-arm dumbbell row", equipment: "Dumbbell + bench", category: "strength", sets: 2, reps: "10–12 each side", restSeconds: 60,
    pattern: "horizontal_pull", needs: ["dumbbells", "bench"], fallback: "prone_w_raise", targetMuscles: ["Lats", "Mid back", "Biceps"], difficulty: "beginner",
    cues: ["Support yourself on the bench.", "Pull the dumbbell to your hip.", "Lower with control."],
    instructions: ["Place one hand and knee on a bench with your back flat.", "Hold a dumbbell in the other hand with your arm straight.", "Pull the weight toward your hip.", "Lower slowly, then switch sides."],
    cautions: [PAIN_STOP],
  },
  {
    id: "straight_arm_pulldown", name: "Straight-arm pulldown", equipment: "Cable machine", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "vertical_pull", needs: ["cable_machine"], fallback: "prone_lat_pull", targetMuscles: ["Lats"], difficulty: "beginner",
    cues: ["Arms long, slight elbow bend.", "Sweep the bar to your thighs.", "Ribs stay down."],
    instructions: ["Set a bar or rope on a high pulley.", "Step back, hinge slightly and hold it with long arms.", "Sweep it down to your thighs, keeping arms nearly straight.", "Let it rise slowly to eye level."],
    cautions: [PAIN_STOP],
  },
  {
    id: "assisted_pullup", name: "Assisted pull-up", equipment: "Pull-up bar or assisted machine", category: "strength", sets: 3, reps: "5", restSeconds: 90,
    pattern: "vertical_pull", needs: ["pullup_bar"], fallback: "lat_pulldown", targetMuscles: ["Lats", "Upper back", "Biceps"], difficulty: "beginner",
    cues: ["Use enough assistance for clean reps.", "Pull your chest toward the bar.", "Lower all the way, slowly."],
    instructions: ["Use an assisted machine or a band looped over the bar.", "Hang with arms straight and shoulders away from your ears.", "Pull until your chin is over the bar.", "Lower slowly to straight arms."],
    cautions: ["Use a lat pulldown instead if you can't control the lowering.", PAIN_STOP],
  },
  {
    id: "ez_curl", name: "EZ-bar biceps curl", equipment: "EZ bar", category: "strength", sets: 3, reps: "8–12", restSeconds: 60,
    pattern: "arm_curl", needs: ["barbell"], fallback: "db_curl", targetMuscles: ["Biceps"], difficulty: "beginner",
    cues: ["Elbows by your sides.", "Curl without swinging.", "Lower slowly."],
    instructions: ["Stand tall holding the EZ bar with palms up.", "Keep elbows close to your sides.", "Curl the bar toward your shoulders.", "Lower it slowly to straight arms."],
    cautions: [PAIN_STOP],
  },
  {
    id: "db_curl", name: "Dumbbell biceps curl", equipment: "Dumbbells", category: "strength", sets: 2, reps: "10–15", restSeconds: 60,
    pattern: "arm_curl", needs: ["dumbbells"], targetMuscles: ["Biceps"], difficulty: "beginner",
    cues: ["Palms face forward.", "Elbows still.", "Slow on the way down."],
    instructions: ["Stand tall holding dumbbells at your sides, palms forward.", "Keep elbows close to your body.", "Curl the weights up toward your shoulders.", "Lower slowly to straight arms."],
    cautions: [PAIN_STOP],
  },
  {
    id: "hammer_curl", name: "Dumbbell hammer curl", equipment: "Dumbbells", category: "strength", sets: 2, reps: "10–12", restSeconds: 60,
    pattern: "arm_curl", needs: ["dumbbells"], fallback: "db_curl", targetMuscles: ["Biceps", "Forearms"], difficulty: "beginner",
    cues: ["Palms face each other.", "Curl straight up.", "Control the way down."],
    instructions: ["Hold dumbbells at your sides with palms facing in.", "Keep elbows by your sides.", "Curl the weights up, keeping palms facing in.", "Lower slowly."],
    cautions: [PAIN_STOP],
  },
  {
    id: "preacher_curl", name: "EZ-bar preacher curl", equipment: "EZ bar + preacher bench", category: "strength", sets: 3, reps: "8–12", restSeconds: 60,
    pattern: "arm_curl", needs: ["barbell", "bench"], fallback: "db_curl", targetMuscles: ["Biceps"], difficulty: "beginner",
    cues: ["Upper arms flat on the pad.", "Curl up smoothly.", "Don't drop into the bottom."],
    instructions: ["Sit at the preacher bench with your upper arms on the pad.", "Hold the EZ bar with palms up.", "Curl the bar up toward your shoulders.", "Lower slowly, stopping just short of locking out."],
    cautions: [PAIN_STOP],
  },
  {
    id: "incline_db_curl", name: "Incline dumbbell curl", equipment: "Bench + dumbbells", category: "strength", sets: 2, reps: "10–12", restSeconds: 60,
    pattern: "arm_curl", needs: ["bench", "dumbbells"], fallback: "db_curl", targetMuscles: ["Biceps"], difficulty: "beginner",
    cues: ["Lean back on an incline bench.", "Arms hang straight down.", "Curl without moving the elbows."],
    instructions: ["Set the bench to about 45° and lie back holding dumbbells.", "Let your arms hang straight down.", "Curl the weights up without moving your elbows forward.", "Lower slowly to a full stretch."],
    cautions: [PAIN_STOP],
  },
  {
    id: "reverse_curl", name: "Reverse curl", equipment: "EZ bar or dumbbells", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "arm_curl", needs: ["dumbbells"], targetMuscles: ["Forearms", "Biceps"], difficulty: "beginner",
    cues: ["Palms face down.", "Wrists stay straight.", "Light weight, slow reps."],
    instructions: ["Hold the weights with palms facing down.", "Keep elbows by your sides and wrists straight.", "Curl up toward your shoulders.", "Lower slowly."],
    cautions: [PAIN_STOP],
  },
  {
    id: "wrist_curl", name: "Wrist curl", equipment: "Dumbbells", category: "strength", sets: 2, reps: "12–15", restSeconds: 45,
    pattern: "arm_curl", needs: ["dumbbells"], targetMuscles: ["Forearms"], difficulty: "beginner",
    cues: ["Forearms rest on your thighs.", "Palms up.", "Small, controlled range."],
    instructions: ["Sit with forearms on your thighs, palms up, wrists past your knees.", "Hold light dumbbells.", "Curl your wrists up.", "Lower slowly."],
    cautions: [PAIN_STOP],
  },
  {
    id: "reverse_wrist_curl", name: "Reverse wrist curl", equipment: "Dumbbells", category: "strength", sets: 2, reps: "12–15", restSeconds: 45,
    pattern: "arm_curl", needs: ["dumbbells"], targetMuscles: ["Forearms"], difficulty: "beginner",
    cues: ["Palms face down.", "Lift the back of the hand.", "Very light weight."],
    instructions: ["Sit with forearms on your thighs, palms down, wrists past your knees.", "Hold light dumbbells.", "Lift the backs of your hands up.", "Lower slowly."],
    cautions: [PAIN_STOP],
  },
  // Legs
  {
    id: "back_squat", name: "Barbell squat", equipment: "Barbell + rack", category: "strength", sets: 3, reps: "6–10", restSeconds: 150,
    pattern: "squat", needs: ["barbell", "rack"], fallback: "smith_squat", targetMuscles: ["Quadriceps", "Glutes", "Core"], difficulty: "intermediate",
    cues: ["Bar on your upper back, brace.", "Sit down between your hips.", "Drive up through the whole foot."],
    instructions: ["Set the bar in the rack at upper-chest height and step under it.", "Rest it on your upper back, brace and step back.", "Squat down with knees tracking over your toes to a controlled depth.", "Drive up through your whole foot."],
    cautions: ["Set the safety bars just below your lowest depth.", PAIN_STOP],
  },
  {
    id: "smith_squat", name: "Smith machine squat", equipment: "Smith machine", category: "strength", sets: 3, reps: "8–10", restSeconds: 120,
    pattern: "squat", needs: ["smith_machine"], fallback: "goblet_squat", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Feet slightly in front of the bar.", "Sit straight down.", "Stand tall without locking knees."],
    instructions: ["Set the bar at shoulder height and step under it.", "Place feet shoulder-width, slightly in front of the bar.", "Unhook and squat down to a comfortable depth.", "Push back up, then re-hook the bar."],
    cautions: ["Set the machine's safety stops before you start.", PAIN_STOP],
  },
  {
    id: "hack_squat", name: "Hack squat", equipment: "Hack squat machine", category: "strength", sets: 3, reps: "8–12", restSeconds: 120,
    pattern: "squat", needs: ["gym_machines"], fallback: "smith_squat", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Back flat on the pad.", "Lower until thighs are about parallel.", "Press through the whole foot."],
    instructions: ["Stand on the platform with back and shoulders on the pads.", "Release the safety handles.", "Lower until your thighs are about parallel.", "Press back up without locking your knees."],
    cautions: [PAIN_STOP],
  },
  {
    id: "bulgarian_split_squat", name: "Bulgarian split squat", equipment: "Bench (+ dumbbells)", category: "strength", sets: 3, reps: "8–10 each leg", restSeconds: 90,
    pattern: "single_leg", needs: ["bench"], fallback: "reverse_lunge", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "intermediate",
    cues: ["Back foot on the bench.", "Drop straight down.", "Front heel stays down."],
    instructions: ["Stand in front of a bench and rest your back foot on it.", "Hop the front foot forward so you can lower straight down.", "Lower until your back knee nears the floor.", "Push through the front foot to stand. Switch legs after the set."],
    cautions: ["Hold a support for balance at first.", PAIN_STOP],
  },
  {
    id: "reverse_lunge", name: "Supported reverse lunge", equipment: "Wall or rack for balance", category: "strength", sets: 3, reps: "8–10 each leg", restSeconds: 75,
    pattern: "single_leg", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Hold a support lightly.", "Step back, drop the back knee.", "Push through the front foot."],
    instructions: ["Stand tall next to a support.", "Step one foot back and lower your back knee toward the floor.", "Keep your front knee over your foot.", "Push through the front foot to step back up. Alternate legs."],
    cautions: [PAIN_STOP],
  },
  {
    id: "step_up", name: "Step-up", equipment: "Step platform or bench", category: "strength", sets: 2, reps: "8–10 each leg", restSeconds: 75,
    pattern: "single_leg", needs: ["step"], fallback: "reverse_lunge", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Whole foot on the step.", "Stand up through the top leg.", "Step down slowly."],
    instructions: ["Place one whole foot on a stable step.", "Press through that foot to stand up on the step.", "Bring the other foot up, then step down slowly.", "Finish the reps, then switch legs."],
    cautions: ["Use a low, stable step to start.", PAIN_STOP],
  },
  {
    id: "leg_extension", name: "Leg extension", equipment: "Leg extension machine", category: "strength", sets: 2, reps: "12–15", restSeconds: 60,
    pattern: "knee_extension", needs: ["gym_machines"], fallback: "sit_to_stand", targetMuscles: ["Quadriceps"], difficulty: "beginner",
    cues: ["Knee lines up with the pivot.", "Straighten and pause.", "Lower slowly."],
    instructions: ["Adjust the seat so your knee lines up with the machine pivot.", "Place the pad just above your ankles.", "Straighten your legs and pause briefly.", "Lower slowly."],
    cautions: [PAIN_STOP],
  },
  {
    id: "calf_raise", name: "Standing calf raise", equipment: "Wall or step", category: "strength", sets: 3, reps: "12–20", restSeconds: 45,
    pattern: "calf_raise", targetMuscles: ["Calves"], difficulty: "beginner",
    cues: ["Rise high onto your toes.", "Pause at the top.", "Lower slowly."],
    instructions: ["Stand with the balls of your feet on a step or flat floor, holding a support.", "Rise up onto your toes as high as you can.", "Pause for a moment.", "Lower slowly, letting your heels dip if on a step."],
    cautions: [PAIN_STOP],
  },
  {
    id: "db_glute_bridge", name: "Dumbbell glute bridge", equipment: "Dumbbell", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "hip_extension", needs: ["dumbbells"], fallback: "glute_bridge", targetMuscles: ["Glutes", "Hamstrings"], difficulty: "beginner",
    cues: ["Weight rests on your hips.", "Drive through your heels.", "Squeeze at the top."],
    instructions: ["Lie on your back with knees bent and a dumbbell resting across your hips.", "Hold the weight in place with both hands.", "Press through your heels to lift your hips.", "Pause at the top, then lower slowly."],
    cautions: [PAIN_STOP],
  },
  {
    id: "slider_leg_curl", name: "Sliding leg curl", equipment: "Towel or sliders", category: "strength", sets: 2, reps: "8–10", restSeconds: 60,
    pattern: "hamstring_curl", targetMuscles: ["Hamstrings", "Glutes"], difficulty: "beginner",
    cues: ["Heels on a towel on a smooth floor.", "Hips up, pull heels in.", "Slide out slowly."],
    instructions: ["Lie on your back with heels on a towel or sliders.", "Lift your hips into a bridge.", "Pull your heels toward you while keeping hips up.", "Slide your feet out slowly. Drop the hips between reps if needed."],
    cautions: ["Do only the slide-out part at first if the full move is too hard.", PAIN_STOP],
  },
  {
    id: "back_extension", name: "Back extension (glute focus)", equipment: "Hyperextension bench", category: "strength", sets: 2, reps: "10–12", restSeconds: 60,
    pattern: "hip_extension", needs: ["back_extension"], fallback: "glute_bridge", targetMuscles: ["Glutes", "Hamstrings", "Lower back"], difficulty: "intermediate",
    cues: ["Pad just below your hips.", "Hinge down slowly.", "Rise until your body is in a line — no further."],
    instructions: ["Set the pad so your hips are free to bend.", "Cross your arms over your chest.", "Lower your upper body by bending at the hips.", "Squeeze your glutes to rise until your body is straight; don't arch back."],
    cautions: ["Add this only once your trainer is happy with your hip hinge.", PAIN_STOP],
  },
  {
    id: "barbell_rdl", name: "Barbell Romanian deadlift", equipment: "Barbell", category: "strength", sets: 3, reps: "8–12", restSeconds: 120,
    pattern: "hip_extension", needs: ["barbell"], fallback: "dumbbell_rdl", targetMuscles: ["Hamstrings", "Glutes", "Back stabilizers"], difficulty: "intermediate", restriction: "trainer_deadlift_approval",
    cues: ["Only after trainer approval.", "Bar slides down your thighs.", "Stop at a comfortable hamstring stretch."],
    instructions: ["This movement is only available after explicit trainer approval.", "Hold the bar at hip height with soft knees.", "Push hips back while the bar stays close to your legs.", "Stand tall by bringing hips forward."],
    cautions: ["This is a deadlift variation and stays locked until your trainer approves it.", PAIN_STOP],
  },
  // Core
  {
    id: "floor_plank", name: "Plank", equipment: "Mat", category: "core", sets: 3, reps: "30–60 sec", restSeconds: 45,
    pattern: "core", fallback: "plank", targetMuscles: ["Core", "Shoulders"], difficulty: "beginner",
    cues: ["Elbows under shoulders.", "Straight line head to heels.", "Breathe; stop before your hips sag."],
    instructions: ["Rest on your forearms with elbows under your shoulders.", "Step your feet back into a straight line.", "Brace gently and breathe normally.", "Hold, and end the set before your hips sag."],
    cautions: ["Drop to your knees or use a bench to make it easier."],
  },
  {
    id: "side_plank", name: "Side plank", equipment: "Mat", category: "core", sets: 2, reps: "20–30 sec each side", restSeconds: 45,
    pattern: "core", targetMuscles: ["Obliques", "Core", "Hips"], difficulty: "beginner",
    cues: ["Elbow under shoulder.", "Hips up in a straight line.", "Knees down to make it easier."],
    instructions: ["Lie on your side with your elbow under your shoulder.", "Stack your feet, or bend your knees for an easier version.", "Lift your hips so your body forms a straight line.", "Hold, then switch sides."],
    cautions: [PAIN_STOP],
  },
  {
    id: "bird_dog", name: "Bird dog", equipment: "Mat", category: "core", sets: 2, reps: "8 each side", restSeconds: 45,
    pattern: "core", targetMuscles: ["Core", "Lower back", "Glutes"], difficulty: "beginner",
    cues: ["Hands under shoulders, knees under hips.", "Reach the opposite arm and leg.", "Keep your back still."],
    instructions: ["Kneel on all fours with a flat back.", "Reach one arm forward and the opposite leg back.", "Pause without letting your hips twist.", "Return and switch sides."],
    cautions: [PAIN_STOP],
  },
  {
    id: "pallof_press", name: "Pallof press", equipment: "Cable machine or band", category: "core", sets: 2, reps: "10 each side", restSeconds: 45,
    pattern: "core", needs: ["cable_machine"], fallback: "side_plank", targetMuscles: ["Obliques", "Core"], difficulty: "beginner",
    cues: ["Stand side-on to the cable.", "Press straight out.", "Don't let it twist you."],
    instructions: ["Set a cable at chest height and stand side-on, holding the handle at your chest.", "Step away until you feel tension.", "Press the handle straight out and hold for a breath.", "Bring it back in. Switch sides after the set."],
    cautions: [PAIN_STOP],
  },
  {
    id: "cable_crunch", name: "Cable crunch", equipment: "Cable machine + rope", category: "core", sets: 3, reps: "12–15", restSeconds: 45,
    pattern: "core", needs: ["cable_machine"], fallback: "reverse_crunch", targetMuscles: ["Abs"], difficulty: "beginner",
    cues: ["Kneel facing the cable.", "Curl your ribs toward your hips.", "Hips stay still."],
    instructions: ["Kneel facing a high pulley, holding a rope beside your head.", "Keep your hips still.", "Curl down, bringing your ribs toward your hips.", "Rise slowly to the start."],
    cautions: [PAIN_STOP],
  },
  {
    id: "hanging_knee_raise", name: "Hanging knee raise", equipment: "Pull-up bar", category: "core", sets: 3, reps: "10–15", restSeconds: 45,
    pattern: "core", needs: ["pullup_bar"], fallback: "reverse_crunch", targetMuscles: ["Abs", "Hip flexors"], difficulty: "intermediate",
    cues: ["Hang still; no swinging.", "Lift knees toward your chest.", "Lower slowly."],
    instructions: ["Hang from a bar with straight arms.", "Brace to stop swinging.", "Raise your knees toward your chest.", "Lower slowly."],
    cautions: ["Use the reverse crunch if your grip or shoulders tire first.", PAIN_STOP],
  },
  {
    id: "reverse_crunch", name: "Reverse crunch", equipment: "Mat", category: "core", sets: 3, reps: "10–15", restSeconds: 45,
    pattern: "core", targetMuscles: ["Abs"], difficulty: "beginner",
    cues: ["Lie with knees bent over hips.", "Curl hips off the floor.", "Lower slowly."],
    instructions: ["Lie on your back with knees bent and lifted over your hips.", "Press your arms into the floor.", "Curl your hips up off the floor a little.", "Lower slowly without dropping."],
    cautions: [PAIN_STOP],
  },
  // Cardio
  {
    id: "easy_cardio", name: "Easy cardio", equipment: "Treadmill, bike, elliptical or rower", category: "conditioning", sets: 1, reps: "20 min", restSeconds: 0,
    pattern: "cardio", targetMuscles: ["Heart and lungs", "Legs"], difficulty: "beginner",
    cues: ["Easy, chatty pace.", "Any machine or a brisk walk.", "Finish feeling fresh."],
    instructions: ["Choose a treadmill, bike, elliptical, rower or a brisk outdoor walk.", "Warm up for two to three minutes.", "Keep a pace where you can still talk in full sentences.", "Ease off for the last minute."],
    cautions: ["Stop for pain, dizziness or unusual shortness of breath."],
  },
];
