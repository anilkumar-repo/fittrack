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
