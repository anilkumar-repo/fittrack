# RozFit — pictures to make (open items)

Made 2026-11-17. Everything below is ready in the app's code; it only needs your pictures. Work one section at a time,
send a folder (any file names are fine, but the names below save us both time) and I'll cut them in, check them and
put them live. Nothing here is urgent: the app works without them and shows the current pictures until they arrive.

| # | What | Pictures | Where it shows | Phase |
|---|---|---|---|---|
| 1 | Recovery map **side view** | 33 (11 per figure) | Recovery → Front / **Side** / Back | 3 (gap) |
| 2 | **Moving stretch** pictures | 124 strips | Stretch & mobility: move sheet, guided player, thumbnails | 5 |
| 3 | **Moving strength exercise** pictures | 74 strips | Exercise guide "How to" tab, workout cards | 5 |
| 4 | Short real **video clips** | later | Exercise guide | 5 (last) |

**Order I suggest:** 1 first (small, and the Side tab switches on as soon as one figure is complete), then 2 and 3 one
group at a time. In section 2, "Spine & back", "Hips & inner thighs" and "Core & posture" appear in the most routines;
in section 3, the strength exercises come first (they're in every program).

---

## 1. Recovery map side view (33 pictures)

The recovery map gets a **Side** tab between Front and Back. The code is done and switched off; it turns on per figure
(female / male / neutral) as soon as that figure's 11 side pictures are in. Same style as the existing body pictures,
so the three views match.

**Save as:** `design/figures-incoming/singles/{figure}-{muscle}-side.png` (PNG or WebP), for example `male-chest-side.png`.

**Best way (same as the front/back set):**
1. Make **`{figure}-base-side`** first, using the female/male/neutral line from the table below.
2. For every muscle, **edit that base picture** (image edit / "vary region") with the edit sentence. Editing keeps the body identical, so switching muscles never jumps.
3. Don't crop. Keep the full portrait canvas.

**Shared prompt (paste first):**
```
Full-body anatomical 3D render, écorché style: smooth matte light-grey skin (#E4E4E1) showing detailed surface musculature, no clothing, no genitals detail, tasteful and clinical.
Side view (profile): the figure's LEFT side faces the camera. Standing straight and relaxed, feet hip-width apart, arms hanging naturally slightly in front of the hips so the side of the chest, the waist and the back stay visible, fingers relaxed.
ONE single figure only, centred. The whole body — head, both hands with every fingertip, both feet — fully inside the frame with at least 10% empty space on every side. Nothing touches or crosses the edge.
Soft, even studio light. Pure black background (#000000), no floor, no shadow, no reflection, no text, no logo, no watermark.
Portrait 1024 x 2048 (1:2).
```

**Figure line (add one):**

| Figure | Line |
|---|---|
| female | `Athletic adult woman, toned and defined, hair in a neat high bun, calm neutral face.` |
| male | `Athletic adult man, lean and muscular, short buzz-cut hair, calm neutral face.` |
| neutral | `Gender-neutral athletic mannequin, smooth bald head, soft simplified face, balanced proportions (neither male nor female).` |

**Highlight colour:** vivid red-orange **#E5482F**, glossy, following the exact muscle shape with clean edges; every other muscle stays grey.

| File | Edit sentence |
|---|---|
| `{figure}-base-side` | `No muscles highlighted; the whole body is light grey.` |
| `{figure}-shoulders-side` | `Edit this image: paint only the deltoid (front, side and rear heads) of the near shoulder red-orange.` |
| `{figure}-chest-side` | `Edit this image: paint only the pectoral (chest) muscle visible on the near side red-orange.` |
| `{figure}-back-side` | `Edit this image: paint only the latissimus dorsi and the trapezius visible from the side red-orange.` |
| `{figure}-arms-side` | `Edit this image: paint only the biceps and triceps of the near upper arm red-orange.` |
| `{figure}-forearms-side` | `Edit this image: paint only the forearm muscles of the near arm, elbow to wrist, red-orange.` |
| `{figure}-core-side` | `Edit this image: paint only the obliques and the side edge of the abdominals red-orange.` |
| `{figure}-glutes-side` | `Edit this image: paint only the gluteus maximus and gluteus medius seen from the side red-orange.` |
| `{figure}-quads-side` | `Edit this image: paint only the quadriceps on the front of the near thigh red-orange.` |
| `{figure}-hamstrings-side` | `Edit this image: paint only the hamstrings on the back of the near thigh red-orange.` |
| `{figure}-calves-side` | `Edit this image: paint only the calf muscles (gastrocnemius and soleus) of the near leg red-orange.` |

`{figure}` = female, male, neutral → 11 × 3 = **33 pictures**. One complete figure is enough to switch the Side tab on for people who use that figure.

---

## 2. Moving stretch pictures (124 strips)

Six moves already move (cat-cow, glute bridge, arm swings, 90/90 hip switch, kneeling hip extension, adductor rock-back).
The rest are below. **Make each move as ONE picture: a horizontal strip of 3 equal panels** (frame 1 → 2 → 3). This is
what worked best: one generation keeps the man, camera and lighting identical. Arrows between panels and thin divider
lines are fine; my script removes them.

**Save as:** `<id>.png` (the id from the table), all in one folder.

**Strip prompt (paste, then add the move line from the table):**
```
Anatomical 3D render of a bald, athletic man with smooth light-grey skin and visible muscle detail, on a solid black background. Show the move as a horizontal strip of 3 equal panels, left to right: panel 1 the starting position, panel 2 halfway, panel 3 the full position described below. The same man, camera angle, zoom and position in every panel; hands, feet and knees that stay on the floor are in exactly the same place in each panel. Soft orange glow on the working muscles. Any prop (chair, bench, wall, band, box, foam roller) in dark grey with small coral accents. No text, no labels. Wide picture, about 3 : 1.
Move:
```

For **holds** (a stretch you stay in), panel 1 is the easy starting position just before the stretch, panel 2 easing in,
panel 3 the full stretch. For **reps** and **breathing**, panels 1 and 3 are the two ends of the movement.

### Neck & upper back (5)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `neck-side-tilt` | Neck side tilt | hold, each side | `Neck side tilt: Sitting tall on a chair, head tilted ear toward one shoulder, opposite shoulder relaxed down. Glow: Upper traps, side of neck.` |
| `chin-to-chest` | Chin-to-chest stretch | hold | `Chin-to-chest stretch: Standing tall, chin gently tucked to the chest. Glow: Back of the neck.` |
| `shoulder-rolls` | Shoulder rolls | hold | `Shoulder rolls: Sitting tall on a chair, both shoulders lifted and rolling backward. Glow: Upper traps.` |
| `upper-trap-stretch` | Upper-trap stretch with hand | hold, each side | `Upper-trap stretch with hand: Sitting tall, one hand gently drawing the head diagonally forward and to the side, other hand under the thigh. Glow: Upper traps.` |
| `dead-hang` | Dead hang | hold | `Dead hang: Hanging from an overhead bar with straight arms, shoulder-width grip, body long and relaxed. Glow: Lats, shoulders, grip.` |

### Shoulders & chest (7)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `seated-chest-opener` | Seated chest opener | hold | `Seated chest opener: Sitting near the front of a chair, hands holding the chair back behind the body, chest lifted and shoulders pulled back. Glow: Chest, front shoulders.` |
| `doorway-chest-stretch` | Doorway chest stretch | hold, each side | `Doorway chest stretch: Standing in a door frame, forearm resting on the frame at shoulder height, stepping through with the chest. Glow: Chest.` |
| `cross-body-arm-stretch` | Cross-body arm stretch | hold, each side | `Cross-body arm stretch: Standing, one straight arm pulled across the chest by the other forearm. Glow: Rear shoulder, triceps.` |
| `band-pull-apart` | Band pull-apart | hold | `Band pull-apart: Standing, arms straight in front at shoulder height, pulling a resistance band apart to the sides. Glow: Rear shoulders, upper back.` |
| `stick-pass-through` | Stick shoulder pass-through | hold | `Stick shoulder pass-through: Standing, holding a long dowel with a wide grip, arms straight, moving it from the hips over the head and behind. Glow: Shoulders, chest.` |
| `wall-slide` | Wall slide | hold | `Wall slide: Facing a wall, forearms on the wall in a W shape, sliding the arms up into a Y. Glow: Lower traps, serratus.` |
| `prone-y-raise` | Prone Y raise | hold | `Prone Y raise: Lying face down on a mat, arms raised overhead in a Y with thumbs up, chest lightly lifted. Glow: Lower traps.` |

### Arms & wrists (8)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `overhead-triceps-stretch` | Overhead triceps stretch | hold, each side | `Overhead triceps stretch: Standing, one elbow bent behind the head, the other hand gently pressing the elbow. Glow: Triceps.` |
| `reaching-down-triceps-stretch` | Reaching-down triceps stretch | hold, each side | `Reaching-down triceps stretch: Standing, one hand reaching down between the shoulder blades from above, the other hand reaching up from below toward it. Glow: Triceps.` |
| `dip-stretch` | Seated dip stretch | hold | `Seated dip stretch: Sitting on the floor, legs straight, hands behind the hips with fingers pointing back, chest lifted, leaning back. Glow: Triceps, chest.` |
| `towel-triceps-stretch` | Towel triceps stretch | hold, each side | `Towel triceps stretch: Standing, holding a towel behind the back with one hand above the head and one at the low back, top hand pulled down by the bottom hand. Glow: Triceps.` |
| `wrist-flexor-stretch` | Wrist flexor stretch | hold, each side | `Wrist flexor stretch: Standing, arm straight forward palm up, fingers gently pulled down and back by the other hand. Glow: Inner forearm.` |
| `wrist-extensor-stretch` | Wrist extensor stretch | hold, each side | `Wrist extensor stretch: Standing, arm straight forward palm down, back of the hand gently pressed down by the other hand. Glow: Outer forearm.` |
| `finger-band-extensions` | Finger band extensions | hold, each side | `Finger band extensions: Close view of one hand with a small rubber band around the fingertips, fingers spreading open; torso visible behind. Glow: Hands, forearm extensors.` |
| `forearm-wall-stretch` | Prayer wrist stretch | hold | `Prayer wrist stretch: Standing, palms pressed together in front of the chest, elbows lifted to the sides, hands lowered toward the waist. Glow: Forearms.` |

### Spine & back (13)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `thread-the-needle` | Thread the needle | hold, each side | `Thread the needle: On hands and knees, one arm sliding under the body along the floor, that shoulder and cheek resting down. Glow: Upper back, rear shoulder.` |
| `childs-pose` | Child's pose | hold | `Child's pose: Kneeling, hips back on the heels, arms stretched forward on the floor, forehead down. Glow: Lats, low back.` |
| `quadruped-t-spine-rotation` | Quadruped thoracic rotation | hold, each side | `Quadruped thoracic rotation: On hands and knees, one arm reaching straight up toward the ceiling, chest turned open. Glow: Upper back.` |
| `side-lying-open-book` | Side-lying open book | hold, each side | `Side-lying open book: Lying on one side, knees bent together, top arm sweeping open behind toward the floor, chest turned to the ceiling. Glow: Upper back, chest.` |
| `foam-roller-t-spine` | Foam roller thoracic extension | hold | `Foam roller thoracic extension: Lying on the back with a foam roller under the upper back, knees bent, hands behind the head, chest arching over the roller. Glow: Upper back.` |
| `seated-thoracic-extension` | Seated thoracic extension | hold | `Seated thoracic extension: Sitting on a chair, hands behind the head, upper back arching over the chair back, chest lifted. Glow: Upper back.` |
| `seated-spinal-twist` | Seated spinal twist | hold, each side | `Seated spinal twist: Sitting on a chair, torso rotated to one side, one hand on the chair back, other hand on the opposite knee. Glow: Obliques, low back.` |
| `seated-side-bend` | Seated side bend | hold, each side | `Seated side bend: Sitting on a chair, one arm reaching overhead and over to the opposite side, other hand on the chair. Glow: Obliques, lats.` |
| `standing-side-bend` | Standing side bend | hold, each side | `Standing side bend: Standing tall, one arm reaching overhead and over to the side, other hand on the hip. Glow: Obliques, lats.` |
| `supine-spinal-twist` | Lying spinal twist | hold | `Lying spinal twist: Lying on the back, arms out in a T, both bent knees dropped to one side, head turned the other way. Glow: Low back, glutes.` |
| `standing-back-extension` | Standing back extension | hold | `Standing back extension: Standing, hands on the low back, gently leaning back and looking up. Glow: Abs, hip flexors.` |
| `seated-forward-fold-chair` | Seated forward fold | hold | `Seated forward fold: Sitting on a chair, torso folded down over the thighs, arms hanging toward the feet. Glow: Low back, hamstrings.` |
| `puppy-pose` | Puppy pose | hold | `Puppy pose: Kneeling with hips above the knees, arms stretched forward, chest sinking toward the floor. Glow: Lats, upper back.` |

### Breathing (8)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `crocodile-breathing` | Crocodile breathing | breaths | `Crocodile breathing: Lying face down, forehead resting on stacked hands, legs long. Glow: Diaphragm, low back.` |
| `90-90-breathing` | 90-90 breathing | breaths | `90-90 breathing: Lying on the back, calves resting on a box so hips and knees are bent 90 degrees, hands on the lower ribs. Glow: Diaphragm, core.` |
| `seated-360-breathing` | Seated 360 breathing | breaths | `Seated 360 breathing: Sitting tall on a chair, hands wrapped around the lower ribs. Glow: Ribs, diaphragm.` |
| `childs-pose-breathing` | Child's pose breathing | breaths | `Child's pose breathing: Kneeling child's pose, arms forward, back ribs expanding. Glow: Back ribs.` |
| `quadruped-breathing` | All-fours breathing | breaths | `All-fours breathing: On hands and knees with a flat back, belly drawn in. Glow: Core, ribs.` |
| `wall-lean-breathing` | Wall-supported breathing | breaths | `Wall-supported breathing: Back resting on a wall, knees slightly bent, one hand on the belly. Glow: Ribs, core.` |
| `bridge-breathing-block` | Supported bridge breathing | breaths | `Supported bridge breathing: Lying on the back, hips resting on a block, knees bent, arms by the sides. Glow: Ribs, glutes.` |
| `legs-up-the-wall` | Legs up the wall | breaths | `Legs up the wall: Lying on the back with hips near a wall, legs straight up resting on the wall, arms relaxed. Glow: Relaxation, hamstrings.` |

### Core & posture (14)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `posterior-pelvic-tilt` | Pelvic tilt | hold | `Pelvic tilt: Lying on the back, knees bent, feet flat, pressing the low back into the floor. Glow: Deep core, low back.` |
| `dead-bug` | Dead bug | hold | `Dead bug: Lying on the back, one arm reaching overhead and the opposite leg extended long just above the floor, other arm and knee up at 90 degrees. Glow: Deep core.` |
| `hollow-body-hold` | Hollow body hold | hold | `Hollow body hold: Lying on the back, shoulders and legs lifted off the floor, arms reaching past the head, low back pressed down. Glow: Abs.` |
| `forearm-plank` | Forearm plank | hold | `Forearm plank: On forearms and toes, body in a straight line from head to heels. Glow: Core, shoulders.` |
| `high-plank` | High plank | hold | `High plank: On straight arms and toes, hands under the shoulders, body in a straight line. Glow: Core, shoulders.` |
| `plank-arm-raise` | Plank arm raise | hold | `Plank arm raise: High plank with one arm reaching straight forward at shoulder height, hips level. Glow: Core, shoulders.` |
| `plank-leg-raise` | Plank leg raise | hold | `Plank leg raise: High plank with one straight leg lifted behind, hips level. Glow: Core, glutes.` |
| `side-plank` | Side plank | hold, each side | `Side plank: Resting on one forearm and the edge of the feet, hips lifted in a straight line, top hand on the hip. Glow: Obliques, hip.` |
| `side-plank-rotation` | Side plank rotation | hold, each side | `Side plank rotation: Side plank on one forearm, top arm threading under the body, torso rotating down. Glow: Obliques.` |
| `side-plank-leg-raise` | Side plank star | hold, each side | `Side plank star: Side plank on one straight arm, top leg raised high. Glow: Obliques, outer hip.` |
| `copenhagen-plank` | Copenhagen plank | hold, each side | `Copenhagen plank: Side plank on one forearm with the top leg resting on a bench, bottom leg lifted to meet the bench. Glow: Inner thigh, obliques.` |
| `wall-posture` | Wall posture check | hold | `Wall posture check: Standing with heels, hips, upper back and head touching a wall, one hand behind the low back. Glow: Posture.` |
| `hip-hinge-drill` | Hip hinge drill | hold | `Hip hinge drill: Standing, hands on the hips, knees soft, hips pushed back with a flat back and chest forward. Glow: Hamstrings, glutes.` |
| `bird-dog` | Bird dog | hold | `Bird dog: On hands and knees, one arm reaching forward and the opposite leg reaching back, both level with the back. Glow: Core, glutes, back.` |

### Hips & inner thighs (24)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `butterfly-stretch` | Butterfly stretch | hold | `Butterfly stretch: Sitting tall on the floor, soles of the feet together, knees dropped out to the sides, hands holding the feet. Glow: Inner thighs.` |
| `butterfly-forward-fold` | Butterfly forward fold | hold | `Butterfly forward fold: Butterfly sitting position, torso folded forward, hands on the floor ahead of the feet. Glow: Inner thighs, low back.` |
| `frog-stretch` | Frog stretch | hold | `Frog stretch: On forearms and knees, knees wide apart, shins parallel, feet turned out, hips sinking back. Glow: Inner thighs, hips.` |
| `seated-straddle` | Seated straddle | hold | `Seated straddle: Sitting tall, legs straight and wide apart, hands on the floor behind the hips. Glow: Inner thighs, hamstrings.` |
| `straddle-forward-fold` | Straddle forward fold | hold | `Straddle forward fold: Legs straight and wide apart, torso folding forward between the legs, hands on the floor. Glow: Inner thighs, hamstrings.` |
| `cossack-squat` | Cossack squat | hold, each side | `Cossack squat: Deep squat over one bent leg, other leg straight out to the side with toes up, hands together at the chest. Glow: Inner thighs, glutes.` |
| `side-lunge-stretch` | Standing side lunge stretch | hold, each side | `Standing side lunge stretch: Wide stance, one knee bent with the hand on it, other leg straight, torso upright. Glow: Inner thighs.` |
| `adductor-squeeze` | Adductor ball squeeze | hold | `Adductor ball squeeze: Lying on the back, knees bent, a soft ball squeezed between the knees. Glow: Inner thighs.` |
| `side-lying-inner-thigh-lift` | Side-lying inner-thigh lift | hold, each side | `Side-lying inner-thigh lift: Lying on one side, head on the hand, top leg bent with the foot on the floor in front, bottom leg straight and lifted. Glow: Inner thighs.` |
| `deep-squat-hold` | Deep squat hold | hold | `Deep squat hold: Feet shoulder-width, heels down, hips low between the knees, hands together at the chest, elbows pressing the knees open. Glow: Hips, ankles.` |
| `goblet-squat-hold` | Goblet squat hold | hold | `Goblet squat hold: Deep squat holding a kettlebell at the chest, chest tall. Glow: Hips, quads.` |
| `overhead-squat-reach` | Overhead squat reach | hold | `Overhead squat reach: Deep squat with both arms reaching straight up overhead. Glow: Hips, upper back.` |
| `half-kneeling-hip-flexor` | Half-kneeling hip flexor stretch | hold, each side | `Half-kneeling hip flexor stretch: Kneeling on one knee, other foot forward, hips pushed gently forward, torso tall, hands on the front knee. Glow: Hip flexors, quads.` |
| `couch-stretch` | Couch stretch | hold, each side | `Couch stretch: Half-kneeling with the back knee near a wall and the back shin up against the wall, torso upright, hands on the front knee. Glow: Quads, hip flexors.` |
| `worlds-greatest-stretch` | World's greatest stretch | hold, each side | `World's greatest stretch: Long lunge with the back knee off the floor, one hand on the floor inside the front foot, the other arm reaching straight up with the chest turned open. Glow: Hips, upper back.` |
| `pigeon-stretch` | Pigeon stretch | hold, each side | `Pigeon stretch: Front shin across the body on the floor, back leg straight behind, torso upright, hands on the floor. Glow: Glutes, outer hip.` |
| `pigeon-forward-fold` | Pigeon forward fold | hold, each side | `Pigeon forward fold: Pigeon position with the torso folded forward over the front shin, arms long on the floor. Glow: Glutes.` |
| `seated-figure-4` | Seated figure-4 | hold, each side | `Seated figure-4: Sitting on a chair, one ankle crossed over the opposite knee, chest leaning slightly forward, hands on the shin. Glow: Glutes.` |
| `supine-figure-4` | Lying figure-4 | hold, each side | `Lying figure-4: Lying on the back, one ankle crossed over the opposite knee, hands pulling the bottom thigh toward the chest. Glow: Glutes.` |
| `seated-knee-hug` | Seated knee hug | hold, each side | `Seated knee hug: Sitting on a chair, one knee hugged to the chest with both arms. Glow: Glutes, low back.` |
| `standing-hip-flexor` | Standing hip flexor stretch | hold | `Standing hip flexor stretch: Split stance, back heel lifted, hands on the hips, hips pushed forward, torso tall. Glow: Hip flexors.` |
| `elevated-side-lunge` | Box side lunge stretch | hold, each side | `Box side lunge stretch: Hands on a box, one leg bent forward, the other straight back and to the side, hips sinking. Glow: Inner thighs, hips.` |
| `low-lunge-rotation` | Low lunge hip rotation | hold, each side | `Low lunge hip rotation: Low lunge with the back knee down, front knee falling outward, one hand on the front knee. Glow: Hips.` |
| `kneeling-shin-stretch` | Kneeling shin stretch | hold, each side | `Kneeling shin stretch: Half-kneeling, back foot pointed with the top of the foot flat on the floor, hands on the front knee. Glow: Shins, quads.` |

### Legs & ankles (8)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `seated-hamstring-stretch` | Seated single-leg hamstring stretch | hold, each side | `Seated single-leg hamstring stretch: Sitting on the floor, one leg straight, the other bent with the sole against the inner thigh, reaching both hands toward the straight foot. Glow: Hamstrings.` |
| `seated-pike-stretch` | Seated forward fold (both legs) | hold | `Seated forward fold (both legs): Sitting with both legs straight together, torso folded forward, hands holding the feet. Glow: Hamstrings, low back.` |
| `chair-hamstring-stretch` | Chair hamstring stretch | hold, each side | `Chair hamstring stretch: Sitting at the edge of a chair, one leg straight with heel on the floor and toes up, leaning forward with a flat back, hands on the thigh. Glow: Hamstrings.` |
| `standing-quad-stretch` | Standing quad stretch | hold, each side | `Standing quad stretch: Standing on one leg, the other heel pulled to the glute with one hand, knees together, free hand on a chair. Glow: Quads.` |
| `wall-calf-stretch` | Wall calf stretch | hold, each side | `Wall calf stretch: Hands on a wall, one leg forward bent, the back leg straight with heel pressed down. Glow: Calves.` |
| `half-kneeling-ankle-mobility` | Knee-over-toe ankle rock | hold, each side | `Knee-over-toe ankle rock: Half-kneeling, front knee rocking forward over the toes with the heel down, hands on the knee. Glow: Ankles, calves.` |
| `ankle-circles` | Seated ankle circles | hold, each side | `Seated ankle circles: Sitting on a chair, one leg straight forward with the foot off the floor, foot drawing circles. Glow: Ankles.` |
| `heel-elevated-squat` | Heel-elevated squat | hold | `Heel-elevated squat: Deep squat with heels on a small slant board, arms straight forward, torso upright. Glow: Quads, ankles.` |

### Hip & leg strength (19)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `single-leg-glute-bridge` | Single-leg glute bridge | reps, each side | `Single-leg glute bridge: Bridge position with one leg straight and lifted in line with the thigh. Glow: Glutes.` |
| `hip-thrust` | Hip thrust | reps | `Hip thrust: Upper back resting on a bench, knees bent, feet flat, hips driven up level with the knees. Glow: Glutes.` |
| `clamshell` | Clamshell | reps, each side | `Clamshell: Lying on one side, knees bent and stacked, feet together, top knee opening up. Glow: Outer hip.` |
| `side-lying-leg-raise` | Side-lying leg raise | reps, each side | `Side-lying leg raise: Lying on one side, head on the hand, top leg straight and raised high. Glow: Outer hip.` |
| `fire-hydrant` | Fire hydrant | reps, each side | `Fire hydrant: On hands and knees, one bent knee lifted out to the side. Glow: Outer hip, glutes.` |
| `standing-hip-abduction` | Standing hip abduction | reps, each side | `Standing hip abduction: Standing beside a wall with one hand on it, outside leg straight and raised to the side. Glow: Outer hip.` |
| `banded-lateral-walk` | Banded side walk | hold | `Banded side walk: Half-squat with a mini band around the knees, stepping sideways, hands together at the chest. Glow: Outer hip.` |
| `banded-monster-walk` | Banded monster walk | hold | `Banded monster walk: Half-squat with a mini band around the knees, stepping diagonally forward. Glow: Outer hip, glutes.` |
| `curtsy-lunge` | Curtsy lunge | reps, each side | `Curtsy lunge: One leg stepping behind and across the other into a lunge, hands together at the chest. Glow: Glutes, outer hip.` |
| `hip-hike` | Hip hike | reps, each side | `Hip hike: Standing on one leg on a low step, hands on hips, the free hip lifting up and down. Glow: Outer hip.` |
| `single-leg-box-squat` | Single-leg squat to box | reps, each side | `Single-leg squat to box: Standing on one leg, the other leg straight forward, arms straight forward, sitting back onto a low box. Glow: Quads, glutes.` |
| `bulgarian-split-squat` | Bulgarian split squat | reps, each side | `Bulgarian split squat: Back foot resting on a bench, front leg bent in a deep lunge, hands on the hips. Glow: Quads, glutes.` |
| `single-leg-rdl` | Single-leg Romanian deadlift | reps, each side | `Single-leg Romanian deadlift: Balancing on one slightly bent leg, torso tipped forward, other leg straight behind in line with the back, arms hanging down. Glow: Hamstrings, glutes.` |
| `step-up` | Step-up | reps, each side | `Step-up: One foot on a box, driving up to stand, hands on the hips. Glow: Quads, glutes.` |
| `eccentric-step-down` | Slow step-down | reps, each side | `Slow step-down: Standing on a box on one leg, the other foot slowly lowering to the floor in front, arms straight forward. Glow: Quads, knee control.` |
| `single-leg-calf-raise` | Single-leg calf raise | reps, each side | `Single-leg calf raise: One hand on a wall, standing on one foot raised high on the toes, other foot tucked behind. Glow: Calves.` |
| `reverse-lunge` | Reverse lunge | reps | `Reverse lunge: Stepping one leg back into a lunge, both knees bent, hands together at the chest. Glow: Quads, glutes.` |
| `wall-sit` | Wall sit | hold | `Wall sit: Back flat against a wall, knees bent 90 degrees, thighs level, arms by the sides. Glow: Quads.` |
| `wall-drive-hold` | Wall drive hold | hold, each side | `Wall drive hold: Body leaning forward in a straight line with hands on a wall, one knee driven up, standing on the toes of the other foot. Glow: Glutes, calves.` |

### Knee care (8)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `seated-knee-extension` | Seated knee extension | reps, each side | `Seated knee extension: Sitting tall on a chair, one leg straightened out in front, toes up. Glow: Quads.` |
| `heel-slide` | Heel slide | reps, each side | `Heel slide: Lying on the back, one heel sliding along the floor toward the hip, the other leg straight. Glow: Knee bend.` |
| `straight-leg-raise` | Straight leg raise | reps, each side | `Straight leg raise: Lying on the back, one knee bent with the foot flat, other leg straight and lifted to the height of the bent knee. Glow: Quads, hip flexors.` |
| `seated-knee-lift` | Seated knee lift | reps, each side | `Seated knee lift: Sitting tall on a chair, one knee lifted up toward the chest. Glow: Hip flexors.` |
| `sit-to-stand` | Sit to stand | reps | `Sit to stand: Rising from a chair with arms straight forward, halfway between sitting and standing. Glow: Quads, glutes.` |
| `chair-supported-squat` | Chair-supported mini squat | reps | `Chair-supported mini squat: Hands on a chair back, small squat with the hips back and knees over the feet. Glow: Quads.` |
| `standing-hamstring-curl` | Standing hamstring curl | reps, each side | `Standing hamstring curl: Standing with one hand on a chair, one heel curled up toward the glute. Glow: Hamstrings.` |
| `quad-set` | Quad set | reps, each side | `Quad set: Sitting on the floor, legs straight, one thigh tightened pressing the back of the knee down, a small rolled towel under that knee. Glow: Quads.` |

### Jump & landing (10)

| id | Move | Type | Move line (panel 3 = this position) |
|---|---|---|---|
| `box-squat` | Box squat | reps | `Box squat: Sitting back toward a low box behind, arms forward, chest up, hips just above the box. Glow: Quads, glutes.` |
| `single-leg-balance` | Single-leg balance | hold, each side | `Single-leg balance: Standing on one leg, the other knee lifted, arms out to the sides like a T. Glow: Ankles, hips.` |
| `athletic-landing` | Landing position | reps | `Landing position: Knees bent, hips back, chest forward, arms swung back, like landing a jump. Glow: Glutes, quads.` |
| `lateral-hop-stick` | Side hop and stick | reps, each side | `Side hop and stick: Landing on one slightly bent leg after a sideways hop, arms out to the sides, other foot off the floor. Glow: Ankles, outer hip.` |
| `single-leg-landing` | Single-leg landing | reps, each side | `Single-leg landing: Landing on one bent leg after a forward hop, arms reaching forward, other leg behind. Glow: Quads, glutes.` |
| `broad-jump-landing` | Broad jump landing | reps | `Broad jump landing: Deep two-foot landing, hips back, arms swung behind, chest forward. Glow: Glutes, quads.` |
| `drop-landing` | Drop landing from box | reps | `Drop landing from box: Landing softly on two feet in front of a low box after stepping off, knees bent and in line with the toes, hands together at the chest. Glow: Quads, control.` |
| `pogo-hops` | Pogo hops | hold | `Pogo hops: Standing tall on the toes, legs almost straight, small bounce off the floor, arms bent by the sides. Glow: Calves, ankles.` |
| `split-squat-landing` | Split jump landing | reps | `Split jump landing: Landing in a lunge with both knees bent, opposite arm forward like running. Glow: Quads, glutes.` |
| `skater-squat` | Skater squat | reps, each side | `Skater squat: On one leg, the other knee bent behind toward the floor, arms reaching forward. Glow: Glutes, balance.` |

---

## 3. Moving strength exercise pictures (74 strips)

Strength exercises only have muscle maps today. These strips give each one a moving "how to" picture (start → middle
→ end), in the same style as the stretches. When the first ones arrive I'll add the player to the exercise guide and
the workout cards (a small code step, no database).

**Save as:** `<id>.png`, all in one folder.

**Strip prompt (paste, then add the exercise line):**
```
Anatomical 3D render of a bald, athletic man with smooth light-grey skin and visible muscle detail, on a solid black background. Show one repetition as a horizontal strip of 3 equal panels, left to right: panel 1 the start position, panel 2 halfway, panel 3 the end of the movement. The same man, camera angle, zoom and position in every panel; feet and anything resting on the floor or a bench stay exactly in place. Soft orange glow on the working muscles. Gym equipment in matte black and dark grey with small coral (#EF7D5C) accents, realistic proportions. No text, no labels, no numbers on plates. Wide picture, about 3 : 1.
Exercise:
```

| id | Exercise | Equipment | Exercise line (camera, steps, glow) |
|---|---|---|---|
| `goblet_squat` | Goblet squat | Dumbbell | `Goblet squat. Side view. Stand with feet about shoulder width and hold one dumbbell close to your chest. Brace gently and sit your hips down between your feet, keeping your whole foot grounded. Lower only as far as you can keep a comfortable, steady position. Press through the floor to stand; keep the weight close throughout. Glow: Quadriceps, Glutes, Core.` |
| `dumbbell_bench` | Dumbbell bench press | Bench + dumbbells | `Dumbbell bench press. Side view. Sit on a stable bench with the dumbbells resting on your thighs; lie back with feet planted. Hold the weights beside your chest with wrists above elbows. Press upward smoothly without letting the weights meet forcefully. Lower with control until elbows are near the bench, then repeat. Glow: Chest, Triceps, Front shoulders.` |
| `lat_pulldown` | Lat pulldown | Cable machine | `Lat pulldown. Back three-quarter view. Adjust the thigh pad so it holds you comfortably and sit facing the machine. Take a comfortable grip slightly wider than shoulder width and sit tall. Pull the bar toward the upper chest while keeping shoulders relaxed. Let the bar return slowly until arms are comfortably long. Glow: Lats, Upper back, Biceps.` |
| `glute_bridge` | Glute bridge | No equipment | `Glute bridge. Side view. Lie on your back with knees bent and feet flat about hip width apart. Gently brace your middle and press through your feet. Lift your hips until your body forms a comfortable line from shoulders to knees. Pause briefly, then lower slowly without dropping. Glow: Glutes, Hamstrings.` |
| `leg_press` | Leg press | Leg press machine | `Leg press. Side view. Adjust the seat so you can sit with your back supported and knees comfortably bent. Place feet about shoulder width on the platform and release the safety handles as instructed by the machine. Lower the platform until your hips stay against the pad and the range feels comfortable. Press through your feet to return without locking your knees. Glow: Quadriceps, Glutes.` |
| `seated_row` | Seated cable row | Cable machine | `Seated cable row. Side view. Sit facing the cable with feet supported and knees softly bent. Hold the handle and sit tall with shoulders relaxed. Draw elbows toward your sides without rocking your torso. Reach forward slowly until arms are comfortably long. Glow: Mid back, Lats, Biceps.` |
| `shoulder_press` | Seated dumbbell press | Bench + dumbbells | `Seated dumbbell press. Front three-quarter view. Sit with back supported and feet on the floor, holding light dumbbells beside your shoulders. Keep ribs comfortably stacked over hips and wrists above elbows. Press the weights upward through a range that feels smooth. Lower slowly to the starting position without shrugging. Glow: Shoulders, Triceps.` |
| `hamstring_curl` | Hamstring curl | Leg curl machine | `Hamstring curl. Side view. Adjust the machine so its pivot lines up near your knee and the pad rests comfortably above your heel. Hold the handles and begin with the leg nearly straight, not forced. Bend your knee to bring the pad through a comfortable range. Return slowly without letting the weight stack drop. Glow: Hamstrings.` |
| `split_squat` | Supported split squat | Rack or wall | `Supported split squat. Side view. Stand beside a stable rack and hold it lightly for balance. Step one foot back into a comfortable split stance, feet about hip width apart. Bend both knees a small amount while keeping your front foot planted. Press through the front foot to stand, then switch sides. Glow: Quadriceps, Glutes.` |
| `incline_pushup` | Incline push-up | Bench or bar | `Incline push-up. Side view. Place hands on a stable bench about shoulder width apart. Walk your feet back until your body forms a straight, comfortable line. Bend elbows and lower your chest toward the bench with control. Press the bench away and keep your body moving as one unit. Glow: Chest, Triceps, Front shoulders.` |
| `chest_row` | Chest-supported row | Bench + dumbbells | `Chest-supported row. Side view. Set a bench to a slight incline and lie chest-down with feet steady. Hold light dumbbells with arms hanging comfortably. Draw elbows toward your ribs without lifting your chest off the pad. Lower the weights slowly until arms are relaxed again. Glow: Upper back, Lats, Biceps.` |
| `hip_thrust` | Bodyweight hip thrust | Bench | `Bodyweight hip thrust. Side view. Sit on the floor with your upper back against a stable bench and feet planted. Keep chin gently tucked and knees bent comfortably. Press through your feet to lift hips until your torso is nearly level. Pause, then lower with control without over-arching. Glow: Glutes, Hamstrings.` |
| `dumbbell_rdl` | Dumbbell Romanian deadlift | Dumbbells | `Dumbbell Romanian deadlift. Side view. This movement is only available after explicit trainer approval. Stand with light dumbbells close to your thighs and knees softly bent. Move hips back while the weights travel close to your legs; keep the range small and controlled. Stand by bringing hips forward without leaning back. Glow: Hamstrings, Glutes, Back stabilizers.` |
| `bodyweight_squat` | Bodyweight squat | No equipment | `Bodyweight squat. Side view. Stand with feet at a comfortable width and arms relaxed in front. Sit hips back and bend knees while keeping your whole foot on the floor. Pause at a depth where you feel steady and comfortable. Press through the floor to stand smoothly. Glow: Quadriceps, Glutes, Core.` |
| `sit_to_stand` | Sit to stand | Sturdy chair | `Sit to stand. Side view. Place a sturdy chair against a wall and sit near the front with feet under your knees. Lean your chest forward slightly while keeping your back comfortable. Press through your feet to stand without rushing. Reach hips back and sit down slowly. Glow: Quadriceps, Glutes.` |
| `wall_pushup` | Wall push-up | Wall | `Wall push-up. Side view. Stand an arm's length from a stable wall and place hands at chest height. Step back slightly and keep your body in one comfortable line. Bend elbows to bring your chest toward the wall. Press through your hands to return smoothly. Glow: Chest, Triceps, Front shoulders.` |
| `prone_lat_pull` | Prone arm pull-down | No equipment | `Prone arm pull-down. Back three-quarter view. Lie face down only if that position is comfortable, with arms reaching overhead. Gently draw elbows down toward your sides while keeping shoulders away from your ears. Pause briefly without straining your neck. Reach overhead slowly to return. Glow: Lats, Upper back.` |
| `prone_w_raise` | Prone W raise | No equipment | `Prone W raise. Side view. Lie face down only if comfortable, with forehead resting on a folded towel if available. Bend elbows so your arms make a relaxed W shape. Lift hands and elbows a small distance while drawing shoulder blades gently together. Lower slowly and relax between repetitions. Glow: Upper back, Rear shoulders.` |
| `wall_slide` | Wall slide | Wall | `Wall slide. Front three-quarter view. Stand comfortably with your back near a wall and arms bent in a goalpost shape. Keep ribs relaxed and slide hands upward only as far as comfortable. Pause without forcing the shoulders against the wall. Slide arms down slowly to the start. Glow: Shoulders, Upper back.` |
| `heel_dig_bridge` | Bridge heel dig | No equipment | `Bridge heel dig. Side view. Lie on your back with knees bent and heels resting on the floor. Press one heel gently into the floor as if drawing it toward you without moving it. Hold briefly while breathing normally, then release. Alternate sides; keep the effort comfortable. Glow: Hamstrings, Glutes.` |
| `bodyweight_split_squat` | Supported bodyweight split squat | Wall for balance | `Supported bodyweight split squat. Side view. Stand beside a wall and use it lightly for balance. Step one foot back into a comfortable split stance. Bend both knees a small amount while keeping the front foot grounded. Press through the front foot to stand, then switch sides. Glow: Quadriceps, Glutes.` |
| `prone_y_raise` | Prone Y raise | No equipment | `Prone Y raise. Side view. Lie face down only if comfortable, arms reaching in a relaxed Y shape. Keep your forehead supported and shoulders away from your ears. Lift your hands a small distance without arching your back. Lower slowly and rest between repetitions. Glow: Upper back, Rear shoulders.` |
| `barbell_bench` | Barbell bench press | Barbell + bench | `Barbell bench press. Side view. Lie on the bench with eyes under the bar and feet flat. Grip slightly wider than shoulder width and unrack with straight arms. Lower the bar to your mid-chest, elbows about 45° from your body. Press back up to straight arms without bouncing off the chest. Glow: Chest, Triceps, Front shoulders.` |
| `incline_db_press` | Incline dumbbell press | Bench + dumbbells | `Incline dumbbell press. Side view. Set the bench to about 30° and sit with the dumbbells on your thighs. Lie back and hold the weights beside your upper chest. Press up until arms are straight without clanking the weights. Lower slowly to the start. Glow: Upper chest, Front shoulders, Triceps.` |
| `machine_shoulder_press` | Machine shoulder press | Shoulder press machine | `Machine shoulder press. Front three-quarter view. Adjust the seat so the handles sit at shoulder height. Sit tall with your back on the pad. Press the handles up until arms are nearly straight. Lower slowly to the start. Glow: Shoulders, Triceps.` |
| `lateral_raise` | Dumbbell lateral raise | Dumbbells | `Dumbbell lateral raise. Front view. Stand tall holding light dumbbells at your sides. Keep a slight bend in your elbows. Raise the weights out to the side until they reach shoulder height. Lower slowly over two to three seconds. Glow: Side shoulders.` |
| `cable_lateral_raise` | Cable lateral raise | Cable machine | `Cable lateral raise. Front view. Set the pulley low and hold the handle with the far hand. Stand side-on with a slight lean away from the machine. Raise the arm out to the side up to shoulder height. Lower slowly, then switch sides. Glow: Side shoulders.` |
| `cable_fly` | Cable chest fly | Cable machine | `Cable chest fly. Front three-quarter view. Set both pulleys at shoulder height and take a handle in each hand. Step forward into a split stance with a slight forward lean. Bring your hands together in a wide arc in front of your chest. Open slowly until you feel a comfortable chest stretch. Glow: Chest, Front shoulders.` |
| `pec_deck` | Pec deck | Pec deck machine | `Pec deck. Front three-quarter view. Adjust the seat so the handles line up with your chest. Sit tall with your back on the pad. Bring the handles together in front of you. Return slowly until you feel a comfortable stretch. Glow: Chest.` |
| `dumbbell_fly` | Dumbbell fly | Bench + dumbbells | `Dumbbell fly. Front three-quarter view. Lie on a flat bench with light dumbbells above your chest, palms facing. Keep a slight bend in your elbows. Open your arms in a wide arc until you feel a mild chest stretch. Bring the weights back together over your chest. Glow: Chest.` |
| `triceps_pushdown` | Cable triceps pushdown | Cable machine | `Cable triceps pushdown. Side view. Set the pulley high and hold the bar with palms down. Stand tall with elbows tucked at your sides. Push the bar down until your arms are straight. Let it rise slowly to about chest height. Glow: Triceps.` |
| `rope_pushdown` | Rope triceps pushdown | Cable machine + rope | `Rope triceps pushdown. Side view. Attach a rope to a high pulley and hold both ends. Keep elbows close to your sides. Push down and spread the rope ends apart at the bottom. Return slowly to the start. Glow: Triceps.` |
| `overhead_cable_extension` | Overhead cable triceps extension | Cable machine | `Overhead cable triceps extension. Side view. Hold a rope from a low or mid pulley and turn to face away. Bring your hands behind your head, elbows pointing forward. Straighten your arms overhead. Bend slowly back to the start. Glow: Triceps (long head).` |
| `db_triceps_extension` | Dumbbell overhead triceps extension | Dumbbell | `Dumbbell overhead triceps extension. Side view. Sit or stand tall holding one dumbbell overhead with both hands. Keep elbows pointing up and close to your head. Lower the weight behind your head by bending the elbows. Straighten your arms to lift it back up. Glow: Triceps.` |
| `pushup` | Push-up | No equipment | `Push-up. Side view. Place hands slightly wider than your shoulders. Step back into a straight line from head to heels. Lower your chest toward the floor with elbows angled back. Press away to straight arms. Glow: Chest, Triceps, Front shoulders, Core.` |
| `barbell_row` | Barbell row | Barbell | `Barbell row. Side view. Hold the bar with an overhand grip, hands just wider than your knees. Push hips back and lean forward with a flat, braced back. Pull the bar to your lower ribs, squeezing your shoulder blades. Lower it under control without rounding your back. Glow: Mid back, Lats, Biceps.` |
| `face_pull` | Cable face pull | Cable machine + rope | `Cable face pull. Side view. Set a rope at about face height and hold the ends with palms facing down. Step back until arms are straight. Pull the rope toward your forehead, elbows high and wide. Return slowly to the start. Glow: Rear shoulders, Upper back.` |
| `single_arm_cable_row` | Single-arm cable row | Cable machine | `Single-arm cable row. Side view. Set a pulley at chest height and hold the handle in one hand. Stand or sit tall facing the machine. Pull your elbow back past your side without twisting. Reach forward slowly, then switch sides. Glow: Lats, Mid back, Biceps.` |
| `one_arm_db_row` | One-arm dumbbell row | Dumbbell + bench | `One-arm dumbbell row. Side view. Place one hand and knee on a bench with your back flat. Hold a dumbbell in the other hand with your arm straight. Pull the weight toward your hip. Lower slowly, then switch sides. Glow: Lats, Mid back, Biceps.` |
| `straight_arm_pulldown` | Straight-arm pulldown | Cable machine | `Straight-arm pulldown. Back three-quarter view. Set a bar or rope on a high pulley. Step back, hinge slightly and hold it with long arms. Sweep it down to your thighs, keeping arms nearly straight. Let it rise slowly to eye level. Glow: Lats.` |
| `assisted_pullup` | Assisted pull-up | Pull-up bar or assisted machine | `Assisted pull-up. Back three-quarter view. Use an assisted machine or a band looped over the bar. Hang with arms straight and shoulders away from your ears. Pull until your chin is over the bar. Lower slowly to straight arms. Glow: Lats, Upper back, Biceps.` |
| `ez_curl` | EZ-bar biceps curl | EZ bar | `EZ-bar biceps curl. Side view. Stand tall holding the EZ bar with palms up. Keep elbows close to your sides. Curl the bar toward your shoulders. Lower it slowly to straight arms. Glow: Biceps.` |
| `db_curl` | Dumbbell biceps curl | Dumbbells | `Dumbbell biceps curl. Side view. Stand tall holding dumbbells at your sides, palms forward. Keep elbows close to your body. Curl the weights up toward your shoulders. Lower slowly to straight arms. Glow: Biceps.` |
| `hammer_curl` | Dumbbell hammer curl | Dumbbells | `Dumbbell hammer curl. Side view. Hold dumbbells at your sides with palms facing in. Keep elbows by your sides. Curl the weights up, keeping palms facing in. Lower slowly. Glow: Biceps, Forearms.` |
| `preacher_curl` | EZ-bar preacher curl | EZ bar + preacher bench | `EZ-bar preacher curl. Side view. Sit at the preacher bench with your upper arms on the pad. Hold the EZ bar with palms up. Curl the bar up toward your shoulders. Lower slowly, stopping just short of locking out. Glow: Biceps.` |
| `incline_db_curl` | Incline dumbbell curl | Bench + dumbbells | `Incline dumbbell curl. Side view. Set the bench to about 45° and lie back holding dumbbells. Let your arms hang straight down. Curl the weights up without moving your elbows forward. Lower slowly to a full stretch. Glow: Biceps.` |
| `reverse_curl` | Reverse curl | EZ bar or dumbbells | `Reverse curl. Side view. Hold the weights with palms facing down. Keep elbows by your sides and wrists straight. Curl up toward your shoulders. Lower slowly. Glow: Forearms, Biceps.` |
| `wrist_curl` | Wrist curl | Dumbbells | `Wrist curl. Side view. Sit with forearms on your thighs, palms up, wrists past your knees. Hold light dumbbells. Curl your wrists up. Lower slowly. Glow: Forearms.` |
| `reverse_wrist_curl` | Reverse wrist curl | Dumbbells | `Reverse wrist curl. Side view. Sit with forearms on your thighs, palms down, wrists past your knees. Hold light dumbbells. Lift the backs of your hands up. Lower slowly. Glow: Forearms.` |
| `back_squat` | Barbell squat | Barbell + rack | `Barbell squat. Side view. Set the bar in the rack at upper-chest height and step under it. Rest it on your upper back, brace and step back. Squat down with knees tracking over your toes to a controlled depth. Drive up through your whole foot. Glow: Quadriceps, Glutes, Core.` |
| `smith_squat` | Smith machine squat | Smith machine | `Smith machine squat. Side view. Set the bar at shoulder height and step under it. Place feet shoulder-width, slightly in front of the bar. Unhook and squat down to a comfortable depth. Push back up, then re-hook the bar. Glow: Quadriceps, Glutes.` |
| `hack_squat` | Hack squat | Hack squat machine | `Hack squat. Side view. Stand on the platform with back and shoulders on the pads. Release the safety handles. Lower until your thighs are about parallel. Press back up without locking your knees. Glow: Quadriceps, Glutes.` |
| `bulgarian_split_squat` | Bulgarian split squat | Bench (+ dumbbells) | `Bulgarian split squat. Side view. Stand in front of a bench and rest your back foot on it. Hop the front foot forward so you can lower straight down. Lower until your back knee nears the floor. Push through the front foot to stand. Switch legs after the set. Glow: Quadriceps, Glutes.` |
| `reverse_lunge` | Supported reverse lunge | Wall or rack for balance | `Supported reverse lunge. Side view. Stand tall next to a support. Step one foot back and lower your back knee toward the floor. Keep your front knee over your foot. Push through the front foot to step back up. Alternate legs. Glow: Quadriceps, Glutes.` |
| `step_up` | Step-up | Step platform or bench | `Step-up. Side view. Place one whole foot on a stable step. Press through that foot to stand up on the step. Bring the other foot up, then step down slowly. Finish the reps, then switch legs. Glow: Quadriceps, Glutes.` |
| `leg_extension` | Leg extension | Leg extension machine | `Leg extension. Side view. Adjust the seat so your knee lines up with the machine pivot. Place the pad just above your ankles. Straighten your legs and pause briefly. Lower slowly. Glow: Quadriceps.` |
| `calf_raise` | Standing calf raise | Wall or step | `Standing calf raise. Side view. Stand with the balls of your feet on a step or flat floor, holding a support. Rise up onto your toes as high as you can. Pause for a moment. Lower slowly, letting your heels dip if on a step. Glow: Calves.` |
| `db_glute_bridge` | Dumbbell glute bridge | Dumbbell | `Dumbbell glute bridge. Side view. Lie on your back with knees bent and a dumbbell resting across your hips. Hold the weight in place with both hands. Press through your heels to lift your hips. Pause at the top, then lower slowly. Glow: Glutes, Hamstrings.` |
| `slider_leg_curl` | Sliding leg curl | Towel or sliders | `Sliding leg curl. Side view. Lie on your back with heels on a towel or sliders. Lift your hips into a bridge. Pull your heels toward you while keeping hips up. Slide your feet out slowly. Drop the hips between reps if needed. Glow: Hamstrings, Glutes.` |
| `back_extension` | Back extension (glute focus) | Hyperextension bench | `Back extension (glute focus). Side view. Set the pad so your hips are free to bend. Cross your arms over your chest. Lower your upper body by bending at the hips. Squeeze your glutes to rise until your body is straight; don't arch back. Glow: Glutes, Hamstrings, Lower back.` |
| `barbell_rdl` | Barbell Romanian deadlift | Barbell | `Barbell Romanian deadlift. Side view. This movement is only available after explicit trainer approval. Hold the bar at hip height with soft knees. Push hips back while the bar stays close to your legs. Stand tall by bringing hips forward. Glow: Hamstrings, Glutes, Back stabilizers.` |
| `dead_bug` | Dead bug | No equipment | `Dead bug. Side view. Lie on your back with knees above hips and arms reaching toward the ceiling. Gently brace so your lower back stays comfortably settled against the floor. Slowly lower one arm and the opposite leg only as far as you can keep that position. Return to the start and alternate sides with an easy pace. Glow: Core, Deep abdominals.` |
| `plank` | Incline plank | Bench | `Incline plank. Side view. Place forearms or hands on a stable bench that will not slide. Step back until your body makes a comfortable straight line from head to heels. Gently brace and breathe normally while holding the position. End the hold before your hips sag or your breath becomes strained. Glow: Core, Shoulders.` |
| `wall_plank` | Wall plank | Wall | `Wall plank. Side view. Place forearms on a stable wall at chest height. Step back until your body forms a comfortable straight line. Gently brace and keep breathing while you hold. Step closer to the wall or finish before your position changes. Glow: Core, Shoulders.` |
| `floor_plank` | Plank | Mat | `Plank. Side view. Rest on your forearms with elbows under your shoulders. Step your feet back into a straight line. Brace gently and breathe normally. Hold, and end the set before your hips sag. Glow: Core, Shoulders.` |
| `side_plank` | Side plank | Mat | `Side plank. Side view. Lie on your side with your elbow under your shoulder. Stack your feet, or bend your knees for an easier version. Lift your hips so your body forms a straight line. Hold, then switch sides. Glow: Obliques, Core, Hips.` |
| `bird_dog` | Bird dog | Mat | `Bird dog. Side view. Kneel on all fours with a flat back. Reach one arm forward and the opposite leg back. Pause without letting your hips twist. Return and switch sides. Glow: Core, Lower back, Glutes.` |
| `pallof_press` | Pallof press | Cable machine or band | `Pallof press. Side view. Set a cable at chest height and stand side-on, holding the handle at your chest. Step away until you feel tension. Press the handle straight out and hold for a breath. Bring it back in. Switch sides after the set. Glow: Obliques, Core.` |
| `cable_crunch` | Cable crunch | Cable machine + rope | `Cable crunch. Side view. Kneel facing a high pulley, holding a rope beside your head. Keep your hips still. Curl down, bringing your ribs toward your hips. Rise slowly to the start. Glow: Abs.` |
| `hanging_knee_raise` | Hanging knee raise | Pull-up bar | `Hanging knee raise. Side view. Hang from a bar with straight arms. Brace to stop swinging. Raise your knees toward your chest. Lower slowly. Glow: Abs, Hip flexors.` |
| `reverse_crunch` | Reverse crunch | Mat | `Reverse crunch. Side view. Lie on your back with knees bent and lifted over your hips. Press your arms into the floor. Curl your hips up off the floor a little. Lower slowly without dropping. Glow: Abs.` |
| `farmer_carry` | Farmer carry | Dumbbells | `Farmer carry. Side view. Place two light dumbbells beside you and stand with feet steady. Pick them up by bending comfortably at your hips and knees, then stand tall. Walk with short, quiet steps and shoulders relaxed. Set the weights down with control before resting. Glow: Grip, Traps, Core.` |
| `march_in_place` | Easy march in place | No equipment | `Easy march in place. Side view. Stand near a sturdy support if you would like balance assistance. March slowly, lifting each foot only as high as comfortable. Keep steps quiet and breathe normally. Continue at an easy pace, then slow down before stopping. Glow: Calves, Hip flexors.` |
| `comfortable_walk` | Comfortable walk | No equipment | `Comfortable walk. Side view. Choose a familiar, level route or a clear indoor path. Walk at a pace that lets you speak comfortably. Keep steps natural and shoulders relaxed. Slow down or stop if the walk no longer feels comfortable. Glow: Legs, Calves.` |

---

## 4. Short real video clips (last)

Not pictures, so no prompts yet. When we get here: 3–6 second silent loops, filmed side-on in good light against a
plain wall, one clean repetition, 9:16 or 1:1, about 720 px. We can decide then whether to film them or license a set.
