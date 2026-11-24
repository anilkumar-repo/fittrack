import type { ProgramExercise } from "./program-exercises.ts";

/**
 * Exercise library expansion (R6), added in reviewed batches. IDs are permanent once released: saved plans, routines,
 * logs and Rozi actions refer to them. The list of what to add, and why, is in docs/EXERCISE_LIBRARY_COVERAGE.md.
 * Muscle words must exist in MUSCLE_TEXT (exercise-taxonomy.ts); the reps text sets the tracking unit.
 */

const PAIN_STOP = "Stop if the movement causes pain, dizziness or unusual symptoms.";

/** Batch A (2026-11-23): upper body. 22 exercises. */
export const BATCH_A_UPPER: ProgramExercise[] = [
  // Chest
  {
    id: "machine_chest_press", name: "Machine chest press", equipment: "Chest press machine", category: "strength", sets: 3, reps: "10–12", restSeconds: 90,
    pattern: "horizontal_push", needs: ["gym_machines"], fallback: "dumbbell_bench", targetMuscles: ["Chest", "Front shoulders", "Triceps"], difficulty: "beginner",
    cues: ["Handles level with mid-chest.", "Shoulder blades back against the pad.", "Press smoothly; don't lock your elbows hard."],
    instructions: ["Set the seat so the handles line up with the middle of your chest.", "Sit tall with your back on the pad and feet flat.", "Press the handles forward until your arms are almost straight.", "Bring them back slowly until you feel a gentle chest stretch."],
    cautions: ["Start with a light pin setting to learn the path.", PAIN_STOP],
  },
  {
    id: "barbell_incline_bench", name: "Barbell incline bench press", equipment: "Barbell + incline bench", category: "strength", sets: 3, reps: "6–10", restSeconds: 150,
    pattern: "horizontal_push", needs: ["barbell", "bench"], fallback: "incline_db_press", targetMuscles: ["Upper chest", "Front shoulders", "Triceps"], difficulty: "intermediate",
    cues: ["Bench at a low incline (about 30°).", "Lower the bar to your upper chest.", "Press up and slightly back."],
    instructions: ["Set an adjustable bench to a low incline and lie back with eyes under the bar.", "Grip a little wider than your shoulders and unrack with straight arms.", "Lower the bar under control to your upper chest.", "Press back up over your shoulders without bouncing."],
    cautions: ["Use safety bars or a spotter for working sets.", PAIN_STOP],
  },
  {
    id: "close_grip_bench", name: "Close-grip bench press", equipment: "Barbell + bench", category: "strength", sets: 3, reps: "8–10", restSeconds: 120,
    pattern: "horizontal_push", needs: ["barbell", "bench"], fallback: "pushup", targetMuscles: ["Triceps", "Chest", "Front shoulders"], difficulty: "intermediate",
    cues: ["Hands about shoulder width, not touching.", "Elbows stay close to your sides.", "Touch your lower chest, then press."],
    instructions: ["Lie on the bench with feet flat and grip the bar about shoulder-width apart.", "Unrack with straight arms over your shoulders.", "Lower the bar to your lower chest, keeping elbows tucked in.", "Press back up until your arms are straight."],
    cautions: ["A very narrow grip strains the wrists; shoulder width is enough.", "Use safety bars or a spotter.", PAIN_STOP],
  },
  {
    id: "db_floor_press", name: "Dumbbell floor press", equipment: "Dumbbells", category: "strength", sets: 3, reps: "8–12", restSeconds: 90,
    pattern: "horizontal_push", needs: ["dumbbells"], fallback: "pushup", targetMuscles: ["Chest", "Triceps", "Front shoulders"], difficulty: "beginner",
    cues: ["Lie on the floor, knees bent.", "Upper arms touch the floor lightly, then press.", "Wrists stacked over elbows."],
    instructions: ["Lie on your back with knees bent and a dumbbell in each hand at chest level.", "Press the dumbbells up until your arms are straight.", "Lower slowly until your upper arms rest lightly on the floor.", "Pause, then press again without bouncing off the floor."],
    cautions: ["No bench needed: the floor limits the range, which is easy on the shoulders.", PAIN_STOP],
  },
  {
    id: "knee_pushup", name: "Knee push-up", equipment: "No equipment", category: "strength", sets: 3, reps: "8–12", restSeconds: 60,
    pattern: "horizontal_push", fallback: "wall_pushup", targetMuscles: ["Chest", "Triceps", "Core"], difficulty: "beginner",
    cues: ["Straight line from knees to head.", "Hands a little wider than shoulders.", "Lower your chest, not your hips."],
    instructions: ["Kneel and place your hands on the floor a little wider than your shoulders.", "Walk your hands forward until your body makes a straight line from knees to head.", "Bend your elbows to lower your chest towards the floor.", "Push back up, keeping your hips in line."],
    cautions: ["Put a folded towel or mat under your knees.", PAIN_STOP],
  },
  // Back
  {
    id: "pullup", name: "Pull-up", equipment: "Pull-up bar", category: "strength", sets: 3, reps: "5–8", restSeconds: 120,
    pattern: "vertical_pull", needs: ["pullup_bar"], fallback: "assisted_pullup", targetMuscles: ["Lats", "Biceps", "Upper back"], difficulty: "intermediate",
    cues: ["Overhand grip, a little wider than shoulders.", "Pull your elbows down to your sides.", "Lower all the way with control."],
    instructions: ["Hang from the bar with palms facing away and arms straight.", "Pull your shoulders down and back, then pull until your chin is over the bar.", "Lower slowly until your arms are straight again.", "Stop the set when you can no longer reach the bar with good form."],
    cautions: ["If you can't do 5 yet, use the assisted pull-up instead.", PAIN_STOP],
  },
  {
    id: "chinup", name: "Chin-up", equipment: "Pull-up bar", category: "strength", sets: 3, reps: "5–8", restSeconds: 120,
    pattern: "vertical_pull", needs: ["pullup_bar"], fallback: "assisted_pullup", targetMuscles: ["Lats", "Biceps", "Upper back"], difficulty: "intermediate",
    cues: ["Palms face you, shoulder width.", "Chest up towards the bar.", "Full hang at the bottom."],
    instructions: ["Hang from the bar with palms facing you, hands about shoulder width.", "Pull until your chin is over the bar, keeping your chest up.", "Lower slowly to a full hang.", "Keep your legs still instead of swinging."],
    cautions: ["Uses more biceps than a pull-up; if your elbows ache, switch to the pull-up or pulldown.", PAIN_STOP],
  },
  {
    id: "machine_row", name: "Machine row", equipment: "Row machine", category: "strength", sets: 3, reps: "10–12", restSeconds: 90,
    pattern: "horizontal_pull", needs: ["gym_machines"], fallback: "seated_row", targetMuscles: ["Mid back", "Lats", "Biceps"], difficulty: "beginner",
    cues: ["Chest against the pad.", "Pull with your elbows.", "Squeeze shoulder blades, then return slowly."],
    instructions: ["Set the seat so the handles are at chest height and rest your chest on the pad.", "Grab the handles with straight arms.", "Pull your elbows back until your hands reach your ribs.", "Return slowly until your arms are straight."],
    cautions: [PAIN_STOP],
  },
  {
    id: "inverted_row", name: "Inverted row", equipment: "Bar at waist height (rack or Smith)", category: "strength", sets: 3, reps: "8–12", restSeconds: 90,
    pattern: "horizontal_pull", needs: ["rack"], fallback: "prone_w_raise", targetMuscles: ["Mid back", "Lats", "Biceps"], difficulty: "beginner",
    cues: ["Body straight like a plank.", "Pull your chest to the bar.", "Higher bar = easier."],
    instructions: ["Set a bar at about waist height and lie underneath it.", "Grip the bar a little wider than your shoulders with straight arms, heels on the floor.", "Keep your body straight and pull your chest up to the bar.", "Lower slowly until your arms are straight."],
    cautions: ["Make sure the bar is locked in place before you hang from it.", "Bend your knees to make it easier.", PAIN_STOP],
  },
  {
    id: "band_row", name: "Resistance band row", equipment: "Resistance band", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "horizontal_pull", needs: ["resistance_band"], fallback: "prone_w_raise", targetMuscles: ["Mid back", "Lats", "Biceps"], difficulty: "beginner",
    cues: ["Anchor the band at chest height.", "Elbows back, shoulders down.", "Slow on the way back."],
    instructions: ["Anchor the band at chest height (or loop it round your feet while sitting).", "Hold the ends with straight arms and step back until the band is tight.", "Pull your elbows back past your sides and squeeze your shoulder blades.", "Let your arms go forward slowly."],
    cautions: ["Check the band and anchor for tears before each set.", PAIN_STOP],
  },
  {
    id: "conventional_deadlift", name: "Conventional deadlift", equipment: "Barbell", category: "strength", sets: 3, reps: "5", restSeconds: 180,
    pattern: "hip_extension", needs: ["barbell"], fallback: "dumbbell_rdl", targetMuscles: ["Hamstrings", "Glutes", "Lower back"], difficulty: "intermediate", restriction: "trainer_deadlift_approval",
    cues: ["Only after trainer approval.", "Bar over mid-foot, back flat.", "Push the floor away; bar stays close."],
    instructions: ["This movement is only available after explicit trainer approval.", "Stand with the bar over the middle of your feet and grip it just outside your legs.", "Brace, keep your back flat and push the floor away to stand up with the bar close to your legs.", "Lower it the same way, hips back first, until it touches the floor."],
    cautions: ["This is a deadlift variation and stays locked until your trainer approves it.", PAIN_STOP],
  },
  {
    id: "db_shrug", name: "Dumbbell shrug", equipment: "Dumbbells", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "shoulder_raise", needs: ["dumbbells"], fallback: "farmer_carry", targetMuscles: ["Traps", "Grip"], difficulty: "beginner",
    cues: ["Shoulders straight up to your ears.", "Pause at the top.", "No rolling."],
    instructions: ["Stand tall with a dumbbell in each hand at your sides.", "Lift your shoulders straight up towards your ears.", "Hold for a second at the top.", "Lower slowly until your shoulders are fully down."],
    cautions: ["Rolling the shoulders in circles adds nothing and can irritate them.", PAIN_STOP],
  },
  // Shoulders
  {
    id: "barbell_ohp", name: "Barbell overhead press", equipment: "Barbell + rack", category: "strength", sets: 3, reps: "6–10", restSeconds: 150,
    pattern: "vertical_push", needs: ["barbell", "rack"], fallback: "shoulder_press", targetMuscles: ["Shoulders", "Triceps", "Upper chest"], difficulty: "intermediate",
    cues: ["Squeeze glutes, ribs down.", "Bar travels in a straight line.", "Head through once the bar passes your face."],
    instructions: ["Unrack the bar at collarbone height with hands just outside your shoulders.", "Brace your core and squeeze your glutes.", "Press the bar straight up, moving your head back slightly to let it pass.", "Finish with the bar over your mid-foot, then lower to your collarbones."],
    cautions: ["Don't lean back to finish a rep; lower the weight instead.", PAIN_STOP],
  },
  {
    id: "pike_pushup", name: "Pike push-up", equipment: "No equipment", category: "strength", sets: 3, reps: "6–10", restSeconds: 90,
    pattern: "vertical_push", fallback: "wall_slide", targetMuscles: ["Shoulders", "Triceps", "Upper chest"], difficulty: "intermediate",
    cues: ["Hips high, upside-down V.", "Head goes forward of your hands.", "Elbows bend back, not out."],
    instructions: ["Start in a push-up position, then walk your feet in and lift your hips into an upside-down V.", "Bend your elbows to lower the top of your head towards the floor in front of your hands.", "Press back up until your arms are straight.", "Keep your hips high throughout."],
    cautions: ["Feet on a step makes it harder; hands on a bench makes it easier.", PAIN_STOP],
  },
  {
    id: "reverse_db_fly", name: "Reverse dumbbell fly", equipment: "Dumbbells", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "horizontal_pull", needs: ["dumbbells"], fallback: "prone_y_raise", targetMuscles: ["Rear shoulders", "Upper back"], difficulty: "beginner",
    cues: ["Hinge forward, flat back.", "Lead with your elbows out to the side.", "Light weights, slow lowering."],
    instructions: ["Hold light dumbbells and hinge forward at the hips with a flat back (or lie chest-down on an incline bench).", "Let the dumbbells hang under your shoulders with a soft bend in your elbows.", "Raise your arms out to the sides until they are level with your body.", "Lower slowly."],
    cautions: ["Swinging moves the work away from the rear shoulders: go lighter.", PAIN_STOP],
  },
  {
    id: "reverse_pec_deck", name: "Reverse pec deck", equipment: "Pec deck machine", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "horizontal_pull", needs: ["gym_machines"], fallback: "reverse_db_fly", targetMuscles: ["Rear shoulders", "Upper back"], difficulty: "beginner",
    cues: ["Face the pad.", "Arms wide and long.", "Squeeze, then return slowly."],
    instructions: ["Sit facing the pad of the pec deck and set the handles to the rear position.", "Grip the handles with arms straight in front of you at shoulder height.", "Open your arms out to the sides until they are in line with your body.", "Bring them back slowly."],
    cautions: [PAIN_STOP],
  },
  {
    id: "band_pull_apart", name: "Resistance band pull-apart", equipment: "Resistance band", category: "strength", sets: 3, reps: "15–20", restSeconds: 45,
    pattern: "horizontal_pull", needs: ["resistance_band"], fallback: "prone_w_raise", targetMuscles: ["Rear shoulders", "Upper back"], difficulty: "beginner",
    cues: ["Arms straight at shoulder height.", "Pull the band to your chest.", "Shoulders down, away from ears."],
    instructions: ["Hold a light band in front of you at shoulder height, hands about shoulder-width apart.", "Keeping your arms straight, pull the band apart until it touches your chest.", "Squeeze your shoulder blades together for a moment.", "Return slowly."],
    cautions: ["A good warm-up for pressing days.", PAIN_STOP],
  },
  // Arms
  {
    id: "cable_curl", name: "Cable biceps curl", equipment: "Cable machine", category: "strength", sets: 3, reps: "10–15", restSeconds: 60,
    pattern: "arm_curl", needs: ["cable_machine"], fallback: "db_curl", targetMuscles: ["Biceps", "Forearms"], difficulty: "beginner",
    cues: ["Elbows pinned to your sides.", "Curl up, squeeze.", "Lower slowly against the cable."],
    instructions: ["Attach a straight bar or rope to the low pulley and stand facing it.", "Hold the handle with palms up and elbows at your sides.", "Curl the handle up towards your shoulders.", "Lower slowly until your arms are straight."],
    cautions: [PAIN_STOP],
  },
  {
    id: "band_curl", name: "Resistance band curl", equipment: "Resistance band", category: "strength", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "arm_curl", needs: ["resistance_band"], fallback: "db_curl", targetMuscles: ["Biceps", "Forearms"], difficulty: "beginner",
    cues: ["Stand on the band.", "Elbows stay still.", "Slow on the way down."],
    instructions: ["Stand on the middle of the band and hold an end in each hand, palms forward.", "Keep your elbows at your sides and curl your hands up to your shoulders.", "Squeeze at the top.", "Lower slowly until your arms are straight."],
    cautions: ["Check the band for tears before each set.", PAIN_STOP],
  },
  {
    id: "skull_crusher", name: "Skull crusher", equipment: "EZ bar or dumbbells + bench", category: "strength", sets: 3, reps: "8–12", restSeconds: 75,
    pattern: "arm_extension", needs: ["barbell", "bench"], fallback: "db_triceps_extension", targetMuscles: ["Triceps (long head)", "Triceps"], difficulty: "beginner",
    cues: ["Upper arms stay still, angled slightly back.", "Lower to your forehead or just behind.", "Straighten your elbows to lift."],
    instructions: ["Lie on a bench holding an EZ bar (or two dumbbells) over your chest with straight arms.", "Tilt your arms slightly back towards your head.", "Bend only at the elbows to lower the weight towards your forehead.", "Straighten your arms to lift it back up."],
    cautions: ["Start light: the weight travels towards your head.", PAIN_STOP],
  },
  {
    id: "bench_dips", name: "Bench dips", equipment: "Bench or sturdy chair", category: "strength", sets: 3, reps: "8–12", restSeconds: 60,
    pattern: "arm_extension", needs: ["bench"], fallback: "incline_pushup", targetMuscles: ["Triceps", "Front shoulders"], difficulty: "beginner",
    cues: ["Hands on the edge, fingers forward.", "Hips close to the bench.", "Lower until elbows are about 90°."],
    instructions: ["Sit on the edge of a bench or sturdy chair with hands beside your hips, fingers forward.", "Slide your hips off the edge with knees bent and feet flat.", "Bend your elbows to lower your body until they are at about a right angle.", "Push back up until your arms are straight."],
    cautions: ["Don't go deeper than 90° at the elbows; it strains the front of the shoulder.", "Make sure the chair can't slide.", PAIN_STOP],
  },
  {
    id: "dead_hang", name: "Dead hang", equipment: "Pull-up bar", category: "strength", sets: 3, reps: "20–30 sec", restSeconds: 60,
    pattern: "carry", needs: ["pullup_bar"], fallback: "farmer_carry", targetMuscles: ["Grip", "Lats", "Shoulders"], difficulty: "beginner",
    cues: ["Full grip, thumbs round the bar.", "Let your shoulders relax up.", "Breathe and hold."],
    instructions: ["Grip the bar with both hands, about shoulder width.", "Lift your feet (or bend your knees) so you hang with straight arms.", "Relax and breathe while holding on.", "Step down before your grip gives out."],
    cautions: ["Use a step to get up and down; don't drop from a height.", PAIN_STOP],
  },
];

/** Batch B (2026-11-23): lower body and core. 12 exercises. */
export const BATCH_B_LOWER_CORE: ProgramExercise[] = [
  // Legs
  {
    id: "walking_lunge", name: "Walking lunge", equipment: "No equipment (dumbbells optional)", category: "strength", sets: 3, reps: "10 each leg", restSeconds: 90,
    pattern: "single_leg", fallback: "reverse_lunge", targetMuscles: ["Quadriceps", "Glutes", "Hamstrings"], difficulty: "intermediate",
    cues: ["Long step, torso tall.", "Back knee lowers towards the floor.", "Push through the front heel into the next step."],
    instructions: ["Stand tall with feet hip-width apart, holding dumbbells at your sides if you use them.", "Take a long step forward and lower until both knees are bent to about 90°.", "Push through your front foot and bring the back leg forward into the next step.", "Keep alternating legs, walking forward."],
    cautions: ["Needs a clear path of about 10 metres.", "Use the supported reverse lunge if your balance feels shaky.", PAIN_STOP],
  },
  {
    id: "wall_sit", name: "Wall sit", equipment: "Wall", category: "strength", sets: 3, reps: "30–45 sec", restSeconds: 60,
    pattern: "squat", fallback: "bodyweight_squat", targetMuscles: ["Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Back flat against the wall.", "Knees over ankles.", "Breathe; don't hold your breath."],
    instructions: ["Stand with your back against a wall and walk your feet about half a step forward.", "Slide down until your knees are bent (aim for thighs parallel to the floor, or higher if that's too hard).", "Keep your knees over your ankles and your back on the wall.", "Hold for the time, then slide back up."],
    cautions: ["Sit higher on the wall to make it easier on the knees.", PAIN_STOP],
  },
  {
    id: "single_leg_rdl", name: "Single-leg Romanian deadlift", equipment: "No equipment (dumbbell optional)", category: "strength", sets: 3, reps: "8 each leg", restSeconds: 75,
    pattern: "hip_extension", fallback: "single_leg_glute_bridge", targetMuscles: ["Hamstrings", "Glutes", "Core"], difficulty: "intermediate", restriction: "trainer_deadlift_approval",
    cues: ["Only after trainer approval.", "Hips stay level; back leg reaches long.", "Hinge until you feel the hamstring, then stand."],
    instructions: ["This movement is only available after explicit trainer approval.", "Stand on one leg with a soft knee, holding a wall or a dumbbell if you like.", "Hinge at the hip, reaching your free leg back as your chest lowers, back flat.", "Stand back up by squeezing the glute of the standing leg."],
    cautions: ["This is a deadlift variation and stays locked until your trainer approves it.", "Hold a wall for balance until it feels steady.", PAIN_STOP],
  },
  {
    id: "barbell_hip_thrust", name: "Barbell hip thrust", equipment: "Barbell + bench", category: "strength", sets: 3, reps: "8–12", restSeconds: 120,
    pattern: "hip_extension", needs: ["barbell", "bench"], fallback: "hip_thrust", targetMuscles: ["Glutes", "Hamstrings"], difficulty: "intermediate",
    cues: ["Upper back on the bench edge.", "Chin tucked, ribs down.", "Drive hips up until your body is flat; squeeze."],
    instructions: ["Sit on the floor with your upper back against a bench and a padded barbell over your hips.", "Plant your feet flat, about hip-width apart.", "Drive through your heels to lift your hips until your body is level from shoulders to knees.", "Pause, then lower your hips under control."],
    cautions: ["Use a bar pad or a folded mat over your hips.", "Don't arch your lower back at the top; the lift comes from the glutes.", PAIN_STOP],
  },
  {
    id: "single_leg_glute_bridge", name: "Single-leg glute bridge", equipment: "Mat", category: "strength", sets: 3, reps: "8–12 each side", restSeconds: 60,
    pattern: "hip_extension", fallback: "glute_bridge", targetMuscles: ["Glutes", "Hamstrings", "Core"], difficulty: "beginner",
    cues: ["One foot planted, other leg up.", "Hips stay level.", "Squeeze at the top."],
    instructions: ["Lie on your back with knees bent and feet flat.", "Lift one foot and straighten that leg (or hug the knee in).", "Push through the planted heel to lift your hips, keeping them level.", "Lower slowly and repeat, then switch sides."],
    cautions: ["If your hamstring cramps, bring the planted foot closer to your hips.", PAIN_STOP],
  },
  {
    id: "single_leg_calf_raise", name: "Single-leg calf raise", equipment: "Wall or step", category: "strength", sets: 3, reps: "10–15 each side", restSeconds: 45,
    pattern: "calf_raise", fallback: "calf_raise", targetMuscles: ["Calves"], difficulty: "beginner",
    cues: ["Hold a wall for balance.", "Rise all the way onto the ball of your foot.", "Lower slowly to a full stretch."],
    instructions: ["Stand on one foot, on the floor or with your heel off the edge of a step, holding a wall.", "Rise as high as you can onto the ball of your foot.", "Pause at the top.", "Lower slowly, then switch legs after the set."],
    cautions: [PAIN_STOP],
  },
  // Core
  {
    id: "crunch", name: "Crunch", equipment: "Mat", category: "core", sets: 3, reps: "12–15", restSeconds: 45,
    pattern: "core", fallback: "dead_bug", targetMuscles: ["Abs"], difficulty: "beginner",
    cues: ["Hands lightly behind your head.", "Curl your ribs towards your hips.", "Lower slowly; don't pull your neck."],
    instructions: ["Lie on your back with knees bent and feet flat.", "Rest your fingertips lightly behind your head, elbows wide.", "Curl your head and shoulders off the floor by tightening your abs.", "Lower slowly back down."],
    cautions: ["Never pull on your head; the hands only support it.", PAIN_STOP],
  },
  {
    id: "bicycle_crunch", name: "Bicycle crunch", equipment: "Mat", category: "core", sets: 3, reps: "10–12 each side", restSeconds: 45,
    pattern: "core", fallback: "crunch", targetMuscles: ["Abs", "Obliques"], difficulty: "beginner",
    cues: ["Slow, controlled twists.", "Shoulder towards the opposite knee.", "Straight leg stays off the floor."],
    instructions: ["Lie on your back with fingertips behind your head and knees lifted over your hips.", "Curl your shoulders up and turn one shoulder towards the opposite knee as that knee comes in.", "Straighten the other leg out at the same time.", "Switch sides in a slow pedalling motion."],
    cautions: ["Speed makes it easier and sloppier; go slow.", PAIN_STOP],
  },
  {
    id: "lying_leg_raise", name: "Lying leg raise", equipment: "Mat", category: "core", sets: 3, reps: "10–12", restSeconds: 45,
    pattern: "core", fallback: "reverse_crunch", targetMuscles: ["Abs", "Hip flexors"], difficulty: "beginner",
    cues: ["Lower back pressed down.", "Legs up together, then lower slowly.", "Stop before your back lifts."],
    instructions: ["Lie on your back with legs straight and hands under your hips or by your sides.", "Press your lower back gently into the floor.", "Raise your legs together until they point at the ceiling.", "Lower them slowly, stopping before your lower back lifts off the floor."],
    cautions: ["Bend your knees to make it easier on the lower back.", PAIN_STOP],
  },
  {
    id: "russian_twist", name: "Russian twist", equipment: "Mat (weight optional)", category: "core", sets: 3, reps: "10–12 each side", restSeconds: 45,
    pattern: "core", fallback: "side_plank", targetMuscles: ["Obliques", "Abs"], difficulty: "beginner",
    cues: ["Lean back a little, chest up.", "Turn your ribs, not just your arms.", "Feet down to make it easier."],
    instructions: ["Sit with knees bent and lean back slightly with a straight back.", "Hold your hands together (or a light weight) in front of your chest.", "Turn your upper body to one side, then the other.", "Keep the movement slow and controlled."],
    cautions: ["Skip it if twisting bothers your lower back; the Pallof press is a gentler option.", PAIN_STOP],
  },
  {
    id: "wood_chop", name: "Wood chop", equipment: "Cable machine, band or dumbbell", category: "core", sets: 2, reps: "10 each side", restSeconds: 45,
    pattern: "core", needs: ["cable_machine"], fallback: "pallof_press", targetMuscles: ["Obliques", "Core", "Shoulders"], difficulty: "beginner",
    cues: ["Pivot your back foot.", "Arms long; turn with your chest.", "Control it back, don't let it pull you."],
    instructions: ["Set a cable (or band) high to one side and hold the handle with both hands.", "Stand side-on with feet wider than your hips.", "Pull diagonally down and across your body, turning your chest and pivoting your back foot.", "Return slowly to the start, then switch sides after the set."],
    cautions: [PAIN_STOP],
  },
  {
    id: "mountain_climber", name: "Mountain climber", equipment: "No equipment", category: "core", sets: 3, reps: "20–30 sec", restSeconds: 45,
    pattern: "core", fallback: "floor_plank", targetMuscles: ["Core", "Shoulders", "Heart and lungs"], difficulty: "beginner",
    cues: ["Hands under shoulders, plank position.", "Drive knees in one at a time.", "Hips level, not bouncing."],
    instructions: ["Start in a high plank with hands under your shoulders.", "Bring one knee towards your chest, then switch legs.", "Keep alternating at a pace you can control.", "Keep your hips in line with your shoulders."],
    cautions: ["Go slower, or step the feet in, for a low-impact version.", PAIN_STOP],
  },
];

/** Batch C (2026-11-24): cardio and home conditioning. 16 exercises. */
export const BATCH_C_CARDIO_HOME: ProgramExercise[] = [
  // Machines
  {
    id: "treadmill_walk", name: "Treadmill walk", equipment: "Treadmill", category: "conditioning", sets: 1, reps: "20–30 min", restSeconds: 0,
    pattern: "cardio", needs: ["cardio_machine"], fallback: "comfortable_walk", targetMuscles: ["Heart and lungs", "Quadriceps", "Calves"], difficulty: "beginner",
    cues: ["Stand tall, look ahead.", "Let your arms swing naturally.", "Pick a pace you can talk at."],
    instructions: ["Stand on the side rails, start the belt slowly, then step on.", "Walk at an easy pace for the first few minutes to warm up.", "Raise the speed or a small incline until you feel warm but can still talk.", "Slow down for the last couple of minutes before stepping off."],
    cautions: ["Hold the rails only if you need to; leaning on them cuts the effort.", PAIN_STOP],
  },
  {
    id: "stationary_bike", name: "Stationary bike", equipment: "Exercise bike", category: "conditioning", sets: 1, reps: "15–30 min", restSeconds: 0,
    pattern: "cardio", needs: ["cardio_machine"], fallback: "march_in_place", targetMuscles: ["Heart and lungs", "Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Seat height: slight bend at the bottom.", "Shoulders relaxed, back tall.", "Smooth, steady pedalling."],
    instructions: ["Set the seat so your knee is slightly bent when the pedal is at its lowest.", "Start pedalling with very light resistance to warm up.", "Add resistance until the effort feels moderate and you can still talk.", "Ease off the resistance for the last couple of minutes."],
    cautions: ["If your knees hurt, raise the seat a little and lower the resistance.", PAIN_STOP],
  },
  {
    id: "elliptical", name: "Elliptical", equipment: "Elliptical trainer", category: "conditioning", sets: 1, reps: "15–30 min", restSeconds: 0,
    pattern: "cardio", needs: ["cardio_machine"], fallback: "march_in_place", targetMuscles: ["Heart and lungs", "Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Stand tall, don't lean on the handles.", "Push through your whole foot.", "Keep a smooth, even rhythm."],
    instructions: ["Step onto the pedals and hold the handles lightly.", "Start moving slowly with low resistance to warm up.", "Increase the resistance or speed until the effort feels moderate.", "Slow down for the last couple of minutes, then step off carefully."],
    cautions: ["It is easy on the joints, but keep your feet flat on the pedals.", PAIN_STOP],
  },
  {
    id: "rowing_machine", name: "Rowing machine", equipment: "Rowing machine", category: "conditioning", sets: 1, reps: "10–20 min", restSeconds: 0,
    pattern: "cardio", needs: ["cardio_machine"], fallback: "easy_cardio", targetMuscles: ["Heart and lungs", "Lats", "Quadriceps"], difficulty: "beginner",
    cues: ["Drive: legs, then body, then arms.", "Return: arms, then body, then legs.", "Keep your back long, not rounded."],
    instructions: ["Strap your feet in and sit tall, holding the handle with arms straight.", "Push with your legs first, then lean back slightly, then pull the handle to your lower ribs.", "Reverse it: arms out, lean forward, then bend your knees to slide back.", "Keep a steady rhythm and relaxed breathing."],
    cautions: ["Don't pull with your arms first; the power comes from your legs.", PAIN_STOP],
  },
  // Outdoor
  {
    id: "brisk_walk", name: "Brisk walk", equipment: "No equipment", category: "conditioning", sets: 1, reps: "20–40 min", restSeconds: 0,
    pattern: "cardio", fallback: "comfortable_walk", targetMuscles: ["Heart and lungs", "Quadriceps", "Calves"], difficulty: "beginner",
    cues: ["Pace: you can talk but not sing.", "Stand tall, arms swinging.", "Land heel first, roll through."],
    instructions: ["Start with a few minutes of easy walking to warm up.", "Pick up the pace until you are breathing harder but can still hold a conversation.", "Keep that pace steady, swinging your arms.", "Slow down for the last few minutes to cool off."],
    cautions: ["Wear supportive shoes and stay aware of traffic and uneven ground.", PAIN_STOP],
  },
  {
    id: "jog", name: "Jog", equipment: "Running shoes", category: "conditioning", sets: 1, reps: "15–25 min", restSeconds: 0,
    pattern: "cardio", fallback: "brisk_walk", targetMuscles: ["Heart and lungs", "Quadriceps", "Calves"], difficulty: "beginner",
    cues: ["Easy pace: you can still talk.", "Short, light steps.", "Relaxed shoulders and hands."],
    instructions: ["Warm up with a few minutes of brisk walking.", "Break into a slow jog; walk-jog intervals are fine if you need them.", "Keep your steps short and your breathing steady.", "Walk for the last few minutes to cool down."],
    cautions: ["For a low-impact option, do the brisk walk instead.", PAIN_STOP],
  },
  {
    id: "run", name: "Run", equipment: "Running shoes", category: "conditioning", sets: 1, reps: "20–40 min", restSeconds: 0,
    pattern: "cardio", fallback: "jog", targetMuscles: ["Heart and lungs", "Quadriceps", "Hamstrings"], difficulty: "intermediate",
    cues: ["Tall posture, slight forward lean.", "Quick, light steps under your body.", "Breathe in a steady rhythm."],
    instructions: ["Warm up with a few minutes of walking and an easy jog.", "Build to a steady running pace that feels hard but sustainable.", "Keep your steps quick and your arms relaxed at about 90 degrees.", "Finish with a few minutes of jogging, then walking."],
    cautions: ["For a low-impact option, do the jog or a brisk walk instead.", PAIN_STOP],
  },
  {
    id: "cycling", name: "Cycling", equipment: "Bicycle and helmet", category: "conditioning", sets: 1, reps: "20–45 min", restSeconds: 0,
    pattern: "cardio", fallback: "stationary_bike", targetMuscles: ["Heart and lungs", "Quadriceps", "Glutes"], difficulty: "beginner",
    cues: ["Helmet on, eyes up.", "Smooth, steady pedalling.", "Relaxed grip and shoulders."],
    instructions: ["Put on your helmet and check your tyres and brakes.", "Ride easily for the first few minutes to warm up.", "Pedal at a steady pace that feels moderate and lets you talk.", "Ease off for the last few minutes."],
    cautions: ["Always wear a helmet, follow road rules and use lights in low light.", PAIN_STOP],
  },
  // Home
  {
    id: "jumping_jack", name: "Jumping jack", equipment: "No equipment", category: "conditioning", sets: 3, reps: "30 sec", restSeconds: 30,
    pattern: "cardio", fallback: "low_impact_jumping_jack", targetMuscles: ["Heart and lungs", "Calves", "Shoulders"], difficulty: "beginner",
    cues: ["Land softly on the balls of your feet.", "Arms and legs open together.", "Keep a steady rhythm."],
    instructions: ["Stand tall with feet together and arms by your sides.", "Jump your feet apart as you swing your arms overhead.", "Jump your feet back together and bring your arms down.", "Keep going at a steady pace for the time."],
    cautions: ["For a low-impact option, use the low-impact jumping jack instead.", PAIN_STOP],
  },
  {
    id: "low_impact_jumping_jack", name: "Low-impact jumping jack", equipment: "No equipment", category: "conditioning", sets: 3, reps: "30 sec", restSeconds: 30,
    pattern: "cardio", fallback: "march_in_place", targetMuscles: ["Heart and lungs", "Shoulders", "Calves"], difficulty: "beginner",
    cues: ["No jumping: one foot at a time.", "Arms rise as the foot steps out.", "Stay tall and steady."],
    instructions: ["Stand tall with feet together and arms by your sides.", "Step one foot out to the side as your arms rise overhead.", "Step it back in as your arms lower, then repeat on the other side.", "Keep going at a steady pace for the time."],
    cautions: [PAIN_STOP],
  },
  {
    id: "step_touch", name: "Step touch", equipment: "No equipment", category: "conditioning", sets: 3, reps: "45 sec", restSeconds: 30,
    pattern: "cardio", fallback: "march_in_place", targetMuscles: ["Heart and lungs", "Calves"], difficulty: "beginner",
    cues: ["Small, light steps side to side.", "Swing your arms with the steps.", "Stay tall, knees soft."],
    instructions: ["Stand with feet together and knees slightly bent.", "Step one foot out to the side, then bring the other foot to meet it.", "Step back the other way and keep going side to side.", "Add arm swings to lift your heart rate."],
    cautions: ["Clear some space around you and wear shoes with grip.", PAIN_STOP],
  },
  {
    id: "high_knees", name: "High knees", equipment: "No equipment", category: "conditioning", sets: 3, reps: "20–30 sec", restSeconds: 30,
    pattern: "cardio", fallback: "march_in_place", targetMuscles: ["Heart and lungs", "Hip flexors", "Calves"], difficulty: "beginner",
    cues: ["Lift your knees to hip height.", "Stay tall, chest up.", "Quick, light feet."],
    instructions: ["Stand tall with your feet hip-width apart.", "Lift one knee up towards hip height, then switch quickly to the other.", "Pump your arms as you go and stay on the balls of your feet.", "Keep it quick but controlled for the time."],
    cautions: ["For a low-impact option, march in place instead of running.", PAIN_STOP],
  },
  {
    id: "jump_squat", name: "Jump squat", equipment: "No equipment", category: "conditioning", sets: 3, reps: "8–10", restSeconds: 60,
    pattern: "squat", fallback: "bodyweight_squat", targetMuscles: ["Quadriceps", "Glutes", "Calves"], difficulty: "intermediate",
    cues: ["Sit back into the squat first.", "Jump up, land softly.", "Bend your knees as you land."],
    instructions: ["Stand with feet shoulder-width apart and lower into a squat.", "Push through your feet and jump straight up.", "Land softly on the balls of your feet, then sink back into the squat.", "Reset your balance before the next jump."],
    cautions: ["For a low-impact option, do a bodyweight squat without the jump.", PAIN_STOP],
  },
  {
    id: "burpee", name: "Burpee", equipment: "No equipment", category: "conditioning", sets: 3, reps: "6–10", restSeconds: 60,
    pattern: "cardio", fallback: "knee_pushup", targetMuscles: ["Heart and lungs", "Chest", "Quadriceps"], difficulty: "intermediate",
    cues: ["Hands down under your shoulders.", "Keep your body in a straight line.", "Stand up tall at the top."],
    instructions: ["Stand tall, then squat down and place your hands on the floor.", "Jump or step your feet back into a high plank.", "Jump or step your feet back in towards your hands.", "Stand up, with a small jump if you like."],
    cautions: ["For a low-impact version, step back and forward instead of jumping.", PAIN_STOP],
  },
  {
    id: "jump_rope", name: "Jump rope", equipment: "Jump rope", category: "conditioning", sets: 3, reps: "30–60 sec", restSeconds: 45,
    pattern: "cardio", fallback: "jumping_jack", targetMuscles: ["Heart and lungs", "Calves", "Shoulders"], difficulty: "beginner",
    cues: ["Small hops, just off the floor.", "Turn the rope with your wrists.", "Elbows close to your sides."],
    instructions: ["Hold the handles with the rope behind your heels.", "Swing the rope over your head using your wrists.", "Hop lightly on the balls of your feet as it passes under.", "Keep the hops small and steady for the time."],
    cautions: ["For a low-impact option, mimic the rope with no jumping, or step side to side.", PAIN_STOP],
  },
  {
    id: "kettlebell_swing", name: "Kettlebell swing", equipment: "Kettlebell (or dumbbell)", category: "conditioning", sets: 3, reps: "12–15", restSeconds: 60,
    pattern: "hip_extension", needs: ["kettlebell"], fallback: "glute_bridge", targetMuscles: ["Glutes", "Hamstrings", "Core"], difficulty: "intermediate",
    cues: ["Hinge at the hips; arms are just ropes.", "Snap your hips forward, squeeze glutes.", "Stand tall at the top, flat back."],
    instructions: ["Stand with feet a little wider than your hips and the weight on the floor in front of you.", "Hinge back at your hips, grab the handle and swing the weight back between your legs.", "Drive your hips forward so the weight floats up to chest height.", "Let it swing back down as you hinge again; your arms only guide it."],
    cautions: ["Learn the hip hinge with a light weight first and keep your back flat.", PAIN_STOP],
  },
];

/** Every exercise added in R6 so far, in batch order. */
export const LIBRARY_ADDITIONS: ProgramExercise[] = [...BATCH_A_UPPER, ...BATCH_B_LOWER_CORE, ...BATCH_C_CARDIO_HOME];

/**
 * The planner never picks these as automatic fill-ins (when an exercise was skipped or its pattern repeats), so adding
 * them leaves everyone's generated plans exactly as they were. They are offered in the library, swaps and Rozi, and a
 * workout template can still list one on purpose.
 */
export const NOT_AUTO_PICKED = new Set(LIBRARY_ADDITIONS.map((exercise) => exercise.id));
