# Release notes template

How to publish a release after merging `develop` → `main`:

1. GitHub → **Releases** → **Draft a new release**.
2. **Tag:** type a new tag, `v<major>.<minor>.<patch>` (e.g. `v1.1.0`) → *Create new tag on publish*. **Target: `main`**.
   - New features → raise the middle number (`v1.1.0` → `v1.2.0`). Only fixes → raise the last (`v1.2.0` → `v1.2.1`).
3. **Title:** `v1.2.0 — <short name>` (e.g. `v1.1.0 — Profile, Ask Rozi and fixes`).
4. Paste the summary block below at the top, then click **Generate release notes**: GitHub adds the merged pull
   requests underneath, grouped by label (set up in `.github/release.yml`).
5. **Publish release.**

---

## Copy from here

```markdown
## Highlights
- <the 2–4 things people will notice>

## Fixes
- <what was broken, now fixed>

## Database
- <migration file names and "applied on <date>", or "None">

## How to update
- Installed app: close RozFit fully and open it again (it updates by itself).

## Checked
- Tests, typecheck, lint and build green · tried on rozfit-dev.vercel.app on a phone, light and dark
```

---

## First release, ready to paste: `v1.1.0 — Profile, Ask Rozi and fixes` (2026-11-16)

```markdown
## Highlights
- New Profile page (your picture is the tab icon); ☰ opens Settings. Library moved into Profile.
- Rozi lives in the corner button: **Ask Rozi** answers about today's workout, your last workout, this week, streak, best lifts, stretches and weight — from your own data.
- 17 Rozi face pictures to choose from in Your picture.
- New loading screen: bouncing Rozi.
- First-time visitors on a phone get a short "Get the RozFit app" install guide.
- Library has an A–Z strip at the side.
- Rest days: "Train today anyway"; Rozi follows the time of day.

## Fixes
- Workouts done on a rest day were saved under the next training day. Future days are now preview-only.
- BMI and "why" were asked again after creating an account.
- Turning on notifications failed when the phone had been used with another account.
- Progress page was cut off on the right on iPhone.
- The page behind sheets and the mobility player no longer scrolls.

## Database
- `20261116120000_push_device_claim.sql` — applied 2026-11-16.

## How to update
- Installed app: close RozFit fully and open it again.

## Checked
- 140 tests, typecheck, lint and build green · tried on phone size and desktop, light and dark.
```
