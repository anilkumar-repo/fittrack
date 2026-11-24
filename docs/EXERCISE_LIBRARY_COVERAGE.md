# Exercise library coverage

Date: 2026-11-23. Source: `EXERCISE_LIBRARY_AUDIT.md`. The "After R6" columns are the plan if every high-priority exercise in §6 is added. Nothing has been added yet.

## 1. Totals

| | Now | After R6 (high priority) |
|---|---|---|
| Exercises | **77** | **127** (+50) |
| Duplicates removed or merged | 0 (none found) | 0. Variants become aliases, not copies. |
| Exercise IDs changed | — | 0 (all kept) |
| Metadata fixes | — | 10 (audit §4) |

## 2. By muscle group (primary muscle, mapped to groups)

| Group | Now | After R6 | Gap today |
|---|---|---|---|
| Quads | 13 | 15 | Fine. No walking lunge or wall sit. |
| Back (lats, mid, upper) | 11 | 17 | No real pull-up/chin-up, no bodyweight row, no deadlift |
| Traps | **0** | 1 | Nothing at all |
| Core | 10 | 16 | No crunch, almost no rotation (Pallof only) |
| Chest | 9 | 14 | No machine chest press, no floor press for home |
| Shoulders | 6 | 11 | No barbell or home overhead press; rear delts thin |
| Biceps | 5 | 7 | Nothing for cable-only or band users |
| Hamstrings | 5 | 6 | No single-leg hinge |
| Glutes | 4 | 6 | No loaded hip thrust |
| Triceps | 4 | 6 | No skull crusher; no home triceps move |
| Forearms & grip | 4 | 5 | No dead hang |
| Calves | 1 | 2 | Only one calf exercise |
| Cardio / conditioning | 4 | 20 | Only walk, march and two generic cardio entries |
| Recovery | 1 | 1 | Stretches live in `mobility.ts` |

(Today `comfortable_walk` and `march_in_place` are tagged "Legs"/"Calves"; they are counted as cardio here. See audit §4 #1.)

## 3. By equipment (`requiredEquipment`; one exercise can need several keys)

| Key | Exercises now | Note |
|---|---|---|
| none | 24 | |
| dumbbells | 18 | |
| bench | 13 | |
| cable_machine | 12 | |
| barbell | 6 | Includes the EZ bar |
| gym_machines | 4 | |
| rack · pullup_bar | 2 each | |
| leg_press · leg_curl_machine · smith_machine · chair · step · back_extension | 1 each | |
| mat | 0 | Key exists, used only in display text |
| cardio_machine | **0** | Key exists but no exercise uses it |
| resistance_band | — | **No key.** Blocks 9 candidates |
| kettlebell | — | **No key.** Blocks swing and goblet squat |

## 4. By training location (derived from equipment)

| Location | Now | After R6 (approx.) |
|---|---|---|
| Home, no equipment | 25 | ~45 |
| Home, dumbbells / bench / step | 23 | ~25 |
| Home, bands or kettlebell | 0 | 6 |
| Gym only | 29 | ~38 |
| Outdoor (walk/run/cycle) | 1 | 5 |

## 5. By category and difficulty

| Category | Now | | Difficulty | Now |
|---|---|---|---|---|
| strength | 61 | | beginner | 69 |
| core | 11 | | intermediate | 8 |
| conditioning | 5 | | advanced | 0 (not used; fits the audience) |

## 6. Missing — high priority (the R6 list, 50)

Batch A, upper body (22) — ✅ added 2026-11-23 (`src/lib/library-additions.ts`):
- **Chest:** Machine chest press · Barbell incline bench press · Close-grip bench press · Dumbbell floor press · Knee push-up
- **Back:** Pull-up · Chin-up · Machine row · Inverted row · Resistance band row · Conventional deadlift (trainer restriction, like the RDLs) · Dumbbell shrug
- **Shoulders:** Standing barbell overhead press · Pike push-up · Reverse dumbbell fly · Reverse pec deck · Resistance band pull-apart
- **Arms:** Cable biceps curl · Resistance band curl · Skull crusher · Bench dips · Dead hang

Batch B, lower body + core (12) — ✅ added 2026-11-23:
- **Legs:** Walking lunge · Wall sit · Single-leg Romanian deadlift · Barbell hip thrust · Single-leg glute bridge · Single-leg calf raise
- **Core:** Crunch · Bicycle crunch · Lying leg raise · Russian twist · Wood chop · Mountain climber

Batch C, cardio + home conditioning (16) — ✅ added 2026-11-24 (time/distance tracking from R5):
- **Machines** (split out of `easy_cardio`): Treadmill walk · Stationary bike · Elliptical · Rowing machine
- **Outdoor:** Brisk walk · Jog · Run · Cycling
- **Home:** Jumping jack · Low-impact jumping jack · Step touch · High knees · Jump squat · Burpee · Jump rope · Kettlebell swing

22 + 12 + 16 = 50.

Metadata only (no new exercise): Kettlebell goblet squat → allow a kettlebell on `goblet_squat`.

## 7. Missing — optional variations (later, 59)

- **Chest:** Barbell decline bench · Dumbbell decline bench · Incline dumbbell fly · High-to-low and low-to-high cable crossover · Standing cable chest press · Smith machine bench press · Decline push-up · Diamond push-up · Chest dips
- **Back:** T-bar row · Sumo deadlift · Rack pull · Good morning · Barbell shrug
- **Shoulders:** Arnold press · Landmine press · Machine lateral raise · Dumbbell front raise · Cable reverse fly
- **Arms:** Barbell biceps curl · Concentration curl · Bayesian cable curl · Dumbbell kickback · Parallel bar dips
- **Legs:** Barbell front squat · Forward lunge · Nordic hamstring curl · Resistance band leg curl · Dumbbell hip thrust · Cable glute kickback · Machine glute kickback · Sumo squat · Banded lateral walk · Clamshell · Seated calf raise · Leg press calf raise
- **Core:** V-up · Hanging leg raise · Captain's chair knee raise · Ab wheel rollout · Hollow body hold · Bear crawl
- **Functional:** Thruster · Battle rope · Box jump · Medicine ball slam
- **Bands / home:** Butt kicks · Band chest press · Band shoulder press · Band triceps extension
- **Cardio:** Sprint intervals · Swimming · Hiking · Treadmill run · Stair climber · Running in place · Skaters · Shadow boxing

## 8. Becomes an alias, not a new exercise (selection)

"Military press" → overhead press · "RDL" / "stiff-legged deadlift" → `barbell_rdl` · "Pec deck fly" → `pec_deck` · "Lat pull-down", "wide/close/neutral-grip pulldown" → `lat_pulldown` · "Bent-over row", "Pendlay row" → `barbell_row` · "Straight-bar pushdown" → `triceps_pushdown` · "Seated/lying/standing leg curl" → `hamstring_curl` · "Alternating / seated curl" → `db_curl` · "Cross-body hammer curl" → `hammer_curl` · "Reverse EZ-bar curl" → `reverse_curl` · "Indoor / stationary cycling" → stationary bike · "Dumbbell chest press" → `dumbbell_bench` · "Barbell back squat" → `back_squat`.

## 9. Not adding (and why)

Upright row (shoulder impingement risk; lateral raises cover it) · Handstand push-up (advanced) · Clean and press, Turkish get-up (technical; low value for beginners) · Sled push/pull, Glute-ham raise, Donkey calf raise, Ski erg (rare equipment) · Sit-up, Toe touch, Frog pump, Plate pinch, Wrist roller (covered by other moves, or niche) · HIIT circuit, Low-impact cardio circuit (workout formats → planner templates, not exercises).
