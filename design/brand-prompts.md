# RozFit — image prompts (icon + new Rozi poses)

Brand colours: coral `#EF7D5C`, warm cream `#F3EFE9`, ink `#16181A`, pastel tints (mint `#DCEFD0`, sky `#CFE4F2`, butter `#F6E9B8`, blush `#F6D9D2`).

## 1. App icon — four concepts

Rules for every icon prompt:
- 1024 × 1024 PNG, **square, full-bleed, no rounded corners** (iOS and Android round the corners themselves).
- Keep the main shape inside the centre 70 % so the Android round mask does not cut it.
- No text other than what the concept asks for; no thin lines (they vanish at small sizes).

### A. Rozi face (recommended app icon)
> App icon, 1024x1024, full-bleed square, no rounded corners. A cute round fluffy coral-orange mascot (#EF7D5C fur, soft felt texture, big glossy black eyes, small smile, pink blush cheeks) shown from the chest up, centred, filling about 65% of the frame, looking at the viewer. Soft warm cream background (#F3EFE9) with a gentle radial glow behind the character. Soft studio lighting, 3D Pixar-like render, clean, no text, no border.

### B. "R" with a dumbbell (recommended flat logo / favicon)
> Flat vector logo mark, 1024x1024, full-bleed square coral background (#EF7D5C). A bold, rounded, geometric white letter "R" whose diagonal leg is formed by a short dumbbell (two round plates and a handle). Thick, even strokes, rounded ends, minimal, no gradients, no shadow, no other text. Must stay readable at 32 pixels.

### C. Weight plate moving forward
> App icon, 1024x1024, full-bleed square. Warm coral-to-red gradient background (#F08C6C to #E5533D) with a large darker coral forward chevron shape behind. In front, a chunky dark charcoal barbell weight plate seen from the side with a short silver bar, soft 3D render, subtle highlights, slight shadow. Minimal, centred, no text.

### D. Rising steps + spark (evolves the current mark)
> Flat app icon, 1024x1024, full-bleed square cream background (#F3EFE9). Three rounded vertical bars of rising height in coral (#EF7D5C), the tallest topped with a small four-point sparkle star. Thick rounded shapes, flat colour, no shadow, no text, minimal and friendly.

**Suggestion:** use **A** as the phone app icon (friendly, matches Rozi, stands out on a home screen) and **B** inside the app header and as the browser tab icon, because Rozi's fur does not read at 16–32 px.

## 2. New Rozi poses (same style as the existing 20)

Rules: 1024 × 1024 PNG, **transparent background** (or plain white), same character as the existing set — round fluffy coral body with **fluffy (not striped) fur**, big glossy eyes, pink cheeks, short arms and feet, 3D soft render, full body, centred, no text.

| File name | Where it goes | Prompt (add after the base description) |
|---|---|---|
| `hello` | Welcome screen | waving one hand high, big open happy smile, slight lean |
| `signin` | Sign-in screen | holding a small white envelope with a coral heart, friendly smile |
| `full-body` | Train card "Full body" | doing a bodyweight squat, arms forward, determined smile |
| `upper-body` | Train card "Upper body" | lifting a small pink dumbbell in one hand, flexing the other arm |
| `lower-body` | Train card "Lower body" | doing a forward lunge, one knee bent |
| `stretch` | Recovery / warm-up | reaching both arms overhead in a side stretch, eyes closed, calm |
| `water` | Hydration tip | sipping from a small coral water bottle, content |

Base description to paste before each pose:
> Cute round fluffy coral-orange mascot named Rozi (#EF7D5C), soft fluffy fur, big glossy black eyes, small pink blush cheeks, tiny arms and feet, 3D Pixar-style soft render, studio lighting, full body, centred, transparent background, no text,

Drop the files in `design/rozi-incoming/` with the file names above and I will process and wire them in.
