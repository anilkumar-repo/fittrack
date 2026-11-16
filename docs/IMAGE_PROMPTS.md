# RozFit image prompts

Two sets to generate:

- **Part A:** single-figure body pictures. These replace the cut front/back pictures.
- **Part B:** stretching and mobility moves, plus the routines built from them.

Generate, then drop the files into the folders named below and tell me. I'll process them (background removal, sizing, wiring into the app).

---

## Part A — Single-figure body pictures (muscle maps)

### Why regenerate

The current single pictures were cut out of a "front + back side by side" image where the hands overlap, so fingers get clipped. New images must have **one figure per image with clear space around it**.

### How many

Only the views where the muscle is visible need a coloured picture. Every other view reuses the plain body (`base`) of that side.

That makes **16 images per figure** and **48 in total** (female, male, neutral).

### Best way to keep them consistent (important)

1. Generate **`base-front`** first. Then generate **`base-back`** using the same character, pose and camera.
2. For every muscle picture, use **image edit / "vary region" on the base image** with the edit sentence from the table: *"Edit this image: paint only the … in red-orange."*
   This keeps the body identical, so the front ↔ back turn and the muscle switch never jump.
3. Do not crop the result. Keep the full canvas.

### Shared prompt (paste first, then the figure and view lines)

```
Full-body anatomical 3D render, écorché style: smooth matte light-grey skin (#E4E4E1) showing detailed surface musculature, no clothing, no genitals detail, tasteful and clinical.
Relaxed A-pose: standing straight, feet hip-width apart, arms angled about 20 degrees away from the body, elbows soft, palms facing forward, fingers relaxed and slightly apart.
ONE single figure only, centred. The whole body — head, both hands with every fingertip, both feet — fully inside the frame with at least 10% empty space on every side. Nothing touches or crosses the edge.
Soft, even studio light from the front. Pure black background (#000000), no floor, no shadow, no reflection, no text, no logo, no watermark.
Portrait 1024 x 2048 (1:2).
```

### Figure line (add one)

| Figure | Line to add |
|---|---|
| female | `Athletic adult woman, toned and defined, hair in a neat high bun, calm neutral face.` |
| male | `Athletic adult man, lean and muscular, short buzz-cut hair, calm neutral face.` |
| neutral | `Gender-neutral athletic mannequin, smooth bald head, soft simplified face, balanced proportions (neither male nor female).` |

### View line (add one)

| View | Line to add |
|---|---|
| front | `Front view, facing the camera directly.` |
| back | `Back view, facing directly away from the camera.` |

### Highlight line (add one, or use it as the edit sentence)

Colour for every highlight: **vivid red-orange #E5482F**, glossy, following the exact muscle shape with clean edges. Every other muscle stays grey.

| File name | View | Highlight line / edit sentence |
|---|---|---|
| `{figure}-base-front` | front | `No muscles highlighted; the whole body is light grey.` |
| `{figure}-base-back` | back | `No muscles highlighted; the whole body is light grey.` |
| `{figure}-shoulders-front` | front | `Paint only the front and side deltoids of both shoulders red-orange.` |
| `{figure}-shoulders-back` | back | `Paint only the rear deltoids of both shoulders red-orange.` |
| `{figure}-chest-front` | front | `Paint only both pectoral (chest) muscles red-orange.` |
| `{figure}-back-back` | back | `Paint only the latissimus dorsi, trapezius and rhomboids (upper and middle back) red-orange.` |
| `{figure}-arms-front` | front | `Paint only the biceps of both upper arms red-orange.` |
| `{figure}-arms-back` | back | `Paint only the triceps of both upper arms red-orange.` |
| `{figure}-forearms-front` | front | `Paint only the forearm flexors (inner forearms, elbow to wrist) of both arms red-orange.` |
| `{figure}-forearms-back` | back | `Paint only the forearm extensors (outer forearms, elbow to wrist) of both arms red-orange.` |
| `{figure}-core-front` | front | `Paint only the rectus abdominis (six-pack) and the obliques on both sides red-orange.` |
| `{figure}-glutes-back` | back | `Paint only the gluteus maximus and gluteus medius of both sides red-orange.` |
| `{figure}-quads-front` | front | `Paint only the quadriceps on the front of both thighs red-orange.` |
| `{figure}-hamstrings-back` | back | `Paint only the hamstrings on the back of both thighs red-orange.` |
| `{figure}-calves-front` | front | `Paint only the lower-leg muscles visible from the front (tibialis anterior and the inner calf edge) on both legs red-orange.` |
| `{figure}-calves-back` | back | `Paint only the calf muscles (gastrocnemius and soleus) on both legs red-orange.` |

`{figure}` = `female`, `male`, `neutral` → 16 × 3 = **48 images**.

**Save to:** `design/figures-incoming/singles/` as PNG or WebP, named exactly as in the table (for example `male-glutes-back.png`).

**Views that reuse the plain body** (no image needed): chest-back, back-front, core-back, glutes-front, quads-back, hamstrings-front.

### Example (male, glutes, back view) — complete prompt

```
Full-body anatomical 3D render, écorché style: smooth matte light-grey skin (#E4E4E1) showing detailed surface musculature, no clothing, no genitals detail, tasteful and clinical.
Relaxed A-pose: standing straight, feet hip-width apart, arms angled about 20 degrees away from the body, elbows soft, palms facing forward, fingers relaxed and slightly apart.
ONE single figure only, centred. The whole body — head, both hands with every fingertip, both feet — fully inside the frame with at least 10% empty space on every side. Nothing touches or crosses the edge.
Soft, even studio light from the front. Pure black background (#000000), no floor, no shadow, no reflection, no text, no logo, no watermark.
Portrait 1024 x 2048 (1:2).
Athletic adult man, lean and muscular, short buzz-cut hair, calm neutral face.
Back view, facing directly away from the camera.
Paint only the gluteus maximus and gluteus medius of both sides red-orange (#E5482F), glossy, clean edges; every other muscle stays grey.
```

---

## Part B — Stretching and mobility

### What I found in your references

The 16 boards contain **192 drawings**. After removing repeats (for example deep squat hold, frog stretch, child's pose and the hip flexor stretch appear on 4–6 boards each), there are **112 different moves**.

They are listed below by body area, each with:
- a short id (file name),
- what it works,
- one prompt line.

The references belong to their creators, so the prompts below are original descriptions written for RozFit's own style, not copies of those images.

### Style (decided for RozFit)

- **One gender-neutral mannequin for every move.** It works for every user and keeps it to 112 images, not 336.
- Same light-grey body as Part A.
- Worked muscles glow in **RozFit coral** with a small coral arrow showing the direction of movement. This matches the app's colours; your references use green.
- Square images, so they sit neatly in cards.

### Shared prompt (paste first, then the move line)

```
Clean 3D illustration of a gender-neutral athletic mannequin: smooth matte light-grey skin (#E4E4E1), subtle surface musculature, smooth bald head with a soft simplified face, no clothing details, no hair.
The target muscles glow soft coral (#EF7D5C), semi-transparent, following the muscle shape. One or two small solid coral arrows show the direction of the movement or stretch.
Any props (chair, box, bench, wall, band, ball, foam roller, towel, kettlebell, dowel, door frame, mat) are simple matte light-grey shapes.
ONE figure only, whole body and props fully inside the frame with at least 8% empty space on every side; no hand, foot or prop touches the edge.
Soft even studio light. Pure black background (#000000), no floor line, no shadow, no text, no numbers, no logo, no watermark.
Square 1024 x 1024.
```

Then add the **Move** line from the tables, for example:
`Move: Butterfly stretch — sitting tall on the floor, soles of the feet together, knees dropped out to the sides, hands holding the feet. Front view. Glow: inner thighs (adductors). Arrows: pointing down on both knees.`

**Save to:** `design/stretches-incoming/` named `{id}.png`, for example `butterfly-stretch.png`.

**Tip:** generate the first 3–4, send them to me, and I'll check that they key out cleanly before you make all 112.

---

### B1. Neck and upper back (5)

| id | Name | Works | Move line |
|---|---|---|---|
| `neck-side-tilt` | Neck side tilt | Upper traps, side of neck | `Move: Neck side tilt — sitting tall on a chair, head tilted ear toward one shoulder, opposite shoulder relaxed down. Front view. Glow: side of the neck and upper trapezius on the stretched side. Arrows: curved arrow over the head, down arrow on the opposite shoulder.` |
| `chin-to-chest` | Chin-to-chest stretch | Back of the neck | `Move: Chin-to-chest stretch — standing tall, chin gently tucked to the chest. Three-quarter side view. Glow: back of the neck and upper trapezius. Arrow: down along the back of the neck.` |
| `shoulder-rolls` | Shoulder rolls | Upper traps | `Move: Shoulder rolls — sitting tall on a chair, both shoulders lifted and rolling backward. Front view. Glow: upper trapezius. Arrows: circular arrows beside each shoulder.` |
| `upper-trap-stretch` | Upper-trap stretch with hand | Upper traps | `Move: Upper-trap stretch — sitting tall, one hand gently drawing the head diagonally forward and to the side, other hand under the thigh. Front three-quarter view. Glow: upper trapezius on the stretched side. Arrow: diagonal down.` |
| `dead-hang` | Dead hang | Lats, shoulders, grip | `Move: Dead hang — hanging from an overhead bar with straight arms, shoulder-width grip, body long and relaxed. Back view. Glow: latissimus dorsi and forearms. Arrows: down beside each side of the body.` |

### B2. Shoulders and chest (8)

| id | Name | Works | Move line |
|---|---|---|---|
| `seated-chest-opener` | Seated chest opener | Chest, front shoulders | `Move: Seated chest opener — sitting near the front of a chair, hands holding the chair back behind the body, chest lifted and shoulders pulled back. Three-quarter view. Glow: pectorals and front deltoids. Arrow: backward behind the shoulders.` |
| `doorway-chest-stretch` | Doorway chest stretch | Chest | `Move: Doorway chest stretch — standing in a door frame, forearm resting on the frame at shoulder height, stepping through with the chest. Three-quarter view. Glow: pectorals of the stretched side. Arrow: forward from the chest.` |
| `cross-body-arm-stretch` | Cross-body arm stretch | Rear shoulder, triceps | `Move: Cross-body arm stretch — standing, one straight arm pulled across the chest by the other forearm. Front view. Glow: rear deltoid and triceps of the stretched arm. Arrow: toward the opposite shoulder.` |
| `band-pull-apart` | Band pull-apart | Rear shoulders, upper back | `Move: Band pull-apart — standing, arms straight in front at shoulder height, pulling a resistance band apart to the sides. Front view. Glow: rear deltoids and rhomboids. Arrows: outward on both sides.` |
| `stick-pass-through` | Stick shoulder pass-through | Shoulders, chest | `Move: Stick pass-through — standing, holding a long dowel with a wide grip, arms straight, moving it from the hips over the head and behind. Front view, dowel overhead. Glow: front deltoids and pectorals. Arrows: arc over the head.` |
| `wall-slide` | Wall slide | Lower traps, serratus | `Move: Wall slide — facing a wall, forearms on the wall in a W shape, sliding the arms up into a Y. Back view. Glow: lower trapezius and serratus. Arrows: upward on both forearms.` |
| `prone-y-raise` | Prone Y raise | Lower traps | `Move: Prone Y raise — lying face down on a mat, arms raised overhead in a Y with thumbs up, chest lightly lifted. Back view from above. Glow: lower and middle trapezius. Arrows: upward on both hands.` |
| `arm-circles` | Arm swings / circles | Shoulders, triceps | `Move: Arm swings — standing tall, arms out to the sides, swinging across the chest and back open. Front view. Glow: triceps and deltoids. Arrows: curved arcs in front of the body.` |

### B3. Arms, wrists and hands (8)

| id | Name | Works | Move line |
|---|---|---|---|
| `overhead-triceps-stretch` | Overhead triceps stretch | Triceps | `Move: Overhead triceps stretch — standing, one elbow bent behind the head, the other hand gently pressing the elbow. Front view. Glow: triceps of the bent arm. Arrow: down behind the head.` |
| `reaching-down-triceps-stretch` | Reaching-down triceps stretch | Triceps | `Move: Reaching-down triceps stretch — standing, one hand reaching down between the shoulder blades from above, the other hand reaching up from below toward it. Back three-quarter view. Glow: triceps of the top arm. Arrows: toward each other.` |
| `dip-stretch` | Seated dip stretch | Triceps, chest | `Move: Seated dip stretch — sitting on the floor, legs straight, hands behind the hips with fingers pointing back, chest lifted, leaning back. Side view. Glow: triceps and front of the shoulders. Arrow: backward.` |
| `towel-triceps-stretch` | Towel triceps stretch | Triceps | `Move: Towel triceps stretch — standing, holding a towel behind the back with one hand above the head and one at the low back, top hand pulled down by the bottom hand. Back three-quarter view. Glow: triceps of the top arm. Arrows: up and down along the towel.` |
| `wrist-flexor-stretch` | Wrist flexor stretch | Inner forearm | `Move: Wrist flexor stretch — standing, arm straight forward palm up, fingers gently pulled down and back by the other hand. Side view. Glow: inner forearm. Arrow: down at the fingers.` |
| `wrist-extensor-stretch` | Wrist extensor stretch | Outer forearm | `Move: Wrist extensor stretch — standing, arm straight forward palm down, back of the hand gently pressed down by the other hand. Side view. Glow: outer forearm. Arrow: down at the hand.` |
| `finger-band-extensions` | Finger band extensions | Hands, forearm extensors | `Move: Finger band extensions — close view of one hand with a small rubber band around the fingertips, fingers spreading open; torso visible behind. Front view. Glow: back of the hand and forearm. Arrows: outward from the fingertips.` |
| `forearm-wall-stretch` | Prayer wrist stretch | Forearms | `Move: Prayer wrist stretch — standing, palms pressed together in front of the chest, elbows lifted to the sides, hands lowered toward the waist. Front view. Glow: inner forearms. Arrow: down beside the hands.` |

### B4. Spine and thoracic (14)

| id | Name | Works | Move line |
|---|---|---|---|
| `cat-cow` | Cat-cow | Whole spine | `Move: Cat-cow — on hands and knees, back rounded up like a cat. Side view. Glow: along the spine (erector spinae). Arrows: one up over the mid-back, one down under the belly.` |
| `thread-the-needle` | Thread the needle | Upper back, rear shoulder | `Move: Thread the needle — on hands and knees, one arm sliding under the body along the floor, that shoulder and cheek resting down. Three-quarter view. Glow: rear deltoid and upper back. Arrow: under the body.` |
| `childs-pose` | Child's pose | Lats, low back | `Move: Child's pose — kneeling, hips back on the heels, arms stretched forward on the floor, forehead down. Side view. Glow: latissimus dorsi and low back. Arrow: forward along the arms.` |
| `quadruped-t-spine-rotation` | Quadruped thoracic rotation | Upper back | `Move: Quadruped thoracic rotation — on hands and knees, one arm reaching straight up toward the ceiling, chest turned open. Three-quarter view. Glow: upper back and obliques. Arrow: curved upward.` |
| `side-lying-open-book` | Side-lying open book | Upper back, chest | `Move: Open book — lying on one side, knees bent together, top arm sweeping open behind toward the floor, chest turned to the ceiling. View from above. Glow: pectorals and upper back. Arrow: arc from front to back.` |
| `foam-roller-t-spine` | Foam roller thoracic extension | Upper back | `Move: Foam roller extension — lying on the back with a foam roller under the upper back, knees bent, hands behind the head, chest arching over the roller. Side view. Glow: upper back. Arrow: curved backward over the head.` |
| `seated-thoracic-extension` | Seated thoracic extension | Upper back | `Move: Seated thoracic extension — sitting on a chair, hands behind the head, upper back arching over the chair back, chest lifted. Three-quarter view. Glow: upper back and obliques. Arrow: up and back.` |
| `seated-spinal-twist` | Seated spinal twist | Obliques, low back | `Move: Seated spinal twist — sitting on a chair, torso rotated to one side, one hand on the chair back, other hand on the opposite knee. View from above three-quarter. Glow: obliques and low back. Arrow: curved around the waist.` |
| `seated-side-bend` | Seated side bend | Obliques, lats | `Move: Seated side bend — sitting on a chair, one arm reaching overhead and over to the opposite side, other hand on the chair. Front view. Glow: obliques and latissimus on the stretched side. Arrow: curved over the head.` |
| `standing-side-bend` | Standing side bend | Obliques, lats | `Move: Standing side bend — standing tall, one arm reaching overhead and over to the side, other hand on the hip. Front view. Glow: obliques and latissimus on the stretched side. Arrow: curved over the head.` |
| `supine-spinal-twist` | Lying spinal twist | Low back, glutes | `Move: Lying spinal twist — lying on the back, arms out in a T, both bent knees dropped to one side, head turned the other way. View from above. Glow: low back and outer hip. Arrow: curved over the knees.` |
| `standing-back-extension` | Standing back extension | Abs, hip flexors | `Move: Standing back extension — standing, hands on the low back, gently leaning back and looking up. Side view. Glow: abdominals. Arrow: curved backward.` |
| `seated-forward-fold-chair` | Seated forward fold | Low back, hamstrings | `Move: Seated forward fold — sitting on a chair, torso folded down over the thighs, arms hanging toward the feet. Side view. Glow: low back and upper back. Arrow: down toward the floor.` |
| `puppy-pose` | Puppy pose | Lats, upper back | `Move: Puppy pose — kneeling with hips above the knees, arms stretched forward, chest sinking toward the floor. Side view. Glow: latissimus and upper back. Arrow: chest down.` |

### B5. Breathing (8)

| id | Name | Works | Move line |
|---|---|---|---|
| `crocodile-breathing` | Crocodile breathing | Diaphragm, low back | `Move: Crocodile breathing — lying face down, forehead resting on stacked hands, legs long. View from above. Glow: low back and lower ribs. Arrows: outward on both sides of the lower ribs.` |
| `90-90-breathing` | 90-90 breathing | Diaphragm, core | `Move: 90-90 breathing — lying on the back, calves resting on a box so hips and knees are bent 90 degrees, hands on the lower ribs. Side view. Glow: lower ribs and abdominals. Arrows: upward from the belly.` |
| `seated-360-breathing` | Seated 360 breathing | Ribs, diaphragm | `Move: Seated 360 breathing — sitting tall on a chair, hands wrapped around the lower ribs. Front view. Glow: rib cage and abdominals. Arrows: outward on both sides.` |
| `childs-pose-breathing` | Child's pose breathing | Back ribs | `Move: Child's pose breathing — kneeling child's pose, arms forward, back ribs expanding. Side view. Glow: back of the rib cage. Arrows: two small arrows spreading apart over the back.` |
| `quadruped-breathing` | All-fours breathing | Core, ribs | `Move: All-fours breathing — on hands and knees with a flat back, belly drawn in. Side view. Glow: abdominals and rib cage. Arrows: small arrows pointing up under the belly.` |
| `wall-lean-breathing` | Wall-supported breathing | Ribs, core | `Move: Wall-supported breathing — back resting on a wall, knees slightly bent, one hand on the belly. Side view. Glow: abdominals and lower ribs. Arrows: small arrows outward from the belly.` |
| `bridge-breathing-block` | Supported bridge breathing | Ribs, glutes | `Move: Supported bridge breathing — lying on the back, hips resting on a block, knees bent, arms by the sides. Side view. Glow: rib cage. Arrows: three small arrows up from the chest.` |
| `legs-up-the-wall` | Legs up the wall | Relaxation, hamstrings | `Move: Legs up the wall — lying on the back with hips near a wall, legs straight up resting on the wall, arms relaxed. Side view. Glow: abdominals and lower ribs. Arrow: up along the legs.` |

### B6. Core and posture (14)

| id | Name | Works | Move line |
|---|---|---|---|
| `posterior-pelvic-tilt` | Pelvic tilt | Deep core, low back | `Move: Pelvic tilt — lying on the back, knees bent, feet flat, pressing the low back into the floor. Side view. Glow: lower abdominals. Arrow: curved under the pelvis.` |
| `dead-bug` | Dead bug | Deep core | `Move: Dead bug — lying on the back, one arm reaching overhead and the opposite leg extended long just above the floor, other arm and knee up at 90 degrees. Side view. Glow: abdominals. Arrows: outward along the moving arm and leg.` |
| `hollow-body-hold` | Hollow body hold | Abs | `Move: Hollow body hold — lying on the back, shoulders and legs lifted off the floor, arms reaching past the head, low back pressed down. Side view. Glow: abdominals. Arrows: small up arrows at hands and feet.` |
| `forearm-plank` | Forearm plank | Core, shoulders | `Move: Forearm plank — on forearms and toes, body in a straight line from head to heels. Three-quarter view. Glow: abdominals and front shoulders. Arrow: a straight line along the back.` |
| `high-plank` | High plank | Core, shoulders | `Move: High plank — on straight arms and toes, hands under the shoulders, body in a straight line. Three-quarter view. Glow: abdominals, chest and shoulders.` |
| `plank-arm-raise` | Plank arm raise | Core, shoulders | `Move: Plank arm raise — high plank with one arm reaching straight forward at shoulder height, hips level. Three-quarter view. Glow: abdominals and shoulder of the raised arm. Arrow: curved up at the raised arm.` |
| `plank-leg-raise` | Plank leg raise | Core, glutes | `Move: Plank leg raise — high plank with one straight leg lifted behind, hips level. Three-quarter view. Glow: abdominals and glute of the raised leg. Arrow: up at the raised foot.` |
| `side-plank` | Side plank | Obliques, hip | `Move: Side plank — resting on one forearm and the edge of the feet, hips lifted in a straight line, top hand on the hip. Front view. Glow: obliques and outer hip. Arrow: up under the hip.` |
| `side-plank-rotation` | Side plank rotation | Obliques | `Move: Side plank rotation — side plank on one forearm, top arm threading under the body, torso rotating down. Front three-quarter view. Glow: obliques. Arrow: curved around the waist.` |
| `side-plank-leg-raise` | Side plank star | Obliques, outer hip | `Move: Side plank star — side plank on one straight arm, top leg raised high. Front view. Glow: obliques and outer hip of the top leg. Arrow: up at the raised foot.` |
| `copenhagen-plank` | Copenhagen plank | Inner thigh, obliques | `Move: Copenhagen plank — side plank on one forearm with the top leg resting on a bench, bottom leg lifted to meet the bench. Front view. Glow: inner thigh of the top leg and obliques. Arrow: up under the hip.` |
| `wall-posture` | Wall posture check | Posture | `Move: Wall posture check — standing with heels, hips, upper back and head touching a wall, one hand behind the low back. Side view. Glow: abdominals. Arrow: small arrow pressing the low back toward the wall.` |
| `hip-hinge-drill` | Hip hinge drill | Hamstrings, glutes | `Move: Hip hinge drill — standing, hands on the hips, knees soft, hips pushed back with a flat back and chest forward. Side view. Glow: hamstrings and glutes. Arrow: backward from the hips.` |
| `bird-dog` | Bird dog | Core, glutes, back | `Move: Bird dog — on hands and knees, one arm reaching forward and the opposite leg reaching back, both level with the back. Side view. Glow: low back, glute and shoulder of the lifted limbs. Arrows: outward along the arm and leg.` |

### B7. Hips and inner thighs (26)

| id | Name | Works | Move line |
|---|---|---|---|
| `butterfly-stretch` | Butterfly stretch | Inner thighs | `Move: Butterfly stretch — sitting tall on the floor, soles of the feet together, knees dropped out to the sides, hands holding the feet. Front view. Glow: inner thighs (adductors). Arrows: down on both knees.` |
| `butterfly-forward-fold` | Butterfly forward fold | Inner thighs, low back | `Move: Butterfly forward fold — butterfly sitting position, torso folded forward, hands on the floor ahead of the feet. Front three-quarter view. Glow: inner thighs. Arrow: diagonal down over the back.` |
| `frog-stretch` | Frog stretch | Inner thighs, hips | `Move: Frog stretch — on forearms and knees, knees wide apart, shins parallel, feet turned out, hips sinking back. View from behind and above. Glow: inner thighs. Arrows: outward on both knees.` |
| `seated-straddle` | Seated straddle | Inner thighs, hamstrings | `Move: Seated straddle — sitting tall, legs straight and wide apart, hands on the floor behind the hips. Front view. Glow: inner thighs. Arrows: outward at both feet.` |
| `straddle-forward-fold` | Straddle forward fold | Inner thighs, hamstrings | `Move: Straddle forward fold — legs straight and wide apart, torso folding forward between the legs, hands on the floor. Front view. Glow: inner thighs and hamstrings. Arrow: diagonal down over the back.` |
| `cossack-squat` | Cossack squat | Inner thighs, glutes | `Move: Cossack squat — deep squat over one bent leg, other leg straight out to the side with toes up, hands together at the chest. Front view. Glow: inner thigh of the straight leg and glute of the bent leg. Arrow: sideways toward the bent leg.` |
| `side-lunge-stretch` | Standing side lunge stretch | Inner thighs | `Move: Standing side lunge stretch — wide stance, one knee bent with the hand on it, other leg straight, torso upright. Front view. Glow: inner thigh of the straight leg. Arrow: sideways toward the bent leg.` |
| `adductor-rock-back` | Adductor rock-back | Inner thighs, hips | `Move: Adductor rock-back — on hands and one knee, the other leg straight out to the side, hips rocking back toward the heel. Three-quarter view. Glow: inner thigh of the straight leg. Arrow: backward from the hips.` |
| `adductor-squeeze` | Adductor ball squeeze | Inner thighs | `Move: Adductor ball squeeze — lying on the back, knees bent, a soft ball squeezed between the knees. View from the feet. Glow: inner thighs. Arrows: inward on both knees.` |
| `side-lying-inner-thigh-lift` | Side-lying inner-thigh lift | Inner thighs | `Move: Inner-thigh lift — lying on one side, head on the hand, top leg bent with the foot on the floor in front, bottom leg straight and lifted. Front view. Glow: inner thigh of the bottom leg. Arrow: up at the bottom foot.` |
| `deep-squat-hold` | Deep squat hold | Hips, ankles | `Move: Deep squat hold — feet shoulder-width, heels down, hips low between the knees, hands together at the chest, elbows pressing the knees open. Front view. Glow: inner thighs and glutes. Arrows: outward at both knees.` |
| `goblet-squat-hold` | Goblet squat hold | Hips, quads | `Move: Goblet squat hold — deep squat holding a kettlebell at the chest, chest tall. Front view. Glow: inner thighs and quadriceps. Arrow: down beside the hips.` |
| `overhead-squat-reach` | Overhead squat reach | Hips, upper back | `Move: Overhead squat reach — deep squat with both arms reaching straight up overhead. Front view. Glow: inner thighs and obliques. Arrows: up at both hands.` |
| `90-90-hip-switch` | 90/90 hip switch | Hip rotation | `Move: 90/90 hip switch — sitting on the floor, front leg bent 90 degrees in front, back leg bent 90 degrees to the side, hands behind for support. Three-quarter view. Glow: outer hip of the front leg. Arrows: curved arrows showing knees rotating.` |
| `half-kneeling-hip-flexor` | Half-kneeling hip flexor stretch | Hip flexors, quads | `Move: Half-kneeling hip flexor stretch — kneeling on one knee, other foot forward, hips pushed gently forward, torso tall, hands on the front knee. Side view. Glow: front of the hip and thigh of the kneeling leg. Arrow: forward from the hip.` |
| `couch-stretch` | Couch stretch | Quads, hip flexors | `Move: Couch stretch — half-kneeling with the back knee near a wall and the back shin up against the wall, torso upright, hands on the front knee. Side view. Glow: quadriceps and hip flexor of the back leg. Arrow: forward from the hip.` |
| `worlds-greatest-stretch` | World's greatest stretch | Hips, upper back | `Move: World's greatest stretch — long lunge with the back knee off the floor, one hand on the floor inside the front foot, the other arm reaching straight up with the chest turned open. Three-quarter view. Glow: hip flexor of the back leg and upper back. Arrow: curved upward at the raised hand.` |
| `pigeon-stretch` | Pigeon stretch | Glutes, outer hip | `Move: Pigeon stretch — front shin across the body on the floor, back leg straight behind, torso upright, hands on the floor. Three-quarter view. Glow: glute of the front leg. Arrow: down over the hips.` |
| `pigeon-forward-fold` | Pigeon forward fold | Glutes | `Move: Pigeon forward fold — pigeon position with the torso folded forward over the front shin, arms long on the floor. Three-quarter view. Glow: glute of the front leg. Arrow: forward along the arms.` |
| `seated-figure-4` | Seated figure-4 | Glutes | `Move: Seated figure-4 — sitting on a chair, one ankle crossed over the opposite knee, chest leaning slightly forward, hands on the shin. Front view. Glow: glute of the crossed leg. Arrow: down on the crossed knee.` |
| `supine-figure-4` | Lying figure-4 | Glutes | `Move: Lying figure-4 — lying on the back, one ankle crossed over the opposite knee, hands pulling the bottom thigh toward the chest. Side view. Glow: glute of the crossed leg. Arrow: toward the chest.` |
| `seated-knee-hug` | Seated knee hug | Glutes, low back | `Move: Seated knee hug — sitting on a chair, one knee hugged to the chest with both arms. Side view. Glow: glute and low back. Arrow: toward the chest at the knee.` |
| `standing-hip-flexor` | Standing hip flexor stretch | Hip flexors | `Move: Standing hip flexor stretch — split stance, back heel lifted, hands on the hips, hips pushed forward, torso tall. Side view. Glow: front of the hip of the back leg. Arrow: forward from the hip.` |
| `elevated-side-lunge` | Box side lunge stretch | Inner thighs, hips | `Move: Box side lunge stretch — hands on a box, one leg bent forward, the other straight back and to the side, hips sinking. Three-quarter view. Glow: inner thigh and hip flexor of the straight leg. Arrow: sideways from the hips.` |
| `low-lunge-rotation` | Low lunge hip rotation | Hips | `Move: Low lunge hip rotation — low lunge with the back knee down, front knee falling outward, one hand on the front knee. Front three-quarter view. Glow: inner thigh and hip of the front leg. Arrow: outward on the front knee.` |
| `kneeling-shin-stretch` | Kneeling shin stretch | Shins, quads | `Move: Kneeling shin stretch — half-kneeling, back foot pointed with the top of the foot flat on the floor, hands on the front knee. Three-quarter view. Glow: front of the shin of the back leg. Arrow: diagonal toward the back foot.` |

### B8. Legs and ankles (8)

| id | Name | Works | Move line |
|---|---|---|---|
| `seated-hamstring-stretch` | Seated single-leg hamstring stretch | Hamstrings | `Move: Seated hamstring stretch — sitting on the floor, one leg straight, the other bent with the sole against the inner thigh, reaching both hands toward the straight foot. Side view. Glow: hamstrings of the straight leg. Arrow: forward to the toes.` |
| `seated-pike-stretch` | Seated forward fold (both legs) | Hamstrings, low back | `Move: Seated forward fold — sitting with both legs straight together, torso folded forward, hands holding the feet. Side view. Glow: hamstrings and calves. Arrow: forward to the toes.` |
| `chair-hamstring-stretch` | Chair hamstring stretch | Hamstrings | `Move: Chair hamstring stretch — sitting at the edge of a chair, one leg straight with heel on the floor and toes up, leaning forward with a flat back, hands on the thigh. Side view. Glow: hamstrings of the straight leg. Arrow: forward from the chest.` |
| `standing-quad-stretch` | Standing quad stretch | Quads | `Move: Standing quad stretch — standing on one leg, the other heel pulled to the glute with one hand, knees together, free hand on a chair. Side view. Glow: quadriceps of the bent leg. Arrow: toward the glute.` |
| `wall-calf-stretch` | Wall calf stretch | Calves | `Move: Wall calf stretch — hands on a wall, one leg forward bent, the back leg straight with heel pressed down. Side view. Glow: calf of the back leg. Arrow: down at the back heel.` |
| `half-kneeling-ankle-mobility` | Knee-over-toe ankle rock | Ankles, calves | `Move: Ankle rock — half-kneeling, front knee rocking forward over the toes with the heel down, hands on the knee. Side view. Glow: calf and ankle of the front leg. Arrow: forward at the front knee.` |
| `ankle-circles` | Seated ankle circles | Ankles | `Move: Ankle circles — sitting on a chair, one leg straight forward with the foot off the floor, foot drawing circles. Side view, close on the lower leg. Glow: ankle and shin. Arrows: circular arrow around the foot.` |
| `heel-elevated-squat` | Heel-elevated squat | Quads, ankles | `Move: Heel-elevated squat — deep squat with heels on a small slant board, arms straight forward, torso upright. Side view. Glow: quadriceps and calves. Arrow: down beside the hips.` |

### B9. Strength and stability for hips and legs (21)

| id | Name | Works | Move line |
|---|---|---|---|
| `glute-bridge` | Glute bridge | Glutes, hamstrings | `Move: Glute bridge — lying on the back, knees bent, feet flat, hips lifted into a straight line from knees to shoulders. Side view. Glow: glutes and hamstrings. Arrow: up under the hips.` |
| `single-leg-glute-bridge` | Single-leg glute bridge | Glutes | `Move: Single-leg glute bridge — bridge position with one leg straight and lifted in line with the thigh. Side view. Glow: glute and hamstring of the support leg. Arrow: up under the hips.` |
| `hip-thrust` | Hip thrust | Glutes | `Move: Hip thrust — upper back resting on a bench, knees bent, feet flat, hips driven up level with the knees. Side view. Glow: glutes. Arrow: up under the hips.` |
| `clamshell` | Clamshell | Outer hip | `Move: Clamshell — lying on one side, knees bent and stacked, feet together, top knee opening up. Front view. Glow: outer hip (gluteus medius) of the top leg. Arrow: up at the top knee.` |
| `side-lying-leg-raise` | Side-lying leg raise | Outer hip | `Move: Side-lying leg raise — lying on one side, head on the hand, top leg straight and raised high. Front view. Glow: outer hip of the top leg. Arrow: up at the top foot.` |
| `fire-hydrant` | Fire hydrant | Outer hip, glutes | `Move: Fire hydrant — on hands and knees, one bent knee lifted out to the side. Three-quarter view. Glow: outer hip and glute of the lifted leg. Arrow: curved up at the knee.` |
| `standing-hip-abduction` | Standing hip abduction | Outer hip | `Move: Standing hip abduction — standing beside a wall with one hand on it, outside leg straight and raised to the side. Front view. Glow: outer hip of the raised leg. Arrow: outward at the foot.` |
| `banded-lateral-walk` | Banded side walk | Outer hip | `Move: Banded side walk — half-squat with a mini band around the knees, stepping sideways, hands together at the chest. Front view. Glow: outer hips; the band also coral. Arrow: sideways at the stepping foot.` |
| `banded-monster-walk` | Banded monster walk | Outer hip, glutes | `Move: Banded monster walk — half-squat with a mini band around the knees, stepping diagonally forward. Front view. Glow: outer hips; the band also coral. Arrow: diagonal forward at the stepping foot.` |
| `curtsy-lunge` | Curtsy lunge | Glutes, outer hip | `Move: Curtsy lunge — one leg stepping behind and across the other into a lunge, hands together at the chest. Front view. Glow: glute and outer hip of the front leg. Arrow: diagonal back at the stepping foot.` |
| `hip-hike` | Hip hike | Outer hip | `Move: Hip hike — standing on one leg on a low step, hands on hips, the free hip lifting up and down. Front view. Glow: outer hip of the standing leg. Arrow: up and down on the free side.` |
| `single-leg-box-squat` | Single-leg squat to box | Quads, glutes | `Move: Single-leg squat — standing on one leg, the other leg straight forward, arms straight forward, sitting back onto a low box. Side view. Glow: quadriceps and glute of the standing leg. Arrow: down beside the hips.` |
| `bulgarian-split-squat` | Bulgarian split squat | Quads, glutes | `Move: Bulgarian split squat — back foot resting on a bench, front leg bent in a deep lunge, hands on the hips. Side view. Glow: quadriceps and glute of the front leg. Arrow: down beside the hips.` |
| `single-leg-rdl` | Single-leg Romanian deadlift | Hamstrings, glutes | `Move: Single-leg Romanian deadlift — balancing on one slightly bent leg, torso tipped forward, other leg straight behind in line with the back, arms hanging down. Side view. Glow: hamstring and glute of the standing leg. Arrows: one forward at the head, one back at the raised foot.` |
| `step-up` | Step-up | Quads, glutes | `Move: Step-up — one foot on a box, driving up to stand, hands on the hips. Side view. Glow: quadriceps and glute of the leg on the box. Arrow: up at the front knee.` |
| `eccentric-step-down` | Slow step-down | Quads, knee control | `Move: Slow step-down — standing on a box on one leg, the other foot slowly lowering to the floor in front, arms straight forward. Side view. Glow: quadriceps of the standing leg. Arrow: down at the lowering foot.` |
| `single-leg-calf-raise` | Single-leg calf raise | Calves | `Move: Single-leg calf raise — one hand on a wall, standing on one foot raised high on the toes, other foot tucked behind. Side view. Glow: calf of the standing leg. Arrow: up at the heel.` |
| `reverse-lunge` | Reverse lunge | Quads, glutes | `Move: Reverse lunge — stepping one leg back into a lunge, both knees bent, hands together at the chest. Side view. Glow: quadriceps and glute of the front leg. Arrow: backward at the back foot.` |
| `wall-sit` | Wall sit | Quads | `Move: Wall sit — back flat against a wall, knees bent 90 degrees, thighs level, arms by the sides. Side view. Glow: quadriceps. Arrow: down beside the hips.` |
| `wall-drive-hold` | Wall drive hold | Glutes, calves | `Move: Wall drive hold — body leaning forward in a straight line with hands on a wall, one knee driven up, standing on the toes of the other foot. Side view. Glow: glute and calf of the standing leg. Arrow: forward along the body.` |
| `bird-dog-knee` | Kneeling hip extension | Glutes | `Move: Kneeling hip extension — on hands and knees, one bent leg lifting the heel toward the ceiling. Side view. Glow: glute of the lifted leg. Arrow: up at the heel.` |

### B10. Knee care (gentle) (8)

| id | Name | Works | Move line |
|---|---|---|---|
| `seated-knee-extension` | Seated knee extension | Quads | `Move: Seated knee extension — sitting tall on a chair, one leg straightened out in front, toes up. Side view. Glow: quadriceps of the straight leg. Arrow: forward at the foot.` |
| `heel-slide` | Heel slide | Knee bend | `Move: Heel slide — lying on the back, one heel sliding along the floor toward the hip, the other leg straight. Side view. Glow: front of the bending knee. Arrow: along the floor toward the hip.` |
| `straight-leg-raise` | Straight leg raise | Quads, hip flexors | `Move: Straight leg raise — lying on the back, one knee bent with the foot flat, other leg straight and lifted to the height of the bent knee. Side view. Glow: quadriceps of the lifted leg. Arrow: up at the foot.` |
| `seated-knee-lift` | Seated knee lift | Hip flexors | `Move: Seated knee lift — sitting tall on a chair, one knee lifted up toward the chest. Side view. Glow: front of the hip and thigh. Arrow: up at the knee.` |
| `sit-to-stand` | Sit to stand | Quads, glutes | `Move: Sit to stand — rising from a chair with arms straight forward, halfway between sitting and standing. Side view. Glow: quadriceps and glutes. Arrow: up from the hips.` |
| `chair-supported-squat` | Chair-supported mini squat | Quads | `Move: Supported mini squat — hands on a chair back, small squat with the hips back and knees over the feet. Side view. Glow: quadriceps. Arrow: down beside the hips.` |
| `standing-hamstring-curl` | Standing hamstring curl | Hamstrings | `Move: Standing hamstring curl — standing with one hand on a chair, one heel curled up toward the glute. Side view. Glow: hamstring of the bending leg. Arrow: curved up at the heel.` |
| `quad-set` | Quad set | Quads | `Move: Quad set — sitting on the floor, legs straight, one thigh tightened pressing the back of the knee down, a small rolled towel under that knee. Side view. Glow: quadriceps of the pressed leg. Arrow: down at the knee.` |

### B11. Jump and landing control (10)

| id | Name | Works | Move line |
|---|---|---|---|
| `box-squat` | Box squat | Quads, glutes | `Move: Box squat — sitting back toward a low box behind, arms forward, chest up, hips just above the box. Front view. Glow: quadriceps. Arrow: down beside the hips.` |
| `single-leg-balance` | Single-leg balance | Ankles, hips | `Move: Single-leg balance — standing on one leg, the other knee lifted, arms out to the sides like a T. Front view. Glow: calf and outer hip of the standing leg. Arrows: small arrows left and right at the standing foot.` |
| `athletic-landing` | Landing position | Glutes, quads | `Move: Landing position — knees bent, hips back, chest forward, arms swung back, like landing a jump. Side view. Glow: glutes and quadriceps. Arrow: down beside the hips.` |
| `lateral-hop-stick` | Side hop and stick | Ankles, outer hip | `Move: Side hop and stick — landing on one slightly bent leg after a sideways hop, arms out to the sides, other foot off the floor. Front view. Glow: outer hip and calf of the landing leg. Arrow: sideways toward the landing leg.` |
| `single-leg-landing` | Single-leg landing | Quads, glutes | `Move: Single-leg landing — landing on one bent leg after a forward hop, arms reaching forward, other leg behind. Side view. Glow: quadriceps and glute of the landing leg. Arrow: forward.` |
| `broad-jump-landing` | Broad jump landing | Glutes, quads | `Move: Broad jump landing — deep two-foot landing, hips back, arms swung behind, chest forward. Side view. Glow: glutes and quadriceps. Arrow: forward.` |
| `drop-landing` | Drop landing from box | Quads, control | `Move: Drop landing — landing softly on two feet in front of a low box after stepping off, knees bent and in line with the toes, hands together at the chest. Front view. Glow: quadriceps. Arrows: down beside both legs.` |
| `pogo-hops` | Pogo hops | Calves, ankles | `Move: Pogo hops — standing tall on the toes, legs almost straight, small bounce off the floor, arms bent by the sides. Side view. Glow: calves. Arrows: up under both feet.` |
| `split-squat-landing` | Split jump landing | Quads, glutes | `Move: Split jump landing — landing in a lunge with both knees bent, opposite arm forward like running. Side view. Glow: quadriceps and glute of the front leg. Arrow: down beside the hips.` |
| `skater-squat` | Skater squat | Glutes, balance | `Move: Skater squat — on one leg, the other knee bent behind toward the floor, arms reaching forward. Side view. Glow: glute and quadriceps of the standing leg. Arrow: down at the back knee.` |

**Total: 5 + 8 + 8 + 14 + 8 + 14 + 26 + 8 + 21 + 8 + 10 = 130 move images.** That includes 18 useful moves I added to fill gaps in the references: upper-trap stretch, arm circles, prayer wrist stretch, puppy pose, bird dog, pigeon forward fold, kneeling shin stretch, chair hamstring stretch, heel-elevated squat, kneeling hip extension, plus clearer split versions of moves the boards drew twice.

---

## Part C — Routines (made from the moves above)

These replace the reference boards with RozFit routines. Each move is about 30–45 seconds (or 8–10 slow reps), so a routine takes 6–10 minutes. The names are RozFit's own.

| Routine | When the app suggests it | Moves (in order) |
|---|---|---|
| **Morning wake-up** | Every morning; rest days | cat-cow, thread-the-needle, childs-pose, deep-squat-hold, worlds-greatest-stretch, half-kneeling-hip-flexor, 90-90-hip-switch, adductor-rock-back, kneeling-shin-stretch |
| **Before squats / leg day** | Warm-up on lower-body days | deep-squat-hold, cossack-squat, adductor-rock-back, half-kneeling-ankle-mobility, low-lunge-rotation, couch-stretch, pigeon-stretch, goblet-squat-hold, heel-elevated-squat |
| **Squat mobility** | Rest days for people with stiff squats | deep-squat-hold, half-kneeling-ankle-mobility, goblet-squat-hold, frog-stretch, 90-90-hip-switch, half-kneeling-hip-flexor, adductor-rock-back, seated-thoracic-extension, overhead-squat-reach, wall-calf-stretch, heel-elevated-squat |
| **Inner thigh mobility** | Hip/leg flexibility focus | butterfly-stretch, butterfly-forward-fold, frog-stretch, seated-straddle, straddle-forward-fold, side-lunge-stretch, cossack-squat, adductor-rock-back, copenhagen-plank, adductor-squeeze, side-lying-inner-thigh-lift |
| **Hip strength (side)** | Runners, knee comfort, "Get fit & toned" | clamshell, side-lying-leg-raise, side-plank, fire-hydrant, standing-hip-abduction, banded-lateral-walk, banded-monster-walk, curtsy-lunge, hip-hike, copenhagen-plank, single-leg-glute-bridge, side-plank-leg-raise |
| **Runner's legs** | Cardio / running days | single-leg-box-squat, bulgarian-split-squat, single-leg-rdl, step-up, eccentric-step-down, single-leg-glute-bridge, single-leg-calf-raise, side-lying-leg-raise, clamshell, bird-dog-knee, hip-thrust, reverse-lunge, wall-drive-hold |
| **Jump and land safely** | Conditioning weeks; sports | box-squat, single-leg-balance, athletic-landing, lateral-hop-stick, single-leg-landing, broad-jump-landing, drop-landing, pogo-hops, split-squat-landing, skater-squat, wall-sit |
| **Knee care (gentle)** | After a knee discomfort report; older or new trainees | seated-knee-extension, heel-slide, straight-leg-raise, seated-knee-lift, sit-to-stand, chair-supported-squat, glute-bridge, side-lying-leg-raise, standing-hamstring-curl, quad-set, standing-quad-stretch, chair-hamstring-stretch |
| **Posture and pelvis reset** | Desk days; low-back tightness | posterior-pelvic-tilt, dead-bug, glute-bridge, hip-thrust, half-kneeling-hip-flexor, couch-stretch, hollow-body-hold, hip-hinge-drill, wall-posture, forearm-plank, bird-dog |
| **Breathing and ribs** | Evenings; stress; recovery days | crocodile-breathing, 90-90-breathing, seated-360-breathing, side-lying-open-book, childs-pose-breathing, standing-side-bend, supine-spinal-twist, quadruped-breathing, wall-lean-breathing, bridge-breathing-block, legs-up-the-wall |
| **Desk and travel stretch** | Travel days (missed-day reason "Travelling"); long sitting | neck-side-tilt, upper-trap-stretch, shoulder-rolls, seated-chest-opener, seated-spinal-twist, seated-side-bend, seated-figure-4, seated-knee-hug, seated-forward-fold-chair, ankle-circles, standing-hip-flexor, standing-back-extension |
| **Back day mobility** (rows and pulls) | Warm-up on pull / back days | deep-squat-hold, half-kneeling-ankle-mobility, seated-pike-stretch, frog-stretch, half-kneeling-hip-flexor, childs-pose, thread-the-needle, foam-roller-t-spine, band-pull-apart, dead-hang, glute-bridge, hip-hinge-drill |
| **Upper body mobility** | Warm-up on push / upper days | frog-stretch, deep-squat-hold, elevated-side-lunge, pigeon-stretch, doorway-chest-stretch, wall-slide, stick-pass-through, prone-y-raise, wrist-flexor-stretch, wrist-extensor-stretch, forearm-wall-stretch, finger-band-extensions, puppy-pose |
| **Triceps and arms stretch** | Cool-down after arm / push days | overhead-triceps-stretch, reaching-down-triceps-stretch, cross-body-arm-stretch, arm-circles, dip-stretch, towel-triceps-stretch |
| **Plank power** | Core finisher | forearm-plank, plank-arm-raise, high-plank, plank-leg-raise, side-plank, side-plank-rotation |
| **Full-body cool-down** | After any workout | half-kneeling-hip-flexor, standing-quad-stretch, seated-hamstring-stretch, wall-calf-stretch, supine-figure-4, pigeon-forward-fold, quadruped-t-spine-rotation, doorway-chest-stretch, neck-side-tilt, chin-to-chest, cross-body-arm-stretch, standing-side-bend, childs-pose |

### How this would fit the app (once the images are in)

- **Library:** a new "Stretch & mobility" area next to Full body / Upper / Lower / Core, with every move and its picture.
- **Train:**
  - a 5-minute **warm-up** chosen from the day's split, before the workout;
  - a **cool-down** after "Finish workout";
  - on rest days, a "Mobility of the day" card (Morning wake-up / Breathing and ribs).
- **Smart picks:**
  - missed-day reason "Travelling" → Desk and travel stretch;
  - "Sore" → Breathing and ribs or Full-body cool-down;
  - a knee discomfort report → Knee care (gentle).
- **Guided player:** one move at a time with Rozi, a 30–45 s timer, the next move shown, and a Skip button. Finishing it counts toward the streak as an active-recovery day (optional; your call).
- **Safety:** stretches stay pain-free. A pain tick in the check-in still switches the day to recovery, and Knee care says "stop if it hurts; see a professional if pain persists".

---

## Checklist

- [ ] Part A: 48 body pictures → `design/figures-incoming/singles/`
- [ ] Part B: 130 move pictures → `design/stretches-incoming/` (send 3–4 first for a check)
- [ ] Tell me when they're in. I'll process them and build the Stretch & mobility feature.

---

## Part D — New Rozi for Stretch & mobility

The Core & cardio card already uses Rozi's side stretch, so mobility gets its own pose. Same character and style as the existing Rozi set.

**Base description (paste first):**
```
Cute round fluffy coral-orange mascot named Rozi (#EF7D5C), soft fluffy fur (not striped), big glossy black eyes, small pink blush cheeks, tiny arms and feet, 3D Pixar-style soft render, soft studio lighting, full body, centred, transparent background, no text, no logo. 1024 x 1024.
```

**Option A — Butterfly stretch on a mat (recommended):**
```
Rozi sits on a small rounded mint-green yoga mat (#BFE6DC) in a butterfly stretch: soles of the feet together, knees out to the sides, tiny hands holding the feet, leaning slightly forward. Eyes gently closed, calm happy smile, three small soft sparkle lines around the head to show relaxation. The whole mat and Rozi fit inside the frame with space around them.
```

**Option B — Tree pose balance:**
```
Rozi balances on one foot in a yoga tree pose: the other foot resting against the standing leg, both tiny arms raised overhead with paws touching. Eyes closed, peaceful smile, a small mint-green yoga mat (#BFE6DC) under the standing foot, two tiny leaf shapes floating nearby.
```

**Save as:** `design/rozi-incoming/mobility.png`. Then tell me, and I'll process it and swap it in on the Library "Stretch & mobility" card and the Mobility page.

---

## Part E — Rozi profile pictures (avatars)

Close-up portraits made for a round profile picture: Rozi's face and chest fill the circle, each on its own soft colour. These replace the small full-body poses in the avatar picker.

**Base description (paste first):**
```
Cute round fluffy coral-orange mascot named Rozi (#EF7D5C), soft fluffy fur (not striped), a small tuft of fur on top, big glossy dark-brown eyes with white highlights, small pink blush cheeks, tiny arms, 3D Pixar-style soft render, soft studio lighting.
Close-up portrait for a round profile picture: head and upper body only, facing the viewer, centred, Rozi filling about 80% of the width. Everything important (face, hands, props) stays inside the centre circle so a round crop never cuts it.
Solid flat background in the colour given below, filling the whole square, no gradient, no floor, no shadow at the edges, no text, no logo. 1024 x 1024.
```

**Then add one line:**

| File name | Emotion | Add this line |
|---|---|---|
| `avatar-happy` | Happy | `Big open happy smile, sparkling eyes, both tiny hands raised in a little wave. Background #FCE3D6 (soft peach).` |
| `avatar-cool` | Cool | `Wearing tiny black sunglasses pushed down the nose, confident smirk, one eyebrow raised. Background #D6E9F5 (soft sky blue).` |
| `avatar-love` | In love | `Heart-shaped eyes, dreamy smile, hugging a small glossy pink heart. Background #F8D7DF (soft blush pink).` |
| `avatar-wink` | Playful | `Winking one eye, tongue slightly out, giving a thumbs-up. Background #F7EBC0 (soft butter yellow).` |
| `avatar-strong` | Strong | `Wearing a coral sweatband, flexing one tiny arm with a proud grin. Background #D3EEE2 (soft mint).` |
| `avatar-focused` | Determined | `Focused game face: eyebrows down, determined small smile, tiny fists up like a boxer. Background #FCE3D6 (soft peach).` |
| `avatar-laughing` | Laughing | `Laughing hard, eyes squeezed shut, mouth wide open, tiny tears of joy. Background #F7EBC0 (soft butter yellow).` |
| `avatar-shy` | Shy | `Very shy: extra-pink blushing cheeks, small bashful smile, tiny hands touching the cheeks, eyes looking to the side. Background #F8D7DF (soft blush pink).` |
| `avatar-surprised` | Surprised | `Surprised: eyes wide open, small round "o" mouth, tiny hands up by the face. Background #D6E9F5 (soft sky blue).` |
| `avatar-starry` | Excited | `Excited: sparkly star-shaped eyes, huge smile, a few tiny gold sparkles around the head. Background #E3DDF5 (soft lavender).` |
| `avatar-zen` | Calm | `Calm and peaceful: eyes gently closed, soft smile, a tiny green leaf resting on the fur tuft. Background #D3EEE2 (soft mint).` |
| `avatar-sleepy` | Sleepy | `Sleepy: wearing a small navy nightcap with a white pom-pom, eyes half closed, cute little yawn. Background #E3DDF5 (soft lavender).` |
| `avatar-party` | Party | `Wearing a small striped party hat, cheering, a few colourful confetti pieces around. Background #F7EBC0 (soft butter yellow).` |
| `avatar-cozy` | Cozy | `Wrapped in a small knitted mint scarf, holding a tiny warm mug with steam, content smile. Background #FCE3D6 (soft peach).` |
| `avatar-hydrated` | Hydrated | `Sipping from a small mint water bottle through a straw, happy eyes. Background #D6E9F5 (soft sky blue).` |
| `avatar-grumpy` | Grumpy (cute) | `Cute grumpy pout, puffed cheeks, tiny arms crossed, one eyebrow down. Background #E3DDF5 (soft lavender).` |

**Tips:**
- Make `avatar-happy` first, then attach it as a reference image for the rest ("same character, same framing"), so all 16 match.
- Keep the same zoom in every picture: the top of the fur tuft near the top edge, the chest at the bottom edge.

**Save to:** `design/rozi-incoming/avatars/` with the file names above (for example `avatar-cool.png`). I'll crop them into circles, add them to the avatar picker (Settings → your picture), and keep the current options too.

---

## Part F — Home Rozi for every time of day (comment 6, 2026-11-16)

Home's big Rozi now follows the clock on **every** day. The app already does this with the pictures it has: morning stretch, afternoon water, evening rest and night sleep on rest days; morning, afternoon and evening on training days; and sleep after a finished workout at night. These 8 new pictures make each moment unique. Save them as `design/rozi-incoming/<file name>.png` and I'll cut them in (transparent background, 480 px, like the others).

**Base description (paste first):** the same as Part D:
```
Cute round fluffy coral-orange mascot named Rozi (#EF7D5C), soft fluffy fur (not striped), big glossy black eyes, small pink blush cheeks, tiny arms and feet, 3D Pixar-style soft render, soft studio lighting, full body, centred, transparent background, no text, no logo. 1024 x 1024.
```

| File name | When it shows | Add this line |
|---|---|---|
| `rest-morning.png` | Rest day, before 12:00 | Rozi stretching both tiny arms up with a big sleepy-happy yawn, a small steaming mint mug on the floor beside the feet, two soft sun-ray lines above the head. |
| `rest-afternoon.png` | Rest day, 12:00–17:00 | Rozi sitting cross-legged, relaxed, sipping from a mint water bottle with a straw, eyes happily closed, a tiny leaf sticker on the bottle. |
| `rest-evening.png` | Rest day, 17:00–21:00 | Rozi lying on a small round peach cushion reading a tiny book, wearing round reading glasses, cosy and content. |
| `train-morning.png` | Training day, before 12:00 | Rozi in a mint headband doing a cheerful warm-up arm swing, one foot lifted, energetic grin, two small yellow motion lines. |
| `train-afternoon.png` | Training day, 12:00–17:00 | Rozi holding a tiny coral dumbbell in one hand and giving a thumbs-up with the other, determined happy face. |
| `train-evening.png` | Training day, 17:00–21:00 | Rozi with a small gym bag over the shoulder, waving goodbye, a crescent moon sticker on the bag, "let's go" smile. |
| `done-night.png` | Workout finished, after 21:00 | Rozi tucked under a tiny peach blanket hugging a small gold medal, eyes closed, peaceful smile, a few "z z" letters above. |
| `done-day.png` | Workout finished, before 21:00 | Rozi jumping with both arms up, a small gold medal bouncing on its chest, coral and mint confetti around. |
