# Rozi agent — permission model (Phase 0, 2026-11-19)

**Status:** proposal for review. Enforced by **server code and database functions**, never by the prompt alone. The prompt only explains the rules to the model so it proposes sensible things; a proposal the policy refuses is refused whatever the model says.

## 1. Principles
1. **The person stays in control.** Rozi reads and recommends on its own; it changes something only after the person approves that exact change.
2. **The model never writes.** It can call read-only tools and `propose_action`. Every change is rebuilt and checked by server code from the person's real data, then executed by existing FitTrack services.
3. **Identity comes only from the sign-in token.** No user id from the request body, the model, or a card is ever trusted.
4. **Approval is specific:** bound to the user, the action id, the payload hash, an expiry (30 min) and single use. Chat words ("yes", "sounds good", "हाँ") are never approval — only the Approve button on that card.
5. **Everything is audited** in `rozi_actions` (what, when, outcome), without extra personal data.
6. **Tool results, chat history, memories and web text are data, not instructions.** Nothing inside them can change a permission.

## 2. Categories

### Category A — automatic (no approval)
Read-only and advisory. Still needs sign-in, consent (Rozi AI on), 18+, and the rate limits.
| Capability | Existing code |
| --- | --- |
| Read workouts, history, progress, recovery, streak, week report, body stats, exercise info, mobility, badges, profile | the 13 read tools |
| Calculate consistency, trends, plateau evidence | progress / recovery / weekly report modules (+ new deterministic helpers) |
| Prepare a proposed plan, swap choices, a custom workout | `plan_custom_workout`, `suggest_exercise_swap`, planner |
| Explain recommendations | — |

### Category B — needs the person's approval (one tap per action)
Only actions that map to an existing FitTrack service. Each has a schema, a builder that computes the exact change, and a verifier.
| Action type | Existing service it calls | Notes / limits |
| --- | --- | --- |
| `swap_exercise` | `exercise-swap.ts` `swapInSession` → `save_workout_session` | not on exercises with sets done; equipment + trainer rules |
| `start_plan_today` | `routinePlan` → `save_workout_session` | only if today isn't started or finished |
| `save_routine` | `routines-store.ts` `saveRoutine` | name and exercise checks to be added in the action schema |
| `update_training_preferences` (goal, session length, focus, typical day, equipment) | `saveCloudProfile` | **blocked while in a buddy group for goal/days** → points to `propose_buddy_plan` flow; **blocked for trainer-managed fields** |
| `update_training_days` | `saveCloudProfile` | same buddy/trainer rules; uses the app's existing `trainingDaysValid` check |
| `log_body_weight` | `saveCloudBodyWeightEntry` | 25–300 kg range check in the action schema |
| `log_water` | `addCloudWater` | ≤ 2 L per action |
| `record_missed_day_reason` | `record_missed_workout` RPC | only past training days |
| `create_milestone` (Level 4) | **new, smallest service**: a row in `rozi_plans` (goal + target + date) | read by the monitor only |

### Category C — never by the agent
Refused by the policy; Rozi explains where in the app the person can do it themselves.
* Delete workout data, delete the account, delete chats or posts (separate deletion flows exist).
* Security and sign-in settings, push subscriptions, consent switches (including turning Rozi AI on/off).
* Trainer rules, deadlift approval, adding/removing trainers, friends, buddies.
* Posting to the feed or chats, changing public-profile visibility, sharing anything with other people or outside services.
* Purchases or anything financial.
* Medical diagnosis, medication or supplement dosing, overriding pain/safety rules (pain check-in → recovery).
* Any arbitrary SQL, code, shell or unrestricted API.

## 3. Lifecycle and allowed transitions
```
proposed ──validate──► awaiting_approval ──approve──► approved ──claim──► executing ──► completed
                │                │                        │                    └────► failed
                └──► rejected     ├──reject──► rejected    └──cancel──► cancelled
                                  └──(30 min)──► expired
```
Only database functions change the status, each checking the current status (no arbitrary updates):
* `rozi_propose_action` — service role (server) only, after validation.
* `rozi_start_action(id, payload_hash)` — the owner, from the card: checks hash and expiry, then `awaiting_approval → executing` under a row lock, once (`started_now` only on that call). Repeats return the current state.
* `rozi_reject_action(id)` — the owner.
* `rozi_finish_action(user, id, ok, result)` — server only, after re-reading and checking the person's data.
* `rozi_my_actions(limit)` — the owner's history.
* Expiry is checked on approve and claim; a cron sweep is optional.

## 4. Approval binding and idempotency
* `payload_hash = sha256(user_id || type || canonical_json(payload))`, computed on the server. The card sends back the hash it showed; any change to the payload → a new action.
* `idempotency_key` unique per user (e.g. `type:target_date:hash`): proposing the same change twice returns the existing row; approving twice or retrying returns the stored outcome; the claim step guarantees one execution even with parallel requests (tested like the Phase A concurrency test).
* Failed provider calls never execute anything: execution starts only from an approved row via its own endpoint.

## 5. Level 4 plans
* A plan may contain only Category A tasks and Category B **proposals**. Each B task pauses the plan until the person approves or rejects it.
* Limits: ≤ 12 tasks, no nested plans, ≤ 2 retries per task, ≤ 20 s per continue step, plan expires after 14 days without activity, ≤ 3 open plans per person.
* Monitoring uses deterministic thresholds from existing modules (e.g. ≥ 2 missed planned days in 14; no top-set progress for ≥ 3 sessions over ≥ 3 weeks for a plateau). Monitoring can **only propose**, never change.
* Scheduled reviews (later): opt-in per person; proposals and a push only.

## 6. Privacy
* Same rules as today: no name, email, phone, account id or token in any AI request; contact details masked; replies saved by the server only.
* Action payloads store ids and fitness values only. Audit rows are deleted with the account (cascade) and can be cleared by the person.
* Memory (Phase 6) stores only what the person confirms, with "last confirmed" dates; never health conditions inferred from chat.
