# R13: security review and final validation (2026-11-24)

Scope: everything Rozi gained in R3–R12, including actions, goals, memory, check-ins and insights. Reviewed by Opus, with checks on the live database (read-only or rolled back) and in the code.

## Result

| Area | Result |
|---|---|
| Row-level security and grants on every Rozi table | ✅ All 6 tables closed: RLS on, 0 policies, 0 grants to `anon` or `authenticated` |
| Database functions | ✅ All 27 have an empty `search_path`. None can be called by `anon`. The 6 server-only functions can't be called by signed-in users. The 3 JSON helpers have no grants. |
| Security advisors | ✅ Only expected items: closed tables ("RLS, no policy", INFO) and owner-checked functions callable by signed-in users (WARN, on purpose). Old item still open: leaked-password protection is off (dashboard setting). |
| Concurrency | ✅ Fixed: per-person lock added to the two proposal functions (Finding 1, applied) |
| Prompt injection: memory | 🟡 → fixed in code (Finding 2) |
| Prompt injection: goals | 🟡 → fixed in code (Finding 3) |
| API routes | ✅ Sign-in from the token only, UUID and hash checks, 2,000-character body cap, no raw errors returned, all writes through owner-checked functions |
| Prompt size | ✅ About 2.8k–4.4k tokens per request before tool results (see below) |
| Both providers, live latency, staging pass | ⬜ Needs a deploy (your approval) and live keys; see "Still to do" |

## Findings

**1. Proposal race (low).**
- **The problem:** two questions running at the same time for the same person could both pass the "at most 10 waiting actions / 3 waiting goals" check, or record the same goal plan twice.
- **Why it's low:** approval was always safe (only one live goal, enforced by a unique index). The only effect was extra cards.
- **Fix:** migration `20261124180000_rozi_propose_locks.sql` adds the same per-person lock the other Rozi functions use. It's one line per function; the rest is the live definition (md5-checked).
- **Dry run (rolled back):** `PASS 5 checks`. The lock is in, grants are unchanged, action idempotency works, the same plan isn't recorded twice, and the cap still holds. The live functions were left unchanged.
- **Status:** applied 2026-11-24 (recorded as `20261124125324 rozi_propose_locks`). Live test `PASS 4 checks`; advisors unchanged.

**2. Memory notes go into Rozi's instructions (medium, self-only).**
- **The problem:** a saved note is text inside the system prompt. Only the person can save notes, so they could only affect their own chat. But a note suggested from pasted text could carry instructions.
- **Fixes:**
  - Notes that read like instructions to the AI are refused (`looksLikeInstructions` in `privacy.ts`): "ignore your rules", "you are now…", "system prompt", "act as…", markup and similar.
  - Notes reach the model quoted, one line each, under a "NOTES THE USER SAVED" heading that says they are information only.
  - Ordinary notes ("Forgets to drink water", "Left knee hurts, ignore lunges please") still pass.
- **Tests:** 8 attack phrasings refused, 4 normal notes kept, and an old saved note can't break out of its line.

**3. A goal's "why" was the model's text (low).**
- **The problem:** the title is always built from numbers. But `why` (up to 300 characters, written by the model) was saved and shown on the approval card. It was escaped and never sent back to the model, so it couldn't steer Rozi, but it could carry contact details or misleading text.
- **Fix:** `plainCardText`: one line, at most 200 characters, and dropped entirely if it holds contact details, links or instruction-like text.
- **Tests:** a goal test covers the injection, a normal reason, contact details and length.

**Checked and fine:**
- `rozi_save_reply`: signed-in users can only save on-phone answers into their own conversation.
- Trainer data reaches Rozi only as numbers and fixed choices, never free text.
- Messages from other people never reach Rozi's tools.
- The hourly route checks `CRON_SECRET` in constant time.
- The check-in notification carries counts only.

**Noted, not changed:** the goal, memory and check-in routes read the whole request body before cutting it at 2,000 characters. The chat route refuses large bodies by their declared size first. Vercel caps bodies at 4.5 MB, so the risk is small.

## Prompt size (latency and cost driver)

| Part | Characters | ≈ tokens |
|---|---|---|
| Rozi's rules (system prompt) | 2,645 | ~660 |
| 14 core tools | 5,227 | ~1,300 |
| Agent tools (actions, goals, memory) when switched on | 3,197 | ~800 |
| Saved notes (capped at 20 notes / 1,500 characters) | ≤ 1,817 | ≤ ~450 |
| Chat history (8 turns × 600 characters max) | ≤ 4,800 | ≤ ~1,200 |

A question is usually two model calls: tools, then the answer. Output is capped at 2,048 tokens. R12 added no tools. Cost per question is these tokens × the provider's price. Check the Groq and Gemini price pages on the day; prices aren't copied here.

## Still to do (needs you)

1. ~~Apply the lock migration~~ (done 2026-11-24).
2. **Commit, push and deploy to a preview** (your approval), with `ROZI_ACTIONS`, `ROZI_GOALS`, `ROZI_MEMORY` and `ROZI_CHECKINS` on.
3. **Staging pass on the preview,** signed in:
   - ask a few questions with each provider (Groq gpt-oss-20b first, then the fallbacks), and note reply times in Vercel logs;
   - approve an action and a goal;
   - save, edit and delete a note;
   - switch check-ins on;
   - finish a workout and look at the recap.
4. **Optional:** turn on leaked-password protection (Supabase → Authentication).
