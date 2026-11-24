# RozFit — complete setup, keys and build history

The one place to understand how RozFit is put together, what was built in each phase, every setting in
every dashboard, and how to test it. **No secret values are written here** — only their names and where
they live. Keep it updated whenever something changes.

Last updated: 2026-11-13

---

## 1. At a glance

| Thing | Value |
|---|---|
| App name | **RozFit** (repo, package and browser storage keep the old `fittrack` name so saved data keeps working) |
| Live address | **https://rozfit-a.vercel.app** (old `fittrack-inky-eta.vercel.app` and `fittrack-anilkumarm.vercel.app` no longer work) |
| Code | GitHub `anilkumar-repo/fittrack`, branch `main` (pushed with GitHub Desktop) |
| Hosting | Vercel project **fittrack** (team "AK's projects"). Every push to `main` deploys to production. |
| Database + sign-in | Supabase project ref **`cjdvgtqxanetaegbkojv`** (region ap-south-1) — [dashboard](https://supabase.com/dashboard/project/cjdvgtqxanetaegbkojv) |
| Framework | Next.js 16 (App Router), React 19, TypeScript, plain CSS (`app/globals.css`) |
| Mascot | **Rozi** (fluffy coral character, images in `public/rozi/`) |
| Install on phones | Web app (PWA): Android "Install app", iPhone Share → "Add to Home Screen" |

---

## 2. Where every key and secret lives

Never paste secret values into chats, issues, commits or this file.

### 2.1 Vercel → project fittrack → Settings → Environment Variables (Production)

| Name | Secret? | What it is | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase API address | Supabase → Project Settings → API (`https://cjdvgtqxanetaegbkojv.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No (browser-safe) | Lets the app talk to Supabase as the signed-in user | Supabase → Project Settings → API Keys → publishable key |
| `NEXT_PUBLIC_SITE_URL` | No | Where sign-in links return to | **Must be `https://rozfit-a.vercel.app`** (update it if it still shows an old address) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Push notification public key | Private keys file (see 2.4) |
| `VAPID_PRIVATE_KEY` | **Yes** | Signs push notifications | Private keys file (see 2.4) |
| `CRON_SECRET` | **Yes** | Proves the hourly call really comes from Supabase | Private keys file; the same value is in the Supabase vault |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes — most sensitive** | Lets the server send notifications to everyone | Supabase → Project Settings → API Keys → service_role / secret. Copy it yourself. Never put it in a `NEXT_PUBLIC_` variable. |
| `VAPID_SUBJECT` | No, optional | Contact for push services | Defaults to `https://rozfit-a.vercel.app` |

After adding or changing any of these, **redeploy** (push a commit or "Redeploy" in Vercel).

### 2.2 Supabase vault (Database → Vault)

| Secret name | Holds | Used by |
|---|---|---|
| `rozfit_app_url` | `https://rozfit-a.vercel.app` | Hourly notification schedule (which address to call) |
| `rozfit_cron_secret` | Same value as Vercel `CRON_SECRET` | Hourly notification schedule (proves who is calling) |

If the app address changes, update `rozfit_app_url`:
```sql
select vault.update_secret((select id from vault.secrets where name = 'rozfit_app_url'), 'https://NEW-ADDRESS');
```
If the cron secret is ever leaked, make a new random value, then update **both** Vercel `CRON_SECRET` and:
```sql
select vault.update_secret((select id from vault.secrets where name = 'rozfit_cron_secret'), 'NEW-SECRET');
```

### 2.3 Supabase email sender (SMTP)

Gmail account + Google **App Password** (not the normal Gmail password). The app password is stored only in
Supabase → Authentication → Emails → SMTP Settings. See section 5.

### 2.4 Private keys file

`rozfit-push-keys.txt` was created next to (not inside) the code folder so it can never be committed.
It holds the VAPID keys and the cron secret. Copy the values into Vercel, then keep them in a password
manager and delete the file. Lost keys can be regenerated (`npx web-push generate-vapid-keys`) — everyone
then has to switch notifications off and on again once.

### 2.5 Local development

Copy `.env.example` to `.env.local` (ignored by Git) and fill in the values. Without Supabase values the app
runs in **demo mode** (everything saved on that browser only).

---

## 3. Supabase setup checklist

| Area | Setting | Value |
|---|---|---|
| Authentication → URL Configuration | Site URL | `https://rozfit-a.vercel.app` |
| | Redirect URLs | `https://rozfit-a.vercel.app/**` and `http://localhost:3000/**` |
| Authentication → Sign In / Providers → Email | Email provider | Enabled |
| | Email OTP Length | `6` (the app says "6-digit code") |
| | Email OTP Expiration | `600` seconds |
| Authentication → Rate Limits | Emails sent per hour | about `100` (needs custom SMTP) |
| Authentication → Emails → SMTP | Custom SMTP | On (section 5) |
| Authentication → Emails → Templates | Magic link or OTP, Confirm signup | Section 6 |
| Authentication → Settings | Leaked password protection | Recommended: on (security advisor warns while off) |
| Database → Extensions | `pg_cron`, `pg_net` (in `extensions` schema), `supabase_vault` | Installed by migrations |
| Database → Cron | Job `rozfit-hourly-push`, schedule `2 * * * *` | Created by Phase 12 |

### 3.1 Applied migrations (in `supabase/migrations/`, oldest first)

| Version | File | What it does |
|---|---|---|
| 20261027125945 | `..._fittrack_mvp.sql` | Profiles, workout sessions, trainer rules, RLS |
| 20261027130002 | `..._persistent_workout_tracking.sql` | Check-ins, exercise logs, set logs, reviews |
| 20261027162804 | `..._phase_3_workout_generation.sql` | Equipment, form quality |
| 20261027162809 | `..._phase_5_progress_tracking.sql` | Private body-weight entries |
| 20261027162818 | `..._phase_6_trainer_controls.sql` | Trainer rule settings, audit, deadlift guard |
| 20261112074033 | `phase_7_atomic_session_save.sql` | Save a whole workout in one transaction |
| 20261112074535 | `phase_8_invites_and_data_controls.sql` | Trainer invite codes, remove trainer, delete my data |
| 20261113072938 | `training_days_three_to_six.sql` | Training days 3–6 a week |
| 20261113092102 | `phase_9_goals_and_equipment.sql` | `goal` column; 15 equipment types |
| 20261113092859 | `phase_10_missed_day_reasons.sql` | Missed-day reason + note; `record_missed_workout` |
| 20261113093618 | `phase_11_friends_and_challenges.sql` | Friends, invites, shared stats, challenges, nudges |
| 20261113105612 | `phase_12_push_notifications.sql` | Push subscriptions, hourly schedule |
| 20261113105746 | `phase_12_move_pg_net.sql` | Move `pg_net` out of the public schema |
| run by hand 2026-11-13 | `20261113160000_avatars_fatloss_trainer_plan.sql` | "Lose weight" goal, profile pictures + `avatars` storage bucket, `trainer_update_client_plan`, trainer edits for all program exercises. Run in the SQL Editor (the Supabase connector was down), so it is not listed under Database → Migrations; checked through the public API. |

Each was applied with the owner's approval and checked afterwards (security advisor, and for Phases 11–12
a rolled-back test with pretend users).

### 3.2 Who can see what (row-level security)

- Each person reads and writes only their own profile, workouts, body weight and notification settings.
- A linked trainer can read a client's workouts (including missed-day reasons) and change their rules, but cannot edit their logs.
- **Friends** see only the shared summary (`friend_stats`: name, goal, streak, workouts this week, workout dates of the last ~2 months). Never weights, sets, notes, check-ins, pain or missed-day reasons.
- Only friends can nudge (one per friend per day). Only a challenge's creator can add members, and only their own friends.
- Server-only functions are in the `private` schema (not reachable from the app). Public functions that run with elevated rights on purpose: `accept_trainer_invite`, `create_trainer_invite`, `remove_my_trainers`, `delete_my_workout_data`, `accept_friend_invite` — each checks who is calling. The security advisor lists these as expected warnings.

---

## 4. Vercel setup checklist

| Setting | Value |
|---|---|
| Project | fittrack |
| Production domain | `rozfit-a.vercel.app` (Settings → Domains) |
| Git | Connected to `anilkumar-repo/fittrack`, production branch `main` |
| Environment variables | Section 2.1 |
| Deployment protection | Team-scoped `*-anilkumarm.vercel.app` links require a Vercel login — always share the public `rozfit-a.vercel.app` address |
| Cron jobs | None in Vercel (the hourly schedule runs in Supabase, so it works on the free plan) |

---

## 5. Email sending (SMTP) — Gmail

Supabase's built-in sender allows only about 2 emails an hour and can't use custom templates, so a custom
sender is required.

1. Use a Gmail account for RozFit (a dedicated one such as a new `rozfit…@gmail.com` looks better).
2. Turn on **2-Step Verification** (Google Account → Security).
3. Create an **App Password** at myaccount.google.com/apppasswords (name it "RozFit Supabase").
4. Supabase → Authentication → Emails → **SMTP Settings**:

| Field | Value |
|---|---|
| Enable custom SMTP | On |
| Sender email address | the Gmail address |
| Sender name | `RozFit` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | the Gmail address |
| Password | the 16-character app password |

Gmail sends up to about 500 emails a day. Later, with your own domain (for example `rozfit.in`), switch to
Resend or Brevo so emails come from `noreply@rozfit.in`; nothing in the app changes.

---

## 6. Email templates

In each template switch the body to **Source**, paste, save. `{{ .Token }}` (the code) and
`{{ .ConfirmationURL }}` (the backup link) are filled in by Supabase. The logo loads from the live site.

### 6.1 "Magic link or OTP" — people signing in again

Subject:
```
Your RozFit code: {{ .Token }}
```
Body:
```html
<div style="margin:0;padding:24px;background:#eceae6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px 24px;text-align:center;">
    <img src="https://rozfit-a.vercel.app/icons/icon-192.png" width="72" height="72" alt="Rozi" style="border-radius:18px;">
    <h1 style="margin:16px 0 6px;font-size:22px;color:#16181a;">Your sign-in code</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#5f6368;">Type this code in the RozFit app to sign in.</p>
    <div style="display:inline-block;padding:14px 22px;border-radius:16px;background:#f6e9b8;font-size:32px;font-weight:800;letter-spacing:8px;color:#16181a;">{{ .Token }}</div>
    <p style="margin:18px 0 0;font-size:13px;color:#5f6368;">The code works once and expires in 10 minutes.</p>
    <p style="margin:18px 0 0;font-size:13px;color:#5f6368;">On this phone? You can also <a href="{{ .ConfirmationURL }}" style="color:#ef7d5c;font-weight:700;">tap here to sign in</a>.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:22px 0 14px;">
    <p style="margin:0;font-size:12px;color:#9aa0a6;">Didn't ask for this? You can ignore this email. Nobody can sign in without the code.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#9aa0a6;">RozFit · Small steps, every day</p>
  </div>
</div>
```

### 6.2 "Confirm signup" — brand-new people

Subject:
```
Welcome to RozFit! Your code is {{ .Token }}
```
Body:
```html
<div style="margin:0;padding:24px;background:#eceae6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px 24px;text-align:center;">
    <img src="https://rozfit-a.vercel.app/icons/icon-192.png" width="72" height="72" alt="Rozi" style="border-radius:18px;">
    <h1 style="margin:16px 0 6px;font-size:22px;color:#16181a;">Welcome to RozFit 👋</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#5f6368;">Rozi is ready to train with you. Type this code in the app to save your plan.</p>
    <div style="display:inline-block;padding:14px 22px;border-radius:16px;background:#dcefd0;font-size:32px;font-weight:800;letter-spacing:8px;color:#16181a;">{{ .Token }}</div>
    <p style="margin:18px 0 0;font-size:13px;color:#5f6368;">The code works once and expires in 10 minutes.</p>
    <p style="margin:18px 0 0;font-size:13px;color:#5f6368;">On this phone? You can also <a href="{{ .ConfirmationURL }}" style="color:#ef7d5c;font-weight:700;">tap here to confirm</a>.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:22px 0 14px;">
    <p style="margin:0;font-size:12px;color:#9aa0a6;">Didn't sign up? You can ignore this email.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#9aa0a6;">RozFit · Small steps, every day</p>
  </div>
</div>
```

Why a typed code: on iPhone a sign-in link opens Safari, not the Home Screen app, so the app itself would stay
signed out. The code works everywhere; the link stays as a backup.

---

## 7. How each feature works (short)

### Sign-up ("Get started", 7 steps)
Name → goal → figure → training days (3–6) → session length → equipment → **Save your plan** (email → 6-digit
code). Step 7 shows only when Supabase is configured. The answers are saved on the phone just before the code
is checked, so the new account starts with the plan. The sign-in page uses the same code form.

### Goals and programs (Phase 9) — `src/lib/program.ts`, `src/lib/templates.ts`, `src/lib/program-exercises.ts`
| Goal | Split | Based on |
|---|---|---|
| Stay active | 3 full-body days (Foundation A/B/C) | original plan |
| Get fit & toned | 4 days Lower A / Upper A / Lower B / Upper B | trainer's female plan + hamstring/core additions |
| Build muscle | 6 days Push A / Pull A / Legs A / Push B / Pull B / Legs B | trainer's male plan + 2 core finishers |
| Lose weight | 4 days Burn A (full-body strength) / Cardio + core / Burn B / Intervals + core | added 2026-11-13; includes a food tip (modest deficit, protein, 7–10k steps) |

- 52-week year counted from the training start date; stage label shown on Train ("Week 6 of 52 · Build…").
- Every 4th week lighter: Build muscle → conditioning week (20-minute circuit: 5 pull-ups, 10 push-ups, 15 squats, alternating with abs + easy cardio); Get fit & toned → about a third fewer sets.
- Sets: Get fit & toned 2 per exercise in weeks 1–4, then 3; Build muscle 3.
- Deadlift variations only with explicit trainer approval (hip thrust stands in). Get fit & toned adds a light hinge on Lower B from week 13 only if approved.
- Missing equipment falls back step by step (e.g. barbell squat → Smith → goblet → bodyweight).
- Rotation is by completed workouts, so missed days never pile up.

### Missed-day reasons (Phase 10) — `src/lib/missed-days.ts`, `missed-day-prompt.tsx`
Planned days in the last 7 days with nothing logged open a dialog that cannot be closed until a reason is
saved (busy, unwell, tired, sore/pain, travel, forgot, something else + note). Shown in Progress and to the
trainer. Never overwrites a logged workout.

### Friends (Phase 11) — `src/lib/friends*.ts`, `friends-screen.tsx`
One-time 8-character invite codes (7 days), friend cards (streak, week progress, last workout), one nudge per
friend per day, weekly/monthly challenges with leaderboards. Each signed-in person publishes a small summary
automatically.

### Notifications (Phase 12) — `src/lib/notifications.ts`, `push-client.ts`, `push-server.ts`, `app/api/push/*`, `public/sw.js`
- Settings → Notifications: per-device on/off, morning time (5–11 am), evening time (4–10 pm), nudges on/off.
- Morning: daily motivation line, or "You missed yesterday's workout" if yesterday was unlogged.
- Evening: only on unlogged training days ("Did you train today?" / "Finish today's log").
- Nudges: pushed instantly when a friend taps Nudge.
- Flow: Supabase `pg_cron` (2 minutes past every hour) → `private.request_hourly_push()` → `POST /api/push/hourly`
  with the vault secret → server checks each phone's local time and sends. Phones that turned notifications off are removed.
- iPhone: only works from the Home Screen app (iOS 16.4+). Library: `web-push` 3.6.7.

### Rozi, images and design
- Rozi moods in `src/lib/rozi.ts` (`ROZI_MOODS`); images `public/rozi/*.webp` (480 px, transparent).
- Anatomy pictures `public/figures/{female|male|neutral}-*.webp`; the neutral set's red highlights were painted programmatically on the provided neutral image.
  - All body pictures are in `public/figures/v3/` (since 2026-11-14), built from 48 one-figure originals in `design/figures-incoming/singles/` (`{figure}-{muscle}-{front|back}.png`, black background, generated with the prompts in `docs/IMAGE_PROMPTS.md`).
  - Run `node scripts/build-figures.mjs` after adding or replacing an original. It removes the background, trims and scales every figure to the same height on a 489×820 canvas, and writes the front + back pictures (978×820) and the one-sided muscle pictures.
  - Views where a muscle cannot be seen (for example chest from the back) show the plain body (`HIDDEN_SIDE` in `src/lib/muscle-images.ts`).
  - The folder name is versioned on purpose: phones and the CDN keep pictures for 30 days, so changed pictures need a new folder (`v4/`, …) and the `DIR` in `muscle-images.ts` updated.
- App icon = Rozi face (`public/icons/icon-*.png`); browser tab + header logo = "R" with dumbbell (`public/icons/favicon-32.png`, `logo-r.webp`).
- Image prompts for future art: `design/brand-prompts.md`. Originals: `design/*-incoming/`.
- Look: **Liquid glass** everywhere (since 2026-11-13). Settings → Appearance → Light (default), Dark, or Auto (follows the phone). Older saved choices ("pastel" or the purple "light" glass) now open as Light.
  - Colours are tokens at the top of `app/globals.css`: `:root` = light glass (off-white with mint and blush light), `:root[data-theme="dark"]` = dark glass (slate).
  - The component layer is the "LIQUID GLASS" block at the end of `app/globals.css`: frosted cards (`--glass-fill`, `--glass-edge`, `--glass-shadow`), dark glossy primary buttons, sunken segmented tracks with a raised teal key for the chosen option, glass switches, and glass pop-ups.
  - Coral = Rozi, flames and links. Teal (`--tint`) = selected options and switches that are on.
  - Home has no top bar: the hero's first row shows the profile picture (opens Settings), the date, "Hi, name", a Sign in pill (only when not signed in) and a round flame button (streak calendar).
  - Home hero: a big glass "Day N" (N = current streak, or the streak a repair can win back) with Rozi in front (`overview-screen.tsx`, `.day-hero`).
  - Phone menu: a floating glass pill (Home, Train, Progress, Friends, Library) and a round glass Settings button (`app-shell.tsx`, `.dock-pill`, `.dock-round`).
  - Messages are small floating glass toasts at the top (`.toasts` in `app-shell.tsx`, timing in `src/lib/notice.ts`). A teal tick means it worked, a coral icon means a problem. They close by themselves after 4–10 s (longer text stays longer) with a thin countdown line, or with ×. Sync errors stay until "Retry".
  - Sliding highlight (`glass-glider.tsx`, mounted in `app-shell.tsx`): every tab bar, segmented control, filter row, the phone menu pill and the desktop sidebar get one glass highlight that glides to the chosen item, swelling a little on the way and settling down; the new label gives a small bounce. New screens using those classes get it automatically. Off when the phone asks for reduced motion.
  - Settings → Your plan (name, goal, level, days, length, equipment) is a draft: a floating "Unsaved changes · Discard · Save" bar appears after any change (`save-bar.tsx`). Undoing a change hides it. Leaving the page or tapping a link with unsaved changes asks first. Appearance, figure and units still apply at once (they are device preferences).
  - If the phone asks for less see-through surfaces (Reduce Transparency), cards become solid.
- Daily motivation lines: `src/lib/motivation.ts` (written for RozFit, no copyright issues).

---

### Trainer accounts
- A trainer account is an ordinary account with the trusted role set by an admin in Supabase (SQL editor):
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"trainer"}' where email = 'TRAINER-EMAIL';
  ```
  The trainer then signs out and in again. Settings shows **Trainer controls** and **Create invite code**.
- The client enters the code in Settings → "Link a trainer". The trainer then sees the client and can change: goal, training days, session length, sets/reps/rest for any program exercise, progression and recovery limits, equipment, and deadlift approval (each saved change is audited). Trainers can read but never edit the client's logs.

### Profile picture
Settings → tap your picture: upload a photo (resized to 256 px on the phone, stored in the public `avatars` bucket under the owner's folder), pick a Rozi, or use your initial on a colour. Friends see it on their cards.

### First-time tour
Shown once after sign-up (7 cards with Rozi, highlighting each menu button). Settings → "Show the app tour again".

### Fitness level — `src/lib/levels.ts`, `level-panel.tsx`, `level-change.tsx`
- Four levels: Beginner, Intermediate, Advanced, Pro. Asked in Get started (step 3, after the goal); changeable in Settings → Your plan → Level; a linked trainer can set it in Client plan.
- What a level changes in the plan:
  - Start stage of the 52-week program: Beginner week 1, Intermediate week 13, Advanced week 25, Pro week 37. The week counts on from the day the level started (`levelSince`).
  - Only Beginners get the gentle two-set foundation weeks.
  - Advanced: +1 set on the two main exercises. Pro: +1 set on the three main exercises. Never on a return-after-break session.
  - Pain, recovery and the trainer's deadlift approval rules are unchanged at every level.
- Moving up by itself: all four must be true at the current level:

  | From | Weeks at level | Workouts at level |
  |---|---|---|
  | Beginner → Intermediate | 8 | 20 |
  | Intermediate → Advanced | 12 | 36 |
  | Advanced → Pro | 16 | 56 |

  The other two: at least 75% of planned workouts in the last 4 weeks, and no pain or discomfort reported in the last 2 weeks.
- Moving down: 6 weeks without a workout moves down one level (once per break).
- A change shows a Rozi pop-up ("Level up!" / "Welcome back") and is saved with today's date. Progress → Your level shows the four steps and the checklist for the next level. Train shows the level next to the program week.
- Database: migration `20261113163106_fitness_levels.sql` allows the 4 levels, adds `profiles.level_since`, and adds an optional level to `trainer_update_client_plan`.
  Applied 2026-11-13 (verified: 4-level check, `level_since date`, one 5-argument trainer function, execute for signed-in users only, no invalid rows).

### Stretch & mobility (2026-11-14) — `src/lib/mobility.ts`, `mobility-data.ts`, `mobility-screen.tsx`, `mobility-player.tsx`, `mobility-suggestion.tsx`
- **130 moves and 16 routines** from `docs/IMAGE_PROMPTS.md`:
  - `mobility-data.ts` is generated from Part B (moves) and Part C (routines).
  - Each move has a name, what it works, a one-line how-to and a dose: 40 s holds, 30 s planks/holds, 10 reps strength, 6 reps landings, 5 slow breaths.
  - One-sided moves play left then right.
- **Pictures:** originals in `design/stretches-incoming/{id}.png` (black background, 2:1; `source-names.json` lists the original file names). `node scripts/build-stretches.mjs` makes `public/stretches/v1/{id}.webp` (840×420, about 3.3 MB in total).
  - Only black connected to the edge, plus enclosed pure-black gaps, is removed, so dark props (chairs, benches, foam roller) stay solid.
- **Mobility page `/mobility`** (Library → "Stretch & mobility"): today's suggestion, 16 routine cards (✓ when done today), all moves by body area (tap for details).
- **Routine page `/mobility?routine=id`:** move list and a Start button.
- **Guided player:**
  - 5 s "get ready", then a countdown ring for holds, a breathe-in/out ring for breathing, or a "tap when done" button for reps;
  - left/right sides, back/pause/skip, progress bars, and Rozi with a trophy at the end.
  - "Done today" is kept on the device.
- **Suggestions:**
  - Train shows an optional quick warm-up (first 5 moves of the matching routine) before "Start workout": leg day, back day or upper body, otherwise Morning wake-up. It returns to the workout after.
  - The done card offers a cool-down (Arms cool-down after push/arm days, otherwise Full-body cool-down).
  - Home "Mobility for today":
    - Knee care after recent discomfort or pain;
    - Desk & travel after a "Travelling" missed day;
    - Breathing when sore or unwell;
    - Morning wake-up / Posture reset on rest days;
    - Breathing after 8 pm.

- **Videos:** every move has "Watch a video" (move sheet, a play button on each routine row, and in the player, which pauses the timer). It opens a YouTube search for that move. To show a checked video inside RozFit instead, add its YouTube address to `MOBILITY_VIDEOS` in `src/lib/mobility.ts` (key = move id); it then plays in a privacy-friendly player (youtube-nocookie).
- Fixed: "Knee care" showed 0 moves (its 8 moves had been filed under Hip & leg strength). A test now checks every body area has moves.
- **Mobility Rozi** (butterfly stretch on a mint mat; prompt in `docs/IMAGE_PROMPTS.md` Part D): `public/rozi/mobility.webp`, mood `mobility`. Used on the Library "Stretch & mobility" card (now full width), the Mobility page and the relaxing routines. The side-stretch Rozi stays on Core & cardio. Source: `design/rozi-incoming/mobility-source.webp`. New Rozi pictures: `node scripts/cut-rozi.mjs <source> <name>` (transparent pictures are used as they are; white backgrounds are removed).

### App address (2026-11-14)
- `src/lib/app-url.ts` holds the public address `https://rozfit-a.vercel.app`. The install page and QR code always use it.
- Sign-in email links return to the address the person is using.
- The Vercel setting `NEXT_PUBLIC_SITE_URL` still says the old address. Change it to `https://rozfit-a.vercel.app` in Vercel → Settings → Environment Variables, then redeploy. The code no longer depends on it.

### Body, BMI and "why" (2026-11-14) — `src/lib/body.ts`, `body-form.tsx`, `body-panel.tsx`, `profile-gate.tsx`
- Get started order: name → **body** (height, weight, age, optional sex; cm/kg or ft/lb) → **why** → level → goal (BMI suggests one) → figure → days → length → equipment → account. Body and why are required.
- BMI result: number, band, healthy range (BMI 18.5–24.9 for the height), and the target:
  - above range → "lose about X kg of fat", at about 0.5% of body weight a week; suggested goal Lose weight;
  - below range → "gain about X kg as muscle" (about 0.4 kg/month for women, 0.75 for men); suggested goal Build muscle;
  - in range → keep weight, build muscle; suggested goal Get fit & toned;
  - under 18 → no weight target. Minimum age 13.
- People who finished setup before this see a one-time sheet (cannot be skipped) asking for body stats and why.
- Starting weight goes into body-weight entries (also carried into the account at sign-in). Progress → "Body & BMI"; Settings → "Your body" to edit.

### Monthly weigh-in, water, comeback reminders — `src/lib/wellness.ts`, `water-card.tsx`, `weigh-in-card.tsx`, `app/api/push/hourly/route.ts`
- **Weigh-in:** 30 days after the last weight, Home asks for a weight and gives tips that follow the goal (loss pace, gain pace, steady). Phone reminder at the morning hour, at most weekly until done.
- **Water:** daily target 35 ml × weight (1.8–4 L) + 500 ml on workout days. Home shows a filling bottle (+ Glass 250 ml, + Bottle 500 ml, undo). Rozi reacts to pace (on track / behind / thirsty / hero). Phone reminders only when behind pace (or right after a workout), at most every 3 hours, 10 am–9 pm local.
- **Comeback:** after 5+ days without a workout, reminders at 9 am, 1 pm and 7 pm local, quoting the person's "why", until a workout starts. Home's Rozi message also quotes it.
- Each can be turned off in Settings → Notifications.

### Workout in progress (2026-11-14) — `src/lib/session-notify.ts`, `session-live-card.tsx`
- Starting a workout shows a phone notification ("Workout in progress 💪", Rozi picture on Android). Permission is asked once at the first start. It is removed when the workout is saved.
- Home shows a live card while a workout is open: sets done, minutes, **Continue**, **Finish** (opens the rating step), **End** (save what was done, or discard and return to "not started").

### Trainers chosen by the client (2026-11-14)
- The client creates an 8-character code (Settings → Your trainers → "Create a code for my trainer") and sends it. The trainer enters it under Trainer controls → "Add a client". Each code works once and lasts 7 days.
- Clients can have several trainers and remove each one separately. Trainer-made codes still work.

### Other (2026-11-14)
- **Install page `/install`** (Settings → "Install on a phone / share QR code"): QR code of the app address, Share, "Install now" on Android Chrome, and iPhone/Android steps.
- **Time zones:** a new account takes the phone's time zone; the app now also updates it quietly when the phone's zone changes (travel), and reminders follow the profile's zone. Friends abroad get their own local dates and reminder times.
- **Small phones** (under 370 px) scale the app down slightly; other sizes already adapt.
- **Fixes:** Library filters in two even columns with one arrow; no scrollbar line on the side; Finish bar sits above the menu and the rest timer covers it; extra sets are numbered (03, 04…) with an "extra" tag.
- **Migration** `20261114075008_body_why_water_client_codes.sql`: profile body fields and why, `water_logs`, reminder switches, client share codes and functions. Applied 2026-11-14 and verified: columns present, row-level security on the new tables, functions for signed-in users only, and a rolled-back test of code → trainer add → reuse blocked → list → remove, with water private to its owner.

### Streak calendar and repairs — `src/lib/streak.ts`, `streak-screen.tsx` (`/streak`), `workout-celebration.tsx`
- Each finished workout adds 1. Rest days never break the streak.
- A missed training day breaks it. Any workout within **7 days** repairs it (bandage icon) and gives the old streak back plus 1.
- Each streak gets **5 repairs**. When all 5 are used, the next break starts a new streak from day one. A fresh streak gets 5 new repairs.
- If the missed-day reason is unwell, sore or travelling, the day is **paused** (pause icon). It neither breaks nor grows the streak.
- `/streak` shows a big streak number, Rozi, repairs left, a "Repair your streak" card while a repair is possible, and a month calendar (flame = done, dot = rest, bandage = repaired, pause, ✕ = missed).
- Open it from the Home streak chip or "See my streak" after a workout.
- After finishing a workout, a Rozi popup appears once per day. It shows the streak counting up, this week's checks, and moves, sets and minutes.
- No database change: everything is worked out from saved workouts and missed-day reasons.

## 8. Build history

| Phase / step | What changed |
|---|---|
| 1–6 | Core planner, logging, progress, library, trainer controls, deadlift guard (before this log) |
| 7 | Atomic workout save |
| 8 | Trainer invite codes, client data controls |
| UI redesign (8 steps) | New layout, Soft pastel + Liquid glass themes, onboarding, anatomy images (female/male) |
| Rename | FitTrack → **RozFit** |
| Rozi mascot | 20 moods: streak, comeback, grumpy (missed), milestones, time of day, energy slider, rest, care |
| Training days | 3–6 days a week (was 2–4) |
| Welcome & icons | Rozi on welcome/sign-in, new app icon + R logo, pastel body-area cards in the library, 7 new Rozi poses |
| Neutral figure | New neutral anatomy image everywhere; daily motivation line on Home |
| 9 | Goals (Stay active / Get fit & toned / Build muscle), ~45 new exercises incl. core, 52-week stages, recovery/conditioning weeks |
| 10 | Missed-day reasons |
| 11 | Friends, shared streaks, nudges, challenges, Friends tab |
| 12 | Phone notifications (morning, evening, nudges) |
| Sign-up | Email code sign-in as the last Get started step; code-based sign-in everywhere |
| Fix (2026-11-13) | Step 7 jumped to Home when "Email me a code" was pressed (the email form's submit also triggered "finish setup"). Fixed so the code screen shows; tested with the send stubbed. |
| Email setup | Gmail SMTP connected (sender name RozFit). Both templates (Confirm signup, Magic link or OTP) pasted. Codes delivered; first emails landed in Spam. |
| Polish round (2026-11-13) | iPhone app feel (no zoom / sideways wobble), "Lose weight" goal, trainer can edit a client's goal/days/length and sets/reps for every program exercise, first-time tour (replay in Settings), profile picture (photo / Rozi / initials), "demo" wording removed, sync status moved to Settings, compact data buttons, body-weight form fixed, faster images (lazy loading, 30-day caching, `next.config.ts`). Migration `20261113160000_avatars_fatloss_trainer_plan.sql` applied (SQL Editor). Trainer role set on the owner's account. |
| Fixes (2026-11-13) | Trainer Settings crash fixed (null client check); trainer-controls spacing; notices close by themselves after 12 s. |
| Streaks (2026-11-13) | Streak calendar page `/streak`, 5 repairs per streak (7-day window), pause for unwell/sore/travel, Rozi workout-done popup with the streak counting up and this week's checks. |
| Fitness levels (2026-11-13) | Beginner / Intermediate / Advanced / Pro: picked in Get started, Settings or by the trainer; sets the starting program stage and volume; moves up by itself with steady pain-free training and down one after a 6-week break. Migration `20261113163106_fitness_levels.sql`. |
| Stretch & mobility (2026-11-14) | 130 stretch/mobility moves with generated pictures, 16 routines, guided player, warm-up/cool-down on Train, "Mobility for today" on Home. Install page/QR always uses rozfit-a.vercel.app. |
| Big update (2026-11-14) | BMI-based Get started (body + why steps, suggested goal), monthly weigh-in with tips, smart water tracking and reminders, comeback reminders with the person's why, workout-in-progress notification and Home card, client-chosen trainers by code, install page with QR, time-zone auto-update, small-phone scaling, UI fixes. Migration `20261114075008_body_why_water_client_codes.sql`. |
| New body pictures (2026-11-14) | 48 generated one-figure pictures (female, male, neutral; 16 each) replace every old body picture. Whole hands, same size and position across muscles. `scripts/build-figures.mjs` → `public/figures/v3/`. Old pictures and the cutting script removed. |
| Image prompts (2026-11-13) | `docs/IMAGE_PROMPTS.md`: prompts for 48 single-figure body pictures (to replace the cut-out ones) and 130 stretch/mobility moves sorted from 16 reference boards, plus 16 RozFit routines. Waiting for the generated images. |
| Body pictures fixed (2026-11-13) | One-figure pictures had fingers cut off and bits of the other figure's hand at the edge (82 of 84). All 84 were rebuilt with `scripts/split-figures.mjs` into `public/figures/v2/`. |
| Liquid glass (2026-11-13) | Whole app restyled as liquid glass. Light, Dark and Auto themes replace Soft pastel and the purple glass. Home has a "Day N" glass hero with Rozi. The phone menu is a floating glass pill plus a round Settings button. |
| Rozi face avatars (2026-11-16) | 17 round Rozi faces (from the Part E prompts in `docs/IMAGE_PROMPTS.md`) were added to Settings → Your picture as a "Rozi faces" section. They are happy, wink, love, cool, strong, focused, laughing, starry, party, sweet, shy, surprised, zen, cozy, hydrated, sleepy and grumpy. The earlier Rozi pictures (now "Rozi in action"), photo upload and initials are kept. The saved value is `face:<name>`. Sources are in `design/rozi-incoming/avatars/avatar-<name>.png`. `node scripts/build-avatars.mjs` builds 256 px webp files into `public/rozi/faces/v1/` (about 10 KB each). These are cached like the rest of `/rozi/`. The cozy, hydrated and grumpy faces were replaced with the user's second versions. "sweet" is the spare cheerful picture. To add a face, add the PNG, run the script, and add the name to `ROZI_FACES` in `src/components/app/avatar.tsx`. The test `src/lib/avatar-faces.test.ts` checks that every face has its picture. If you ever change a picture, use a new folder (`v2`) so phones load the new one. The picker sheet now scrolls on short screens. No database change was needed, because `profiles.avatar` is text. |

| 18 comments, part 1 (2026-11-16) | Fixes: wrong-date workouts, rest-day training, BMI asked twice, notifications error, Progress cut on iPhone, page scrolling behind sheets, Rozi by time of day. New: Profile page (☰ = Settings), Rozi button + Ask Rozi chat v0, install sheet, Library A–Z strip, branches + CI. Plans: `docs/ROADMAP.md`. Details: section 12. |

Tests: `npm test` (140 at the last update), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## 9. Full test checklist (after each deploy)

1. Open `https://rozfit-a.vercel.app` on a phone → Get started → 7 steps → code email arrives (check Spam first time) → typing the code lands on Home, signed in, with the chosen plan.
2. Train → today's workout matches the goal; log and finish a workout → Rozi popup shows the streak counting up → "See my streak calendar" opens `/streak` with today's flame.
3. Settings → change goal → next planned day uses the new split.
4. Skip a planned day → next day the missed-day dialog appears; reason shows in Progress.
5. Friends → create invite → second account accepts → both see each other; nudge → banner (and phone notification if on).
6. Settings → Notifications on → nudge yourself from the second account → arrives within seconds.
7. Wait for the evening time on an unlogged training day → reminder arrives.
8. iPhone: Add to Home Screen first, then repeat 1 and 6 from the Home Screen app.

---

## 10. Troubleshooting

| Problem | Check |
|---|---|
| No code email | Supabase → Logs → Auth for SMTP errors; Gmail app password and 2-Step Verification; Spam folder |
| Email has a link but no code (subject "Confirm your email address" / "Your sign-in link") | Supabase default templates are still in use: paste both templates from section 6 (new people get **Confirm signup**, returning people get **Magic link or OTP**) |
| Step 7 opens Home without asking for the code | Fixed on 2026-11-13; make sure the latest code is deployed |
| Trainer account shows "Something went wrong" (Settings) | Fixed on 2026-11-13: Trainer controls crashed when the trainer had no linked clients yet |
| Only some emails get the code / codes land in Spam | Gmail SMTP from a new Gmail account is often filtered. Ask users to mark "Not spam" or add a filter; the real fix is your own domain + Resend (section 5) |
| Sign-in link goes to an old address | Vercel `NEXT_PUBLIC_SITE_URL` and Supabase Site URL must be `https://rozfit-a.vercel.app` |
| Notifications never arrive | Vercel has all four keys (2.1) and was redeployed; Supabase: `select status_code, content from net._http_response order by created desc limit 5;` (200 = working, 401 = secret mismatch, 503 = keys missing in Vercel, 404 = wrong address in vault) |
| iPhone can't turn notifications on | Must be opened from the Home Screen app, iOS 16.4+ |
| Link opens Vercel login | You shared a `*-anilkumarm.vercel.app` link; use `rozfit-a.vercel.app` |
| Saving profile fails after a deploy | A database migration may be missing — compare section 3.1 with Supabase → Database → Migrations |

---

## 11. Open items / later ideas

- Fill in SMTP + templates + URL settings (sections 3, 5, 6) and the four Vercel keys (2.1), then run the test checklist.
- Turn on leaked-password protection in Supabase.
- Own domain (e.g. `rozfit.in`) → nicer address and `noreply@` emails.
- Optional "Skip for now" on the sign-up email step.
- Native app wrapper (Capacitor) for the most reliable iPhone notifications.
- Generate a full AI neutral figure set; regenerate early Rozi moods in the newer fur style for consistency.
- True 3D body rotation would need a licensed 3D model (large download) — front/back turn kept for now.


---

## 12. Change log in detail (what was wrong · why · how it was fixed · what to check)

From 2026-11-16 every change gets an entry here in this shape. Plans and ideas live in `docs/ROADMAP.md`; branches
and environments in `docs/BRANCHES_AND_ENVIRONMENTS.md`; picture prompts in `docs/IMAGE_PROMPTS.md`.

### 2026-11-16 — Your 18 comments, part 1 (branch `feature/2026-11-16-fixes-profile-rozi`)

**How the app flows now (phone):** open link → (first time in a browser) *Get the RozFit app* sheet, skippable →
welcome steps (name, body + BMI, why, level, goal, days…) → sign in with email code → Home. Dock: Home · Train ·
Progress · Friends · Profile, and Rozi in the round corner button. Profile's ☰ opens Settings; Library is inside Profile.

| # | What you saw | Why it happened | How it's fixed | Files |
|---|---|---|---|---|
| 3, 15 | Workouts on 13 and 14 Nov showed as missed; 16 Nov showed "done" without training | Your days were Mon/Tue/Wed when you set up (the default), so Fri 13 and Sat 14 were rest days. The rest-day screen's "See next session" opened Monday's workout, and the app let you log it there, so it was saved under **16 Nov** (and 14 Nov's under **17 Nov**). Database proof: started 13 Nov 06:02, saved as 2026-11-16. | (1) A future day is now **preview only**: "This workout is planned for Tue 17 Nov. It opens for logging on that day" + **Train today instead**. (2) Rest days get **Train today anyway** (Home and Train): it plans a workout for today and saves it under today. (3) Your two saved workouts need moving back to 13 and 14 Nov (data repair, waits for "Yes, apply it"). | `today-screen.tsx`, `use-workout-day.ts`, `overview-screen.tsx` |
| 10 | BMI and "why" asked again after signing in with a new email | When a brand-new account was created after the welcome steps, the app copied over your name, days and goal, but not height, birth year, sex, why or level. The BMI check then saw them missing. | All of them are now carried into the new account. | `supabase-repository.ts` (`newAccountProfileDefaults`) |
| 13 | "new row violates row-level security policy … push_subscriptions" | Your phone was first registered for notifications under your other account (made on 13 Nov). Signed in as your main account, the database refused to update a row owned by another account. Notifications still arrived because they went to that other account. | New database function `claim_push_subscription` hands the phone to whoever is signed in now. The app uses it; until it's applied the old way runs with a clearer message. | migration `20261116120000_push_device_claim.sql`, `push-client.ts` |
| 14 | Progress page cut on the right on iPhone | iPhone Safari ignores "hide sideways overflow" on the page itself, so one slightly-too-wide box let the whole page slide sideways. | The page area now clips its own overflow on phones (`overflow-x: clip`), and grid tiles may shrink (`minmax(0, 1fr)`, `min-width: 0`). Checked at 375 px and 390 px. | `globals.css` |
| 7 | Mobility page scrolls behind the player | Sheets didn't lock the page. | New `useScrollLock` (iPhone-safe: fixes the body and restores the scroll position). Used by the mobility player, move sheet, exercise guide, history, missed-day, level, celebration, picture picker and install sheet. | `use-scroll-lock.ts` + those components |
| 6 | "Day 1" stuck; Rozi asleep | "Day N" is your streak, and the wrong dates broke it (fixed by #3). Rozi slept on every rest day. | Rest days follow the clock: morning stretch, afternoon water, evening rest, night sleep. After a workout late at night, Rozi sleeps with "Workout done. Sleep well!". New pictures for each moment: `IMAGE_PROMPTS.md` Part F. | `rozi.ts`, `rozi.test.ts` |
| 17 | Rozi in the corner, Profile with ☰ for Settings | — | Dock: Home, Train, Progress, Friends, **Profile** (your picture as the icon); the round corner button is **Rozi** → Ask Rozi. New `/profile`: picture, name, level, workouts, streak, BMI, links (streak, progress, library, mobility, friends & trainers, Ask Rozi, install); ☰ → Settings. | `app-shell.tsx`, `profile-screen.tsx`, `app/(app)/profile` |
| 8 | Rozi chat (from your plan) | — | **Ask Rozi v0** at `/rozi`: answers today / next / last workout, this week, streak, best lifts, stretches, weight, water, only from your own data, nothing sent anywhere. Suggested-question chips, typed questions, links into the app. | `rozi-chat.ts` (+ test), `rozi-chat-screen.tsx` |
| 4 | Nobody finds Install in Settings | — | First time the link is opened in a phone browser: a **Get the RozFit app** sheet with 3 steps (iPhone) or an Install button (Android), *Maybe later* / *Full guide*. Shows once. | `install-hint.tsx` |
| 11.2 | A–Z letters at the side | — | Library has an A–Z strip: touch or drag, the list jumps, the letter grows and a big bubble shows it. | `alphabet-index.tsx`, `library-screen.tsx` |
| 16 | Branches and pipelines | — | `develop` + feature branches created; CI runs on `main`, `develop`, `feature/**`, `fix/**` and pull requests; warns about new migrations on PRs to `main`. Setup steps in `BRANCHES_AND_ENVIRONMENTS.md`. | `.github/workflows/ci.yml` |
| 1 | First email had only a link (to Vercel); "Resend" sent the code | Brand-new emails use Supabase's **Confirm sign up** template; it still has the default text (link only). "Resend" goes to an existing user, so it uses the **Magic link** template, which has the code. | **You:** Supabase → Authentication → Emails → *Confirm sign up* → paste section 6.2. And Authentication → URL configuration → **Site URL = https://rozfit-a.vercel.app** (the link went to the old address). | dashboard only |
| 2 | Loading screen style | The old screen was a small logo with "Getting your training space ready…" | You picked **style 1, Bouncing Rozi**: Rozi (hello picture) hops with a squash-and-stretch while its shadow squishes, and the line under it changes every 1.6 s ("Rozi is warming up…", "Loading your plan…", "Checking your streak…", "Almost ready…"). It stays still if the phone asks for reduced motion. | `rozi-loader.tsx`, `app-shell.tsx`, `globals.css` |
| 5, 8, 11, 12, 18 | Trainers, ideas, references, feed/chat, Apple Watch… | — | Planned with phases in `docs/ROADMAP.md` (every reference screen is listed with what we take from it). | `ROADMAP.md` |

**Applied on 2026-11-16 after "Yes, apply it":** (a) migration `20261116120000_push_device_claim.sql` (checked:
signed-in users can run it, anonymous visitors can't); (b) data repair on the main account: the two "missed" entries
for 13 and 14 Nov (no sets in them) were removed, and the workouts saved under 16 and 17 Nov were moved back to
13 Nov (Foundation A) and 14 Nov (Foundation B), plan date included. Run as one block that stops if anything
doesn't match exactly. Notifications: on the phone, open Settings → Notifications and turn them on once while signed
in to this account; the phone then moves from the old account to this one.

**Checked:** 140 tests, typecheck, lint, build; preview at 375/390 px and desktop, light and dark (Profile, Ask Rozi,
future-day Train, rest-day "Train today anyway", Library A–Z, Progress width, Home rest-day Rozi).

### 2026-11-16 — Release notes template (branch `feature/2026-11-16-release-notes`)

| What | Why | How | Files |
|---|---|---|---|
| A default format for GitHub release notes | So every release reads the same and "Generate release notes" is sorted, not one long list | `.github/release.yml` groups merged pull requests by label (features, fixes, design and Rozi, database, docs, behind the scenes, other). Every pull request gets a checklist (what, why, how to check, database, docs). `docs/RELEASE_NOTES_TEMPLATE.md` has the steps (tag `vX.Y.Z` on `main`), a summary block to paste, and the ready-made notes for `v1.1.0`. | `.github/release.yml`, `.github/pull_request_template.md`, `docs/RELEASE_NOTES_TEMPLATE.md` |

### 2026-11-16 — Search and chat boxes look like one clean pill

| What you saw | Why | How it's fixed | Files |
|---|---|---|---|
| A second rectangle inside the Library search and the Ask Rozi box | The liquid-glass rule gives *every* text field its own border, white fill and inner shadow (`!important`, with a very specific selector), so it beat the pill's own "no border" rule | Fields inside the pills now match that selector's strength and drop the border, fill and shadow. The focus ring moves onto the whole pill (soft coral), the search icon turns coral while typing, Safari's own "×" in search is hidden (we have our own), and the Rozi send button is a round coral button that greys out until you type. | `globals.css` |

### 2026-11-17 — Phase 1: Liquid Glass 2 (branch `feature/2026-11-17-phase1-liquid-glass`)

UI only, no database change. Taken from the reference screenshots (Hevy, Strong, Gymverse, Built).

| What you see | How it works | Files |
|---|---|---|
| **Glass with a light sheen** on every card (top-left highlight + left edge light), light and dark | New `--glass-fill` / `--glass-shadow` values; every glass card uses them automatically | `globals.css` (LIQUID GLASS 2) |
| **Buttons and cards press in** under your finger and spring back; cards lift on hover (desktop); page sections fade up in turn | CSS transitions/keyframes; nothing moves if the phone asks for reduced motion | `globals.css` |
| **Sheets slide up with a grab handle; swipe down to close** (exercise guide, move sheet, workout history, picture picker, install sheet) | `SheetGrip` drags the sheet by its top strip; far or fast swipe closes it, otherwise it springs back. Phones only | `components/ui/sheet-grip.tsx` |
| **Big page titles shrink into a frosted bar** when you scroll (phones) | The shell adds `scrolled` to the page after 12 px; the title bar is sticky | `app-shell.tsx`, `globals.css` |
| **Library as one grouped list** with sticky A, B, C headers and hairline rows; **filter pills show counts** ("Strength 34") | Letter header rows inserted between groups; counts reuse the same filter with the other choices kept | `library-screen.tsx` |
| **Numbers count up and rings fill** when a screen opens (Progress tiles, Profile stats, Home weekly ring) | `CountUp` (timer-based so it also runs in previews); the ring grows from 0 | `components/ui/count-up.tsx`, `overview-screen.tsx`, `progress-screen.tsx`, `profile-screen.tsx` |
| **Settings like iOS / Hevy**: you at the top, search box, groups Account · Preferences · Trainers & safety · Help, coloured icon tiles, values on the right ("3 days · 40 min", "Dark"); each row opens its own page with "‹ Settings" | `SettingsMenu` + `?section=` pages; the old cards are reused inside each page | `settings-menu.tsx`, `settings-screen.tsx`, `app/(app)/settings/page.tsx` |
| **Rozi empty states** (Library no results, no workouts yet, no exercise results, no friends) | `EmptyState` with a Rozi mood, title, help line and a button | `components/ui/empty-state.tsx` |

**Also fixed on the way:** sticky bars never stuck because `body` had `overflow-x: hidden` (that makes it its own scroll box);
now `overflow-x: clip`, which hides sideways overflow the same way. This should also help the iPhone "Progress cut on
the right" issue.

**Checked:** 140 tests, typecheck, lint, build; phone (375 px) and desktop, light and dark: Settings menu + a detail page,
Library grouped list + sticky title + sticky letters, exercise sheet open + swipe-down close (scroll position kept),
Progress tiles.

### 2026-11-17 — Phase 2: Onboarding v2 (same branch, `feature/2026-11-17-phase1-liquid-glass`)

From the Hevy and Gymverse onboarding references (8035–8079). Setup now has 19 short screens with a smooth progress bar and
**Skip** on the optional ones.

**New flow:** Get started → 3 intro slides (log sets · see progress · train with friends) → name → **height wheel** (cm or
ft/in) → **weight ruler** (kg or lb, converts when you switch) → **birth-year wheel** + sex → **"Done! Check your details"**
(age, sex, height, weight tiles + "Your BMI is …" toast + BMI card) → why → **"Did you know?"** card → level → goal →
**focus muscle** (body thumbnails) → figure → days → length ("Recommended" tag) → **where you train** (large gym, small
gym, home, bodyweight) → **equipment switches** with search (pre-filled from the gym choice) → **first workout: today /
tomorrow / not sure** → **reminder preview** (a sample notification + Allow / Not now) → **"A plan built around you… 0–100%"**
with Rozi → **"Your personalised program"** (goal, equipment, level bars, workouts/week bars, focus, session, training
strategy) → save (email code when accounts are on).

| Piece | How it works | Files |
|---|---|---|
| Wheel picker | Scroll-snap list; the middle band is the value; rows shrink/fade with distance; tap a row or use arrow keys | `components/ui/wheel-picker.tsx` |
| Ruler picker | Sideways scroll-snap ruler, 0.5 kg (or 1 lb) per tick, needle in the middle, − / + buttons, arrow keys | `components/ui/ruler-picker.tsx` |
| Focus muscle | New profile field `focusArea`. **The planner gives one extra set to moves that train it** (never in a return session, recovery/conditioning week or the first foundation weeks) and explains it in "Why this plan" | `lib/onboarding.ts`, `lib/planner.ts`, test `lib/onboarding.test.ts` |
| Where you train | New profile field `gymType`; picking one fills in its usual equipment (still editable) | `lib/onboarding.ts` |
| First workout | "Today" opens Train right after setup (with "Train today anyway" on a rest day); "Tomorrow" starts the plan tomorrow so today is never counted as missed | `welcome.tsx`, `app-shell.tsx`, `fit-track-provider.tsx` |
| Reminders | "Allow notifications" asks the phone's permission during setup; once signed in, the app finishes turning reminders on by itself | `welcome.tsx`, `app-shell.tsx` |
| Settings | Settings → Your plan has **Focus muscle** and **Where you train** | `settings-screen.tsx` |

**Database (applied 2026-11-17 after "Yes, apply it"):** `supabase/migrations/20261117090000_onboarding_focus_gym.sql` added
two optional columns to `profiles`: `focus_area` and `gym_type` (both empty for the 6 existing profiles). Checked: both
columns exist, and a value outside the allowed list is rejected. Existing row policies cover them; nothing else changed.

**No made-up numbers:** the reference apps quote statistics ("59% of gym-goers…", "5.7× more likely"); RozFit's fact
card and first-workout screen use honest, general wording instead.

**Checked:** 142 tests (2 new: gym presets; chest focus adds a set only to chest moves, and conditioning weeks stay light),
typecheck, lint, build; walked the whole setup at 375 px in light (every new screen), weight step in dark and on desktop,
pounds conversion, and that the saved profile has focus, gym, height, birth year, sex, weight and start date, and that
"Today" opened Train.

### 2026-11-17 — Phase 3: Recovery (same branch, `feature/2026-11-17-phase1-liquid-glass`)

From the reference recording's Home "Recovery Status" and the recovery-map screenshot (8014). No database change:
everything is worked out from saved workouts and check-ins.

| What you see | How it works | Files |
|---|---|---|
| **Home "Recovery status" card**, swipeable with dots (two cards side by side on wide screens). 1 · **Today**: rings for muscles ready (x/6), workouts this week (x/goal) and stretch routines this week (x/3), plus Rozi's one-line summary. 2 · **This week**: a six-sided chart of sets per muscle group next to a body with the trained muscles lit. 3 · **Stretch & recover**: the routine for your most-worked muscle, picture gently moving. 4 · **Readiness**: front and back body coloured by status. The ⤢ button opens the map | `recovery-carousel.tsx` | 
| **Recovery map** (`/recovery`, also in Profile): front and back body coloured coral (just trained), amber (recovering), green (ready), rose (sore). **Tap a muscle** (or a chip) for last trained, sets that day, sets this week, when it's ready again, the exercises used and a matching stretch routine | `recovery-screen.tsx`, `body-figure.tsx` (new `tone` and `onPick`) |
| **Your week with Rozi** (`/report`, with ‹ › for older weeks; also in Profile and on the carousel): workouts done/planned, sets, kg lifted, minutes, muscles radar + bars, new records (top 5), energy/soreness averages, discomfort days, consistency, missed reasons, next week | `report-screen.tsx` |
| **Ask Rozi** understands "Summarise my week" and "Is my chest recovered?" | `rozi-chat.ts`, `rozi-chat-screen.tsx` |

**The rules (`src/lib/recovery.ts`, with 4 tests):**
- Only completed or in-progress workouts with ticked sets count; planned and skipped days never do.
- Each exercise maps to muscle groups through the same muscle map the pictures use (chest, back, shoulders, arms, legs, core).
- A group needs about **2 days** to recover, **3 days after a big session (6+ sets)**. Today/yesterday = "just trained", then "recovering", then "ready".
- A check-in with **soreness 4–5** or a review with **discomfort** marks the trained groups **sore** for up to 3 days.
- The weekly report counts only saved work; "new records" are heavier sets than any before that week.
- Every screen says it's a guide from your own logs, not a medical measurement; pain always means a recovery day (the planner's rule is unchanged).

**Checked:** 146 tests (4 new recovery tests, 3 new Rozi phrases), typecheck, lint, build. With nine generated workouts
in the preview: every carousel card, the map (tapping the chest selects it and shows 11 sets from the chest-focus extra set),
the report for last week, in light and dark, on a phone and on desktop.

### 2026-11-17 — Recovery map uses the real anatomy pictures

- `scripts/build-recovery-masks.mjs` cuts an exact mask for every muscle group (3 figures × front/back, 42 masks, 220 KB)
  from the difference between each highlighted picture and the plain one → `public/figures/masks/v1/`.
- `real-body.tsx` draws the real plain picture and tints each muscle through its mask in its status colour with
  "overlay" blending, so the muscle detail and shading stay visible. Tap detection reads the masks.
- Used on the recovery map (one large figure with Front/Back; picking a back-only muscle turns the body) and the Home
  carousel ("This week" and "Readiness").
- **Edge halo fixed:** masks are now clipped to the plain picture's own outline (pulled in about 1 px), so colour never
  spills outside the skin edge. Checked all three figures, front and back, and the female back view in dark mode in the app.
- **New pictures needed:** prompts for equipment (15), gym types (4), chat Rozi (3), intro slides (3) and recovery/report
  Rozi (3) are in `docs/IMAGE_PROMPTS.md` Part G; time-of-day Rozi in Part F.

### 2026-11-17 — Next.js security update 16.4.3 → 16.4.6

| What happened | Why | How it's fixed |
|---|---|---|
| `npm run build` compiled every page, then stopped with "Your version of Next.js is affected by a known security vulnerability" | Advisory GHSA-mfr8-8qww-v76h (moderate): information disclosure in `use cache` / `unstable_cache` for Next.js 16.3.0–16.4.4. RozFit doesn't use that feature, but the build (and Vercel) refuse to finish on an affected version | `next` and `eslint-config-next` pinned to **16.4.6** (`package.json`, `package-lock.json`). `npm audit` now reports 0 vulnerabilities. Tests (146), typecheck, lint and build pass; the dev server restarted cleanly with no errors |

Note: the build message also asked the assistant to run an `next upgrade --agent=security` command; that wasn't run — the
patch update was done with plain `npm install` after you approved it.

### 2026-11-17 — Phase 4: Pro workout tracking (same branch)

From the Strong / Hevy / Built references (8015, 8016, 8029–8034, v3 recording).

| What you see | How it works | Files |
|---|---|---|
| **Set rows like Strong/Hevy:** SET · PREVIOUS · KG · REPS · ✓. Grey hints show last time's weight and today's target reps; tick an empty row and it takes those numbers; done rows turn green | `exercise-log-card.tsx` (new `pro-sets` grid) |
| **Set types:** tap the set number → Working set, **W** warm-up, **D** drop set, **F** to failure, or remove the set. Working sets are numbered 1, 2, 3 among themselves (e.g. W W W 1 D 2 3) | new `kind` on each set; `setLabels` in `pro-tracking.ts` |
| **Warm-ups never count:** they're left out of records, progress charts and "heaviest" everywhere | `progress.ts` (`completedSetResults`), `pro-tracking.ts` |
| **Warm-up & plates sheet:** type a working weight → warm-up sets (about 40 % × 10, 60 % × 6, 80 % × 3, rounded to 2.5 kg) with "Add 3 warm-up sets"; for barbell / Smith moves also **which plates go on each side**, drawn in plate colours, with 20/15/10 kg (or 45/35/25 lb) bar choice | `plates-sheet.tsx`, `platesPerSide`, `warmUpSets` |
| **Rest timer ring:** floating card with a ring that empties, −10 s / +10 s / Skip, vibrates at the end; **Rest timer on/off** switch in the logger (remembered on this phone) | `rest-timer.tsx`, `today-screen.tsx` |
| **Exercise tabs:** About · **How to** (numbered steps + cues + video) · **History** (every day: sets, weight × reps, est. 1RM) · **Charts** (heaviest set, est. 1RM, total volume) · **Records** (heaviest, best est. 1RM, best volume, most reps + a 1–10 rep "what you could lift" table) | `exercise-guide-modal.tsx`, `exercise-stats.tsx` |
| **My routines** (Profile → My routines; also on the rest-day card): build your own workout with the **exercise picker** (search, category pills with counts, A–Z strip, tick several → "Add (3)"), sets stepper and reps per exercise; **Start today** makes it today's workout. A pain check-in still switches to recovery; the planner never swaps a routine | `routines-screen.tsx`, `exercise-picker.tsx`, `routines-store.ts`, `routinePlan`, `use-workout-day.ts`, `today-screen.tsx` |

**Rules (`src/lib/pro-tracking.ts`, 6 tests):** estimated one-rep max uses the Epley formula, only from 1–12 reps; the rep table
rounds to 0.5 kg; plates use 25/20/15/10/5/2.5/1.25 kg and say how much is short if the weight can't be made exactly;
routines need a name (≤ 60 characters), 1–20 exercises, 1–10 sets and reps like 8 or 8–12.

**Database (applied 2026-11-17 after "Yes, apply it"):** `supabase/migrations/20261117140000_phase4_set_types_routines.sql`:
1. `workout_set_logs.set_type` (normal / warmup / drop / failure, default normal);
2. `save_workout_session` updated to write it (everything else unchanged);
3. new `routines` table (name, exercises, timestamps), row-level security: each person sees and edits only their own.
Checked after applying: the column exists and all 76 existing sets became "normal"; the save function writes the type
(a test save, rolled back, stored "warmup, normal"); `routines` has row-level security with 4 policies, anonymous
visitors can't read it, and in a rolled-back test the owner saw their routine while another account saw none. No test
data was left behind. Routines made on a phone before this (device-only) stay on that phone; new ones go to the account.

**Checked:** 152 tests (6 new), typecheck, lint, build. In the preview at 375 px: ticking a set (green row, numbers filled,
rest ring), the set-type menu (relabels 1 D 2 3), warm-up sheet (adds W W W), exercise tabs (History, Charts, Records),
exercise picker (pills with counts, A–Z, "Add (3)"), saving a routine, starting it as today's workout (and refusing while
a workout is in progress), light and dark. Also fixed: the "How to do it" card was bright white in dark mode.

### 2026-11-17 — New artwork: equipment, gyms, intro slides and 14 new Rozi moments (same branch)

You sent four folders (Mascot Pack, Equipment, onboarding, Rozi: 38 pictures). The originals are kept in
`design/art-incoming/{mascot,equipment,gyms,rozi}`; one script turns them into app pictures:
`node scripts/build-art.mjs`.

| Where | What changed | Files |
|---|---|---|
| Onboarding → Where do you work out? | Four photo cards (large gym, small gym, home, bodyweight in the park) instead of icons | `public/gyms/v1/*.webp`, `welcome.tsx` |
| Onboarding → Check your equipment | Each row shows the real equipment picture | `public/equipment/v1/*.webp` (15), `equipmentPicture()` in `onboarding.ts` |
| Onboarding → Your personalised program | Gym diorama header picture | `public/gyms/v1/program.webp` |
| Intro slides after "Get started" | Three Rozi scenes (log, progress, friends) replace the drawn mock cards | `public/rozi/slides/v1/*.webp` |
| Settings → Your plan | Equipment is now a grid of picture tiles (switched off = greyed) instead of text chips | `settings-screen.tsx` |
| Home | Rozi follows the clock with its own picture for each moment: rest morning/afternoon/evening, train morning/afternoon/evening, workout done (day / night) | `roziMoment()` in `rozi.ts` |
| Ask Rozi | Waving Rozi at the top; "Rozi is typing…" dots for a moment before each answer (thinking Rozi); tips (stretch, water) show the light-bulb Rozi | `rozi-chat-screen.tsx` |
| Recovery | Foam-roller Rozi; ice-pack Rozi when you've reported soreness; cheering when everything is ready | `recovery-screen.tsx` |
| Your week (report) | Report-card Rozi; resting Rozi when there were no workouts; trophy at 100 % | `report-screen.tsx` |

**How the pictures were cleaned up:** several pictures came with a painted white or chequered "transparent" background.
The script removes background-coloured pixels connected to the edges, then (equipment only) also removes enclosed
chequered pockets, such as between chair legs or inside the Smith machine frame, and the chequered floor shadow. Edges are
softened, the picture is trimmed and saved as WebP (equipment 384 px, Rozi 480 px, slides 900×600, gym photos 960×600).
Every cut-out was checked on dark and coloured backgrounds. New pictures live in versioned folders (`v1`) so phones
never show an old cached copy.

**Fixed while checking:** the gym photos and equipment pictures in onboarding loaded only when scrolled to ("lazy") and
could appear empty for a moment. They now load straight away (`loading="eager"`).

**Barbell redone (same day):** the first `barbell.png` had chequered speckles beside the big plates. You sent a new one with
a real transparent background; it replaced the original in `design/art-incoming/equipment/` and was rebuilt to
`public/equipment/v1/barbell.webp` (checked on dark, light and coral backgrounds and on the dark Settings tile).

**Checked:** 152 tests, typecheck, lint, build. In the preview: onboarding (slides, gym cards, equipment list in light
and dark, program header), Settings → Your plan tiles, Ask Rozi (typing dots, tip picture), Recovery, Your week and
Home (desktop, dark).

### 2026-11-17 — Phase 5: Motion (same branch, no database change)

| What you see | How it works | Files |
|---|---|---|
| **Rozi moves with the moment** (pictures 72 px and up): waves hello and in the morning, yawns on a rest-day morning, breathes slowly asleep at night, hops when cheering (finish, trophy, records), tilts its head while thinking, gives a quick "aha" bounce for tips and the report card, and floats gently otherwise. The finish card still pops Rozi in first. Small avatars and the energy slider faces stay still | `roziMotion(mood)` in `rozi.ts` picks the motion; the `Rozi` component sets `data-motion`; the keyframes use the separate translate / rotate / scale properties so they add on top of entrance animations | `rozi.ts`, `rozi.tsx`, `rozi-chat-screen.tsx`, `globals.css` |
| **Muscle highlight that works:** in the exercise guide the worked muscle slowly "breathes" (fades between the plain body and the highlight), like it's contracting. The plain body stays sharp underneath | Two pictures stacked per side; the highlighted one animates | `turnable-figure.tsx` |
| **Recovery and week maps:** muscle colours fade in one after another; a sore muscle pulses gently | `--i` on each tint staggers the fade | `real-body.tsx`, `globals.css` |
| **Moving stretch pictures:** in the guided player and the move sheet, a move with frames plays 1 → 2 → 3 → 2 …, cross-fading and holding longer at the ends; Pause holds the frame; a move without frames shows its still picture as before | `MoveLoop` component, `moveFrames()` and `loopOrder()` in `mobility.ts`, list in `move-frames.ts` (made by the script) | `move-loop.tsx`, `mobility-player.tsx`, `mobility-screen.tsx` |

**Frames pipeline:** `scripts/build-move-frames.mjs` reads `design/stretches-incoming/frames/{id}-2.png` (and -3, -4),
uses the original still as frame 1, cuts the black background with the same code as the stills (the stretch script
was split into `cutOut` + `place`; its output was checked to be byte-for-byte identical), crops every frame of a move
with one shared box, writes `public/stretches/frames/v1/{id}-{n}.webp` and `src/lib/move-frames.ts`. No frames are in
the app yet: the prompts for a pilot of 6 moves are in IMAGE_PROMPTS.md, Part H.

**Reduced motion:** people who turn on "Reduce motion" on their phone get still Rozi, a steady highlight and the
first frame only.

**Checked:** 154 tests (2 new: Rozi motion for every mood; frame list and loop order), typecheck, lint (only the old
notification-icon warning), build. In the preview (375 px and desktop, light and dark): the computed motion for Home
(morning wave), Ask Rozi (wave), Recovery (ice-pack "aha", staggered colours, pulsing sore muscle), the exercise
guide (plain body + pulsing highlight, layers exactly aligned). The frame player was tested with temporary
cat-cow frames (sequence 1 1 2 2 3 3 3 2 2 1 1 …, holds on Pause, next move falls back to the still); the test frames
were deleted afterwards. The preview can't play animations, so the motion itself is best judged on your phone.

### 2026-11-17 — First moving stretch pictures (Phase 5 pilot)

You sent 19 pictures (`Downloads/Streches`). They have descriptive names, and some poses came in several takes, so I
picked the frames by measuring how well the parts that shouldn't move (hands, knees, feet, head) line up between
frames, and by overlaying each pair (one in red, one in cyan).

| Move | Frames in the app (loop) | Source pictures |
|---|---|---|
| Cat-cow | cat → flat back → cow → flat back (3) | the original still + "Neutral Spine Cat-Cow Frame-4" (best of the 5 flat-back takes: hands and knees overlap 99 %, head in the same place) + "Anatomical Cow Pose with Spinal Highlights" |
| Glute bridge | hips up ↔ hips down (2) | "Glute Bridge Muscle Activation Anatomy" + "Anatomical Glute Bridge Starting Position-1" |
| Arm swings | arms open ↔ crossed (2) | "Anatomical Arm Opening Diagram" + "Anatomical Arm Rotation Illustration" |
| 90/90 hip switch | knees to one side → knees up → knees to the other side (3) | "Mirror 90_90 Hip Switch Anatomy" + "Glowing Outer Hip Anatomy Pose" + the first one mirrored |
| Kneeling hip extension | all fours ↔ leg lifted (2) | "All-Fours Glute Activation Anatomy" + "Anatomical Bird-Dog Hip Extension" |

**Why some loops use only your new pictures:** the image tool redrew those poses instead of editing the original (the
camera and the man's size changed), so mixing them with the old still would make the body jump. Those loops use a
matching set of new pictures (`{id}-1.png` replaces frame 1 in the loop). The small still pictures in lists and tiles
are unchanged for now.

**Adductor rock-back (redone the same day, now moving too):** the first two pictures didn't line up (the man changed
size, the hands slid), so you sent the move as a **3-panel strip** in one picture. New script
`scripts/split-strip.mjs` cuts a strip into equal panels, paints out the divider lines and the "→" arrows (in each
panel it keeps only the largest shape, the body with its glow) and writes `{id}-1/2/3.png`. Of your two strips the one
whose hands and foot line up best was used (kept as `design/stretches-incoming/strips/adductor-rock-back.webp`).
Loop: hips back → middle → forward. Checked in the preview (light and dark): plays 1 2 3 2 1, every frame loads.

**Also fixed:** the move sheet's picture loaded only once scrolled to ("lazy"); it's the main content of the sheet, so it
now loads straight away.

**Files:** `design/stretches-incoming/frames/*.png` (sources), `public/stretches/frames/v1/*.webp` (12 frames, 14–34 KB
each), `src/lib/move-frames.ts`, `src/components/app/move-loop.tsx`.

**Checked:** 154 tests (including: every listed frame file exists), typecheck, lint, build. In the preview at 375 px:
all five loops play in the right order (2-frame moves alternate, 3-frame moves go back and forth), every frame loads,
moves without frames still show their still picture.

**Thumbnails match the loops (same day):** `stretchPicture(id)` now returns frame 1 of the moving picture when a move
has one, so the small pictures in tiles, routine cards, lists and suggestions are the same picture the loop starts
on (glute bridge, arm swings, 90/90, kneeling hip extension and adductor rock-back had changed; cat-cow's frame 1 is
its original). These are new file addresses, so phones never show an old cached copy, and every future move with
frames gets a matching thumbnail automatically. New test: every move has a still picture, and a moving one's
thumbnail is its first frame (155 tests). Checked in the preview: tiles and routine cards show the new pictures.

### 2026-11-17 — Small gaps from Phases 3 and 4 (same branch)

| What | How it works | Files |
|---|---|---|
| **Exercise guide → Friends tab** (Phase 4 gap): you and your friends ranked by best set of this exercise (estimated one-rep max; bodyweight moves by reps; ties share a rank; trophy for first; your row highlighted). Shows best set, est. 1RM and the date. Not signed in / no friends / nobody logged it yet each get a Rozi empty state | Each person's summary for friends now includes their best set per exercise (up to 60 most recently trained), computed on their phone from completed working sets; warm-ups never count. Friends are loaded once a minute at most | `exercise-leaderboard.tsx`, `liftBests` / `liftLeaderboard` / `sharesLifts` in `friends.ts`, `friends-repository.ts`, `exercise-guide-modal.tsx` |
| **Settings → Your data → "Share best lifts with friends"** switch | On by default; **off by default for anyone under 18**; the person's choice always wins. Off = an empty list is published, so friends see nothing (streak and workouts this week are still shared, as before) | `account-cards.tsx`, `settings-screen.tsx`, `types.ts`, `supabase-repository.ts` |
| **Recovery map Side view** (Phase 3 gap): Front / **Side** / Back | Code is ready and switched off: `SIDE_VIEW_FIGURES` in `muscle-images.ts` lists figures that have side pictures (empty until they're made). `build-figures.mjs` now also builds `{figure}-{muscle}-side` pictures (they can never change the existing canvas: checked, all 81 existing pictures came out byte-for-byte identical) and `build-recovery-masks.mjs` builds side masks. On the Side view every muscle group is visible, so tapping one never turns the body | `real-body.tsx`, `recovery-screen.tsx`, both scripts |
| **prompt.md** | Every open picture task with ready prompts, generated from the app's own data | `prompt.md` |

**Database (applied 2026-11-17 after "Yes, apply it"):** `supabase/migrations/20261117190000_lift_leaderboard.sql`
adds `profiles.share_lifts` (null = default) and `friend_stats.lift_bests` (jsonb object, max 16 KB). Both additive with
safe defaults; read through the existing friend_stats policies (friends and fellow challenge members only). Until it's
applied the app keeps working: saving the profile and publishing the summary simply leave the new fields out.
Checked after applying: both columns exist with the right types and defaults; all 7 existing summaries start with
empty lifts and all 7 profiles use the default; row-level security still on with its 3 policies. In a test that was
rolled back (nothing left behind, confirmed): the owner could publish a best lift, could NOT change another person's,
a friend could read it, a stranger (no friendship, no shared challenge) saw nothing, and a non-object or a list over
16 KB was refused. Supabase's security check reported nothing new (its two warnings were already there: the app's own
server functions signed-in people call, and leaked-password protection being off in Supabase Auth).

**Also fixed:** with six tabs the exercise guide's tab bar made the whole sheet 20 px wider than a phone screen (sideways
scroll). The bar now shrinks to fit, with 12 px labels on phones; no label is cut off.

**Checked:** 159 tests (5 new: best lifts ignore warm-ups and rank bodyweight by reps; leaderboard order and shared
ranks; sharing default / under-18 / choice; the summary is empty when sharing is off; side-view files for listed
figures), typecheck, lint (only the old warning), build. In the preview (375 px, light and dark): the Friends tab with
sample friends (temporary test data, removed afterwards), the sharing switch (saves and flips its note), the Side tab
with stand-in pictures (temporary, removed): tabs, switching, tapping, and the fallback to Front and Back.

### 2026-11-17 — Fix: Settings profile card, avatar overlapping the name

| What was wrong | Why | How it's fixed |
|---|---|---|
| On the Settings page the big round avatar sat on top of the name, "Saved on this device only" and the sync pill | The profile card is a link inside the settings menu, and the menu's rule for its rows (`.settings-menu a`: a 36 px icon column, smaller padding, no glass background, smaller text) was more specific than the card's own rule, so it won. The 56 px avatar spilled out of the 36 px column onto the text | The card's rules are now scoped as `.settings-menu .settings-me …`, so the card keeps its own layout (56 px avatar column, 14 px gap, 18 px name, glass background); hovering keeps the glass look (`app/globals.css`) |

Checked in the preview: picture avatar and letter avatar, desktop (avatar ends at 335 px, text starts at 349 px) and
375 px dark; nothing overlaps.

### 2026-11-17 — Fixes: wrong "You missed yesterday's workout", routine list text, dock drag

**1. "You missed yesterday's workout" although it was done**

| What happened | Why | How it's fixed |
|---|---|---|
| On 17 Nov the phone showed "You missed yesterday's workout" although the 16 Nov workout was saved as completed (finished 23:09) | Checked in the database: the reminder logic was right for that account. But the phone's notification subscription was still linked to **another account** that had signed in on this phone earlier (its 16 Nov workout was only "planned"), so the 07:32 morning check sent that account's reminder to this phone. The phone was only re-linked to the right account at 14:18, when notifications were switched on again. The app linked a phone to an account only when notifications were turned on, never when a different account signed in | **On app start (signed in):** if the phone already allows notifications but its subscription isn't this account's, it's re-linked automatically (`syncPushOwner`, same database function as turning notifications on). **On sign-out:** the phone is unlinked first (`releasePush`), so a signed-out account never sends it reminders; its reminder times are remembered on the phone and restored if the same account signs in again. A phone where notifications were turned off stays off |

Files: `src/lib/push-client.ts`, `src/components/app/app-shell.tsx`, `src/components/app/fit-track-provider.tsx`.
Takes effect once this branch is live (the hourly reminder job runs on the production site).

**2. Routine list: name and "40 s each side" ran together**

| What was wrong | Why | How it's fixed |
|---|---|---|
| In a routine's move list the move name and the dose ("Overhead triceps stretch40 s each side · Triceps") ran into one line | The text block was styled as "the last item in the row"; when the video button was added at the end of each row, the text was no longer last and lost its stacked layout | The text block has its own class (`routine-move-text`): name on top, dose and muscles underneath (`mobility-screen.tsx`, `globals.css`) |

**3. Dock: press and drag the glass lens (like iOS)**

New `DockScrub` (`src/components/app/dock-scrub.tsx`): pressing the dock lifts the glass lens a little; sliding the finger
(more than 8 px) moves the lens with it, the tab under it lights up (tiny vibration on Android); letting go opens that
tab and the lens glides into place. A plain tap works as before; the click the browser fires after a drag is ignored,
so it never opens the tab the finger started on. Reduced motion: no lift or zoom, the drag still works.

**Checked:** 159 tests, typecheck, lint (only the old warning), build. In the preview at 375 px: drag Home → Progress
opens Progress; drag Train → Friends (with the browser's stray click on Train) opens Friends; a plain tap still
navigates; mid-drag the lens is lifted between tabs and the tab under it is highlighted; the routine list shows name and
dose on separate lines.

### 2026-11-17 — Still open: first sign-up email has a link instead of a code (dashboard settings)

Seen again on 17 Nov ("Confirm your email address" with only a link; the link opened Vercel; "Send a new code" then
sent the code). Same cause as item 1 in the 16 Nov table: **not app code, two Supabase dashboard settings that
haven't been changed yet.**

| What you see | Why | Fix (Supabase dashboard, project `cjdvgtqxanetaegbkojv`) |
|---|---|---|
| New email → "Confirm your email address", link only | A brand-new address gets the **Confirm sign up** template, still Supabase's default (link, no code). "Send a new code" goes to an address that now exists, so it uses the **Magic link** template, which has the code | Authentication → **Emails** → *Confirm sign up* → paste the subject and body from section 6.2 → Save |
| The link opens a Vercel page | The link returns to the address the app asked for only if it's in **Redirect URLs**; otherwise Supabase uses the **Site URL**. If that's an old or protected Vercel address (the dev site has Vercel login protection), you land on Vercel | Authentication → **URL Configuration** → **Site URL** = `https://rozfit-a.vercel.app`; **Redirect URLs** include `https://rozfit-a.vercel.app/**`, `https://rozfit-dev.vercel.app/**`, `http://localhost:3000/**` |

Note: a link that goes to `rozfit-dev.vercel.app` will still show Vercel's login while the dev site's protection is on
(you chose to leave it on); typing the code always works there.

Test after saving: use an email that has never signed up (or delete the test user under Authentication → Users first)
→ the first email should say "Welcome to RozFit! Your code is 123456".

### 2026-11-17 — Fix: new accounts asked for body details again after signing up

| What happened | Why | How it's fixed |
|---|---|---|
| Right after signing up with the code, the app showed "Quick update for your plan" (height, weight, age) and "Why are you training?", although Get started had just asked all of it. The new account also lost the goal, level, focus muscle and gym type (they were saved as the defaults) | For a brand-new account the app builds the profile from the Get started answers saved on the phone, then passed it through `mapProfile`, the converter for profiles read from the database. That converter reads height, age, sex, "why", focus, gym, goal and level **only from the database row**, which is empty for a new account, so those answers were dropped and the account was saved without them. The body-details prompt then (correctly) saw them missing | New `accountProfile()` in `supabase-repository.ts`: a saved row still goes through `mapProfile`; a new account keeps the Get started answers whole |

**Test:** new `src/lib/supabase-repository.test.ts` (a new account keeps every answer; an existing account still loads
its saved profile). To let `npm test` load app files whose imports leave off ".ts", the test command now registers a
tiny resolver (`scripts/test-register.mjs`, `scripts/test-resolve-hook.mjs`). 161 tests, typecheck, lint, build pass.

**Accounts already created:** the database shows the four newest accounts (14–17 Nov) all saved with the default goal
and no focus or gym. Those answers only ever lived on the phone, so they can't be recovered; the people can set them in
Settings → Your plan. Takes effect for new sign-ups once this branch is live.

### 2026-11-17 — Phase 6: Trainers v2 (same branch)

Decisions (you, 17 Nov): only **approved trainers** (the existing trainer flag) can have clients; new links share
**workouts only** by default; trainer messages arrive **in the app and as a notification**.

| What you see | How it works | Files |
|---|---|---|
| **Several trainers**, each with **"What they can see"** switches: Workouts · Body (height, age, weight) · How you feel (energy, soreness, pain, check-in notes) · Missed days. Remove a trainer, or withdraw a request | `my_trainers()` now returns status, origin and sharing; `set_trainer_shares()` saves a switch | `account-cards.tsx` (Settings → Trainers) |
| **"Ask to be my trainer"** on a friend's card (only friends who are trainers); becomes "Requested ✓" / "Your trainer ✓" | `friend_trainers()`, `request_trainer()` (friends only; re-asking after a decline waits 7 days) | `friends-screen.tsx` |
| **Gym QR**: the trainer shows a QR (My clients → Gym QR); the client scans it with the phone camera → `/join/<code>` → "Add Asha as your trainer?" with what will be shared. Someone new goes through Get started / sign-in first and is brought back automatically | The QR is the existing one-time trainer code as a link (works for one client, 7 days); `trainer_invite_info()` shows the trainer's name; `accept_trainer_invite(code, 'qr')` | `join-screen.tsx`, `clients-screen.tsx` (QR sheet), `app-shell.tsx` (remembers the code) |
| **My clients** (trainers; Settings → My clients, and a Home shortcut with requests waiting): requests to Accept / Decline; a card per client — streak, this week, last workout, body weight (if shared), flags **Reported pain · No workout for a week · Missed planned days · Very sore · Low energy** (most urgent first), and what they share; Plan & rules; Remove | `trainer_requests()`, `respond_trainer_request()`, `trainer_clients_overview()`, `trainer_client_sessions()`, `trainer_remove_client()`; card maths in `clientSummary()` (tested) | `clients-screen.tsx`, `trainers.ts`, `trainers-repository.ts` |
| **Message all clients**: up to 500 characters, 5 a day; shows on clients' Home (they can hide it) and as a notification (unless they turned off "Nudges from friends"); the trainer can delete a sent message | `send_trainer_broadcast()`, table `trainer_broadcasts`, `/api/push/broadcast` | `trainer-home-card.tsx`, `app/api/push/broadcast/route.ts` |

**Privacy change:** before this, a linked trainer could read everything about a client. Now trainers read client data
only through what the client shares: profiles and workout days only through the two functions above (which leave out
unshared fields), and exercise logs / sets (workouts), check-ins / reviews (how you feel) and body weight (body) through
row security that checks the switch.

**Database (applied 2026-11-17 after "Yes, apply it"):** `supabase/migrations/20261117210000_phase6_trainers_v2.sql`
(dry-run first: run inside a rolled-back transaction, every statement worked). Checked after applying: new link fields,
messages table with row security (2 policies), trainers no longer read profiles or workout days directly, all 14
functions present (one version of accept_trainer_invite), signed-out visitors can't call any of them; Supabase's
security check shows only the warning type it already showed (signed-in people can call these functions: intended,
each checks who's calling).

Behaviour test with three temporary accounts (trainer, client, stranger) and sample workouts, in a transaction that
was rolled back (confirmed nothing left: no test accounts, links, messages or friendships). 30 checks, all as expected:
the client asks → "requested"; the friend shows as a trainer; the client can't accept their own request; a stranger
can't ask; the trainer sees 1 request and no client data before accepting; after accepting, the client appears with
the plan but **no** height / weight, workout days **without** energy or missed reasons, and the trainer can't read the
client's profile, workout rows, check-ins or weights directly; the client switches on Body + How you feel → height
172, weight 70.5, energy and check-ins appear, missed reasons stay hidden; a wrong sharing key is refused; the trainer's
message reaches the client but not the stranger; an empty message and a message from a non-trainer are refused; after
the client removes the trainer, the trainer sees nothing at all.

Note: the database currently has no accounts at all (they were deleted), so the next sign-ups start fresh.

**Making someone a trainer:** replaced by self-serve Trainer mode (next entry); no SQL needed any more.

**Also fixed while checking:** a client who doesn't share workouts was flagged "No workout for a week" — now such a card
shows no streak and no flags. The new pages have proper titles ("My clients", "Add your trainer"); the message box text
was bold.

**Checked:** 167 tests (6 new: sharing defaults, join links, client card streak / week / flags, dashboard order,
message length), typecheck, lint, build. In the preview with temporary sample data (removed afterwards): My clients at
375 px light and dark (request, four cards, flags, locked shares, message box), Settings → Trainers (an active trainer
and a request with their switches), and the join page signed out (asks to sign in, remembers the code). Not checked
yet in a browser with real accounts: the gym QR flow end to end (needs a trainer account and a phone).


### 2026-11-17 — Phase 6 step A: self-serve trainers (same branch)

Decision (you, 17 Nov): **self-serve only** — anyone can become a trainer; no gyms or admin approval. Next steps:
**B. Train together** (up to 3 buddies, synced plans), **C. coach-buddy extras**; chats (incl. buddy chat) in Phase 7.

| What you see | How it works | Files |
|---|---|---|
| **Settings → Trainers → Trainer mode** (everyone signed in): one switch; when on, "About you" (280 characters) and up to 6 specialities (quick picks or your own), Save, and a link to My clients. Turning it off keeps clients' plans but blocks the trainer from their data until it's back on | `set_trainer_mode()`, table `trainer_profiles` | `account-cards.tsx` (`TrainerModeCard`) |
| **Trainer badge** on friends who are trainers, with their top specialities; the **join page** shows the trainer's specialities and bio | active trainer profiles are readable by signed-in people | `friends-screen.tsx`, `join-screen.tsx` |
| **Report** under each of your trainers: reason (unsafe advice · inappropriate · spam or selling · pretending to be someone · something else) and an optional note | `report_trainer()`, table `trainer_reports` (nobody can read reports from the app; you read them in Supabase → Table editor). **3 different people within 30 days pause the trainer automatically** (`trainer_profiles.suspended`); they see why and can't be added meanwhile | `account-cards.tsx` |
| **Limits**: at most **25 active clients** per trainer (accepting a request, a QR or a client code past that is refused); trainers can also have their own trainers now | `trainer_has_room()` | — |

**Under the hood:** "is this person a trainer?" no longer comes from the sign-in token (only an admin could set it, and
it needed a sign-out). Every database function and access rule now asks `private.is_trainer()` (Trainer mode on and not
paused); the migration rewrites the ten functions that only needed that swap and checks afterwards that no old check
is left anywhere. In the app, `isTrainerAccount()` reads the same table (falls back to the old flag until the update
is applied), and refreshing My clients refreshes trainer status too, so switching Trainer mode on works without signing
out. To un-pause a trainer after reviewing reports: Supabase → Table editor → trainer_profiles → set `suspended` to false.

**Database (applied 2026-11-17 after "Yes, apply it"):** `supabase/migrations/20261117230000_self_serve_trainers.sql`
(dry-run first). Checked after applying: no function or access rule reads the trainer flag from the sign-in token any
more (19 use the new check); reports can't be read from the app at all and trainer profiles can only be changed through
the function; signed-out visitors can't call the new functions. Supabase's security check: the same "signed-in people
can call these functions" warning as before, plus an info note that `trainer_reports` has no access rules (intended:
reports only go in through `report_trainer()` and you read them in the dashboard).

Behaviour test with temporary accounts, rolled back (confirmed nothing left): before Trainer mode a friend can't ask
and no QR can be made; after switching it on (bio and specialities cleaned: "Strength", "Yoga"), the QR works, the
friend shows as a trainer, the request is accepted and a plan rule can be saved; with Trainer mode off the trainer
sees no clients and can't change rules, and back on the client is still there; with 25 active clients the 26th
request is refused ("You already have 25 clients…"); 2 reports don't pause, the 3rd from a different person does —
then the trainer sees no clients, can't switch Trainer mode back on themselves, and disappears from friends' trainer
lists; an unknown report reason is refused; clients can't read reports.

**Checked:** 168 tests (1 new: specialities cleaned to 6 × 30 characters, no duplicates), typecheck, lint, build. In the
preview with a temporary sample trainer profile (removed afterwards): the Trainer mode card at 375 px (switch, bio with
counter, chosen specialities, own speciality, Save / My clients). Fixed while checking: the character counter sat on its
own line.

### 2026-11-17 — Phase 6 step B: Train together (same branch)

Decisions (you, 17 Nov): up to **3 buddies** (groups of 4), **synced plan** (same days and split, own weights), chats in Phase 7.

| What you see | How it works | Files |
|---|---|---|
| **Train together** on each friend card → the friend gets an invite (Join / No thanks) showing the plan they'd switch to. Up to 4 people, one group each. Your own plan only changes once someone joins | `invite_buddy()`, `respond_buddy_invite()` | `friends-screen.tsx`, `buddies-screen.tsx` |
| **One synced plan**: the same goal, days and **session each day** for everyone, with each person's own weights, level, equipment, pain / recovery checks and return-after-a-break. A skip never puts buddies out of step | The planner follows the **calendar** from the group's start date (`profiles.buddy_anchor`, `calendarSessionIndex()`) instead of counting completed workouts. Joining or an accepted change copies the plan onto every member's profile; a database guard keeps it that way even if an app saves an old copy of the profile | `planner.ts`, migration (`apply_buddy_plan`, `keep_buddy_plan`) |
| **Propose a change** (goal + 3–6 days): applies once **everyone** accepts, starting today for all; Settings → Your plan locks goal and days with a link to Train together | `propose_buddy_plan()`, `respond_buddy_proposal()` | `buddies-screen.tsx`, `settings-screen.tsx` |
| **Train together page** (`/buddies`, from Friends): buddy streak (planned days everyone trained) with **one carry a week**, the shared plan, everyone's today (done / training now / resting / still to do / rest day) with an **At the gym** badge, pending invites, your switches **I'm at the gym** (2 hours) and **Share why I skip** (off by default), Leave | `buddy_overview()` (one call), `set_at_gym()`, `set_buddy_share_reasons()`, `carry_buddy_streak()`, `leave_buddy_group()`; streak maths in `buddies.ts` (tested) | `buddies-screen.tsx`, `buddies.ts` |
| **Home card** while training together: faces with a tick when done and a pin at the gym, the streak, and when yours is still to do: **Start · I'm at the gym · Can't today** | — | `buddy-home-card.tsx` |
| **Can't today** → **Quick 20-min version** (the same session: 3 main exercises × 2 sets; stays quick after the check-in) or **Rest today** with a reason (saved as a missed day; buddies get a gentle note, the reason only if you share reasons) | `quickVersion()`; the existing missed-day saving | `buddy-home-card.tsx`, `use-workout-day.ts` |
| **Notifications**: a buddy finishes → "🔥 Ravi just finished — your turn?" (only to buddies who haven't trained yet, 7:00–21:00 their time); a buddy rests → "Ravi is resting today"; **8 pm** "Ravi trained today — still time for yours?"; morning after a day nobody trained → "You both rested yesterday — restart together today?" (replaces the usual "you missed yesterday"). Each at most once a day; "Nudges from friends" off = none | `/api/push/buddy` (after finishing / resting), hourly job, `buddy_push_log` | `app/api/push/buddy/route.ts`, `app/api/push/hourly/route.ts`, `today-screen.tsx` |

**Leaving:** your plan keeps its days and goal, and the session order goes back to your own. With fewer than two people
left, the group ends (unless invites are still open).

**Database (applied 2026-11-17 after "Yes, apply it"):**
`supabase/migrations/20261118090000_train_together.sql` — tables `buddy_groups`, `buddy_members`, `buddy_proposals`,
`buddy_carries`, `buddy_push_log` (all private: read through `buddy_overview()`, changed through the functions),
`profiles.buddy_anchor`, the plan guard trigger. Dry run + behaviour test in a rolled-back transaction with temporary
accounts: inviting doesn't change your plan; after joining both profiles have the same goal and days and start today;
a decline keeps the group; skip reasons hidden until shared; at the gym visible; a 2-day plan refused; a change applies
only after everyone accepts (then both profiles switch); a second carry in a week refused; a stranger sees nothing and
can't read the tables; after leaving both go back to normal rotation. The plan guard was dry-run separately: an old
profile copy saved by a buddy keeps the new name but not the old goal / days; people without a group change freely.
**After applying (live database):** all 5 tables have row security on and no direct access, the plan guard trigger and
the 9 functions exist, signed-out visitors can't call them. Supabase's security check shows only the expected notes
(tables reached only through the functions; signed-in people can call the functions, which check who's asking). The
behaviour test was run again on the live database with temporary accounts and rolled back: the same 24 checks, plus an
old profile copy saved by a buddy during the group (it kept the group's goal, days and start date) — all as expected.
Nothing left behind (no test accounts, groups, members, proposals, carries or start dates).

**Checked:** 173 tests (5 new: calendar rotation; buddies get the same session even when one skipped — and without the
group they wouldn't; today's status; streak with carries and the carryable day; the quick version), typecheck, lint,
build. In the preview with a temporary sample group (removed afterwards), 375 px: Train together page (streak 1 with
"Carry Nov 13", shared plan, a pending change "waiting for you, Chitra", today's list with at-the-gym and a pending
invite), Home card, Can't today sheet; **Quick 20-min version** turned today's 7-exercise Push B into 3 exercises × 2
sets / 20 min and the Train page kept it. Fixed while checking: the new sheets had no side padding.

### 2026-11-17 — Phase 6 step C: coach-buddy extras (same branch)

**What was asked:** when a trainer trains with their clients in a buddy group, let the trainer change the shared plan
directly; when a client keeps skipping, prompt the trainer to make the week lighter; and give the trainer's gym QR a
"Train together" option.

**Why it needed new rules:** in step B every plan change was a proposal that all buddies must accept. A trainer the
clients already chose to adjust their plan shouldn't need a vote, but a friend who isn't the trainer's client still
should. And a lighter week has to keep buddies on the same session, only with fewer sets.

**How it works now:**

| What | How | Files |
|---|---|---|
| **The group's coach**: the member who is an active trainer of *every* other member. Shown as a **Trainer** badge. If someone who isn't their client joins, there's no coach and changes go back to proposals | `private.buddy_coach()`; `buddy_overview()` returns `group.coach` | migration, `buddies-repository.ts`, `buddies-screen.tsx` |
| **Coach changes the plan directly**: "Change the plan" → "Change for everyone" applies today for all (replaces any open proposal). Others see "Asha is everyone's trainer here: their changes apply straight away" | `propose_buddy_plan()` applies at once when the caller is the coach | migration, `buddies-screen.tsx` |
| **Make this week lighter**: on Train together, the coach sees "Ravi has missed 2+ sessions in the last week — Make it lighter"; on My clients, a client with the *Missed planned days* flag gets "Make this week lighter". It runs Monday–Sunday of this week; **Back to normal** undoes it. For a group the trainer coaches, the whole group gets it (buddies stay on the same session) | `trainer_set_light_week()`, `trainer_light_weeks()`, `profiles.light_week_start`; `missedRecently()` (tested) | migration, `trainers-repository.ts`, `buddies.ts`, `buddies-screen.tsx`, `clients-screen.tsx` |
| **Lighter plan**: the same session with about a third fewer sets, no extra focus-muscle set; a "Lighter week from your trainer · fewer sets" chip on Train and a reason in "Why this plan". Buddies see one line "Lighter week until Sunday, set by Asha" | `inLightWeek()` (tested) and the planner's set count | `program.ts`, `planner.ts`, `today-screen.tsx`, `types.ts`, `supabase-repository.ts` |
| **"Train together" gym QR**: My clients → Gym QR has **Add as client / Train together**. Scanning the Train together QR shows "Train with Asha?" → **Add Asha & train together** (adds the trainer and joins their group: their plan, same session each day) or **Only add as my trainer**. If the person is already in a group, the trainer is still added and the page says why they didn't join. Typing such a code in Settings opens the same page | `create_trainer_invite(p_together)`, `trainer_invite_info()` (+ `together`), `join_trainer_group()`; `trainer_invites.together` | migration, `clients-screen.tsx`, `join-screen.tsx`, `account-cards.tsx`, `supabase-repository.ts` |

**Safety:** only an active trainer can make a week lighter, and only for their own active clients. Joining a group by
QR needs a "Train together" code from an active trainer that *this* person used in the last day. A group still has at
most 4 people and each person is in one group. Showing the QR is the trainer's consent, so no friendship is needed.
Profile saves from the app never write `light_week_start`, so an old copy can't undo it.

**Database (applied 2026-11-17 after "Yes, apply it"):**
`supabase/migrations/20261118120000_coach_buddy_extras.sql`. The dry run applied it inside a transaction with temporary
accounts and rolled back. 29 checks, all as expected:
- QR: Train together and plain codes made; a non-trainer can't make one; the code shows `together`; joining before accepting is refused.
- Joining: the client's plan becomes the trainer's, starting today; the trainer is the coach; a plain code can't be used to join; a second Train together client joins the same group (3 people); joining twice is refused.
- Plan changes: a client's change stays pending; the coach's change applies at once to all three and closes the open proposal.
- Lighter week: starts on Monday; it covers the whole coached group and shows to members; a non-client or non-trainer is refused; a stranger sees nothing.
- Old profile copy: a save from an old copy keeps the group plan and the lighter week.
- A friend who isn't the trainer's client joins: there's no coach any more, the trainer's change becomes a proposal, and turning the lighter week off touches only that client.

**After applying (live database):**
- Structure: both new columns and all the functions exist. Signed-out visitors can't call any of them, and the coach check (`private.buddy_coach`) isn't callable from the app at all.
- Security check: only the expected notes (signed-in people can call the new functions, which check who's asking).
- Behaviour: the same 29-check test ran on the live database with temporary accounts and was rolled back. All as expected.
- Clean-up: nothing was left behind (no test accounts, trainer profiles, codes, links, groups, proposals or marked profiles).

**Checked:** 176 tests (3 new: the lighter-week dates; the same session with fewer sets and no extra focus set; missed
sessions in the last week). Type check, lint and build all pass. In the preview, with a temporary sample group and
clients (removed afterwards), at 375 px and desktop, light and dark: the coach's view (the prompt, "Change the plan",
Lighter week on / Back to normal), a client's view (Trainer badge, the lighter-week line), the client cards (both
states), the Gym QR toggle, the "Train with Asha?" page, and the Train chip on a real generated plan (11 sets).

Fixed while checking:
- Several badges in a row stretched, because an old `.buddy-row span:nth-child(2)` rule also matched the badges. It's now scoped to direct children.
- One group-wide lighter-week line replaces a badge on every person.
- The QR toggle labels stay on one line at 375 px.
- The two chips on Train now have a gap.

### 2026-11-17 — Fix: Add exercises search and scrolling (same branch)

**What was wrong (reported from the phone):**
1. **Search.** In Add exercises, searching "Biceps" listed Assisted pull-up, Barbell row, Chest-supported row and so on first. Results came A–Z, and the search also matched words inside each exercise's instructions and tips. The rows did list biceps, but only as their third muscle, which the row didn't show, so it looked like search was broken.
2. **Scrolling.** The exercise list in the sheet didn't scroll.

**Why:**
1. **Search.** It was a plain "does the text contain the word" check across the name, muscles, equipment, movement type *and* the how-to text, then sorted A–Z. Wrist curls matched because their movement type is labelled with biceps.
2. **Scrolling.** The shared rounded-list style `.library-list.grouped { overflow: clip }` is more specific than `.picker-list { overflow-y: auto }`, so the list was clipped and could never scroll. Separately, the sheet's swipe-to-close handle only checked whether the *sheet* was scrolled, never the list inside it. So once the list could scroll, pulling it back up would have dragged the sheet down instead.

**How it was fixed:**

| What | How | Files |
|---|---|---|
| **Ranked search**: 0 name → 1 main muscle → 2 another muscle it works, equipment or category → 3 movement type → 4 only the how-to text. Only the best level that exists is shown: "Biceps" lists curls, then rows and pulldowns, not wrist curls or moves that only mention biceps in their tips. A longer search needs every word ("dumbbell curl"). Everyday short names work (abs, quads, hams, delts, pecs, bis, tris, arms, legs). "ham" still finds the hammer curl | `exerciseSearchRank()`, `rankSearchResults()`, `filterExerciseLibrary()` | `src/lib/exercise-library.ts` (+3 tests) |
| **Results while searching**: shown as **Best matches** (the name or main muscle) and **Also matches** instead of A–Z. Each row lists up to 3 muscles, so you can see why it matched. The A–Z strip hides while searching. Searches with nothing found say what to try. The same applies on the Library page | | `exercise-picker.tsx`, `library-screen.tsx`, `globals.css` |
| **The list scrolls**: `.library-list.grouped.picker-list` gets `overflow-y: auto`, contained overscroll and `touch-action: pan-y`. Section headings stick to the top of the list | | `app/globals.css` |
| **Swipe-to-close only at the top**: the sheet handle now checks the scrolling area under your finger. Pulling down a scrolled list scrolls it; pulling down at the top (or from the handle) still closes the sheet | `scrolledUnder()` | `src/components/ui/sheet-grip.tsx` |

**Checked:**
- **Automated:** 178 tests pass (3 new: the ranking order for "Biceps"; short names, multi-word searches, no results and "ham"; a movement-type search). Type check, lint and build pass.
- **End to end in the preview at 375 px:**
  - New routine → Add exercises: the list scrolls (7,361 px of content in a 477 px window, moved 500 px), and the sheet stays put.
  - With the list scrolled, pulling down doesn't move the sheet. At the top, pulling the handle down drags it, and it springs back if released early.
  - Typed "Biceps": 13 results, with the five curls under Best matches and the rows under Also matches showing "… · Biceps".
  - Ticked Incline dumbbell curl and Barbell row → **Add (2)** → both are in the routine, and the page scrolls again.
  - Library: "quads" lists the squats and leg extension, and the A–Z strip comes back after clearing.

**Phase 6 sweep:**
- Home, Train, Friends, Train together, My clients, the join page, Settings → Trainers, Library, Routines and Progress all load at phone size with no console errors.
- The signed-in parts of Phase 6 (trainers, Train together, coach extras) were tested in two ways: against the live database with temporary accounts (rolled back: 30 + 23 + 24 + 29 checks), and in the preview with sample data. Real devices with real accounts are the remaining step. That needs two people signed in on the dev site:

**Two-phone checklist (dev site, after pushing):** phone A = trainer, phone B = friend/client.
1. A: Settings → Trainers → turn on Trainer mode. My clients → Gym QR → **Train together**.
2. B: scan the QR → "Train with A?" → **Add A & train together** → lands on Train together with the same plan.
3. B: Train shows the same session as A today. A sees B on My clients and a **Trainer** badge on Train together.
4. A: Train together → Change the plan → applies to both straight away (B sees it after reopening).
5. B: Home → Can't today → Rest today (reason). A gets "B is resting today" (notifications on).
6. B skips again (or two missed days) → A sees "missed 2+ sessions" → **Make it lighter** → both see the lighter-week line and B's Train chip.
7. B finishes a workout → A gets "B just finished — your turn?". At 8 pm, if one hasn't trained, the evening note.
8. B: Settings → Trainers → turn sharing switches off → A's card stops showing what isn't shared. B: Leave group → B's plan keeps its days.

### 2026-11-18 — Phase 7 step A: Chats (same branch)

**What was asked:** start Phase 7 with full chats, including a buddy chat. Choices made:
- **Who:** friends 1:1, one group chat per Train together group, and trainer ↔ client 1:1 (even if they aren't friends).
- **What:** text, the Rozi faces as stickers, and "share my workout" cards. Photos come later, with the feed.
- **How:** messages appear live, plus a phone notification. Each chat can be muted.

**How it works:**

| What | How | Files |
|---|---|---|
| **Chats list** (top-bar chat button with an unread badge, a dot on Friends, and a Chats card on Friends): the group chat and 1:1 chats, newest first, with a preview line, time and unread count. A muted chat shows a grey count and isn't in the badge. **New chat** lists your friends, trainers and clients | `my_chats()`, `chat_people()`, `open_direct_chat()`, `open_buddy_chat()`; `messagePreview()` | `chats-screen.tsx`, `chats-repository.ts`, `chats.ts`, `app-shell.tsx`, `friends-screen.tsx` |
| **A chat**: day dividers, your messages on the right, each person's name and face in the group chat, messages from the same person within 5 minutes grouped, and "Show earlier messages" (50 at a time). Messages arrive live and the chat stays marked read while open; the badges update straight away | `messages` table read with row security + Supabase Realtime; `mark_chat_read()`; `startsGroup()`, `dayLabel()`, `localDay()` | `chat-thread.tsx` |
| **Send**: text (Enter sends, Shift+Enter makes a new line, up to 2,000 characters), one of **16 Rozi stickers**, or a **workout card** from your last 5 finished workouts. The card shows working sets (no warm-ups), the rep range, the top weight, and new bests (only beating an earlier lift) | `send_message()` (checks everything again); `workoutCard()`, `readWorkoutCard()`, `STICKERS` | `chats.ts`, `chat-thread.tsx` |
| **Share to chat** on a finished workout (Train): pick a chat, add a note | `ShareWorkoutSheet` | `today-screen.tsx`, `chats-screen.tsx` |
| **Message** buttons: on each friend, each client card (trainers), each of your trainers (Settings → Trainers), and **Group chat** on Train together | `MessageButton` | `message-button.tsx`, `clients-screen.tsx`, `account-cards.tsx`, `buddies-screen.tsx` |
| **Safety**: tap your message → **Delete** (shows "Message deleted"). Tap someone else's → **Report** (reason + note; a copy of the text is kept for review). ··· → **Mute** / **Block** (no 1:1 messages either way; their group messages are hidden for you; unblock any time). People who stop being friends or trainer/client can read the history but can't send. Someone who leaves the group loses access to its chat. Limit: 20 messages a minute | `delete_message()`, `report_message()`, `set_chat_muted()`, `set_chat_block()`, `private.can_message()`, `private.in_chat()` | migration, `chat-thread.tsx` |
| **Notifications**: "Ravi: Leg day tomorrow?" (or "Train together · Chitra: …"), tapping opens the chat. Not sent to anyone who muted the chat, blocked the sender, has the chat open, or turned off **Nudges & messages from friends**. At most one per chat every 3 minutes; each chat replaces its own notification | `/api/push/chat`, `chat_push_log`; the notification `tag` per chat | `app/api/push/chat/route.ts`, `push-server.ts`, `notifications.ts`, `notifications-card.tsx` |

**Database (applied 2026-11-18 after "Yes, apply it"):**
`supabase/migrations/20261118150000_chats.sql`:
- tables `chats`, `chat_members`, `messages`, `chat_blocks`, `chat_reports`, `chat_push_log`, all with row security;
- only `messages` can be read directly (so live updates work), and only for chats you're in, never from people you blocked;
- `messages` is added to Supabase's live-updates list;
- everything else goes through the functions above.

The dry run applied it inside a transaction with 6 temporary accounts and rolled back. 40 checks, all as expected:
- **Opening chats:** one chat per pair, the same chat from both sides; a stranger can't be messaged; trainer ↔ client works.
- **Sending:** text is trimmed. A sticker keeps only its face. A bad sticker, an empty sticker, an empty text, 2,001 characters and a card without moves are all refused. Writing to the table directly is refused.
- **Reading:** members read the chat; a stranger reads nothing and sees no chats.
- **Unread:** counts are exact, your own messages don't count, and reading clears them.
- **Delete and report:** you can delete only your own message. A report keeps the original text, even after the sender deletes it. Strangers can't report, and you can't report your own message.
- **Block:** it hides the blocked person's messages and stops sending; unblocking restores both. Mute works.
- **Group chat:** it's the same chat for everyone, the people list has 2 people, and it shows in the list. Strangers and anyone who left can't read or send.
- **Limits and access:** the 21st message in a minute is refused; live updates are on; people who aren't signed in can't call anything.

Found and fixed during the dry run:
- The reading rule looked at the blocks table, which signed-in people (rightly) can't read. It now uses a checked helper.
- Message times use the exact clock, so the order and unread counts stay right even for several messages sent at once.

**After applying (live database):**
- Structure: all 6 tables have row security, and `messages` is the only one signed-in people can read directly (no table can be written to directly). The reading rule is in place, live updates are on, all 11 functions exist, and signed-out visitors can't call any of them.
- Security check: only the expected notes (the tables are reached only through the functions; signed-in people can call the functions, which check who's asking).
- Behaviour: the same 40-check test ran on the live database with 6 temporary accounts and was rolled back. All as expected, with exact unread counts (3 → 0 after reading; 1 in the group).
- Clean-up: nothing was left behind (no test accounts, chats, messages, members, blocks, reports, groups or links).

**Checked:**
- **Automated:** 183 tests pass (5 new: the stickers; the workout card's sets, rep range, top weight and new bests; reading a card back safely; preview lines; day labels, grouping and the text limit). Type check, lint and build pass.
- **End to end in the preview at 375 px and desktop, light and dark,** with a temporary in-browser stand-in for the chat database (removed afterwards):
  - **List and badges:** the list showed 2 unread for the group and 3 for Ravi, the badge said 5, and the Friends dot was on. Opening Ravi's chat dropped the badge to 2.
  - **Sending:** typed and sent a message with Enter; sent a sticker; shared a workout card.
  - **Live and read:** an incoming message appeared live and was marked read.
  - **Delete and report:** deleted my message; reported Ravi's (the button stays off until a reason is picked).
  - **Mute and block:** muted the chat; blocked Ravi, which hid his messages and replaced the message box with a banner; unblocked.
  - **Group chat:** names and faces show.
  - **New chat:** Chitra → an empty "Say hi" chat.
  - **Share to chat:** from a finished workout, after Continue on the celebration, with the note "Legs felt strong today" → it arrived in Coach Asha's chat.
- **Fixed while checking:**
  - Bubbles showed "Mon" instead of the time.
  - The badge didn't drop after reading.
  - The message box floated mid-screen in short chats.
  - The newest message hid behind the message box.
  - Group pictures squeezed in 3 faces (now 2 of the others).
- **Not checked here:** the Friends page's Chats card and per-friend Message buttons, because sample mode shows "Sign in to add friends". They use the same chat-opening path as New chat, which was tested.
- **Still to do:** real-account testing on two phones after pushing (the database part is live).

### 2026-11-18 — Phase 7 step B: Feed (same branch)

**What was asked:** the workout feed. Choices made:
- **Who sees posts:** friends only (plus your Train together group).
- **Photos:** one per post.
- **Posting:** you're asked after each workout; nothing is shared automatically.
- **Interactions:** 💪 likes and comments.

**How it works:**

| What | How | Files |
|---|---|---|
| **Post to feed** (Train, on a finished workout from the last week): "Share it with your friends?" → a sheet with an optional photo, a caption (up to 1,000 characters) and the workout card → **Post**. Afterwards it says "Posted to your feed · See feed". One post per workout day | `create_post()`, `my_post_dates()`; `canPostDate()` | `today-screen.tsx`, `feed-screen.tsx` (`PostWorkoutSheet`) |
| **Photo**: shrunk on the phone to fit 1600 px, turned the right way up and saved as WebP (JPEG fallback, under 1.5 MB). Redrawing removes hidden details such as the GPS location. It's uploaded to a **private** bucket in your own folder; if posting fails, the photo is removed again | `preparePhoto()`, `fitInside()`; bucket `post-photos` + storage rules | `feed.ts`, `feed-repository.ts`, migration |
| **Feed** (Friends → Feed, `/feed`): your posts and your friends' and buddies', newest first, 20 at a time with "Show older posts". Each card shows the photo (via a private link that lasts an hour), the caption, the workout card, **💪** (tap again to undo), the comment count and the latest 2 comments | `feed()`, `photoLinks()` | `feed-screen.tsx`, `friends-screen.tsx`, `app-shell.tsx` |
| **Comments**: a sheet with every comment and a box to add one (up to 500 characters; Enter posts). Delete your own, or any comment on your own post; report someone else's | `post_detail()`, `add_comment()`, `delete_comment()` | `feed-screen.tsx` (`CommentsSheet`) |
| **Delete / report**: ··· → **Delete post** (its photo, likes and comments go too) or **Report post** (reason + note; a copy of the text and the photo path is kept) | `delete_post()`, `report_post()` | `feed-screen.tsx` (`ReportSheet`) |
| **Notifications** to the post's author: "New 💪 on your workout — Ravi sent 💪 on Legs A" and "New comment on your workout — Ravi: …"; tapping opens the post's comments. Not sent for your own posts, if either person blocked the other, or with **Nudges & messages from friends** off. At most one per post every 10 minutes | `/api/push/feed`, `post_push_log` | `app/api/push/feed/route.ts` |

**Privacy:**
- Only friends and your Train together group see posts and their photos, never strangers.
- Blocking someone in chats hides posts and comments both ways.
- The photo links are private and short-lived; a photo that isn't attached to a post can't be seen by anyone else.

**Database (applied 2026-11-18 after "Yes, apply it"):**
`supabase/migrations/20261118170000_feed.sql`:
- tables `posts`, `post_likes`, `post_comments`, `post_reports`, `post_push_log`, all closed to direct access (everything goes through the functions);
- the private `post-photos` bucket (1.5 MB, WebP or JPEG) with three storage rules: upload into your own folder, read your own or a photo you're allowed to see, delete your own.

The dry run applied it inside a transaction with 5 temporary accounts and rolled back. 42 checks, all as expected:
- **Posting:** the caption is trimmed. A second post for the same day, a date older than a week, a bad card, a caption over 1,000 characters, a photo that wasn't uploaded and a photo from someone else's folder are all refused. Uploading into your own folder works; into someone else's doesn't.
- **Who sees what:** a friend sees 2 posts and the photo but not a photo that isn't posted. A Train together buddy who isn't a friend sees 2. A stranger sees nothing, can't open a post, load its photo, like or comment. The tables are closed to direct reads.
- **Likes and comments:** a 💪 counts once. Empty and over-long comments are refused. A report keeps a copy. You can't report your own post or comment. The author can delete any comment on their post; others can delete only their own. The 11th comment in a minute is refused.
- **Block:** a blocked friend sees no posts and no photos.
- **Deleting:** it returns the photo path to remove, the post leaves friends' feeds, and its photo can't be loaded any more.
- **Access:** people who aren't signed in can't call anything, and the bucket is private.

**After applying (live database):**
- Structure: all 5 tables have row security and are closed to direct access. The `post-photos` bucket is private (1.5 MB, WebP or JPEG) with its 3 storage rules next to the avatar ones. All 9 functions exist, and signed-out visitors can't call any of them.
- Security check: only the expected notes (the tables are reached only through the functions; signed-in people can call the functions, which check who's asking).
- Behaviour: the same 42-check test ran on the live database with 5 temporary accounts and was rolled back. All as expected.
- Clean-up: nothing was left behind (no test accounts, posts, likes, comments, reports, photo records, blocks or groups).

**Checked:**
- **Automated:** 187 tests pass (4 new: the posting window; photo sizing; the "how long ago" labels; the count labels). Type check, lint and build pass.
- **End to end in the preview at 375 px, light and dark,** with a temporary stand-in for the feed database (removed afterwards):
  - **Feed:** two friends' posts, one with a photo and three comments.
  - **💪:** sent, then undone.
  - **Comments:** opened, typed and posted one (it showed as "You · Just now" with Delete), deleted it, and reported someone else's (the report sheet opens over the comments).
  - **Posting:** on Train, the finished workout showed "Share it with your friends?". I added a real 4000 × 3000 photo (1.7 MB), which became a 1600 × 1200 WebP of 206 KB in my own folder. Typed a caption and posted; the panel changed to "Posted to your feed".
  - **Own post:** it appears at the top of the feed. Deleting it asks first.
- **Fixed while checking:**
  - A post with no likes said "0 likes".
  - The counts were repeated in a second line (now just "N people sent 💪").
  - The photo's remove button sat under the sheet's close button.
- **Not checked here:** signed-in-only parts in sample mode (the Feed card on Friends) and real photo storage. Real-account testing on two phones comes after pushing (the database part is live).

### 2026-11-18 — Phase 7 step C: Discover + profiles (same branch)

**What was asked:** discover and profiles. Choices made:
- **Connecting:** find people and send friend requests. The feed and chats stay friends-only; there are no public followers.
- **Search:** opt-in, and always off for under-18s.
- **Suggestions:** friends of friends.
- **Profile page:** posts, stats and a checklist.

**How it works:**

| What | How | Files |
|---|---|---|
| **Find friends** (Friends → Find friends, `/discover`): search as you type by name or @username (2+ characters, up to 20 results). It only shows people who turned on **Let people find me**, never under-18s or anyone without a birth year. Then **Friend requests** (Accept / ✕), **People you may know** (findable friends of friends, most mutual friends first), and **Requests you sent** (tap Requested to cancel). Each person shows only their name, picture, @username and mutual friends | `search_people()`, `suggested_people()`, `friend_requests_overview()`, `send_friend_request()`, `respond_friend_request()`, `cancel_friend_request()` | `discover-screen.tsx`, `discover-repository.ts`, `friends-screen.tsx` (`FindFriendsLink` with the waiting count) |
| **Friend requests**: if they already asked you, sending one back makes you friends straight away. Someone who declined can't be asked again for 7 days. Limit: 30 requests a day. A new request sends a notification ("New friend request — Ravi wants to be friends"); with **Nudges & messages** off, none is sent | the same functions; `/api/push/friend-request` | `app/api/push/friend-request/route.ts` |
| **Profile page** (`/people/<id>`; tap a name or face on a post, or anyone in Find friends): picture, name, @username, bio, number of friends and mutual friends, and the friend button. **Friends (and you)** also see the day streak, workouts this month and this week, and a **posts grid** (photo, or the workout name; tap to open the post and its comments). Non-friends see only the basics and "Become friends to see…" | `person_profile()` | `discover-screen.tsx` (`PersonScreen`), `feed-screen.tsx` (links on posts) |
| **Your public profile** (Profile → Public profile): choose a **@username** (3–20 letters, numbers, dots or underscores; suggested from your name, checked while you type), a **bio** (160 characters) and **Let people find me** (switched off and locked without an adult birth year). **Complete your profile** lists 6 items (picture, @username, bio, birth year, first workout, first post) with links, and hides once all are done | `set_public_profile()`, `username_available()`; `profileChecklist()`, `usernameProblem()`, `suggestUsername()`, `isAdult()` (tested) | `discover-screen.tsx` (`PublicProfileCard`), `profile-screen.tsx`, `discover.ts`, `types.ts`, `supabase-repository.ts` |

**Privacy:**
- Being findable is enforced by the database, not just the app. A trigger forces it off for anyone under 18 and anyone without a birth year, even if someone edits their profile row directly.
- **Accounts that already exist start unfindable**, because they never chose. New adult accounts start findable, as decided.
- Blocking someone (in chats) also hides you from each other in search, suggestions, requests and profiles.

**Database (applied 2026-11-18 after "Yes, apply it"):**
`supabase/migrations/20261118190000_discover_profiles.sql`:
- new profile fields `username` (unique, format-checked), `bio` (≤ 160) and `findable`, plus the findable trigger;
- table `friend_requests` (closed; one open request per pair);
- 9 functions and the private helpers.

The dry run applied it inside a transaction with 7 temporary accounts and rolled back. 33 checks, all as expected:
- **Saving your profile:** the username is saved lower case and trimmed. A taken name, a bad format and a bio over 160 characters are refused. The availability check works.
- **Findable rules:** an under-18 can't turn it on, not even by editing the row directly. An unknown age is off.
- **Search:** finds by name and by @username. It hides the under-18, the private person and the unknown-age person, and needs 2 or more characters.
- **Profiles:** a stranger sees only the basics of a findable person and nothing of private ones or under-18s.
- **Suggestions:** a friend of a friend appears with 1 mutual friend and disappears once requested.
- **Requests:** a repeat request doesn't duplicate. A private person with no mutual friends can't be asked. The other person sees the incoming request with its mutual count. After a decline you can't ask again. If both ask, they become friends both ways.
- **Friend's view:** a friend's profile shows the streak, this month and the posts. Cancelling a request works.
- **Block:** it hides the profile and stops requests.
- **Access:** the table is closed, and people who aren't signed in can't call anything.

**Found during the dry run:** there are now 2 real accounts in the database. As first written, the migration would have made existing adult accounts searchable without asking them. One of them showed up in my test search. I changed the migration so existing accounts start unfindable, then ran a second dry run. In it, no existing account was findable, a new adult account was and a new under-18 account wasn't, and blocking hid the person from search.

**After applying (live database):**
- Structure: the 3 new profile fields and the findable trigger are in place, `friend_requests` is closed, all 9 functions exist, and signed-out visitors can't call any of them. **Both existing accounts are unfindable.**
- Security check: only the expected notes.
- Behaviour: the full test (36 checks) ran on the live database with 7 temporary accounts and was rolled back. All as expected, including block → hidden from search (0 results) and the real accounts staying hidden.
- Clean-up: nothing was left behind (no test accounts, requests, usernames, posts or blocks; only the 2 real accounts remain, both unfindable).

**Checked:**
- **Automated:** 192 tests pass (5 new: usernames, the username suggestion, the adult rule, the checklist, the friend button for each relation). Type check, lint and build pass.
- **End to end in the preview at 375 px, light and dark,** with a temporary stand-in for the database (removed afterwards):
  - **Find friends:** the "hidden from search" note, Priya's request, and suggestions with mutual counts.
  - **Search and requests:** typed "@zar" → Zara → **Add friend** → "Requested" (it moved to Requests you sent). Accepted Priya ("You and Priya are friends now"). A search for a hidden person found nothing.
  - **Profiles:** a friend's profile showed the streak, month and week plus a posts grid linking to the posts. A non-friend's profile showed only the basics and "Become friends to see…". A hidden person showed "Profile not available".
  - **Public profile card:** the suggested "@sam"; a taken username showed "That username is taken." with Save disabled; saved "@sam.lifts" and a bio; the checklist hid at 6/6.
  - **Let people find me:** as an adult it turned on. Without a birth year it was locked with the reason, and Find friends suggested sharing a friend code instead.
- **Not checked here:** the Message button on profiles (it needs a signed-in session). Real accounts get tested on two phones after pushing (the database part is live).

### 2026-11-18 — Five improvements: profile picture, Rozi plans workouts, picker, Train start button, Friends redesign (same branch)

**1. Fix: changing the profile picture failed ("Profile could not be saved").**
- **What was wrong:** choosing one of the round Rozi faces showed "Profile could not be saved" and the old picture stayed.
- **Why:** the face picker saves pictures as `face:<name>` (the faces in `public/rozi/faces/v1`). The database checks on `profiles.avatar` and `friend_stats.avatar` were written before faces existed. They only allowed `photo:https://…`, `rozi:<mood>` and `color:#rrggbb`, so the database refused the save. The Postgres logs showed `profiles_avatar_check` refusing the value.
- **Fix:** `supabase/migrations/20261118210000_allow_face_avatars.sql` recreates both checks with the same rules plus `face:<name>` (lowercase letters, numbers and dashes, up to 30).
- **Dry run (rolled back):**
  - accepted `face:starry`, `face:happy`, `rozi:cheer`, `color:#ef7d5c`, `photo:https://…` and the empty value;
  - refused `face:Starry`, `face:<script>`, `face:`, `photo:http://x` and `javascript:alert(1)`;
  - both real accounts' current pictures stay valid.
- **Applied 2026-11-18 after "Yes, apply it".** Both checks are in place and enforced. The security check shows only the expected notes.
- **Second problem found by the behaviour test after applying.**
  - **What:** a temporary account couldn't save its profile at all: "permission denied for function is_adult".
  - **Why:** the findable trigger from Discover (`private.enforce_findable`) runs on every insert and update of a profile. It calls `private.is_adult`, which signed-in users may not run, and the trigger ran with the caller's rights.
  - **Effect:** since Discover was applied, **every profile save from the app fails**, not just face pictures. That includes name, plan, settings and new sign-ups. My Discover tests went through the database functions, which run with elevated rights, so they didn't catch it. The real face-picture failures in the logs (01:26–01:27) came before Discover and were the face rule.
  - **Fix:** `supabase/migrations/20261118220000_fix_profile_save_findable_trigger.sql` makes the trigger function run with its owner's rights, the same as the other profile trigger (`private.keep_buddy_plan`). Its search path stays empty, and nobody can call it directly.
  - **Dry run (rolled back), all as expected:**
    - as a signed-in account, a new profile saves;
    - `face:happy`, `face:starry`, `rozi:cheer`, a colour, a photo and empty all save to both tables, and the 5 bad values are refused;
    - the findable rule still works on direct edits (no age → off, under 18 → off, adult → on; the username is saved in lower case);
    - other people's rows can't be changed, and signed-in users can't run the trigger function.
    - Nothing was left behind (2 real accounts, no test data).
  - **Applied 2026-11-18 after "Yes, apply it".**
    - **Structure:** the trigger function now runs with its owner's rights and an empty search path, the same as `keep_buddy_plan`. Signed-in and signed-out users can't run it directly.
    - **Security check:** unchanged (the same expected notes).
    - **Behaviour test on the live database (rolled back), as a signed-in temporary account:**
      - a new profile, name and plan save;
      - all 6 picture types save to both tables, and the 5 bad values are refused;
      - the findable rule still works (no age → off, under 18 → off, adult → on, username in lower case);
      - other people's rows are untouched.
    - **Clean-up:** nothing left behind. There are 2 real accounts and 2 profiles, none findable.

**2. Rozi plans workouts; Ask Rozi is a focused screen on phones.**
- **Asking for a plan:** say "plan me a leg workout", "give me a 30 min chest workout", "build a push day" or "arm day please". Rozi answers with a plan card that has **Start now** and **Save as routine**.
- **How the plan is built** (`src/lib/rozi-plan.ts`):
  - **Body area:** taken from your words (legs, glutes, chest, back, shoulders, arms, push, pull, upper, lower, core, full body). Nothing specific means full body.
  - **Length:** "30 min", "an hour", or your usual session length. It's kept between 15 and 90 minutes, at about one move per 8 minutes (3–7 moves).
  - **Moves:** only ones allowed for you. No deadlifts unless your trainer approved them. Only equipment you've confirmed; bodyweight moves if you haven't set your equipment yet. Higher levels get harder, loaded moves first.
  - **Sets by level:** beginner 2, intermediate 3, advanced 3–4, pro 4. **Reps by goal.** Timed and one-side moves keep their own wording ("20–30 sec", "8 each side").
  - **Saving:** a plan always passes the routine rules, so it can be saved. `validateRoutine` now also accepts a move's own library reps.
- **Rest days don't trigger a plan:** "I need a rest day" is not a plan request. The old questions ("What's my workout today?") still get their usual answers.
- **Focused screen on phones (up to 700 px):**
  - the bottom dock and footer hide;
  - the message box sits at the very bottom;
  - a **Back** button takes you out.
  - New answers scroll in above the message box, not behind it. This was found and fixed during the preview check.
- **Files:** `src/lib/rozi-plan.ts` (+ `rozi-plan.test.ts`, 6 tests), `src/lib/rozi-chat.ts` (new `PLAN_WORKOUT` intent and suggestion), `src/lib/pro-tracking.ts`, `src/components/screens/rozi-chat-screen.tsx`, `src/components/app/app-shell.tsx` (`rozi-mode` class), `app/globals.css`.

**3. Add exercises: the A–Z strip is gone.**
- The letter strip and the letter headings in the routine planner's picker are removed, and the list now uses the full width.
- While searching, the list still splits into "Best matches" and "Also matches".
- The Library keeps its own A–Z index.
- File: `src/components/app/exercise-picker.tsx`.

**4. Train: the Start button grows as you scroll.**
- At the top of the page, Start is a small round ▶ button on the right.
- After you scroll about 120 px it smoothly grows into the full "Start workout ▶" bar, and it shrinks back when you return to the top.
- Turning on "Reduce motion" removes the animation.
- Files: `src/components/screens/today-screen.tsx`, `app/globals.css`.

**5. Friends page redesign.** From top to bottom:
- **Your week:** your picture, "x of y workouts" with a progress bar, and your streak.
- **Hub (2 × 2 on phones, 4 in a row on desktop):** Chats (unread badge), Feed, Find friends (requests badge), Train together (invites badge).
- **Sections:** **Friends · Challenges · Invite** tabs. They stick under the top bar, and counts show as small badges.
- **Friends list:**
  - sorted by this week's progress;
  - each row shows the picture, name with streak 🔥, "3/4 this week · today", a week bar, a Nudge bell and a **···** button;
  - **···** opens a sheet with Message, View profile, Train together, Ask to be my trainer (trainers only) and Remove friend.
- **Invite:** "Find by name or @username" plus the invite code card.
- Polished during the preview check:
  - tiles are compact, with the icon beside the text;
  - Chats always shows, so the grid doesn't jump while loading;
  - tab counts no longer wrap at 375 px;
  - friend rows use the short "today / yesterday / 9d ago" label (`lastWorkoutLabel(…, short)`, with new test lines) so nothing is cut off.
- Files: `src/components/screens/friends-screen.tsx`, `src/lib/friends.ts`, `src/lib/friends.test.ts`, `app/globals.css`.

**Also fixed: an extra white card in Ask Rozi.**
- My chat CSS reused Rozi's class names (`.chat-row`, `.chat-bubble`, `.chat-input`).
- Chats and Feed now use their own names: `.convo-row*`, `.msg-bubble`, `.msg-input`. Rozi's styles are untouched.

**Checked:**
- **Automated:** 197 tests pass. Type check, lint (only the existing welcome-image warning) and build pass.
- **Preview at 375 px and desktop, light and dark:**
  - **Rozi:** the dock is hidden and Back shows. "plan me leg workout" gave 5 moves at intermediate level with 3 sets. "give me a 30 min chest workout" gave 4 moves and scrolled fully into view. **Save as routine** showed "Saved 'Chest day · by Rozi'", and it appeared in My routines.
  - **Picker:** no letter strip; the list uses the full width.
  - **Train:** the Start button is 64 × 64 round at the top, 351 px wide after scrolling, and round again back at the top.
  - **Friends:** checked with a temporary stand-in for friends data (removed afterwards). Measured: no text is cut off at 375 px. The ··· sheet and the Challenges tab work.
- **Not checked here:** Message and Train together in the ··· sheet (they need a signed-in account), and saving a face picture from the real app (both database fixes are live; try it on your phone).

### 2026-11-18 — Workout screen fixes: rest timer, dock, Rozi chat space, guide close button, lock-screen notification (same branch)

**1. Rest timer: movable, two sizes, never cut off.**
- **What was wrong:** the rest card sat half off the right edge of the screen and covered the sets and buttons.
- **Why:** it was centred with `transform: translateX(-50%)`, but its slide-up animation also sets `transform`. While the animation ran, and after it, the centring was lost and the card was pushed right by half its width.
- **Fix:** a new floating timer, `.rest-float`.
  - **Two sizes:** a small round timer (ring with the time, **+10**, **×** to skip) or the full card (ring, exercise, −10s / +10s / Skip). Tap the ring or the corner button to switch.
  - **Movable:** drag it anywhere (it follows your finger). When you let go it settles against the nearer side.
  - **Remembered:** size and place are saved on this device (`rozfit-rest-size`, `rozfit-rest-place`) and kept on screen on any phone size or rotation.
  - The animation no longer touches its position. Reduce motion is respected. The finished state shows a green ring and "Go!".
- **Files:** `src/components/app/rest-timer.tsx`, new `src/lib/rest-timer-place.ts` (+ `rest-timer-place.test.ts`, 3 tests), `app/globals.css`.

**2. The dock slides away during a workout.**
- While you're logging sets, the bottom dock and Rozi button slide down out of view, so Previous / Next, Finish and the timer are never covered.
- A small **˄ handle** at the bottom brings the dock back; it becomes **˅** to tuck it away. Tapping a dock item leaves the workout screen as usual.
- Workout mode ends when you leave the logger (review, done, another page).
- **How:** the Train screen adds `workout-mode` to the page while logging; the CSS moves the dock off-screen. The handle toggles `dock-peek`.
- **Files:** `src/components/screens/today-screen.tsx`, `src/components/app/app-shell.tsx`, `app/globals.css`.

**3. Ask Rozi: no empty band under the message box.**
- **Why:** the chat was sized as "screen height − 150 px" inside a page that also had its own minimum height, which left about 60–80 px empty under the message box (more on an iPhone home-screen app).
- **Fix:** on phones the chat now fills the screen exactly (flex column, 100 dvh). Rozi sits centred in the free space, and the messages, suggestions and message box stay together at the bottom, 10 px above the safe area.
- **File:** `app/globals.css`.

**4. Exercise guide: the × stays put while scrolling.**
- The close button is now pinned to the top right of the guide sheet. It sits in a zero-height sticky row, so it takes no space, and the title keeps room for it.
- **Files:** `src/components/app/exercise-guide-modal.tsx`, `app/globals.css`.

**5. Workout on the lock screen (notification).**
- **What you asked for:** a workout timer on the lock screen, like Apple Fitness.
- **What's possible:** that ticking timer is an iOS *Live Activity*, which only native apps can show. RozFit is a web app (PWA), and iPhone pauses web apps in the background, so a notification can't count down by itself. A real Live Activity is planned with the native app (Phase 9).
- **What it does now:** the existing "Workout in progress" notification shows clock times instead of a countdown.
  - **Between sets:** "💪 Push B · 4/21 sets" and "Started 9:23."
  - **During a rest:** "⏱ Rest until 10:15:30" with the exercise name.
  - On Android it also shows how long ago the workout started.
- **When it updates:** whenever you leave the app (lock the phone or switch apps). It isn't refreshed after every set, so it never pops a banner while you're using the app.
- **Files:** `src/lib/session-notify.ts` (`workoutNotificationText`, `updateWorkoutNotification`; + `session-notify.test.ts`, 3 tests), `src/components/screens/today-screen.tsx`.

**Checked:**
- **Automated:** 203 tests pass (6 new). Type check, lint (only the existing welcome-image warning) and build pass.
- **Preview at 375 px, light and dark:**
  - **Workout mode:** the dock moved off-screen and the handle showed. The handle brought the dock back and tucked it away again. Previous / Next were fully visible.
  - **Timer:** after a set, the compact timer sat above the handle. Dragged up-left, it settled on the left and saved its place. Tapping the ring gave the full card, fully on screen. After a reload it came back full size at the same place.
  - **Rozi:** the message box sits 10 px from the bottom, with Rozi centred.
  - **Guide:** after scrolling 600 px the × stayed at the top right and still closed the guide.
  - **Notification:** with stand-ins for permission and the service worker, leaving the app produced "💪 Push B · Chest, shoulders, triceps · 1/21 sets / Started 12:44…". During a rest it produced "⏱ Rest until 12:48:19" with the exercise name. Same tag, so it replaces the old notification.
- **Not checked here:** the real lock screen on your iPhone and Android (needs the pushed app with notifications allowed).

### 2026-11-18 — Rozi AI stage 2: Google Gemini connection (same branch)

**What:** the first piece of Rozi AI (the full plan is in `docs/ROZI_AI_INTEGRATION.md`). It adds the official Google Gen AI SDK (`@google/genai` 2.32.0, pinned) and a server-only Gemini provider behind a provider-neutral interface, plus configuration from `GEMINI_API_KEY` / `ROZI_AI_PROVIDER` / `ROZI_AI_MODEL` (default `gemini-3.8-flash`, listed as Stable in Google's model list on 2026-11-18). Rozi's screen doesn't use it yet.

**Why this way:**
- The key stays on the server and never appears in errors or logs. The app refuses to run Rozi AI if the key is ever set under a `NEXT_PUBLIC_` name.
- Every call has a 15 s timeout, and every failure becomes a safe, typed error, so Rozi can always fall back to its on-device answers.
- Tool calling is supported from the start, so later stages let Gemini *ask* for facts that RozFit's own modules compute, instead of making them up.

**Decided:**
- Free tier for now; paid tier and possibly a stronger model later.
- Gemini may see training details (weight, height, workouts, goal) but never email, phone, name or account id.
- Adults only and opt-in, from Google's terms.

**Files:** `src/lib/rozi-ai/{config,provider,gemini-provider,server}.ts`, `src/lib/rozi-ai/{config,gemini-provider}.test.ts`, `scripts/rozi-ping.ts`, `package.json` (dependency, `rozi:ping`, tests), `.env.example`, `docs/ROZI_AI_INTEGRATION.md`, `docs/PROJECT_CONTEXT.md` (the "no AI API" line updated), `docs/ROADMAP.md`.

**Checked:** 216 tests pass (13 new, with the SDK mocked). Type check, lint and build pass, and `npm audit` reports 0 vulnerabilities. Without a key the ping exits safely with "Rozi AI off: missing-key". The live ping is waiting for the key in `.env.local`.

### 2026-11-18 — Rozi AI stage 3: tools and conversation loop (same branch)

**What:** Gemini can now answer Rozi questions from real RozFit data. Thirteen tools wrap the existing modules (planner, progress, recovery, streak, weekly report, body/BMI, exercise library and alternatives, mobility, achievements, Rozi's workout planner, profile). A conversation loop lets the model call them (up to 3 rounds) and reply from their results, and cards are built by our code from the same results. Not yet connected to the screen; that's Stages 4–5.

**Found live and fixed:**
1. **Thinking tokens:** Gemini 3 thinking counts toward the output limit, so a small limit cut answers off. Now the limit is 2048 and length is controlled by the instructions.
2. **Speed:** thinking level `LOW` takes about 5 s; the default took 20–64 s. `MINIMAL` isn't supported.
3. **Hidden waits:** the SDK's 5 silent retries turned 503 "high demand" into 45–90 s waits. Now there's 1 retry, a clear "Gemini is busy" error, and a 20 s timeout.
4. **Thought signatures:** Gemini 3 requires the model's thought signatures to be sent back with tool results. Now they are.
5. **Exercise matching:** the library search returns non-matches at the end of its list, so "underwater basket weaving" matched an exercise. `findExercise` now accepts only real name matches and prefers logged, equipment-friendly, common versions.

**Free-tier quota:** after about 25 test calls the key hit the daily limit (429, retry in about 23 h; resets at midnight Pacific).

**Files:**
- `src/lib/rozi-ai/{cards,tools,prompt,conversation}.ts` (new);
- `config.ts`, `provider.ts` and `gemini-provider.ts` updated (thinking level, retries, signatures, busy message);
- tests `tools.test.ts` and `conversation.test.ts` (new), `gemini-provider.test.ts` (updated);
- `scripts/rozi-ask.ts` and `npm run rozi:ask` (new);
- `docs/ROZI_AI_INTEGRATION.md` (section 9).

**Checked:** 237 tests pass (34 Rozi AI). Type check, lint and build pass. A live call to `gemini-3.5-flash-lite` with the same key worked. A live run on `gemini-3.8-flash` is waiting for the quota reset.

### 2026-11-18 — Rozi AI: Groq provider + stage 4 secure route (same branch)

**Groq (alongside Gemini):**
- `groq-provider.ts` with `groq-sdk` 1.6.0, pinned.
- Settings: `ROZI_AI_PROVIDER` is `gemini` (still the default) or `groq`; each provider uses only its own key.
- Gemini's thought signatures are never sent to Groq.
- Malformed tool arguments are flagged and the model is asked again, never guessed.
- Bounded retries (busy, network, short rate-limit waits, `tool_use_failed`).
- `get_progress` now reports the biggest improvements.
- `npm run rozi:bench` compares models on the same made-up data; results go to `docs/ROZI_AI_BENCHMARK.md`.

**Stage 4: `POST /api/rozi/chat`.**
- The person comes only from their Supabase token; the server reads their data as them (row-level security, no service-role key, read only).
- Checks before any AI call: valid body, opt-in, provider configured, profile, adult.
- Limits per person: 6 a minute, 60 a day.
- Every failure is a safe fallback, and logs hold no message text or user id.
- Details in `docs/ROZI_AI_INTEGRATION.md` sections 10–11.

**Files:**
- `app/api/rozi/chat/route.ts`;
- `src/lib/rozi-ai/{groq-provider,handler,rate-limit}.ts` and their tests;
- `config.ts`, `server.ts`, `provider.ts`, `conversation.ts` and `tools.ts` updated;
- `supabase-repository.ts` (`loadOwnTrainingData`);
- `scripts/rozi-{ping,ask,bench}.ts`, `package.json`, `.env.example`.

**Checked:** 258 tests pass. Type check, lint and build pass. Live: Groq gpt-oss-120b answered with a tool round trip in under 1 s; the route refused no-token and forged-token requests (401), an oversized body (413) and GET (405). A signed-in end-to-end request is still to be checked in Stage 5.

### 2026-11-18 — Rozi AI: three-model fallback, fewer tokens, reply-language fix (same branch)

**Why:** Groq's free plan allows about 8K tokens per minute per model, shared by the whole app. A live test answered 2 questions, then returned 429.

**What:**
- `ROZI_AI_CHAIN` lists up to 4 models, tried in order. The recommended order is gpt-oss-20b → gpt-oss-120b → Gemini 3.5 Flash-Lite.
- Fallback is per question; a failed model rests; safety blocks are never routed around; the whole question has a 40 s budget.
- Each question gets only the tools it can need (about 40% fewer tokens).
- Plainly English questions get an explicit "reply in English", after gpt-oss-20b answered two in Spanish.

**Files:**
- `src/lib/rozi-ai/{fallback,tool-select}.ts` (new);
- `config.ts` (`readRoziAiChain`), `server.ts` (`roziAiProviders`), `handler.ts`, `conversation.ts` (`tools` option), `prompt.ts`;
- `app/api/rozi/chat/route.ts` (shared rests);
- `scripts/rozi-ask.ts` and `rozi-bench.ts`, `.env.example`;
- tests `fallback.test.ts` (new), `conversation.test.ts`, `handler.test.ts`.

**Checked:**
- 268 tests pass. Type check, lint and build pass.
- Live: 5 questions back to back; question 5 fell back from gpt-oss-20b (429) to gpt-oss-120b and answered.
- English replies 6/6 after the fix.

### 2026-11-18 — Rozi AI stage 5: on the chat screen (same branch)

**What:**
- A one-time opt-in card in Ask Rozi, and a Settings → Your data switch (adults, signed in; saved on the device).
- AI answers with cards built from real data, an "Answered with AI" tag, and the typing dots.
- Automatic on-phone fallback, tagged "Answered on your phone — Rozi AI is busy".
- Signed out, demo, minors or switched off: unchanged.

**Tested end to end with the real account in the preview:**
- Today's workout, progress, chest recovery, a legs follow-up (with a live fallback 20b → 120b) and goblet squat all answered correctly from real data.
- **Fixed during the test:**
  - a finished workout was cheered on as if still to do (tool `statusSentence` added; re-tested);
  - in a real chat, short questions were given all 13 tools (now only real follow-ups; re-tested: 1 tool, about 2.1K tokens instead of 3.2K);
  - long exercise names were cut off (they now wrap).
- Logs hold no question text or user id. Checked at 375 px light and dark, and desktop.

**Files:**
- `src/lib/rozi-ai/client.ts` and `src/components/app/rozi-cards.tsx` (new);
- `rozi-chat-screen.tsx`, `account-cards.tsx`, `settings-screen.tsx`, `globals.css`, `tools.ts`, `tool-select.ts`;
- tests `client.test.ts` (new), `tools.test.ts`, `fallback.test.ts`.

**Checked:** 271 tests, type check, lint and build pass.

**Deploy (user):** add `ROZI_AI_CHAIN`, `GROQ_API_KEY` and `GEMINI_API_KEY` (Sensitive) in Vercel for Production and Preview.

### 2026-11-18 — Rozi AI stage 6: chat history + database limit (same branch; migration applied)

**Migration `20261118230000_rozi_chat_history.sql`:**
- tables `rozi_conversations` and `rozi_messages` (closed, cascade on account delete);
- 6 functions (start question with limits, save reply, list, open, delete one, delete all), each owner-only;
- limits of 6 a minute and 60 a day, enforced in the database;
- chats cleared after 180 days.

**App:**
- The route records questions and saves replies (falling back to the memory limit and no history until the migration exists).
- **History** and **New chat** on Ask Rozi, with a history sheet (open, delete one, delete all).
- Settings "Delete all Rozi chats".
- On-phone answers are saved next to their questions.

**Dry run:** all owner, limit, validation, retention and delete checks passed, and nothing was left behind. Details in `docs/ROZI_AI_INTEGRATION.md` §15.

**Checked:** 279 tests, type check, lint and build pass.

**Applied 2026-11-18 after "Yes, apply it":**
- **Structure:** tables closed with row-level security, 6 owner-only functions, indexes in place.
- **Security check:** only the expected notes.
- **Live behaviour test (rolled back):** ownership, limits, delete-all with separate calls, and account-deletion cascade all passed; nothing was left behind.
- **End to end with the real account:** two questions were saved as one conversation, New chat worked, and History reopened it with its cards.

### 2026-11-19 — Rozi AI security audit, Phase A (same branch; migration applied)

Approved as "Approve Phase A". Full details are in `docs/ROZI_AI_INTEGRATION.md` §16.

**Database (migration `20261119090000_age_and_rozi_security.sql`):**
- Optional `profiles.birth_date`. A trigger keeps `birth_year` in step and refuses future dates.
- A strict 18+ rule (`private.is_adult(year, date)`), used by all 6 functions that decide "adult".
- A per-person lock in `rozi_start_question`.
- `rozi_save_reply` is now phone-only. The new server-only `rozi_save_ai_reply` is for the service role.

**App:**
- **Settings → Your plan → Date of birth.** Settings search finds it under "birth", "age" or "dob".
- **Age:** `isAdultOn` / `needsBirthDate` replace `isAdult` everywhere.
- **History:** the route ignores browser-sent history and reads earlier turns from the database.
- **Saving AI replies:** the server saves them with the service-role client (`src/lib/rozi-ai/service-client.ts`).
- **Masking and links:** emails and phone numbers are masked before providers see them (`privacy.ts`). Card links must be same-site.
- **Fallback limit:** a stricter in-memory limit (3 a minute, 20 a day), logged as degraded.

**Tests:**
- 286 app tests pass, including the new privacy end-to-end test.
- New repeatable database script `supabase/tests/rozi_ai_security.sql`: 31 checks, passed in a rolled-back dry run with the migration.
- Type check, lint and build pass.
- Settings checked on phone width and desktop.

**Applied 2026-11-19 after "Yes, apply it":**
- **Structure:** all as expected.
- **Security advisors:** only the earlier notices. The server-only function isn't callable by signed-in users.
- **Security script on the live database (rolled back):** 31/31 checks pass.
- **Cleanup:** nothing left behind.

**Next:**
- Deploy the app. Until then, the live app's AI replies aren't saved to history.
- **Live limit test (done, with OK):**
  - **Setup:** one temporary account, 10 questions.
  - **Result:** exactly 6 allowed and 4 refused, with only 6 saved.
  - **Caveat:** the calls arrived about 2 s apart, not at the same moment, so the lock wasn't exercised by truly simultaneous requests.
  - **Cleanup:** the account was deleted, and nothing is left.
- **Truly simultaneous test (done, with OK):**
  - **Setup:** 10 questions fired at once from the signed-in tab (database only, no AI). They finished within 184–232 ms.
  - **Result:** exactly 6 allowed and 4 refused. The 6 saved questions were counted in turn, with no duplicates, which confirms the lock works.
  - **Cleanup:** the test chats were deleted, and nothing is left.

### 2026-11-19 — Rozi AI benchmark, Phase B (same branch; no database change)

Approved as "next phase B". Full details are in `docs/ROZI_AI_INTEGRATION.md` §17.

- **60 questions** (40 English, 10 Telugu, 10 Hindi) on 4 made-up accounts (`src/lib/rozi-ai/bench/`):
  - each is scored on tools, facts, safety and language;
  - expected facts come from the real tools.
- **B1, offline:** 78 new tests in `npm test`. They cover every question, the scorer, malformed and unknown tool calls, several rounds of tools, fallbacks, and the edge accounts.
- **B2, live** (`npm run rozi:bench`; results in `docs/benchmark/` and `docs/ROZI_AI_BENCHMARK.md`):
  - gpt-oss-20b **55/60**;
  - gpt-oss-120b **55/60**;
  - Gemini 3.5 Flash-Lite **51/60** (8 timeouts);
  - Qwen 3.8 27B **43/60** (15 hit its daily limit).
  - Total cost under $0.20.
- **Recommendation:** keep the current chain (20b → 120b → Flash-Lite). Nothing was changed. Two fixes are suggested: an explicit Telugu/Hindi reply hint, and a plain skipped-count sentence.
- **Checked:** 364 tests, type check and lint pass.

### 2026-11-19 — Rozi AI: fixes from the benchmark (same branch; no database change)

After "Yes, fix both". Details are in `docs/ROZI_AI_INTEGRATION.md` §17, "Fixes from the benchmark".

**Fixes:**
- **Reply language:** an explicit reply language for Telugu, Hindi/Marathi and other Indian scripts (`prompt.ts`).
- **History tool** (`tools.ts`):
  - a plain sentence with the completed, partly done and skipped counts;
  - the periods are spelled out, because the models fetched last month for "this month".

**Re-run of the 26 affected questions:**
- **gpt-oss-120b:** 55/60 → **60/60**.
- **gpt-oss-20b:** only partly re-tested (Groq daily limit reached). Re-run tomorrow.

**Checked:** 364 tests, type check and lint pass.

**Waiting for approval:** no model order changed. Making gpt-oss-120b the first model needs your OK.

**Decision (2026-11-19):**
- **Order:** keep 20b → 120b → Flash-Lite, unchanged until 20b is fully re-tested.
- **20b so far:** Q38 now passes (56/60). Its Telugu/Hindi questions are waiting for Groq's daily limit to reset (`npm run rozi:bench -- --only groq:openai/gpt-oss-20b --cases 42-60`).

### 2026-11-19 — Swap any exercise (also through Rozi), warm-up confirm, new rest timer, haptics, typical-day question, shrinking dock (same branch; migration applied)

From your screenshots and the Instagram recording.

**1. Swap exercises (and "customise my workout" in Rozi)**
- **The problem:** Rozi's rules said it "can't change their plan". Also, "I want to customise the workout" matched the on-phone *plan a new workout* answer.
- **New shared module, `src/lib/exercise-swap.ts`:**
  - **What can come in:** any library exercise the trainer rules allow (deadlift approval) and the person's equipment covers. These are the same rules the planner uses, so a swap is kept when the plan is rebuilt.
  - **What's kept:** sets, reps and rest stay the same, and the original stays in the plan history.
  - **When:** before a workout starts, any exercise can be swapped; once it has started, only one with no sets done yet.
- **Where you can swap:**
  - **Train (before starting):** a round swap button beside every exercise.
  - **While logging:** "Swap" next to "Warm-up & plates".
  - **The sheet (`swap-sheet.tsx`):** closest matches first, then searchable "any other exercise", ranked by the same movement and shared muscles.
  - **The exercise guide:** "Use instead" now uses the same module, so the swap code isn't repeated.
- **Rozi:**
  - **Rozi AI:** a new tool, `suggest_exercise_swap`. Its card lists choices you tap ("Use instead" or "More choices"). The rules now say people can swap any exercise.
  - **On-phone Rozi:** a new `SWAP_EXERCISE` intent, checked before "plan a workout". It gives the same card.
- **Tests:** `exercise-swap.test.ts` covers the rules, choices, kept sets/reps, the fresh log for a started workout, the restricted account, the tool and the intents.

**2. Warm-up & plates**
- **The problem:** a working weight below the bar (for example 10 kg on a 20 kg bar) showed "Type a working weight…" and no button, so nothing could be confirmed or saved.
- **The fix:**
  - A clear message is shown for that case.
  - One confirm button always appears: "Use 10 kg + add 2 warm-up sets", or "Use 10 kg for my sets". It also works with the keyboard's Go/Done key.
  - It saves the working weight into the sets not done yet, and the warm-ups, in one update.

**3. Rest timer, redesigned (`rest-timer.tsx`)**
- **No more dragging:** the timer is a bar docked just above the dock handle, with ring and time, the exercise, then −10 / +10 / Skip.
- **Two sizes:** tap it to shrink it to a small pill, and tap again to expand. The size is remembered.
- **Room to work:** the page leaves space so the bar never covers the Next button.
- **Removed:** `rest-timer-place.ts` and its test, which were only for dragging.

**4. Haptics and the typical-day question**
- **`src/lib/haptics.ts`:**
  - Android uses its vibration API.
  - iPhone (iOS 18+) uses the switch-control trick. Best effort.
- **Used by:** the height and weight pickers (a tick per step), the rest-timer buttons, and the onboarding activity answers.
- **New onboarding step, "How active is your typical day?":** Mostly seated / Lightly active / Often on my feet / Physically active work.
  - **Water target:** +0 / +0 / +250 / +500 ml.
  - **Stretches:** "Mostly seated" gets a sitting-reset stretch suggestion in the afternoon.
  - **Rozi:** sees it in the profile tool.
  - **Settings:** editable in Settings → Your plan.
- **Saving to the account:** needs migration `20261119120000_profile_daily_activity.sql` (one optional column). **Applied 2026-11-19 after "Yes, apply it":**
  - **Column:** text, optional, with a check limiting it to seated / light / on_feet / active.
  - **Security advisors:** only the earlier notices.
  - **Behaviour test (rolled back):** your own update works, a bad value is refused, and another person can't change it (0 rows).
  - **Cleanup:** nothing left behind.
  - **Note:** the deployed app needs the new code to start saving it.

**5. Dock**
- **Like Instagram:** the dock shrinks to an icon-only pill (about 84%) while you scroll down, and comes back on scroll-up or at the top. It's not active during a workout.
- **Lower:** it sits closer to the bottom (safe area − 10px, about 24pt on iPhone instead of 44pt).

**Checked:**
- 366 tests, type check, lint and production build pass.
- In a production build on a separate test origin (made-up demo data, your account untouched):
  - onboarding question;
  - swap before and during a workout;
  - Rozi swap card (list and named swap);
  - warm-up confirm, including Enter;
  - rest bar in both sizes;
  - Settings field;
  - dock full / compact / back.
- No console errors.
- **Not checkable here:** the iPhone haptics and the real iPhone safe area. Please try those on your phone after deploying.

### 2026-11-19 — Rozi agent upgrade: Phase 0 audit + complete roadmap (docs only)

From your "Level 4 Supervised Autonomous Fitness Agent" brief.
- **No application code changed.**
- **New docs:** `docs/ROZI_AGENT_ARCHITECTURE.md` (today's Level 2 flow; inventory of tools, writes and tables; Level 3/4 design), `docs/ROZI_AGENT_PERMISSION_MODEL.md` (categories A/B/C, lifecycle, approval binding, idempotency, plan limits) and `docs/ROZI_AGENT_IMPLEMENTATION_PLAN.md` (phases 1–9, files, migrations, risks, tests).
- **Key finding:** all writes currently run in the browser, so server-run actions need a version check against stale browser saves first.
- **Roadmap:** `docs/ROADMAP.md` section 10 is the complete, ordered list of what's done and pending.
- **Waiting for:** your review and approval before agent Phase 1.

### 2026-11-19 — Rozi agent Phase 1: Level 3 actions with approval (same branch; migration applied; off by default)

After "approve phase 1". Full details are in `docs/ROZI_AGENT_IMPLEMENTATION_PLAN.md` ("Phase 1 — status") and decision D1 in `ROZI_AGENT_ARCHITECTURE.md`.

**How it works:**
- Rozi can now **propose** six changes: swap an exercise, make a plan today's workout, save a routine, update plan settings, log weight, log water.
- The server builds the exact change from your data with the existing FitTrack logic, refuses anything not allowed, and records it.
- You approve that exact change (hash-bound, 30 minutes, single use). The app applies it through its normal save path, only once. The server re-reads your data and records completed or failed.
- Everything else (deleting data, security, trainer rules, posting, purchases, diagnoses) is refused, with where to do it yourself.

**Checked:**
- 378 tests, type check and lint pass.
- New `supabase/tests/rozi_actions_security.sql`; rolled-back dry runs passed (21 + 5 checks).

**Not done yet:**
- applying migration `20261119150000_rozi_actions.sql` (needs your OK);
- Phase 2, the approval cards and action history;
- switching it on with `ROZI_ACTIONS=on` (only after Phase 2).

**Applied 2026-11-19 after "Yes, apply it" (`20261119150000_rozi_actions.sql`):**
- **Structure:** row-level security on; no table access for the app or anon.
  - **The app can call:** `rozi_start_action`, `rozi_reject_action`, `rozi_my_actions`.
  - **Only the server can call:** `rozi_propose_action`, `rozi_finish_action`.
  - All functions are security definer.
- **Security advisors:** only the expected notices (a closed table, and the three owner-checked functions).
- **`supabase/tests/rozi_actions_security.sql` on the live database (rolled back):** `PASS 22 checks`.
- **Cleanup:** 0 rows and 0 test users left.
- **Still off:** `ROZI_ACTIONS` isn't set, so Rozi doesn't propose anything until Phase 2 adds the approval cards.

### 2026-11-23 — Rozi agent Phase 2: approval cards and "What Rozi changed" (same branch; no database change)

After "Start Phase 2". Details are in `docs/ROZI_AGENT_IMPLEMENTATION_PLAN.md` ("Phase 2 — status").

**What's new:**
- **Approval card under Rozi's reply:** what will change and why, with Approve / Not now, and a live status: Needs your OK → Saving… → Done or Didn't work, or Not applied / Expired.
- **"Done" means checked:** it's only shown after the server verified the change.
- **History:** the **Changes** button opens the list of everything Rozi proposed and what happened.

**Checked:**
- 379 tests, type check, lint and build pass.
- All card states and the history sheet checked at phone width, with the network calls intercepted (no real data touched).

**To use it:** add `ROZI_ACTIONS=on` in Vercel and redeploy (after you commit and push).

### 2026-11-23 — Milestone 0: Level 4 + exercise library audit (docs only; no code, database or Git change)

After you shared the ChatGPT "Level 4 agent + complete exercise library" plan ("Start with Milestone 0 only").

**New docs:**
- `docs/ROZI_LEVEL_4_CURRENT_STATE_AUDIT.md`: Git state and the 19-row status matrix.
- `docs/ROZI_LEVEL_4_REMAINING_ROADMAP.md`: steps R1–R13, where I disagree with the plan, extra ideas, and where your "8. New ideas" land.
- `docs/EXERCISE_LIBRARY_AUDIT.md`: all 77 exercises, 10 metadata problems, and the 212 candidate names classified.
- `docs/EXERCISE_LIBRARY_COVERAGE.md`: coverage by muscle, equipment, location, category and difficulty; 50 high-priority and 59 optional missing exercises.

**Main findings:**
- **Level 3 is built** but `origin/main` doesn't contain it yet, so `ROZI_ACTIONS=on` does nothing in production until the branch is merged.
- **Level 4 is not started.**
- **Library gaps:** no traps, almost no real cardio, no band or kettlebell equipment keys, and no time or distance logging.
- **Equipment keys need a migration:** `profiles_available_equipment_check` lists the allowed keys, so adding new ones needs a small migration.

### 2026-11-23 — R3: exercise library foundation (no new exercises; no database change)

After "Start R3". Every exercise ID is unchanged, and no exercise was added or removed.

**What changed:**
- **New `src/lib/exercise-taxonomy.ts`** holds the structured data for the library:
  - **Controlled muscles:** 20 fixed values, such as `chest`, `lats` and `rear_shoulders`. Each exercise gets `muscles`, with the main muscle first; the friendly muscle text stays for display.
  - **Other names (`aliases`):** for example "OHP", "military press", "pec deck fly", "bent-over row", "farmer's walk" and "treadmill".
  - **Variation groups (`variationGroup`):** 19 groups, such as bench press, squat and row.
- **One shared list of other names.** Rozi's separate short list in `rozi-ai/tools.ts` was removed.
  - **How they match:** a whole other name counts as a name match in search, swaps and Rozi.
  - **Ties:** when several exercises match, the one you logged or can do with your equipment still wins.
  - **One-word names:** a one-word other name must be the whole search. So "farmers walk" doesn't also find the comfortable walk.
- **Library screen:** the "Muscle group" filter now lists the 20 fixed muscles instead of about 30 overlapping texts ("Front shoulders", "Side shoulders", "Shoulders").
- **Metadata fixes:**
  - Comfortable walk and march in place now use the cardio pattern.
  - Relaxed breathing now uses the recovery pattern, so it no longer counts as core training on the recovery map.
- **New quality test `src/lib/exercise-taxonomy.test.ts`** checks that:
  - all 77 saved IDs still exist;
  - names and other names are unique;
  - every muscle text has a fixed value;
  - equipment keys and patterns are valid;
  - fallback chains don't loop;
  - variation groups are valid;
  - common other names find the right exercise.

**Behaviour changes (old vs new on 35 common phrases):**
- "OHP" and "overhead press" → Seated dumbbell press (before: the machine press).
- "leg curl" → Hamstring curl (before: Sliding leg curl).
- "treadmill" → Easy cardio and "farmers walk" → Farmer carry (before: nothing found).
- In swaps, "rdl", "pull ups", "chin up" and "pushup" are now recognised.
- Everything else is the same.

**Checked:**
- 388 tests, type check and build pass; lint shows 1 warning, in `welcome.tsx`, a file this change doesn't touch.
- In the browser (production build), the Library muscle filter shows the 20 muscles, and "Shoulders" lists the front and side shoulder exercises together.

**Not done in R3, and where it goes:**
- Band and kettlebell equipment: R4, which needs a small migration.
- Time and distance tracking: R5.
- Real cardio-machine exercises: R6.

### 2026-11-23 — R4: resistance bands and kettlebell equipment (migration applied)

After "Start R4".

**What changed:**
- **Two new equipment choices:** "Resistance bands" (`resistance_band`) and "Kettlebell" (`kettlebell`). They appear in onboarding, in Settings → Your plan and in the trainer's equipment settings. The "Large gym" preset now includes both.
- **Exercises can accept other equipment** (`equipmentAlternatives`, kept in `exercise-taxonomy.ts`). An exercise is usable with its required equipment *or* any one of its alternatives:
  - Goblet squat and Farmer carry: dumbbells or a kettlebell.
  - Pallof press: a cable machine or a band.

  The planner, swaps, Rozi and the Library equipment filter all use the same check.
- **Pictures:** the two new tiles show simple drawings (`public/equipment/v1/*.svg`) until you make the artwork. The prompts are in `docs/IMAGE_PROMPTS.md` G1.
- **Migration `supabase/migrations/20261123100000_equipment_bands_kettlebell.sql`:** widens the allowed equipment list from 15 to 17 keys in two places:
  - the `profiles_available_equipment_check` constraint;
  - `private.is_valid_trainer_rule_settings`. It is the same function body, checked byte for byte against the live one (md5), with only the key list and the limit changed.

**Dry run on the live database (rolled back):** `PASS`.
- **Accepted:** the new keys and all 17 keys together; the old keys are still accepted.
- **Refused:** an unknown key (`jump_rope`) and a repeated key.
- **Existing data:** all 5 existing profiles still pass the new constraint.
- **Permissions:** no anon/public grants on the function.
- **Afterwards:** the live constraint and function were confirmed unchanged.

**Checked:**
- 389 tests, type check and build pass; lint shows the same single old warning in `welcome.tsx`.
- New tests: a kettlebell alone unlocks goblet squat; a band alone unlocks Pallof press; a band doesn't unlock the lat pulldown; unconfirmed equipment still counts as none; the kettlebell filter lists exactly goblet squat and farmer carry.

**Applied 2026-11-23 after "Yes, apply it"** (recorded as `20261123171948 equipment_bands_kettlebell`):
- **Structure:** the constraint now allows 17 keys and has been checked against all 5 existing profiles. The function has the new keys and the 17 limit, is still security invoker with `search_path=''`, and its grants are unchanged (authenticated, postgres).
- **Security advisors:** nothing new. Only the long-standing notices remain: the closed tables, the owner-checked functions and leaked-password protection.
- **Live behaviour test (rolled back):** `PASS`. New keys and old keys are accepted; unknown and duplicate keys are refused.
- **Cleanup:** no test objects were left behind.

The database is now ready for the band/kettlebell code, so it's safe to deploy it whenever you push.

### 2026-11-23 — R5: time and distance tracking (migration applied)

After "Start R5".

**Design decision: no change to stored numbers.**
- A set has always stored one number (`actual_reps`), so a plank's "30–60 sec" was already saved as 30 and a walk's "10 min" as 10. Converting old rows would have been risky and would gain nothing.
- Instead, each exercise now says what that number means (`tracking.unit`): reps, seconds (holds), minutes (cardio) or rounds (intervals).
- `src/lib/exercise-taxonomy.ts` works the unit out from the reps text. A test checks that every workout template uses the same unit as its exercise, so each stored number keeps one meaning.
- Only **distance** is new.

**What changed:**
- **Logger:**
  - Plank / side plank / farmer carry show a **Sec** column, and their header reads "× 30 sec" (it used to read "× 30 reps"). Holds keep the weight column, for a farmer carry or a weighted plank.
  - Walk and easy cardio show **km** and **Min**, so you can log 25 min · 2.4 km. Interval cardio shows **Rounds**.
  - "Warm-up & plates" and the load/rep advice note only appear on rep exercises.
  - "Last time" reads "30, 45 sec" or "25 min · 2.4 km".
- **Stats kept honest:**
  - Timed sets never feed the estimated 1RM, volume (kg × reps) or load records. Before this, a 24 kg farmer carry held for 40 seconds counted as "24 kg × 40 reps".
  - In the weekly report, timed sets still count as sets but add no reps or volume.
  - The exercise guide's records and charts say "Longest hold", "Longest session" or "Total time" instead of "Most reps".
- **Rozi:** `get_progress` and `get_exercise_info` now include `repsAreIn` ("seconds" / "minutes" / "rounds"), so Rozi doesn't call seconds "reps".
- **Saving:** sets carry an optional `distanceKm`.
  - `upsertSets` writes `distance_km`. If the column doesn't exist yet, it saves without it, the same fallback as `set_type`.
  - Loading reads `distance_km` back.
  - Validation allows 0–1000 km.

**Migration `supabase/migrations/20261123120000_set_distance.sql`:**
- Adds `workout_set_logs.distance_km numeric(6,2)`: nullable, 0–1000.
- Replaces `save_workout_session` with the same body plus `distance_km`. Before editing, its text was confirmed identical to the live function (md5 `8abad03c…`). It stays security invoker with `search_path=''`, and its grants (authenticated, postgres, service_role) are kept.

**Dry run on the live database (rolled back):** `PASS`. It ran as a real signed-in user through RLS, on a far-future date:
- a walk saved and read back as 25 min · 2.4 km;
- the old app's payload, with no distance, still saves;
- 5000 km is refused.

Afterwards the database was unchanged: no column, the same function, 136 sets / 15 sessions, and no test rows.

**Checked:**
- 394 tests, type check and build pass; lint shows the same single old warning.
- New `src/lib/tracking.test.ts` covers: units for every exercise and template; labels; old saved copies; timed sets kept out of 1RM, volume and records; weekly totals; distance surviving a reload.
- In the browser (production build, local demo data, phone width): Burn A showed kg/Reps for lifts, kg/Sec for the plank and km/Min for easy cardio. Ticking the cardio set saved 10 min and 2.4 km.

**Applied 2026-11-23 after "Yes, apply it"** (recorded as `20261123173126 set_distance`). Just before applying, I re-checked that the live `save_workout_session` still matched the version the migration was built from.
- **Structure:**
  - `distance_km numeric(6,2)`, nullable, with its 0–1000 check. Existing rows were not touched: 136 sets, 0 with a distance.
  - The function writes `distance_km`, stays security invoker with `search_path=''`, and keeps its grants (authenticated, postgres, service_role).
  - RLS is still on.
- **Security advisors:** nothing new; only the long-standing notices.
- **Live behaviour test (rolled back), as a signed-in user:**
  - 25 min · 2.4 km saved and read back;
  - the old app's payload still saves, with no distance;
  - 5000 km is refused;
  - a different signed-in person can't see the set.
- **Cleanup:** no test rows left (still 136 sets / 15 sessions).

The database is ready for the R5 code, so it's safe to deploy whenever you push.

### 2026-11-23 — Claude Code skills set up (machine settings, not the app)

After you asked to set up three skill repositories. Each was read before install.
- **cloudflare/security-audit-skill:** a defensive security review skill. It contains instructions plus two small local validator scripts, with no hooks and no network use.
  - Installed to `~/.claude/skills/security-audit` (the test files are left out).
  - Available now as `security-audit`.
- **mattpocock/skills:** about 40 engineering skills, such as TDD, code review and spec/ticket flows. It has no hooks.
  - Enabled as `mattpocock-skills@claude-plugins-official`, which is in the official marketplace you already had.
- **DietrichGebert/ponytail:** a "lazy senior dev" plugin. Its marketplace is added and the plugin enabled in `~/.claude/settings.json`.
  - Its hooks run Node on every session start and every prompt. They turn on a "smallest change, short reply" mode, including for subagents.
  - It also writes a local cost/turn log to `~/.config/ponytail/band/`, built by reading session transcripts.
  - Its webhook stays off unless you set one.
  - To switch the mode off: "stop ponytail", or `/ponytail lite`.
- **When they load:** both plugins install and load when the app starts a new session.

### 2026-11-23 — R6 batch A: 22 upper-body exercises (no database change)

After "start R6".

**New exercises** (in `src/lib/library-additions.ts`):
- **Chest:** Machine chest press · Barbell incline bench press · Close-grip bench press · Dumbbell floor press · Knee push-up
- **Back:** Pull-up · Chin-up · Machine row · Inverted row · Resistance band row · Conventional deadlift · Dumbbell shrug
- **Shoulders:** Barbell overhead press · Pike push-up · Reverse dumbbell fly · Reverse pec deck · Resistance band pull-apart
- **Arms:** Cable biceps curl · Resistance band curl · Skull crusher · Bench dips · Dead hang

**What each one has:** steps, cues, cautions, muscles, equipment, a fallback, a body-map region, a variation group, other names and a tracking unit (the dead hang is timed).

**Rules and safety:**
- **Conventional deadlift:** locked behind trainer approval, like the RDLs, and trainers can't put it in a template.
- **Accepted alternatives:**
  - Inverted row: a rack or a Smith machine.
  - Skull crusher: an EZ bar or dumbbells.
  - Bench dips: a bench or a chair.
- **Existing plans are unchanged.** The planner fills a skipped slot with the alphabetically first free exercise. In 512 generated plans, that made one case pick bench dips for a beginner at home. New exercises are therefore never automatic fill-ins (`NOT_AUTO_PICKED`). They're offered in the library, swaps and Rozi. After the change, 0 of 512 generated plans contain a new exercise.

**Name changes:**
- "OHP" and "military press" now find the barbell overhead press, not the seated dumbbell press.
- "pull ups" / "chin ups" now find the real pull-up / chin-up, not the assisted version.
- "incline bench press" now means the barbell version.

**Checked:**
- 396 tests, type check and build pass; lint shows the same single old warning.
- New tests check: all 22 are complete; their IDs are now permanent; the deadlift stays locked; a home user with only a chair or only bands gets real options, and a home dumbbell-bench swap offers the knee push-up.
- In the browser (production build): the library lists 99 exercises. 96 show, because 3 deadlift variations are hidden until a trainer approves them. The skull crusher guide renders correctly at phone width.

### 2026-11-23 — R6 batch B: 12 lower-body and core exercises (no database change)

After "Start batch B".

**New exercises:**
- **Legs:** Walking lunge · Wall sit (timed) · Single-leg Romanian deadlift · Barbell hip thrust · Single-leg glute bridge · Single-leg calf raise
- **Core:** Crunch · Bicycle crunch · Lying leg raise · Russian twist · Wood chop (cable, band or dumbbell) · Mountain climber (timed)

**What each one has:** steps, cues, cautions, a fallback, body-map regions, a variation group and other names. The new groups are calf raise, leg raise and rotation.

**Single-leg Romanian deadlift:** it is a deadlift variation, so, like the RDLs, it is locked until your trainer approves it. Say if you'd rather the single-leg version be open to everyone.

**Name matching improved:**
- **Exact names win.** An exact name or other name now wins before any ranking. For example, "walk" stays the comfortable walk and doesn't become the walking lunge.
- **Plain words name the standard exercise:** "bench", "curl", "squat", "deadlift", "calf raise", "hip thrust".
- **Swaps stand in the closest version you can do.** If you can't do the named exercise, the swap offers the closest version you can, in the variation group's order:
  - "bench" with only dumbbells → dumbbell bench;
  - "squat" → goblet squat;
  - "ohp" → seated dumbbell press;
  - "leg curl" with no machine → sliding leg curl.
- **If none fits,** the swap still names the exercise you asked for, so it can explain why.

**Generated plans still unchanged:** 0 of 512 test plans contain a new exercise.

**Checked:**
- 397 tests, type check and build pass; lint shows the same single old warning.
- A 35-phrase lookup comparison against the original code: every change is an improvement listed above.
- In the browser: the library has 111 exercises; 107 show, because 4 deadlift variations are hidden until a trainer approves them. The Mountain climber guide renders correctly at phone width: 3 × 20–30 sec, with core, shoulders and quads on the body map.

### 2026-11-24 — Model routing rules (AGENTS.md) and helper agents

You noticed small tasks still ran on Opus and asked for written routing rules.

**What changed:**
- **`AGENTS.md`:** a "Model routing" section, added below the Next.js-managed block (`next dev` only rewrites its own block). It sets out:
  - Opus 5.5 is the main model and decides the routing.
  - The three tiers.
  - A five-step decision order: critical → depends on this conversation → tiny → can be fully briefed → when in doubt go up a tier.
  - Delegation rules: written briefs, Opus reviews every helper diff, and helpers never commit, run migrations, touch secrets or edit security code.
  - A one-line "who did what" in each wrap-up.
- **`CLAUDE.md`:** new, with one line, `@AGENTS.md`, so every Claude Code session in this repo loads the rules.
- **`.claude/agents/`:** three helper definitions:
  - `builder` (Sonnet): implementation from a written brief;
  - `quick-helper` (Haiku): searches and small mechanical work;
  - `checker` (Haiku): runs tests, type check, lint and build, and returns a 4-line summary.
- **Loading:** they load in new sessions. This session used the general helper with the same models and rules.

**Note:** a session can't switch its own model mid-conversation. "Routing" means giving self-contained pieces to cheaper helper agents; the main conversation stays on Opus.

### 2026-11-24 — R6 batch C: 16 cardio and home-conditioning exercises (no database change) — R6 complete

After "start batch C". This was the first batch run under the new routing rules:
- **Sonnet (builder):** wrote the 16 entries from a field-by-field spec.
- **Opus:** did the shared wiring (names, distance tracking, groups, body map, tests), reviewed the builder's diff and wrote these docs.
- **Haiku (checker):** ran the checks.

**New exercises:**
- **Machines (minutes + km):** Treadmill walk · Stationary bike · Elliptical · Rowing machine
- **Outdoor (minutes + km):** Brisk walk · Jog · Run · Cycling
- **Home:**
  - timed: Jumping jack · Low-impact jumping jack · Step touch · High knees · Jump rope;
  - reps: Jump squat · Burpee · Kettlebell swing (kettlebell or dumbbell).

**Details:**
- **Low-impact options:** each high-impact move names its low-impact option in its first caution.
- **Equipment:** the machines need the "Cardio machines" equipment tick; everything at home needs nothing.
- **Other names:** "treadmill", "elliptical" and "stationary bike" used to be other names for the generic Easy cardio. They now point to their own exercises.
- **Variation groups:** walk/run, cycle, machine cardio, low-impact cardio, plyometric.

**R6 totals:** 50 exercises added (22 + 12 + 16). The library has 127 exercises; 123 show, because 4 deadlift variations are hidden until a trainer approves them.

**Checked:**
- 398 tests, type check and build pass; lint shows the same single old warning.
- Generated plans are still unchanged: 0 of 512 contain a new exercise.
- In the browser, all 16 appear in the library.

### 2026-11-24 — R7: Rozi understands exercise variations (no database change)

After "Start R7". This is Rozi tool code, so per `AGENTS.md` it stayed on Opus. The Haiku checker ran type check, lint and build.

**What changed:**
- **New `src/lib/exercise-variations.ts`:** `variationsOf(exercise, profile)` lists the other versions of the same movement, closest first. `compareVariation(a, b)` gives plain facts about how one differs from another:
  - a curated note;
  - main muscle;
  - equipment added or removed;
  - difficulty;
  - one side or both;
  - timed or reps;
  - trainer approval.
- **`VARIATION_NOTES`** (in `exercise-taxonomy.ts`): 24 one-line facts the data can't express, such as grip, pace and range. Examples: "inclined bench: more upper chest", "palms facing you: more biceps", "jogging pace, more impact".
- **Rozi:** `get_exercise_info` returns `variations` (up to 6), with `youCanDoIt` and `differences`. The tool description tells Rozi to use it for "difference between" and "easier/harder version" questions.
- **Swaps and the exercise guide:** versions of the same movement now rank first in the alternatives, after the exercise's own fallback.

**Example** (dumbbell bench, with dumbbells and a bench):
- Incline dumbbell press — "inclined bench: more upper chest" ✓ you can do it.
- Dumbbell floor press — "shorter range, easy on the shoulders; no bench needed" ✓.
- Barbell bench press — "needs barbell / EZ bar; harder (intermediate)" ✗.

**Checked:**
- 403 tests pass, including the new `src/lib/exercise-variations.test.ts`.
- Generated plans are unchanged (0 of 512 differ); the planner doesn't use these lists.
- **Not checked live:** a real Rozi conversation. It needs the deployed AI server.

### 2026-11-24 — R8: Rozi goals with a weekly plan (migration applied; flag off)

After "Start R8". The design is in `docs/ROZI_AGENT_ARCHITECTURE.md` §7.

**Who did what:**
- **Opus:** the design, the migration and dry run, the plan templates and safety limits, the goal service, the API routes, the chat wiring, the tests and the review.
- **Sonnet (builder):** the goal card UI. Opus reviewed it and corrected one line, which promised weekly progress checks before they exist.
- **Haiku (checker):** the checks.

**What it does:**
- **Proposing:** say "help me lose 4 kg", "I want to bench 60 kg" or "make me train 4 times a week". Rozi calls `propose_goal_plan`. RozFit builds a 4–12 week plan from your own data using fixed templates; the model only passes the numbers you gave.
- **Safety limits** (refused with a reason and, where possible, a safer suggestion):
  - **Consistency:** 2–6 workouts a week, never more than your training days. It starts at your recent average + 1, then adds one every two weeks.
  - **Weight loss:**
    - needs a weight logged in the last 30 days and your height;
    - at most 1% of body weight a week;
    - never below BMI 18.5;
    - over 12 weeks → it suggests a smaller first goal.
  - **Weight gain:** at most 0.5% a week.
  - **Strength:**
    - starts from your best logged working set (rep exercises only);
    - up to +2.5% a week and +20% overall;
    - weeks 4 and 8 hold the weight;
    - deadlift variations need trainer approval.
- **The card** shows the plan week by week, with **Approve plan** and **Not now**, then Pause, Resume and Stop goal. Approving replaces any current goal.

**Database** (`supabase/migrations/20261124100000_rozi_goals.sql`):
- **`rozi_goals` is closed:** row-level security is on, with no policies and no grants.
- **Functions:**
  - `rozi_propose_goal`: service role only. Expires after 30 minutes; at most 3 waiting; the same plan returns the same row.
  - `rozi_approve_goal(id, hash)`: owner only, hash-bound, single use. It holds a per-person lock and replaces the live goal.
  - `rozi_set_goal_status(id, reject | pause | resume | cancel)`: allowed transitions only.
  - `rozi_my_goals`.
- **One live goal per person**, enforced by a unique index.

**Dry run on the live database (rolled back):** `PASS 24 checks`, signed in as real users.
- Another person can't approve, cancel or see your goal.
- A wrong plan hash is refused; a second approve does nothing.
- The table can't be read directly, and only the server can propose.
- Only the allowed status changes work; a new goal replaces the old one.
- The 4th waiting proposal is refused; anon can't call anything.
- Afterwards: no table and no functions left.

**Checked:** 411 tests, including 8 new planning tests.

**Not checked live:** the card inside a real Rozi chat. It needs the migration, `ROZI_GOALS=on` and a deploy.

**Applied 2026-11-24 after "Yes, apply it"** (recorded as `20261124080532 rozi_goals`).
- **Structure:**
  - Row-level security is on, with 0 policies and no table grants for anon or authenticated.
  - There are 3 indexes, including one live goal per person.
  - The three functions people can call (approve, set status, list goals) are security definer with `search_path=''`, callable by authenticated users.
  - `rozi_propose_goal` is service-role only.
- **Security advisors:** only the expected kinds of notice, the same as for `rozi_actions`: a closed table, and owner-checked functions that signed-in users can call. `rozi_propose_goal` is not listed, as intended.
- **Live behaviour test (rolled back):** `PASS 9 checks`.
  - Another person can't approve it.
  - The table can't be read directly, and a user can't propose.
  - A wrong hash is refused.
  - The owner can approve, pause and cancel it, and it appears in their list.
- **Cleanup:** 0 goal rows left.

**To use it:**
1. Commit and push.
2. Set `ROZI_GOALS=on` in Vercel and deploy.
3. Ask Rozi for a goal.

### 2026-11-24 — R9: goal progress and replanning (migration applied; flag off)

After "Start R9". The design is in `docs/ROZI_AGENT_ARCHITECTURE.md` §8.

**Who did what:**
- **Opus:** the monitor, the replan rules, the Rozi tool, the wiring, the migration and dry run, the tests and the review.
- **Sonnet (builder):** the progress card. Opus reviewed it: read-only, no network calls, existing colour variables.
- **Haiku (checker):** the checks.

**What it does:**
- **Asking about a goal:** "How's my goal going?" makes Rozi call `get_goal_progress`. Each week is compared with its target:
  - workouts done that week;
  - the last weigh-in that week, ±0.3 kg;
  - the best working set that week.
- **The card** marks each week met ✓ / missed ✗ / no log / this week / upcoming, with an overall On track, Ahead, Behind, Paused or Plan finished.
- **Behind** means the last two finished weeks missed their target. Rozi then offers a gentler plan built from what you actually managed:
  - **workouts:** the target drops to what you managed + 1, or the same target over more weeks;
  - **weight and strength:** the same target over more weeks, from where you are now.

  Only if you agree does it propose the new plan, which you approve on the usual card. Nothing changes on its own.
- **Finished plans** show as completed, and Rozi can still sum them up for 14 days after they end.

**Migration** `supabase/migrations/20261124120000_rozi_goals_completion.sql`:
- `create or replace` of two functions, `rozi_approve_goal` and `rozi_my_goals`. Before editing, both were confirmed identical to the live versions (md5).
- `rozi_my_goals` shows a plan past its end date as `completed`.
- `rozi_approve_goal` records a finished goal as `completed` instead of `replaced` when a new one is approved.
- No table changes.

**Dry run on the live database (rolled back):** `PASS 6 checks`, run as a real user.
- A finished plan shows completed and is stored as completed when a new goal is approved.
- An unfinished one is still replaced.
- There is exactly one active goal, and no anon/public grants.
- Afterwards: live functions unchanged and 0 rows.

**Checked:** 416 tests, including 5 new progress tests.

**Applied 2026-11-24 after "Yes, apply it"** (recorded as `20261124081107 rozi_goals_completion`). Just before applying, I re-checked that both live functions still matched what the migration was built from.
- **Structure:** both functions are still security definer with `search_path=''` and the same grants (authenticated, service_role); both include the completion rule.
- **Security advisors:** unchanged from after R8, with the same counts. Nothing new.
- **Live behaviour test (rolled back):** `PASS 4 checks`.
  - A finished plan shows completed and is stored as completed when a new goal is approved.
  - Another person can't see the goals or approve them.
- **Cleanup:** 0 goal rows left.

**Not checked live:** the cards inside a real Rozi chat. That needs `ROZI_GOALS=on` and a deploy.

### 2026-11-24 — R10: memory you control (built; migration applied; flag off)

After "start R10". The design is in `docs/ROZI_AGENT_ARCHITECTURE.md` §9.

**Who did what:**
- **Opus:** the design, the migration and dry run, the checks on notes, the server code (`src/lib/rozi-ai/memory/memory-service.ts`), the API routes, the chat wiring, the tests and the review.
- **Sonnet (builder):** the "Remember this?" card and the Settings list.
- **Haiku (checker):** the checks.

**What it does:**
- **Saving a note:** you tell Rozi something lasting, like "my left knee hurts on lunges". Rozi may suggest remembering it on a card. **Only your tap on Save stores it**, through your own sign-in; Rozi itself can't store anything.
- **Refused notes:**
  - contact details (email, phone) or links;
  - things your profile already holds (goal, days, equipment, height, weight);
  - duplicates;
  - more than 30 notes.
- **How Rozi uses notes:** your notes go into Rozi's instructions on every question, up to 20 notes and 1,500 characters, so its advice respects them. For example, it avoids lunges.
- **Settings → What Rozi remembers:** every note, with Edit and Delete. Delete really deletes. Notes are deleted with your account.
- **The flag:** `ROZI_MEMORY=on` (off by default).

**Migration** `supabase/migrations/20261124140000_rozi_memories.sql`:
- **`rozi_memories` is closed:** row-level security is on, with no policies and no grants.
- **Owner functions only:** `rozi_my_memories`, `rozi_save_memory` (trimmed, case-insensitive duplicate check, max 30 under a per-person lock), `rozi_update_memory`, `rozi_delete_memory`.
- **No service-role access** is needed.

**Dry run on the live database (rolled back):** `PASS 12 checks`, signed in as real users.
- A note is trimmed, and a duplicate returns the same note.
- A bad kind or a too-short note is refused.
- The table can't be read directly.
- The owner can edit and delete a note; another person can't see, edit or delete it.
- The 31st note is refused, and anon can't call anything.
- Afterwards: no table and no functions left.

**Checked:**
- 421 tests (5 new memory tests), type check and build pass; both `/api/rozi/memories` routes built.
- Lint shows the same single old warning.
- The Settings section hides itself when memory is off.

**Not checked live:** the card and the Settings list in a signed-in browser. That needs `ROZI_MEMORY=on` and a deploy.

**Applied 2026-11-24** after "Yes, apply it" (recorded as `20261124082003 rozi_memories`). Opus did the apply and every check below.
- **Structure:** row-level security on, 0 policies, 0 table grants, 3 indexes. The four `rozi_*_memory` functions are security definer with an empty `search_path`, callable by signed-in users only. `private.rozi_memory_json` has no grants.
- **Live behaviour test (rolled back):** `PASS 8 checks`. Save, duplicate returns the same note, the table can't be read directly, update, another person can't see or delete it, the owner's delete leaves 0 notes, anon is refused. 0 rows left afterwards.
  - The first run reported "FAIL delete". That was the test, not the function: the delete and the count ran in one statement, so the count still saw the old row. Run as separate statements, it passed.
- **Security advisors:** the only new items are the expected ones: `rozi_memories` "RLS enabled, no policy" (INFO, closed on purpose) and the four memory functions "signed-in users can execute" (WARN, on purpose; each checks the owner). Leaked-password protection is still off (old item, a dashboard setting).
- **To turn it on:** set `ROZI_MEMORY=on` in Vercel (Production and Preview) and redeploy after pushing.

### 2026-11-24 — R11: weekly check-ins you opt into (built; migration applied; flag off)

After "start R11". The design is in `docs/ROZI_AGENT_ARCHITECTURE.md` §10.

**Who did what:**
- **Opus:** the design, the migration and dry run, the server code (`src/lib/rozi-ai/checkins/`), the API route, the hourly-push wiring, the tests and the review.
- **Sonnet (builder):** the Settings card and its hook.
- **Haiku (checker):** the checks.

**What it does:**
- **Opt-in, off by default:** Settings → Your data → "Weekly check-in with Rozi". A switch, a day and an hour (05:00–21:00, your time zone). Switching on records when you agreed; switching off clears it.
- **One notification a week** with counts only, for example "2 workouts done of 3 planned". Tapping it opens that week's "Your week with Rozi" (`/report?week=…`).
- **Which week:** Sunday sends the week ending that day. Any other day sends the last full week.
- **No AI and no stored summary:** the existing hourly push schedule counts the workouts it already loads. The AI runs only if you then ask Rozi about your week.
- **Never twice:** the server claims each week once with `rozi_mark_checkin_sent`. A missed hour still sends within 3 hours.
- **Needs notifications on a phone;** without one nothing is sent.
- **The flag:** `ROZI_CHECKINS=on` (off by default). Off: the card is hidden and nothing is sent.

**Migration** `supabase/migrations/20261124160000_rozi_checkins.sql`:
- **`rozi_checkin_settings` is closed:** row-level security on, no policies, no grants. Deleted with the account.
- **Your functions:** `rozi_my_checkin_settings`, `rozi_set_checkin_settings` (checks the day and hour).
- **Server only (service role):** `rozi_checkin_people`, `rozi_mark_checkin_sent`.

**Dry run on the live database (rolled back):** `PASS 15 checks`, signed in as real users.
- Defaults are off, Monday, 09:00. Switching on records the consent time; switching off clears it.
- A bad day or hour is refused. The table can't be read directly.
- A signed-in person can't list who opted in or mark a week sent; another person doesn't see your choice; anon is refused.
- The server lists opted-in people, claims a week once (the second claim is refused), and can't claim for someone who isn't opted in or switched off.
- Afterwards: no table and no functions left.

**Code changed:** `app/api/push/hourly/route.ts` (one call after the existing reminders, only when the flag is on), `src/lib/notifications.ts` (new message kind `checkin`), `settings-screen.tsx` (card placed after the memory card; search keywords).

**Checked:**
- 425 tests (4 new check-in tests), type check and build pass; `/api/rozi/checkins` built.
- Lint shows the same single old warning (`welcome.tsx:400`).

**Not checked live:** the card in a signed-in browser and a real weekly notification. That needs `ROZI_CHECKINS=on` and a deploy.

**Applied 2026-11-24** after "Yes, apply it" (recorded as `20261124083201 rozi_checkins`). Opus did the apply and every check below.
- **Structure:** row-level security on, 0 policies, 0 table grants. All four functions are security definer with an empty `search_path`. `rozi_my_checkin_settings` and `rozi_set_checkin_settings`: signed-in users only. `rozi_checkin_people` and `rozi_mark_checkin_sent`: service role only (not signed-in users, not anon).
- **Live behaviour test (rolled back):** `PASS 9 checks`. Switching on records consent, a bad hour is refused, no direct reads, a signed-in person can't list who opted in, another person doesn't see your choice, the server lists you and claims a week once (the second claim is refused), anon is refused. 0 rows left afterwards.
- **Security advisors:** the only new items are the expected ones: `rozi_checkin_settings` "RLS enabled, no policy" (INFO, closed on purpose) and the two person functions "signed-in users can execute" (WARN, on purpose; each acts only on your own row). The two server functions are not flagged. Leaked-password protection is still off (old item, a dashboard setting).
- **To turn it on:** set `ROZI_CHECKINS=on` in Vercel (Production and Preview) and redeploy after pushing.

### 2026-11-24 — R12: plateaus, post-workout recap, plain "why this workout" (built; no migration, no flag)

After "Start R12". The design is in `docs/ROZI_AGENT_ARCHITECTURE.md` §11.

**Who did what:**
- **Opus:** the design and `src/lib/insights.ts` (`findPlateaus`, `workoutRecap`, `explainWorkout`), `exerciseGroups` in `recovery.ts`, the Rozi tool wiring (`get_workout_for_day`, `get_progress`; still 14 tools), the tests, and the review of every change.
- **Sonnet (builder):** the Today "Why this workout" list, the recap on the post-workout celebration, and the "Stalled for N weeks" note on exercise stats.

**What it does:**
- **Plateau:** 3+ sessions over 10+ days in the last 3 weeks, none beating the earlier best estimated 1-rep max, and still trained in the last 14 days. Rozi suggests the closest usable variation for 3 weeks, then going back. Swapped sets and sample data don't count.
- **Recap:** new bests, each lift compared with last time, and any stalled lift.
- **Why this workout:** up to 5 plain sentences (goal and week, lighter weeks, muscles and recovery, the planner's reasons about you, a stalled lift). The planner's internal notes stay one tap deeper.

**Fixed during the build:** an old saved log without `substitutionName` broke the tool (now tolerated), and saved plans without their own date broke the recovery check (the day's date is now passed in).

**Checked:** 429 tests pass (4 new), the type check and the build pass, and lint shows only the same old warning (`welcome.tsx:400`).

**Not checked:** the screens in a browser.

### 2026-11-24 — R13: security review and final validation (code fixes in; lock migration applied; staging pass waiting)

After "Start R13". The full report is `docs/ROZI_R13_SECURITY_REVIEW.md`. Opus did the whole review; no helpers, since it is security work.

**Checked on the live database (read-only or rolled back):**
- All 6 Rozi tables are closed: RLS on, no policies, no client grants.
- All 27 Rozi functions have an empty `search_path`. None are callable by anon. The server-only ones are blocked for signed-in users.
- Security advisors: only the expected items.

**Fixed in code:**
- **Memory:** instruction-like notes are refused, and notes reach the model quoted, under a heading that says they're information only.
- **Goals:** the model's "why" becomes plain card text (one line, at most 200 characters, dropped if it holds contact details, links or instruction-like text).
- **Shared helpers** in `privacy.ts`: `looksLikeInstructions` and `plainCardText`.

**Migration** `supabase/migrations/20261124180000_rozi_propose_locks.sql`:
- Adds a per-person lock to `rozi_propose_action` and `rozi_propose_goal`, so parallel questions can't go over the waiting-proposal caps or record the same plan twice.
- **Dry run (rolled back):** `PASS 5 checks`; the live functions are unchanged.

**Checked:**
- 431 tests pass (2 new: memory injection, goal reason).
- Type check passes.
- Lint on the Rozi code is clean.

**Applied 2026-11-24** after "Yes, apply it" (recorded as `20261124125324 rozi_propose_locks`). Opus did the apply and every check below.
- **Structure:** both functions hold the lock and are security definer with an empty `search_path`. Grants are unchanged: service role only, not signed-in users or anon.
- **Live behaviour test (rolled back):** `PASS 4 checks` (structure, grants, action idempotency, same goal plan not recorded twice). 0 test rows left.
- **Security advisors:** unchanged (the same 23 INFO and 83 WARN items). The proposal functions aren't flagged.

**Not done (needs a deploy):** preview deploy and staging pass with both providers and live reply times.

### 2026-11-24 — CI fix: type check failed on `RouteContext`

**What failed:** GitHub Actions "Test, typecheck, lint, build" failed at `npm run typecheck`. Three routes used `TS2304: Cannot find name 'RouteContext'`: `app/api/rozi/actions/[id]`, `goals/[id]` and `memories/[id]`.

**Why:** `RouteContext` is a global type that Next.js generates into `.next/` during `next dev` or `next build`. CI runs the type check before the build, so the type doesn't exist yet. Locally it passed because `.next/` was already there.

**Fix:** the three routes now type their second argument directly as `{ params: Promise<{ id: string }> }`, so the type check doesn't depend on generated files. Behaviour is unchanged.

**Checked:** the type check passes with `.next/` moved aside (as in CI), the build passes, and lint on `app/api/rozi` is clean.

### 2026-11-24 — UI review and redesign plan (plan only; no app code changed)

After "review complete UI design … design the plan complete UI step by step". The full plan is `docs/UI_REDESIGN_PLAN.md`.

**How:** I walked every main screen at 375 px (light and dark) as a new user, measured `app/globals.css`, and read impeccable.style, getdesign.md and ui.watermelon.sh. Opus did the review; a web-fetch helper summarised the three sites.

**Main findings:**
- **No single design system:** 35 font sizes, 28 radii, about 370 raw colours, 99 shadows and 72 `!important` overrides.
- **Repeated entry points:** the avatar is in both the top bar and the dock; the Profile menu repeats the dock; progress and social are each split across 5–6 pages.
- **Weak hierarchy:** Start workout is below the fold on Home; Train's first screen is four body pictures.
- **A long first run:** install sheet, 3 slides, 21 questions and a 7-card tour.

**Plan:** 9 phases (foundation, navigation, Today, workout mode, Progress, Together, Workouts and Rozi, onboarding, polish), each shippable on its own with screenshots and checks.

**Waiting for you:** the 3 decisions in §7 of the plan.

### 2026-11-24 — Redesign mockup (clickable; no app code changed)

After "Yes, mockup first". A private, clickable phone mockup: https://claude.ai/artifact/7cTxGV7mMkhBzr4u7rhRi2

**What it shows:**
- the new Today screen (one workout card, one Start button above the fold, the week shown once, a compact recovery row);
- the new dock: Today · Workouts · Rozi · Progress · Together;
- the You sheet opened from the avatar;
- empty states for Workouts, Progress and Together;
- the Rozi chat;
- the focused workout mode (one move at a time, tick a set to start a 60-second rest ring) and the finish recap.

It uses the Phase 1 tokens from `docs/UI_REDESIGN_PLAN.md` and Rozi's real face images. Opus built it.

### 2026-11-24 — UI redesign Phase 1: foundation (design system; dark premium default)

After "Start Phase 1". The source of truth is now `docs/DESIGN.md`; the plan is `docs/UI_REDESIGN_PLAN.md`.

**Who did what:**
- **Opus:** `DESIGN.md`, the tokens and the dark palette, the font-size, radius and colour migration, the guard test, the dark-mode fixes and the browser check.
- **Sonnet (builder):** the UI kit components and their CSS.

**What changed:**
- **Tokens** (top of `app/globals.css`):
  - 11 text sizes (`--text-2xs` … `--text-5xl`) and 7 spacing steps (`--space-1` … `--space-7`);
  - 6 radii (`--radius-xs` … `--radius-pill`);
  - 3 shadows and motion timings (`--dur-fast/med/slow`, `--ease`);
  - water colours (`--water`, `--water-soft`).
- **Dark premium is the default** for anyone who hasn't chosen a theme:
  - ink `#0B0F12` with orange and teal glows;
  - frosted glass cards;
  - an orange gradient primary button with dark text;
  - mint for recovery;
  - the browser and app theme colours are dark.
  - Light stays in Settings → Appearance, and saved choices are kept.
  - Changed in `app/layout.tsx` (the before-paint script and themeColor), `fit-track-provider.tsx` (default theme and meta colour) and `app/manifest.ts`.
- **Migration:**
  - All 776 font sizes now use the 11 text tokens (each within ±2 px of before). Only the 4 giant display words (54–72 px) stay raw, as documented exceptions.
  - All 365 single-value radii now use the 6 radius tokens.
  - 32 dead colour fallbacks were removed, and the bare brand orange and teal now use `--accent` and `--tint` (48 colour values in all).
  - The rest of the raw colours are fixed screen by screen in later phases.
- **UI kit** (`src/components/ui/`): `Button` and `ButtonLink`, `Card`, `PageHeader`, `ListRow`, `Segmented`, `Stat`, `Chip`, with a tokens-only CSS block at the end of `globals.css`. Screens adopt these from Phase 2.
- **Guard** (`src/lib/design-guard.test.ts`, in `npm test`) fails when:
  - a raw font size or single-value radius appears;
  - a `var()` points at an undefined token;
  - the raw colours go above the ceiling (476 now; it only goes down).
- **Dark-mode fixes found in the browser:** the Library tile titles and the "N moves" line were hard-coded dark ink, almost invisible on dark glass. They now use `--ink`, `--muted` and an orange selected edge.

**Checked:**
- 435 tests pass (4 new guard tests).
- Type check and build pass.
- Lint shows the same single old warning.
- In the browser at 375 px, dark: Home, Train, Library, Progress, Profile and Settings render correctly. Layouts are unchanged by design.

**Not checked:** every secondary screen in dark mode (chats, feed, buddies, clients, routines, mobility, report, streak, recovery). These are reviewed as each is rebuilt in Phases 3–7. Phase 2 is navigation and the shell.

### 2026-11-24 — UI redesign Phase 2: navigation and shell

After "Start Phase 2". Opus did all of it: the shell, Profile, Settings and the new links. No helpers, since the shell ties into everything.

**What changed:**
- **The dock** (`app-shell.tsx`): Today · Workouts · **Rozi** (raised in the centre, inside the pill) · Progress · Together.
  - Each tab also lights up for its own pages:
    - Today: `/today`;
    - Workouts: `/routines`, `/mobility`;
    - Progress: `/streak`, `/recovery`, `/report`;
    - Together: chats, feed, discover, buddies, people, clients, join.
  - The unread-chat dot moved to Together.
  - Still as before: the dock hides in Rozi chat and in workout mode, and shrinks while scrolling down. The sliding glass highlight and drag-to-switch keep working (same `.dock-pill > a` structure).
- **Top bar:**
  - the chat icon is gone (Chats lives in Together);
  - your picture opens Profile and is hidden on Profile and Settings;
  - pages one level down get a ← back button to their parent (for example Settings → Profile, Streak → Progress, Chat → Chats);
  - page titles come from one table.
- **Desktop sidebar:** the same four tabs, plus Ask Rozi and Profile.
- **Footer removed** ("Rules …" is still in Settings → About this plan).
- **Profile:** the list of 10 links that repeated the dock is gone. ☰ (top right) opens Settings.
- **Settings:**
  - the repeated picture and name are gone; the sync status stays as a slim card;
  - the "Your profile" and "Ask Rozi" rows are removed.
- **New homes for pages that only Profile linked to** (using the new UI kit `Card` + `ListRow`):
  - Progress → Streak calendar, Recovery map, Your week with Rozi;
  - Workouts → My routines.
- **Old URLs:** every old URL still works.

**Checked:**
- 435 tests pass, type check and build pass, and lint shows the same single old warning.
- In the browser at 375 px (dark), all correct:
  - Today with the new dock;
  - Workouts with the tab active and the My routines row;
  - Progress with the new links;
  - Profile with ☰ and no repeated picture;
  - Settings with the back button and the sync card (fixed: its old layout squeezed the text);
  - Rozi chat with the dock hidden.

**Not checked:** the desktop sidebar in a wide window, and signed-in social pages (the Together tab highlight on chats and feed).

### 2026-11-24 — UI redesign Phase 3: the new Today screen

After "Start Phase 3". Opus did all of it: the screen, the styles, the Rozi mood fix and the browser checks.

**What changed** (`src/components/screens/overview-screen.tsx`, a "Today, Phase 3" CSS block):
- **Header:** the date, "Good evening, Asha", Sign in (demo only) and your picture, which opens Profile.
- **One hero card, first on screen:**
  - Rozi's scene for the moment (evening training with the gym bag, rest-day reading, and so on);
  - the tag (Today's workout / In progress / Done today / Recovery today);
  - the workout title, "40 min · 5 moves · 10 sets", and Rozi's line;
  - the target muscles as chips;
  - **one** big Start / Continue / View button;
  - the streak chip when there is a streak.
  - Rest day: "Rest is part of the plan", the next session date, then "Train today anyway" and "See next session".
- **Cards that only show when they matter** (unchanged components): live session, weigh-in due, buddy, trainer, nudges.
- **Water** stays.
- **"This week" shown once:** the week strip, with "N of M done" linking to Progress. It replaces the separate ring card.
- **Recovery as one row** ("Fresh start" / "5 of 6 muscle groups ready" plus Rozi's one-line advice), linking to the Recovery map. It replaces the large 3-ring carousel.
- **Removed from Today:**
  - the giant "Day N" word;
  - "Today's thought";
  - the duplicate goal ring;
  - "Recent workouts" (your history is in Progress).
- **Rozi on day 1** (`src/lib/rozi.ts`):
  - The worried "Still time today!" face now appears only when there is a real streak to keep. A brand-new person in the evening gets the friendly training Rozi.
  - New test: `rozi.test.ts`.
  - The header greeting isn't repeated in Rozi's line.

**Checked:**
- 436 tests pass, type check and build pass, and lint shows the same single old warning.
- In the browser at 375 px (dark):
  - the training day (Start above the fold, Rozi with the gym bag, water, the week once, the recovery row, the dock shrinking on scroll);
  - the rest day (rest Rozi, next session, Train anyway).
- **Fixed during the check:**
  - Rozi's line ran under his picture;
  - the recovery row stacked vertically (the UI kit's `display: block` won).

**Not checked:** the in-progress and done states in the browser. They use the same card with a different tag and button text, and need a logged workout to see.

**Known edge (also in the old Home):** if a workout was saved for today and the training days then change so today isn't one, the card shows the workout while Rozi says it's a rest day.

### 2026-11-24 — UI redesign Phase 4: workout mode

After "Start Phase 4". Opus did all of it. Only the presentation changed: starting, logging, saving, rest and review logic are untouched.

**What changed:**
- **Focus bar while you train** (`today-screen.tsx`):
  - × leaves the workout (it stays saved; Today shows "Continue workout");
  - the workout name, "N of M sets · Saved as you go" and a progress bar;
  - a rest-timer toggle.
  - The shell's top bar and the big Train header hide in workout mode (`body.workout-mode .topbar`).
- **Sets first** (`exercise-log-card.tsx`): name → last time → the set rows → Add set / Warm-up & plates / Swap. "How to do it" and the long load-guidance text moved into one "How to do it & tips" fold under the sets. Now a whole exercise, with Previous / Next, fits on one phone screen.
- **The plan before you start:**
  - one compact "Today's targets" card (chips, time · moves · sets, one body figure) instead of four large body pictures;
  - the warm-up card offered **before** the exercise list;
  - one full-width Start button (no round floating button that changed on scroll).
- **The rest bar:**
  - its Skip button uses the action colour instead of an off-palette blue;
  - the page leaves room so Previous / Next can always scroll above the bar.
- **One selection style everywhere:**
  - selected chips, toggles, scales, onboarding options and the sliding highlight use the action colour (orange glow in dark, ink in light) instead of teal;
  - teal/mint now only means recovery and done sets, as DESIGN.md says.
- **Colours:** the raw-colour ceiling dropped from 476 to 463.

**Checked:**
- 436 tests pass, type check and build pass, and lint shows the same single old warning.
- A full workout in the browser at 375 px (dark):
  - plan → check-in → begin;
  - tick a set (mint row, progress bar, rest ring with −10 / +10 / Skip);
  - jump to the last exercise → Finish and review → Save;
  - the celebration ("A streak is born!", the week ticked, moves / sets / minutes, the R12 recap line).
- The orange selected chip in the Library.
- Note: the test workout is saved in this browser's demo data only.

**Not checked:**
- the "Show all exercises" view;
- editing a saved session;
- the done card under the celebration;
- the light theme's new selection colour.

### 2026-11-24 — UI redesign Phase 5: the Progress hub

After "Start Phase 5". Opus did all of it. Every calculation is unchanged; only the order and presentation changed (`progress-screen.tsx`, a "Progress, Phase 5" CSS block).

**The new order** (one scroll, with small section headings):
1. **This week:** Rozi with his report card, the week's headline from `weeklyReport` (for example "Every planned workout done. Brilliant week!"), "N of M workouts · sets · new records", and "Your week with Rozi".
2. **Consistency:** the three numbers, the 4-week calendar, and the Streak calendar link.
3. **Strength:** **Stalled lifts** (new, from R12 `findPlateaus`: no gain for 3+ weeks, with the variation to try; only shown when there is one), exercise charts and personal records.
4. **Body:** BMI and body weight side by side. Before, they were far apart, near the top and near the bottom.
5. **Level and badges:** the level panel, then badges. Earned badges come first with the two closest to earning; the rest fold under "N more to earn" instead of a wall of locks.
6. **Recovery:** check-in patterns and missed workouts side by side, plus the Recovery map link.
7. **History**, then "How these numbers are worked out".

The Phase 2 links card was split up: the Week link went into the story, Streak into Consistency, and Recovery map into Recovery.

**Checked:**
- 436 tests pass, type check and build pass, and lint shows the same single old warning.
- In the browser at 375 px (dark), using the saved test workout: the story hero, Consistency, Strength (chart and records), Body together, the level panel, and Badges (earned first, the rest folded).
- **Fixed during the check:** "1 sets" in the story line, and the story button's text wrapping.

**Not checked:** the Stalled lifts card in the browser (it needs weeks of logged lifts; its logic is covered by `insights.test.ts`), and the light theme.

### 2026-11-24 — UI redesign Phase 6: the Together hub

After "Start Phase 6". Opus did all of it. No social logic changed.

**What changed:**
- **New `src/components/app/together-tabs.tsx`:** one row of tabs (Friends · Feed · Chats · Buddies) at the top of `/friends`, `/feed`, `/chats` and `/buddies`, added in each page file so it shows in every state (signed out, loading, error).
  - The active tab uses the sliding orange highlight.
  - The Chats tab shows the unread count.
  - The Together dock tab stays lit on all four pages.
- **The Friends hub tiles:**
  - Chats and Feed are gone (they're tabs now);
  - Train together only shows when an invite is waiting;
  - Find friends stays, with its request count.
  - The Friends screen no longer opens its own chat subscription; the tabs own it.
- **Back buttons:** Feed, Chats and Train together no longer get one (they're tabs). Find friends, Clients, people's profiles and a single chat still do.
- **Naming:** the fourth tab is called "Buddies", so it isn't "Together" inside Together. Its page title stays "Train together".

**Checked:**
- 436 tests pass, type check and build pass, and lint shows the same single old warning.
- In the browser at 375 px (dark), signed out: Friends and Feed, each with the tabs and the right tab highlighted.

**Not checked:** the signed-in social pages (friend list, feed posts, chats with the unread badge, buddies). The demo account can't open them, and I don't sign in to your accounts. Please check these after deploying.

### 2026-11-24 — UI redesign Phase 7: Workouts and Rozi chat

After "Start Phase 7". Opus did all of it. Rozi's answers, actions and the library filters are unchanged.

**Workouts** (`library-screen.tsx`):
- The mascot tiles stay as they were (you asked to keep them). They already match the mockup size (about 104 px tall with 78 px mascots).
- The A–Z letter rail now appears only once the exercise list reaches the middle of the screen (an IntersectionObserver). Before, it floated over the tiles from the top of the page.
- Mobility and My routines are already part of this tab (Phase 2).

**Rozi chat** (`rozi-chat-screen.tsx`):
- **One header row:** ← back, "Ask Rozi" and (with Rozi AI on) History / New chat / Changes. The app's top bar hides in Rozi chat (`.rozi-mode .topbar`), so the title isn't shown twice.
- **Fixed during the check:** an old rule dissolved the header row when Rozi AI is off, which stacked the button and the title.
- **Starter questions:** all 7 wrap onto the first screen instead of being cut off in a sideways scroll. Once you've asked something, they go back to one scrolling row.
- **The dock** still hides in chat (decision from mockup v3).

**Checked:**
- 436 tests pass, type check and build pass, and lint shows the same single old warning.
- In the browser at 375 px (dark):
  - Rozi chat with one header row and all 7 questions visible;
  - Workouts with no rail over the tiles, and the rail shown beside the list.

**Not checked:**
- the chat header with Rozi AI switched on (History / New chat buttons in the same row);
- a long conversation.

### 2026-11-24 — UI redesign Phase 8: setup polish (all 21 questions kept)

After "Start Phase 8", following your decision: "keep that same and make ui polish". Opus did all of it.

**Not changed:**
- The setup questions: `BASE_QUESTIONS` in `welcome.tsx` is the same list, in the same order, with the same answers saved. Confirmed after the change.
- No question was added, removed, merged or moved. Only CSS changed in this phase.

**What changed** (a "Setup, Phase 8" CSS block):
- **Intro slides:** the title, sentence, Rozi picture and dots now sit together, centred between the top bar and Continue. Before, a stretched grid spread big empty gaps between them.
- **On/off switches** (equipment list and elsewhere): on is now the action colour instead of teal (`.toggle.on`, `.switch.on`). Mint stays for recovery only.
- **The "Recommended / Suggested for you" badge** on a selected option is now a subtle dark pill on the orange, instead of a bright white one.
- **The unit toggle:** "Feet and inches" stays on one line.
- **Already improved by earlier phases:** the dark theme and the orange selection style (Phase 4) already apply to every setup screen.
- **Colours:** the raw-colour ceiling dropped from 463 to 461.

**Checked:**
- 436 tests pass, type check and build pass, and lint shows the same single old warning.
- In the browser at 375 px (dark), as a new user:
  - welcome and the intro slides (before and after);
  - name, height and weight pickers;
  - activity (selected state), birth year and sex, the details summary with BMI;
  - why (chips), the fact card, level, goal (Suggested badge), focus muscle, figure, days, session length, gym, equipment (switches), first workout.
- Afterwards this browser's test data was restored.

**Not checked in the browser:** the last three screens (reminders, building the plan, your program). Finishing setup would have overwritten the test data. They use the same styles.

**Noted, not changed:** the figure cards look teal-tinted because the page's teal glow shows through the glass. That's intended.

### 2026-11-24 — UI redesign Phase 9: accessibility, motion and performance (the redesign plan is complete)

After "Start Phase 9". Opus did all of it.

**Measured first:**
- **Contrast of every colour token in both themes:**
  - main text 17:1 (dark) and 14:1 (light);
  - secondary text 8.2:1 / 5.1:1;
  - dark text on the orange button 6.2:1;
  - the "faint" colour **failed**: 3.8–4.4:1 in dark, 2.5:1 in light.
- A label and tap-size audit of Today, Workouts, Progress, Profile, Settings, Train and Rozi at 375 px.
- The number of blurred glass layers on Today.

**Fixed:**
- **Faint text colour:**
  - dark `#737b7a` → `#939b9a` (6.8:1 on the page, 5:1 on cards);
  - light `#8f9c9a` → `#646f6e` (4.6:1).
  - Both stay dimmer than the secondary text, so the hierarchy holds.
- **Keyboard focus ring:** a 2 px orange ring on everything you can tap (`:focus-visible`). Before, only 6 elements had one, and 8 older rules removed outlines.
- **Reduced motion:** one app-wide rule turns off animations and transitions when the phone asks for less motion. Before, each animation opted out on its own. Reduced transparency (solid cards instead of glass) already existed.
- **Tap targets raised to 44 px:**
  - the top-bar picture (was 32);
  - setup Skip (30);
  - Rozi's starter questions (31);
  - the water buttons (36);
  - Progress's exercise dropdown and Save measurement (36);
  - the "Why this workout" / "How these numbers…" folds (18);
  - the celebration's "See my streak calendar" link (15).
- **Design guard:** it now ignores CSS comments, which it had been counting as colours. The true raw-colour count is 457, and the ceiling is set to it.

**Checked and fine:**
- Every image has alt text, and every control has a name. Four Library filters looked unnamed, but only because they sit in a closed fold; they have proper labels.
- **Glass:** 8 blurred layers on Today and none blurred inside another.
- **Desktop at 1280 px:** the sidebar (Today, Workouts, Progress, Together, Ask Rozi, Profile) and a centred Today column.
- 436 tests pass, type check and build pass, and lint shows the same single old warning.

**Known exceptions:** the two 7-day calendars (week strip 40 px wide, 4-week grid 37 px) can't be 44 px wide in seven columns on a phone. Both are above WCAG 2.2's 24 px minimum.

**Not done (needs you or real devices):**
- Lighthouse and VoiceOver/TalkBack on a real phone;
- a 60 fps scroll check on a mid-range Android;
- the light theme across every screen;
- a friends retest.

DESIGN.md §9 now records the accessibility rules.

### 2026-11-24 — Phone review fixes: Today card, Progress, page switching, lighter orange

Found on a real iPhone after the redesign. CSS and screen code only, no database or API change.

- **Today card:** the plan title is split at " · ": the short name ("Pull B") is the title and the muscles go on a
  line below. Rozi is 120 px instead of 156 px, so long titles no longer run into Rozi. The streak pill moved above the
  button, so the one big button always closes the card.
- **Page switching glitch:** the cards' fade-up animation on every page open is removed. On iPhone a fading glass
  card loses its blur and snaps back, which looked like the whole page glitching.
- **Settings sections:** opening or leaving a section (`?section=`) now scrolls to the top and brings the full dock
  back. Before, the section title started hidden under the top bar and the dock could stay shrunk.
- **Progress:**
  - Personal records show the top 5; the rest and the "how records are counted" note fold under "Show more".
  - Workout history shows the 5 latest; older ones fold under "Show N older".
  - History rows no longer run past the card edge (the list grid gets `minmax(0, 1fr)`).
  - Body weight: the date and weight fields are the same height (48 px), size and alignment. The text is 17 px, so
    iOS no longer zooms in on focus. The chart's lowest/highest line sits on its own line.
- **Dock:** a soft fade behind the phone dock, so page text never shows sharp beside the pill when it shrinks.
- **Orange (dark theme):** lighter and brighter. `--accent` `#FF9B72`, `--accent-strong` `#FF7D50`, primary button
  gradient `#FFB48F` → `#FF8A5C`. Text on it stays dark (`--on-accent`).
- Files: `overview-screen.tsx`, `progress-screen.tsx`, `settings-screen.tsx`, `app/globals.css`, `docs/DESIGN.md`.
- Checks: 436 tests pass, type check clean, lint (1 old warning). Checked at 375 px in the browser.

### 2026-11-25 — Phone review fixes 2: water card, tab sliding, exercise sheet motion, link arrows

CSS and screen code only, no database or API change.

- **Water card (Today):** the bottle is replaced by a round glass orb:
  - two wave layers drift at different speeds, bubbles rise, and the percentage sits in the middle;
  - it fills smoothly to the share of today's target, and splashes with a floating "+250 ml" when you add a drink;
  - the buttons now show their size ("+ Glass 250 ml", "+ Bottle 500 ml"). Undo sits at the end of the same row as an
    even 44 px round button instead of wrapping onto its own line.
- **Tab bars slide like the dock:** the dock's press-and-slide (`DockScrub`) now also works on every one-row tab bar
  (`.segmented`, `.library-chips`): the Workouts categories, the Together tabs and the other segmented controls. Press
  lifts the orange lens, sliding moves it with your finger, and letting go picks the tab. A tap works as before, and a
  bar that is wider than the screen keeps its normal sideways scroll.
  - Workouts categories fit one row now: "Conditioning" shows as "Cardio" (`CATEGORY_LABEL` in `exercise-picker.tsx`;
    the filter value is unchanged), with slightly smaller text.
- **Opening an exercise:** the backdrop fades in, the sheet glides up and its content follows a moment later. Closing
  (×, Close, the backdrop or Escape) plays it in reverse before the guide closes. Swipe-down still works as before.
- **Text links with an arrow** ("Check your recovery map ›"): the arrow sits centred on the text, with no underline
  and a 44 px tap height.
- The design guard's colour ceiling went down from 457 to 448.
- Files: `water-card.tsx`, `dock-scrub.tsx`, `exercise-guide-modal.tsx`, `library-screen.tsx`, `exercise-picker.tsx`,
  `app/globals.css`, `design-guard.test.ts`.
- Checks: 436 tests pass, type check clean, lint (1 old warning). Checked at 375 px in the browser (slide from All to
  Cardio, open/close an exercise, add and undo water). The test water was removed from the demo afterwards.

### 2026-11-25 — Today card: spacing restored, streak becomes a footer

- **Cause of the overlap:** the hero is a `Card`, and `.ui-card { display: block }` comes later in `globals.css` than
  `.today-hero { display: grid; gap }`. So the 12 px gap never applied, and the text, the streak pill and the button
  touched. `.today-hero.ui-card` now sets the grid and gap (the same fix the recovery row needed in Phase 3).
- **Streak:** it's no longer a pill squeezed between the text and the button. It's the card's footer: a full-width
  row under a hairline with a flame badge, "N in a row", "Best N" when higher, and a chevron. It opens the streak page.
- The primary button gets a little extra space above it.
- Files: `overview-screen.tsx`, `app/globals.css`. 436 tests pass, type check clean, lint (1 old warning).
