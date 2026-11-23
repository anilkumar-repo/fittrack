# Exercise library audit (Milestone 0 / plan Milestone 3)

Date: 2026-11-23. Read-only: no exercise was added, renamed or removed.

## 1. Where the library lives

- Exercises are defined in `src/lib/templates.ts` and `src/lib/program-exercises.ts` and exported as `EXERCISE_LIBRARY` (77 exercises). The type is `ExerciseDefinition` in `src/lib/types.ts`.
- Search lives in `src/lib/exercise-library.ts` (`SEARCH_ALIASES`, `exerciseSearchRank`). Rozi's name matching lives in `src/lib/rozi-ai/tools.ts` (`EXERCISE_ALIASES`, `findExercise`). Swaps live in `src/lib/exercise-swap.ts` (`swapChoices`, `canUseExercise`).
- Stretches and mobility routines are a separate module (`src/lib/mobility.ts`, `mobility-data.ts`) and are not counted here.
- **Saved data uses exercise IDs** (plans, routines, workout logs, Rozi actions). Every ID below must stay as it is.

## 2. Current fields

`id`, `name`, `equipment` (display text), `category` (`strength` | `core` | `conditioning`), `sets`, `reps` (text, e.g. "8–10", "30–60 sec", "20 min"), `restSeconds`, `cues`, `instructions`, `cautions`, `targetMuscles[]` (free text), `difficulty` (`beginner` | `intermediate`), `restriction`, `movementPattern` (18-value enum), `requiredEquipment` (`EquipmentKey[]`, 15-value enum), `fallbackId`, plus a video link.

Already controlled enums: category, difficulty, movement pattern, equipment keys. **Not controlled:** muscles (free text), aliases (two separate lists in two files).

## 3. Inventory (all 77)

| # | ID | Name | Category | Pattern | Primary muscle | Group | Difficulty | Required equipment |
|---|---|---|---|---|---|---|---|---|
| 1 | `goblet_squat` | Goblet squat | strength | squat | Quadriceps | Quads | beginner | dumbbells |
| 2 | `dumbbell_bench` | Dumbbell bench press | strength | horizontal_push | Chest | Chest | beginner | bench, dumbbells |
| 3 | `lat_pulldown` | Lat pulldown | strength | vertical_pull | Lats | Back | beginner | cable_machine |
| 4 | `glute_bridge` | Glute bridge | strength | hip_extension | Glutes | Glutes | beginner | none |
| 5 | `dead_bug` | Dead bug | core | core | Core | Core | beginner | none |
| 6 | `leg_press` | Leg press | strength | squat | Quadriceps | Quads | beginner | leg_press |
| 7 | `seated_row` | Seated cable row | strength | horizontal_pull | Mid back | Back | beginner | cable_machine |
| 8 | `shoulder_press` | Seated dumbbell press | strength | vertical_push | Shoulders | Shoulders | beginner | bench, dumbbells |
| 9 | `hamstring_curl` | Hamstring curl | strength | hamstring_curl | Hamstrings | Hamstrings | beginner | leg_curl_machine |
| 10 | `plank` | Incline plank | core | core | Core | Core | beginner | bench |
| 11 | `split_squat` | Supported split squat | strength | single_leg | Quadriceps | Quads | beginner | rack |
| 12 | `incline_pushup` | Incline push-up | strength | horizontal_push | Chest | Chest | beginner | bench |
| 13 | `chest_row` | Chest-supported row | strength | horizontal_pull | Upper back | Back | beginner | bench, dumbbells |
| 14 | `hip_thrust` | Bodyweight hip thrust | strength | hip_extension | Glutes | Glutes | beginner | bench |
| 15 | `farmer_carry` | Farmer carry | conditioning | carry | Grip | Forearms & grip | beginner | dumbbells |
| 16 | `dumbbell_rdl` | Dumbbell Romanian deadlift | strength | hip_extension | Hamstrings | Hamstrings | intermediate | dumbbells |
| 17 | `bodyweight_squat` | Bodyweight squat | strength | squat | Quadriceps | Quads | beginner | none |
| 18 | `sit_to_stand` | Sit to stand | strength | squat | Quadriceps | Quads | beginner | chair |
| 19 | `wall_pushup` | Wall push-up | strength | horizontal_push | Chest | Chest | beginner | none |
| 20 | `prone_lat_pull` | Prone arm pull-down | strength | vertical_pull | Lats | Back | beginner | none |
| 21 | `prone_w_raise` | Prone W raise | strength | horizontal_pull | Upper back | Back | beginner | none |
| 22 | `wall_slide` | Wall slide | strength | vertical_push | Shoulders | Shoulders | beginner | none |
| 23 | `heel_dig_bridge` | Bridge heel dig | strength | hamstring_curl | Hamstrings | Hamstrings | beginner | none |
| 24 | `wall_plank` | Wall plank | core | core | Core | Core | beginner | none |
| 25 | `bodyweight_split_squat` | Supported bodyweight split squat | strength | single_leg | Quadriceps | Quads | beginner | none |
| 26 | `prone_y_raise` | Prone Y raise | strength | horizontal_pull | Upper back | Back | beginner | none |
| 27 | `march_in_place` | Easy march in place | conditioning | carry | Calves | Calves | beginner | none |
| 28 | `comfortable_walk` | Comfortable walk | conditioning | carry | Legs | Quads | beginner | none |
| 29 | `relaxed_breathing` | Relaxed breathing | core | core | No specific muscle focus | Recovery | beginner | none |
| 30 | `barbell_bench` | Barbell bench press | strength | horizontal_push | Chest | Chest | intermediate | barbell, bench |
| 31 | `incline_db_press` | Incline dumbbell press | strength | horizontal_push | Upper chest | Chest | beginner | bench, dumbbells |
| 32 | `machine_shoulder_press` | Machine shoulder press | strength | vertical_push | Shoulders | Shoulders | beginner | gym_machines |
| 33 | `lateral_raise` | Dumbbell lateral raise | strength | shoulder_raise | Side shoulders | Shoulders | beginner | dumbbells |
| 34 | `cable_lateral_raise` | Cable lateral raise | strength | shoulder_raise | Side shoulders | Shoulders | beginner | cable_machine |
| 35 | `cable_fly` | Cable chest fly | strength | chest_fly | Chest | Chest | beginner | cable_machine |
| 36 | `pec_deck` | Pec deck | strength | chest_fly | Chest | Chest | beginner | gym_machines |
| 37 | `dumbbell_fly` | Dumbbell fly | strength | chest_fly | Chest | Chest | beginner | bench, dumbbells |
| 38 | `triceps_pushdown` | Cable triceps pushdown | strength | arm_extension | Triceps | Triceps | beginner | cable_machine |
| 39 | `rope_pushdown` | Rope triceps pushdown | strength | arm_extension | Triceps | Triceps | beginner | cable_machine |
| 40 | `overhead_cable_extension` | Overhead cable triceps extension | strength | arm_extension | Triceps (long head) | Triceps | beginner | cable_machine |
| 41 | `db_triceps_extension` | Dumbbell overhead triceps extension | strength | arm_extension | Triceps | Triceps | beginner | dumbbells |
| 42 | `pushup` | Push-up | strength | horizontal_push | Chest | Chest | beginner | none |
| 43 | `barbell_row` | Barbell row | strength | horizontal_pull | Mid back | Back | intermediate | barbell |
| 44 | `face_pull` | Cable face pull | strength | horizontal_pull | Rear shoulders | Shoulders | beginner | cable_machine |
| 45 | `single_arm_cable_row` | Single-arm cable row | strength | horizontal_pull | Lats | Back | beginner | cable_machine |
| 46 | `one_arm_db_row` | One-arm dumbbell row | strength | horizontal_pull | Lats | Back | beginner | dumbbells, bench |
| 47 | `straight_arm_pulldown` | Straight-arm pulldown | strength | vertical_pull | Lats | Back | beginner | cable_machine |
| 48 | `assisted_pullup` | Assisted pull-up | strength | vertical_pull | Lats | Back | beginner | pullup_bar |
| 49 | `ez_curl` | EZ-bar biceps curl | strength | arm_curl | Biceps | Biceps | beginner | barbell |
| 50 | `db_curl` | Dumbbell biceps curl | strength | arm_curl | Biceps | Biceps | beginner | dumbbells |
| 51 | `hammer_curl` | Dumbbell hammer curl | strength | arm_curl | Biceps | Biceps | beginner | dumbbells |
| 52 | `preacher_curl` | EZ-bar preacher curl | strength | arm_curl | Biceps | Biceps | beginner | barbell, bench |
| 53 | `incline_db_curl` | Incline dumbbell curl | strength | arm_curl | Biceps | Biceps | beginner | bench, dumbbells |
| 54 | `reverse_curl` | Reverse curl | strength | arm_curl | Forearms | Forearms & grip | beginner | dumbbells |
| 55 | `wrist_curl` | Wrist curl | strength | arm_curl | Forearms | Forearms & grip | beginner | dumbbells |
| 56 | `reverse_wrist_curl` | Reverse wrist curl | strength | arm_curl | Forearms | Forearms & grip | beginner | dumbbells |
| 57 | `back_squat` | Barbell squat | strength | squat | Quadriceps | Quads | intermediate | barbell, rack |
| 58 | `smith_squat` | Smith machine squat | strength | squat | Quadriceps | Quads | beginner | smith_machine |
| 59 | `hack_squat` | Hack squat | strength | squat | Quadriceps | Quads | beginner | gym_machines |
| 60 | `bulgarian_split_squat` | Bulgarian split squat | strength | single_leg | Quadriceps | Quads | intermediate | bench |
| 61 | `reverse_lunge` | Supported reverse lunge | strength | single_leg | Quadriceps | Quads | beginner | none |
| 62 | `step_up` | Step-up | strength | single_leg | Quadriceps | Quads | beginner | step |
| 63 | `leg_extension` | Leg extension | strength | knee_extension | Quadriceps | Quads | beginner | gym_machines |
| 64 | `calf_raise` | Standing calf raise | strength | calf_raise | Calves | Calves | beginner | none |
| 65 | `db_glute_bridge` | Dumbbell glute bridge | strength | hip_extension | Glutes | Glutes | beginner | dumbbells |
| 66 | `slider_leg_curl` | Sliding leg curl | strength | hamstring_curl | Hamstrings | Hamstrings | beginner | none |
| 67 | `back_extension` | Back extension (glute focus) | strength | hip_extension | Glutes | Glutes | intermediate | back_extension |
| 68 | `barbell_rdl` | Barbell Romanian deadlift | strength | hip_extension | Hamstrings | Hamstrings | intermediate | barbell |
| 69 | `floor_plank` | Plank | core | core | Core | Core | beginner | none |
| 70 | `side_plank` | Side plank | core | core | Obliques | Core | beginner | none |
| 71 | `bird_dog` | Bird dog | core | core | Core | Core | beginner | none |
| 72 | `pallof_press` | Pallof press | core | core | Obliques | Core | beginner | cable_machine |
| 73 | `cable_crunch` | Cable crunch | core | core | Abs | Core | beginner | cable_machine |
| 74 | `hanging_knee_raise` | Hanging knee raise | core | core | Abs | Core | intermediate | pullup_bar |
| 75 | `reverse_crunch` | Reverse crunch | core | core | Abs | Core | beginner | none |
| 76 | `interval_cardio` | Cardio intervals | conditioning | cardio | Heart and lungs | Cardio | beginner | none |
| 77 | `easy_cardio` | Easy cardio | conditioning | cardio | Heart and lungs | Cardio | beginner | none |

## 4. Metadata problems found

Status after R3 (2026-11-23): ✅ fixed · ⏭ moved to a later step · ➖ kept on purpose.

| # | Exercise(s) | Problem | Fix |
|---|---|---|---|
| 1 | `comfortable_walk`, `march_in_place` | Pattern is `carry`; primary muscle is "Legs" / "Calves". They are cardio. | ✅ Pattern `cardio`, main muscle "Heart and lungs" |
| 2 | `easy_cardio`, `interval_cardio` | `requiredEquipment` is empty, but the text says "Treadmill, bike, elliptical or rower". The `cardio_machine` key exists and no exercise uses it. | ➖ Kept: both also accept a brisk walk, so requiring a machine would drop them from home plans. Real machine entries come in R6; "treadmill", "elliptical" and "stationary bike" are aliases for now |
| 3 | `ez_curl`, `preacher_curl` | An EZ bar is recorded as `barbell` | ➖ Kept (the equipment option is "Barbell / EZ bar") |
| 4 | `pallof_press` | Text says "Cable machine or band", but it requires `cable_machine`; there is no band key | ✅ R4 (code): a band works instead of the cable (`equipmentAlternatives`); migration applied 2026-11-23 |
| 5 | `goblet_squat` | Dumbbell only; a kettlebell works the same way | ✅ R4 (code): a kettlebell works for goblet squat and farmer carry; migration applied 2026-11-23 |
| 6 | `relaxed_breathing` | Category `core`, muscle "No specific muscle focus" | ✅ Pattern `recovery` (it no longer counts as core training on the recovery map); category stays `core` for the tabs |
| 7 | All | `targetMuscles` is free text: 20+ spellings ("Lats", "Mid back", "Upper back", "Triceps (long head)") | ✅ `muscles: TargetMuscle[]` (20 values, `exercise-taxonomy.ts`); the text stays for display |
| 8 | All | Time targets ("30–60 sec", "20 min") are only text; logged sets store weight × reps | ✅ R5: `tracking` unit per exercise + distance (migration applied 2026-11-23) |
| 9 | All | No `advanced` difficulty; 69 of 77 are `beginner` | ➖ Kept |
| 10 | — | Two alias lists (`SEARCH_ALIASES`, `EXERCISE_ALIASES`) can disagree | ✅ `aliases` on each exercise; Rozi's separate list was removed. `SEARCH_ALIASES` stays: it is for muscle words ("abs", "quads"), not exercise names |

No duplicate IDs and no duplicate names were found. Two exercises carry a trainer restriction (`dumbbell_rdl`, `barbell_rdl` → `trainer_deadlift_approval`).

## 5. Candidate classification (the plan's §6.2–6.15)

Statuses: ALREADY PRESENT · PRESENT UNDER ANOTHER NAME · VARIATION MISSING · METADATA MISSING · COMPLETELY MISSING · NOT REQUIRED.
Priority: **H** = add in the first expansion (R6) · **O** = optional, later.

Totals (212 unique names): ALREADY PRESENT 37 · PRESENT UNDER ANOTHER NAME 29 · VARIATION MISSING 34 · METADATA MISSING 5 · COMPLETELY MISSING 76 · NOT REQUIRED 31. Some names appear in more than one list (e.g. Farmer's carry, Chin-up); they are counted once. Five pairs are the same exercise under two names (Burpee/Burpees, Jumping jack/jacks, Mountain climber/s, Jump squat/Squat jumps, Resistance band curl/biceps curl).

### Chest

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Barbell Flat Bench Press | ALREADY PRESENT | `barbell_bench` | — |  |
| Barbell Incline Bench Press | VARIATION MISSING | `barbell_bench` | H | Incline variant of `barbell_bench` |
| Barbell Decline Bench Press | VARIATION MISSING | `barbell_bench` | O |  |
| Close-Grip Bench Press | VARIATION MISSING | `barbell_bench` | H | Compound triceps press; also covers the triceps list |
| Dumbbell Flat Bench Press | ALREADY PRESENT | `dumbbell_bench` | — |  |
| Dumbbell Incline Bench Press | PRESENT UNDER ANOTHER NAME | `incline_db_press` | — | Named "Incline dumbbell press" |
| Dumbbell Decline Bench Press | VARIATION MISSING | `dumbbell_bench` | O |  |
| Dumbbell Floor Press | VARIATION MISSING | `dumbbell_bench` | H | Dumbbells but no bench — a common home setup with no chest press today |
| Dumbbell Chest Fly | PRESENT UNDER ANOTHER NAME | `dumbbell_fly` | — | Named "Dumbbell fly" |
| Incline Dumbbell Fly | VARIATION MISSING | `dumbbell_fly` | O |  |
| Cable Chest Fly | ALREADY PRESENT | `cable_fly` | — |  |
| High-to-Low Cable Crossover | VARIATION MISSING | `cable_fly` | O | Could be an alias + cue on `cable_fly` instead of a new entry |
| Low-to-High Cable Crossover | VARIATION MISSING | `cable_fly` | O | Same as above |
| Standing Cable Chest Press | COMPLETELY MISSING | — | O |  |
| Machine Chest Press | COMPLETELY MISSING | — | H | One of the most common beginner gym machines |
| Pec Deck Fly | PRESENT UNDER ANOTHER NAME | `pec_deck` | — | Named "Pec deck" |
| Smith Machine Bench Press | VARIATION MISSING | `barbell_bench` | O |  |
| Standard Push-Up | ALREADY PRESENT | `pushup` | — |  |
| Incline Push-Up | ALREADY PRESENT | `incline_pushup` | — |  |
| Decline Push-Up | VARIATION MISSING | `pushup` | O |  |
| Knee Push-Up | VARIATION MISSING | `pushup` | H | Missing step between incline push-up and full push-up |
| Wide Push-Up | NOT REQUIRED | `pushup` | — | A hand-position cue on `pushup`, not a separate exercise |
| Diamond Push-Up | VARIATION MISSING | `pushup` | O |  |
| Chest Dips | COMPLETELY MISSING | — | O | Needs a dip station — no equipment key for it |

### Back

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Pull-Up | VARIATION MISSING | `assisted_pullup` | H | Only the assisted version exists; `pullup_bar` key already exists |
| Chin-Up | VARIATION MISSING | `assisted_pullup` | H | Also a biceps compound |
| Assisted Pull-Up | ALREADY PRESENT | `assisted_pullup` | — |  |
| Lat Pulldown | ALREADY PRESENT | `lat_pulldown` | — |  |
| Close-Grip Lat Pulldown | NOT REQUIRED | `lat_pulldown` | — | Grip choice → alias + cue on `lat_pulldown` |
| Wide-Grip Lat Pulldown | NOT REQUIRED | `lat_pulldown` | — | Alias |
| Neutral-Grip Lat Pulldown | NOT REQUIRED | `lat_pulldown` | — | Alias |
| Barbell Bent-Over Row | PRESENT UNDER ANOTHER NAME | `barbell_row` | — | Named "Barbell row" |
| Pendlay Row | NOT REQUIRED | `barbell_row` | — | Technique variant → alias |
| Dumbbell Single-Arm Row | PRESENT UNDER ANOTHER NAME | `one_arm_db_row` | — | Named "One-arm dumbbell row" |
| Chest-Supported Dumbbell Row | PRESENT UNDER ANOTHER NAME | `chest_row` | — | Named "Chest-supported row" |
| Seated Cable Row | ALREADY PRESENT | `seated_row` | — |  |
| Machine Row | COMPLETELY MISSING | — | H | Common plate-loaded / selectorised machine |
| T-Bar Row | COMPLETELY MISSING | — | O | Needs a landmine/T-bar — no key |
| Inverted Row | COMPLETELY MISSING | — | H | The only real bodyweight horizontal pull; home users have just prone raises today |
| Resistance Band Row | COMPLETELY MISSING | — | H | Needs a new `resistance_band` equipment key |
| Conventional Deadlift | COMPLETELY MISSING | — | H | Most-asked-about lift; add with the same restriction rule as the RDLs |
| Sumo Deadlift | COMPLETELY MISSING | — | O |  |
| Romanian Deadlift | ALREADY PRESENT | `barbell_rdl, dumbbell_rdl` | — |  |
| Rack Pull | COMPLETELY MISSING | — | O |  |
| Back Extension | ALREADY PRESENT | `back_extension` | — | "Back extension (glute focus)" |
| Good Morning | COMPLETELY MISSING | — | O |  |
| Barbell Shrug | COMPLETELY MISSING | — | O |  |
| Dumbbell Shrug | COMPLETELY MISSING | — | H | Traps have zero dedicated exercises |
| Farmer's Carry | ALREADY PRESENT | `farmer_carry` | — |  |

### Shoulders

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Standing Barbell Overhead Press | COMPLETELY MISSING | — | H | No barbell vertical press at all |
| Seated Dumbbell Shoulder Press | PRESENT UNDER ANOTHER NAME | `shoulder_press` | — | Named "Seated dumbbell press" |
| Arnold Press | VARIATION MISSING | `shoulder_press` | O |  |
| Machine Shoulder Press | ALREADY PRESENT | `machine_shoulder_press` | — |  |
| Landmine Press | COMPLETELY MISSING | — | O | No landmine key |
| Dumbbell Lateral Raise | ALREADY PRESENT | `lateral_raise` | — |  |
| Cable Lateral Raise | ALREADY PRESENT | `cable_lateral_raise` | — |  |
| Machine Lateral Raise | VARIATION MISSING | `lateral_raise` | O |  |
| Dumbbell Front Raise | COMPLETELY MISSING | — | O | Front delts already get a lot of pressing work |
| Plate Front Raise | NOT REQUIRED | — | — | Alias of front raise once added |
| Cable Front Raise | NOT REQUIRED | — | — | Alias of front raise once added |
| Reverse Dumbbell Fly | COMPLETELY MISSING | — | H | Rear delts: only face pull and prone Y/W today |
| Cable Reverse Fly | VARIATION MISSING | `face_pull` | O |  |
| Reverse Pec Deck | VARIATION MISSING | `pec_deck` | H | Same machine as pec deck; very common |
| Face Pull | PRESENT UNDER ANOTHER NAME | `face_pull` | — | Named "Cable face pull" |
| Upright Row | NOT REQUIRED | — | — | Shoulder-impingement risk for a beginner-first app; lateral raises cover it |
| Pike Push-Up | COMPLETELY MISSING | — | H | No home overhead press exists |
| Handstand Push-Up progression | NOT REQUIRED | — | — | Advanced; outside the app's beginner/intermediate scope |

### Biceps

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Barbell Biceps Curl | VARIATION MISSING | `ez_curl` | O |  |
| EZ-Bar Curl | PRESENT UNDER ANOTHER NAME | `ez_curl` | — | Named "EZ-bar biceps curl" |
| Dumbbell Biceps Curl | ALREADY PRESENT | `db_curl` | — |  |
| Alternating Dumbbell Curl | NOT REQUIRED | `db_curl` | — | Alias + cue |
| Seated Dumbbell Curl | NOT REQUIRED | `db_curl` | — | Alias |
| Hammer Curl | PRESENT UNDER ANOTHER NAME | `hammer_curl` | — | Named "Dumbbell hammer curl" |
| Cross-Body Hammer Curl | NOT REQUIRED | `hammer_curl` | — | Alias |
| Incline Dumbbell Curl | ALREADY PRESENT | `incline_db_curl` | — |  |
| Concentration Curl | COMPLETELY MISSING | — | O |  |
| Preacher Curl | PRESENT UNDER ANOTHER NAME | `preacher_curl` | — | Named "EZ-bar preacher curl" |
| Cable Biceps Curl | COMPLETELY MISSING | — | H | Cable-only users have no curl |
| Bayesian Cable Curl | COMPLETELY MISSING | — | O |  |
| Resistance Band Curl | COMPLETELY MISSING | — | H | Needs `resistance_band` key |
| Chin-Up | VARIATION MISSING | `assisted_pullup` | H | Also a biceps compound |

### Triceps

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Cable Triceps Pushdown | ALREADY PRESENT | `triceps_pushdown` | — |  |
| Rope Pushdown | PRESENT UNDER ANOTHER NAME | `rope_pushdown` | — | Named "Rope triceps pushdown" |
| Straight-Bar Pushdown | PRESENT UNDER ANOTHER NAME | `triceps_pushdown` | — | The bar attachment — alias |
| Overhead Dumbbell Triceps Extension | PRESENT UNDER ANOTHER NAME | `db_triceps_extension` | — | Named "Dumbbell overhead triceps extension" |
| Cable Overhead Triceps Extension | PRESENT UNDER ANOTHER NAME | `overhead_cable_extension` | — | Named "Overhead cable triceps extension" |
| Skull Crusher | COMPLETELY MISSING | — | H | Classic lying triceps extension |
| EZ-Bar Lying Triceps Extension | NOT REQUIRED | — | — | Same movement as skull crusher → alias |
| Dumbbell Kickback | COMPLETELY MISSING | — | O |  |
| Close-Grip Bench Press | VARIATION MISSING | `barbell_bench` | H | Compound triceps press; also covers the triceps list |
| Bench Dips | COMPLETELY MISSING | — | H | Home triceps move; `chair`/`bench` keys already exist |
| Parallel Bar Dips | COMPLETELY MISSING | — | O | Dip station — no key |
| Diamond Push-Up | VARIATION MISSING | `pushup` | O |  |

### Forearms and grip

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Wrist Curl | ALREADY PRESENT | `wrist_curl` | — |  |
| Reverse Wrist Curl | ALREADY PRESENT | `reverse_wrist_curl` | — |  |
| Reverse Barbell Curl | PRESENT UNDER ANOTHER NAME | `reverse_curl` | — | "Reverse curl" (EZ bar or dumbbells) |
| Reverse EZ-Bar Curl | PRESENT UNDER ANOTHER NAME | `reverse_curl` | — | Same |
| Farmer's Carry | ALREADY PRESENT | `farmer_carry` | — |  |
| Dead Hang | COMPLETELY MISSING | — | H | Grip + shoulder health; `pullup_bar` exists; needs hold-time tracking |
| Plate Pinch Hold | NOT REQUIRED | — | — | Niche |
| Wrist Roller | NOT REQUIRED | — | — | Niche equipment |

### Quadriceps

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Barbell Back Squat | PRESENT UNDER ANOTHER NAME | `back_squat` | — | Named "Barbell squat" |
| Barbell Front Squat | VARIATION MISSING | `back_squat` | O |  |
| Goblet Squat | ALREADY PRESENT | `goblet_squat` | — |  |
| Bodyweight Squat | ALREADY PRESENT | `bodyweight_squat` | — |  |
| Smith Machine Squat | ALREADY PRESENT | `smith_squat` | — |  |
| Hack Squat | ALREADY PRESENT | `hack_squat` | — |  |
| Leg Press | ALREADY PRESENT | `leg_press` | — |  |
| Leg Extension | ALREADY PRESENT | `leg_extension` | — |  |
| Bulgarian Split Squat | ALREADY PRESENT | `bulgarian_split_squat` | — |  |
| Forward Lunge | VARIATION MISSING | `reverse_lunge` | O |  |
| Reverse Lunge | PRESENT UNDER ANOTHER NAME | `reverse_lunge` | — | Only the *supported* version; a free/dumbbell reverse lunge is missing |
| Walking Lunge | VARIATION MISSING | `reverse_lunge` | H | Very common gym finisher |
| Step-Up | ALREADY PRESENT | `step_up` | — |  |
| Split Squat | PRESENT UNDER ANOTHER NAME | `split_squat, bodyweight_split_squat` | — | Supported versions |
| Wall Sit | COMPLETELY MISSING | — | H | Home isometric; needs hold-time tracking |

### Hamstrings

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Romanian Deadlift | ALREADY PRESENT | `barbell_rdl, dumbbell_rdl` | — |  |
| Stiff-Legged Deadlift | NOT REQUIRED | `barbell_rdl` | — | Near-identical to RDL → alias |
| Conventional Deadlift | COMPLETELY MISSING | — | H | Most-asked-about lift; add with the same restriction rule as the RDLs |
| Seated Leg Curl | PRESENT UNDER ANOTHER NAME | `hamstring_curl` | — | "Hamstring curl" on the leg curl machine — alias |
| Lying Leg Curl | PRESENT UNDER ANOTHER NAME | `hamstring_curl` | — | Alias |
| Standing Leg Curl | NOT REQUIRED | `hamstring_curl` | — | Alias |
| Nordic Hamstring Curl | COMPLETELY MISSING | — | O | Advanced |
| Glute-Ham Raise | NOT REQUIRED | — | — | Special bench |
| Single-Leg Romanian Deadlift | COMPLETELY MISSING | — | H | Unilateral hinge, works with one dumbbell or none |
| Resistance Band Leg Curl | COMPLETELY MISSING | — | O | Needs `resistance_band` key |

### Glutes

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Barbell Hip Thrust | VARIATION MISSING | `hip_thrust` | H | Only the bodyweight version exists |
| Dumbbell Hip Thrust | VARIATION MISSING | `hip_thrust` | O | `db_glute_bridge` is close |
| Glute Bridge | ALREADY PRESENT | `glute_bridge` | — |  |
| Single-Leg Glute Bridge | VARIATION MISSING | `glute_bridge` | H | Home progression |
| Cable Glute Kickback | COMPLETELY MISSING | — | O |  |
| Machine Glute Kickback | COMPLETELY MISSING | — | O |  |
| Bulgarian Split Squat | ALREADY PRESENT | `bulgarian_split_squat` | — |  |
| Sumo Squat | VARIATION MISSING | `goblet_squat` | O | Wide-stance goblet squat |
| Step-Up | ALREADY PRESENT | `step_up` | — |  |
| Frog Pump | NOT REQUIRED | — | — | Niche |
| Banded Lateral Walk | COMPLETELY MISSING | — | O | Needs `resistance_band` key |
| Clamshell | COMPLETELY MISSING | — | O |  |

### Calves

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Standing Calf Raise | ALREADY PRESENT | `calf_raise` | — |  |
| Seated Calf Raise | VARIATION MISSING | `calf_raise` | O |  |
| Leg Press Calf Raise | VARIATION MISSING | `calf_raise` | O |  |
| Single-Leg Calf Raise | VARIATION MISSING | `calf_raise` | H | Home progression |
| Donkey Calf Raise | NOT REQUIRED | — | — | Rare machine |
| Bodyweight Calf Raise | PRESENT UNDER ANOTHER NAME | `calf_raise` | — | `calf_raise` needs no equipment |

### Core and abs

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Crunch | COMPLETELY MISSING | — | H | The most basic ab move is missing |
| Reverse Crunch | ALREADY PRESENT | `reverse_crunch` | — |  |
| Sit-Up | NOT REQUIRED | — | — | Crunch covers it with less spine loading |
| Bicycle Crunch | COMPLETELY MISSING | — | H |  |
| V-Up | COMPLETELY MISSING | — | O | Intermediate |
| Toe Touch | NOT REQUIRED | — | — |  |
| Hanging Knee Raise | ALREADY PRESENT | `hanging_knee_raise` | — |  |
| Hanging Leg Raise | VARIATION MISSING | `hanging_knee_raise` | O |  |
| Lying Leg Raise | COMPLETELY MISSING | — | H | Home lower-ab move |
| Captain's Chair Knee Raise | VARIATION MISSING | `hanging_knee_raise` | O | Same move on a different station |
| Cable Crunch | ALREADY PRESENT | `cable_crunch` | — |  |
| Ab Wheel Rollout | COMPLETELY MISSING | — | O | No ab-wheel key |
| Plank | ALREADY PRESENT | `floor_plank` | — |  |
| Side Plank | ALREADY PRESENT | `side_plank` | — |  |
| Dead Bug | ALREADY PRESENT | `dead_bug` | — |  |
| Bird Dog | ALREADY PRESENT | `bird_dog` | — |  |
| Hollow Body Hold | COMPLETELY MISSING | — | O |  |
| Pallof Press | ALREADY PRESENT | `pallof_press` | — | Its equipment says "or band" but it requires `cable_machine` |
| Russian Twist | COMPLETELY MISSING | — | H | Rotation is thin (Pallof only) |
| Wood Chop | COMPLETELY MISSING | — | H | Cable or dumbbell rotation |
| Mountain Climber | COMPLETELY MISSING | — | H | Home conditioning staple |
| Bear Crawl | COMPLETELY MISSING | — | O |  |

### Full-body and functional

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Burpee | COMPLETELY MISSING | — | H |  |
| Kettlebell Swing | COMPLETELY MISSING | — | H | Needs a new `kettlebell` equipment key |
| Kettlebell Goblet Squat | METADATA MISSING | `goblet_squat` | H | Same move; `goblet_squat` should accept a kettlebell once the key exists |
| Thruster | COMPLETELY MISSING | — | O |  |
| Clean and Press | NOT REQUIRED | — | — | Technical Olympic-style lift |
| Farmer's Carry | ALREADY PRESENT | `farmer_carry` | — |  |
| Turkish Get-Up | NOT REQUIRED | — | — | Technical; low value for beginners |
| Battle Rope | COMPLETELY MISSING | — | O | No key |
| Box Jump | COMPLETELY MISSING | — | O | Impact; intermediate |
| Sled Push | NOT REQUIRED | — | — | Rare equipment |
| Sled Pull | NOT REQUIRED | — | — | Rare equipment |
| Medicine Ball Slam | COMPLETELY MISSING | — | O | No key |
| Bear Crawl | COMPLETELY MISSING | — | O |  |
| Jump Squat | COMPLETELY MISSING | — | H | Home conditioning |

### Home and bodyweight

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Pike Push-Up | COMPLETELY MISSING | — | H | No home overhead press exists |
| Bodyweight Squat | ALREADY PRESENT | `bodyweight_squat` | — |  |
| Split Squat | PRESENT UNDER ANOTHER NAME | `split_squat, bodyweight_split_squat` | — | Supported versions |
| Reverse Lunge | PRESENT UNDER ANOTHER NAME | `reverse_lunge` | — | Only the *supported* version; a free/dumbbell reverse lunge is missing |
| Step-Up | ALREADY PRESENT | `step_up` | — |  |
| Glute Bridge | ALREADY PRESENT | `glute_bridge` | — |  |
| Single-Leg Glute Bridge | VARIATION MISSING | `glute_bridge` | H | Home progression |
| Plank | ALREADY PRESENT | `floor_plank` | — |  |
| Side Plank | ALREADY PRESENT | `side_plank` | — |  |
| Dead Bug | ALREADY PRESENT | `dead_bug` | — |  |
| Bird Dog | ALREADY PRESENT | `bird_dog` | — |  |
| Mountain Climber | COMPLETELY MISSING | — | H | Home conditioning staple |
| Burpee | COMPLETELY MISSING | — | H |  |
| Jumping Jack | COMPLETELY MISSING | — | H |  |
| High Knees | COMPLETELY MISSING | — | H |  |
| Butt Kicks | COMPLETELY MISSING | — | O |  |
| Wall Sit | COMPLETELY MISSING | — | H | Home isometric; needs hold-time tracking |
| Resistance Band Row | COMPLETELY MISSING | — | H | Needs a new `resistance_band` equipment key |
| Resistance Band Chest Press | COMPLETELY MISSING | — | O | Band key |
| Resistance Band Shoulder Press | COMPLETELY MISSING | — | O | Band key |
| Resistance Band Pull-Apart | COMPLETELY MISSING | — | H | Cheap rear-delt / posture move |
| Resistance Band Biceps Curl | COMPLETELY MISSING | — | H | = Resistance Band Curl |
| Resistance Band Triceps Extension | COMPLETELY MISSING | — | O | Band key |

### Cardio

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Walking | PRESENT UNDER ANOTHER NAME | `comfortable_walk` | — | "Comfortable walk"; pattern wrongly set to `carry` |
| Brisk Walking | VARIATION MISSING | `comfortable_walk` | H |  |
| Jogging | COMPLETELY MISSING | — | H | Needs duration/distance tracking |
| Running | COMPLETELY MISSING | — | H | Needs duration/distance tracking |
| Sprint Intervals | VARIATION MISSING | `interval_cardio` | O |  |
| Cycling | COMPLETELY MISSING | — | H | Outdoor; duration/distance |
| Swimming | COMPLETELY MISSING | — | O |  |
| Hiking | COMPLETELY MISSING | — | O |  |
| Treadmill Walking | METADATA MISSING | `easy_cardio` | H | Folded into the generic `easy_cardio`, which requires no equipment although it needs a machine |
| Treadmill Running | COMPLETELY MISSING | — | O |  |
| Stationary Bike | METADATA MISSING | `easy_cardio` | H | Same — generic entry, `cardio_machine` key unused |
| Indoor Cycling | NOT REQUIRED | — | — | Alias of stationary bike |
| Elliptical | METADATA MISSING | `easy_cardio` | H | Same |
| Rowing Machine | METADATA MISSING | `easy_cardio` | H | Same; also full-body |
| Stair Climber | COMPLETELY MISSING | — | O |  |
| Ski Ergometer | NOT REQUIRED | — | — | Rare |
| Jump Rope | COMPLETELY MISSING | — | H | Needs a `jump_rope` key or treat as no-equipment |
| Jumping Jacks | COMPLETELY MISSING | — | H | = Jumping Jack |
| High Knees | COMPLETELY MISSING | — | H |  |
| Marching in Place | PRESENT UNDER ANOTHER NAME | `march_in_place` | — | "Easy march in place"; pattern wrongly `carry` |
| Running in Place | VARIATION MISSING | `march_in_place` | O |  |
| Butt Kicks | COMPLETELY MISSING | — | O |  |
| Mountain Climbers | COMPLETELY MISSING | — | H | = Mountain Climber |
| Burpees | COMPLETELY MISSING | — | H | = Burpee |
| Squat Jumps | COMPLETELY MISSING | — | H | = Jump Squat |
| Skaters | COMPLETELY MISSING | — | O |  |
| Shadow Boxing | COMPLETELY MISSING | — | O |  |
| Low-Impact Marching | PRESENT UNDER ANOTHER NAME | `march_in_place` | — |  |
| Step Touch | COMPLETELY MISSING | — | H | Low-impact home cardio |
| Low-Impact Jumping Jack | COMPLETELY MISSING | — | H | Low-impact home cardio |
| Stationary Cycling | NOT REQUIRED | — | — | Alias of stationary bike |
| Low-Impact Step-Ups | PRESENT UNDER ANOTHER NAME | `step_up` | — |  |

### Training formats

| Candidate | Status | Existing ID | Priority | Note |
|---|---|---|---|---|
| Steady-State Cardio | PRESENT UNDER ANOTHER NAME | `easy_cardio` | — | A training format |
| Interval Training | PRESENT UNDER ANOTHER NAME | `interval_cardio` | — | A training format |
| HIIT Circuit | NOT REQUIRED | — | — | A workout format → planner template, not a library exercise |
| Low-Impact Cardio Circuit | NOT REQUIRED | — | — | A workout format → planner template |
