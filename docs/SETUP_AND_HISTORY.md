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
- App icon = Rozi face (`public/icons/icon-*.png`); browser tab + header logo = "R" with dumbbell (`public/icons/favicon-32.png`, `logo-r.webp`).
- Image prompts for future art: `design/brand-prompts.md`. Originals: `design/*-incoming/`.
- Themes: Soft pastel (default) and Liquid glass. Daily motivation lines: `src/lib/motivation.ts` (written for RozFit, no copyright issues).

---

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
| Email setup | Gmail SMTP connected (sender name RozFit). Templates still to paste (section 6). |

Tests: `npm test` (112 at the last update), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## 9. Full test checklist (after each deploy)

1. Open `https://rozfit-a.vercel.app` on a phone → Get started → 7 steps → code email arrives (check Spam first time) → typing the code lands on Home, signed in, with the chosen plan.
2. Train → today's workout matches the goal; log and finish a workout → Rozi celebrates.
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
