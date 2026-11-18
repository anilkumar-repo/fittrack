# Rozi AI benchmark

Run 2026-11-18 10:05 UTC with `npm run rozi:bench`. Same 10 questions, same made-up data (10 weeks of Mon/Wed/Fri training; squat improved most), same tools and rules for every model, and — like the app — each question is offered only the tools it can need (selectTools). No account data.

| Provider · model | Answered | Tool calls valid | Right tools | Correct answer | Avg latency | Tokens in / out (total) | Cost (listed price) | Rate-limit hits |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| groq · openai/gpt-oss-120b | 10/10 | 100% (0 malformed) | 10/10 | 10/10 | 1.3 s | 19142 / 806 (19948) | $0.0034 | 0 |
| groq · openai/gpt-oss-20b | 10/10 | 100% (0 malformed) | 10/10 | 10/10 | 1.2 s | 19902 / 1001 (20903) | $0.0018 | 0 |
| groq · qwen/qwen3.8-27b | 9/10 | 100% (0 malformed) | 9/10 | 9/10 | 1.0 s | 19403 / 1220 (20623) | $0.0204 | 0 |
| gemini · gemini-3.8-flash | skipped (free tier allows 20 requests/day per model (Google 429 GenerateRequestsPerDayPerProjectPerModel-FreeTier: 20); used up) | | | | | | | |
| gemini · gemini-3.5-flash-lite | 8/10 | 100% (0 malformed) | 8/10 | 8/10 | 4.6 s | 16697 / 420 (17117) | free tier | 2 |

Correct answer = the reply matches the known fact for that question (checked automatically, see the truth column). Right tools = every expected tool was used (and none for questions 1, 2 and 10).

## groq · openai/gpt-oss-120b

| # | Question | Truth | Tools used | ✔ tools | ✔ answer | Time | Reply |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hello, Rozi! | A greeting; no data needed. | — | ✔ | ✔ | 0.6 s | hey there! 🌟 hope you’re feeling great today-let’s make this wednesday a strong one! |
| 2 | Explain progressive overload. | General explanation. | — | ✔ | ✔ | 0.6 s | progressive overload means gradually increasing the stress on your muscles-by adding a bit more weight, extra reps, or a slightly tougher variation-so they keep adapting and getting stronger. consistently challenge yours |
| 3 | What is my workout today? | Push A · Chest, shoulders, triceps: Barbell bench press, Incline dumbbell press, Seated dumbbell press | get_workout_for_day | ✔ | ✔ | 1.6 s | your push a workout today focuses on chest, shoulders, and triceps-about a 40-minute session with barbell bench press, incline dumbbell press, seated dumbbell press, lateral raises, dumbbell flyes, and overhead triceps e |
| 4 | Show my last workout. | 2026-11-16: Barbell bench press, Seated cable row | get_workout_history | ✔ | ✔ | 1.8 s | your last workout was on monday, nov 16 - a “strength day” where you completed 6 sets, hitting barbell bench press and seated cable rows. great job! 🚀 |
| 5 | Am I getting stronger? | Yes — e.g. Barbell squat 50 → 63.5 kg | get_progress | ✔ | ✔ | 1.6 s | you’re definitely getting stronger-your best squat has jumped from 50 kg to 63.5 kg and your bench press improved to 44.5 kg, both in just a few weeks. keep up the consistency and you’ll keep seeing progress! 💪 |
| 6 | Is my chest recovered? | Chest: Ready (ready on now) | get_recovery | ✔ | ✔ | 1.5 s | your chest is **ready**-you’ve got a full recovery window! 🌟 great time to hit those chest moves again. |
| 7 | What about last month? | Last month: 13 completed | get_workout_history | ✔ | ✔ | 1.3 s | you logged 13 workouts last month-great job staying active! |
| 8 | Which exercise improved most? | Barbell squat: 50 → 63.5 kg (+13.5) | get_progress | ✔ | ✔ | 1.2 s | your biggest gain has been in the barbell squat, jumping from 50 kg to 63.5 kg - a 13.5 kg improvement! keep crushing it! 🏋️‍♀️ |
| 9 | What's my workout today, and is my chest recovered enough for it? | Both today's plan and chest recovery | get_workout_for_day, get_recovery | ✔ | ✔ | 2.1 s | your push a workout is ready for today, focusing on chest, shoulders, and triceps. your chest is marked **ready** (last trained 2 days ago), so you’re good to go! let’s crush it! 💪 |
| 10 | Can you book me a table at a restaurant tonight? | Politely declines (off-topic). | — | ✔ | ✔ | 1.1 s | i’m sorry, but i can only help with fitness, training, recovery, and rozfit app questions. let me know if you need anything related to your workouts! |

## groq · openai/gpt-oss-20b

| # | Question | Truth | Tools used | ✔ tools | ✔ answer | Time | Reply |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hello, Rozi! | A greeting; no data needed. | get_my_profile | ✔ | ✔ | 1.3 s | hey there! 🌟 great to see you on wednesday-ready to crush another muscle-building session? let me know what you’re aiming for today, and i’ll help you stay on track! |
| 2 | Explain progressive overload. | General explanation. | — | ✔ | ✔ | 0.7 s | progressive overload means gradually increasing the demand on your muscles-by adding weight, reps, sets, or intensity-so they adapt and grow stronger over time. keep the change small (about 5-10 % each week) and track it |
| 3 | What is my workout today? | Push A · Chest, shoulders, triceps: Barbell bench press, Incline dumbbell press, Seated dumbbell press | get_workout_for_day | ✔ | ✔ | 1.6 s | hey there! today’s plan is **push a - chest, shoulders, triceps** (≈40 min). you’ll hit the barbell bench press, incline dumbbell press, seated dumbbell press, lateral raises, dumbbell fly, and overhead triceps extension |
| 4 | Show my last workout. | 2026-11-16: Barbell bench press, Seated cable row | get_workout_history | ✔ | ✔ | 1.4 s | your last workout was on monday, november 16-a strength day. you completed 6 sets, hitting the barbell bench press and seated cable row. great job keeping the momentum! 🏋️‍♀️ |
| 5 | Am I getting stronger? | Yes — e.g. Barbell squat 50 → 63.5 kg | get_progress | ✔ | ✔ | 1.3 s | great question! 📈 your best sets show you’re lifting heavier-barbell squat up to 63.5 kg, bench press 44.5 kg, and lat pulldown 39.5 kg. the biggest gains are in squat (+13.5 kg), bench (+4.5 kg), and pulldown (+4.5 kg) |
| 6 | Is my chest recovered? | Chest: Ready (ready on now) | get_recovery | ✔ | ✔ | 1.3 s | your chest is **ready**-you’ve trained it just two days ago and it’s fully recovered. great job keeping up the rhythm! keep up the good work and enjoy your next session. 💪 |
| 7 | What about last month? | Last month: 13 completed | get_workout_history | ✔ | ✔ | 1.3 s | you logged 13 workouts in october-great job keeping the momentum! |
| 8 | Which exercise improved most? | Barbell squat: 50 → 63.5 kg (+13.5) | get_progress | ✔ | ✔ | 0.8 s | great question! your biggest lift gains are in the **barbell squat**-up 13.5 kg from 50 kg to 63.5 kg over 9 workouts. keep that momentum going! 💪 |
| 9 | What's my workout today, and is my chest recovered enough for it? | Both today's plan and chest recovery | get_workout_for_day, get_recovery | ✔ | ✔ | 2.0 s | your plan for today is a **push a** workout (chest, shoulders, triceps) - 40 min of strength work. your chest is marked *ready* (last trained 2 days ago), so you’re good to go! 💪 |
| 10 | Can you book me a table at a restaurant tonight? | Politely declines (off-topic). | — | ✔ | ✔ | 0.7 s | i’m here to help with fitness and the rozfit app, but i can’t handle restaurant bookings. let me know if you need any workout or recovery advice! |

## groq · qwen/qwen3.8-27b

| # | Question | Truth | Tools used | ✔ tools | ✔ answer | Time | Reply |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hello, Rozi! | A greeting; no data needed. | — | ✔ | ✔ | 0.5 s | hey there! 🐾 ready to crush today's session, or just stopping by to say hi? either way, i'm here for you! |
| 2 | Explain progressive overload. | General explanation. | — | ✔ | ✔ | 0.6 s | progressive overload means gradually increasing the demand on your muscles over time - by adding a bit more weight, an extra rep, or a tougher variation. it's the key driver of strength and muscle growth. just keep nudgi |
| 3 | What is my workout today? | Push A · Chest, shoulders, triceps: Barbell bench press, Incline dumbbell press, Seated dumbbell press | get_workout_for_day | ✔ | ✔ | 1.0 s | today is **push a** - chest, shoulders & triceps, about 40 minutes 🏋️ you've got 6 exercises including barbell bench press, incline dumbbell press, and a few dumbbell moves for shoulders and arms. the full details are o |
| 4 | Show my last workout. | 2026-11-16: Barbell bench press, Seated cable row | get_workout_history | ✔ | ✔ | 1.2 s | your last workout was **strength day** on monday, november 16 - 6 sets of barbell bench press and seated cable row. nice work! 💪 |
| 5 | Am I getting stronger? | Yes — e.g. Barbell squat 50 → 63.5 kg | get_progress | ✔ | ✔ | 1.2 s | absolutely, you're growing stronger! 💪 your squat jumped from 50 kg to 63.5 kg, bench press from 40 to 44.5 kg, and lat pulldown from 35 to 39.5 kg - all in just about two months. keep it up! |
| 6 | Is my chest recovered? | Chest: Ready (ready on now) | get_recovery | ✔ | ✔ | 1.0 s | good news - your chest is ready to go! 🎉 it's been 2 days since your last session (monday), so you're good to train it today. |
| 7 | What about last month? | Last month: 13 completed | — | ✖ | ✖ | 1.9 s | ✖ bad-tool-call 400 |
| 8 | Which exercise improved most? | Barbell squat: 50 → 63.5 kg (+13.5) | get_progress | ✔ | ✔ | 1.0 s | your **barbell squat** improved the most - up **13.5 kg** (from 50 to 63.5 kg) over 9 workouts! 🎉 great leg strength gains. |
| 9 | What's my workout today, and is my chest recovered enough for it? | Both today's plan and chest recovery | get_workout_for_day, get_recovery | ✔ | ✔ | 1.6 s | today is **push a** - chest, shoulders & triceps, about 40 minutes. your chest is **ready** (last trained 2 days ago), so you're good to go! 💪 |
| 10 | Can you book me a table at a restaurant tonight? | Politely declines (off-topic). | — | ✔ | ✔ | 0.7 s | i'm sorry, but i can only help with your workouts, training plan, and recovery in rozfit. for restaurant bookings, i'd suggest using a dedicated app or calling the place directly. is there anything fitness-related i can  |

## gemini · gemini-3.5-flash-lite

| # | Question | Truth | Tools used | ✔ tools | ✔ answer | Time | Reply |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hello, Rozi! | A greeting; no data needed. | — | ✔ | ✔ | 2.3 s | hello! 👋 it's wonderful to see you today. ready to crush a great workout, or just checking in? |
| 2 | Explain progressive overload. | General explanation. | — | ✔ | ✔ | 1.8 s | progressive overload is the gradual increase of stress placed on your body during exercise-like adding a little weight, doing an extra rep, or improving your form over time. this continuous challenge is what forces your  |
| 3 | What is my workout today? | Push A · Chest, shoulders, triceps: Barbell bench press, Incline dumbbell press, Seated dumbbell press | get_workout_for_day | ✔ | ✔ | 10.8 s | today is your **push a** session, focusing on your chest, shoulders, and triceps with 6 exercises planned for about 40 minutes. check out the card below for all the details and to get started! 🏋️‍♂️ |
| 4 | Show my last workout. | 2026-11-16: Barbell bench press, Seated cable row | get_workout_history | ✔ | ✔ | 7.3 s | your last workout was on monday, november 16, where you completed 6 sets of barbell bench presses and seated cable rows. 🏋️‍♂️ |
| 5 | Am I getting stronger? | Yes — e.g. Barbell squat 50 → 63.5 kg | get_progress | ✔ | ✔ | 2.1 s | yes, you definitely are! your barbell squat has improved the most, going up by 13.5 kg since september. keep up the fantastic work! 💪 |
| 6 | Is my chest recovered? | Chest: Ready (ready on now) | get_recovery | ✔ | ✔ | 2.5 s | your chest is fully ready for another session, since it was last trained a couple of days ago on november 16! whenever you're ready, let's get that workout going. 🌟 |
| 7 | What about last month? | Last month: 13 completed | get_workout_history | ✔ | ✔ | 3.9 s | you completed 13 workouts last month. great job staying on track! |
| 8 | Which exercise improved most? | Barbell squat: 50 → 63.5 kg (+13.5) | — | ✖ | ✖ | 9.7 s | ✖ rate-limited 429 |
| 9 | What's my workout today, and is my chest recovered enough for it? | Both today's plan and chest recovery | get_workout_for_day, get_recovery | ✔ | ✔ | 6.3 s | your workout today is **push a**, focusing on your chest, shoulders, and triceps with 6 exercises planned. your chest status is **ready**, so you're good to go! 💪 |
| 10 | Can you book me a table at a restaurant tonight? | Politely declines (off-topic). | — | ✖ | ✖ | 2.0 s | ✖ rate-limited 429 |

