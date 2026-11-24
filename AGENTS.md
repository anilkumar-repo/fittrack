<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Model routing (RozFit)

Set by the project owner on 2026-11-24. These rules apply to every session in this repository. `CLAUDE.md` loads this file.

## Who decides

- **Opus 5.5 is the main model.** It runs the conversation, plans the work, picks the model for each piece, reviews everything a helper produces, and writes the final report to the user.
- A session cannot switch its own model mid-conversation. **Routing means delegating a piece of work to a helper agent that runs on a cheaper model.** The main session stays on Opus. Never claim a switch that didn't happen.
- The user can still change the session model in the app's model picker. These rules assume Opus is the main model.

## The three tiers

| Tier | Model | Agent (`.claude/agents/`) | Use it for |
|---|---|---|---|
| Main | Opus 5.5 | — (the session itself) | Planning and routing decisions. Architecture. Database migrations, RLS, security, auth, payments, user data. Rozi AI prompts, tools and actions. Tricky debugging. Anything that depends on this conversation's history or decisions. Reviewing helper output. Talking to the user. |
| Builder | Sonnet | `builder` | Well-specified, self-contained implementation from a written brief: library data entries (exercises, aliases, prompts) from a spec, UI copy and CSS tweaks, tests written to a stated behaviour, doc drafts, a refactor inside one or two files. |
| Quick | Haiku | `quick-helper`, `checker` | Running tests / type check / lint / build and returning only a short summary (`checker`). Code searches and file sweeps, listing and counting, formatting, extracting data, short text rewrites (`quick-helper`). |

## How to decide (in this order)

1. **Is it critical?** Migrations, RLS or security rules, auth, secrets, payments, deleting or changing user data, production config, and Rozi's approval/action engine stay on **Opus**. No exceptions.
2. **Does it lean on this conversation?** That means earlier decisions, the user's rules, or half-finished work. If so, it stays on **Opus**. A helper starts cold, and re-explaining costs more than it saves.
3. **Is it tiny?** Fewer than about 3 tool calls, or a one-line edit: **Opus does it directly**. Starting a helper costs more than the work.
4. **Can it be fully described in a brief?** That means the files, the exact change, the rules and what "done" looks like. If so, mechanical work goes to **Haiku** and judgement-light implementation to **Sonnet**.
5. **When in doubt, go up a tier.** Never go down.

## Rules for every delegation

- **The brief:** Opus writes it. It names the files, the exact change, the project rules that apply, and what to return. Helpers do not see this conversation.
- **Helpers never:**
  - commit, push or deploy;
  - apply migrations, or run anything against the live Supabase project;
  - touch `.env*`, keys or tokens;
  - edit `supabase/`, `src/lib/rozi-ai/actions/`, `src/lib/rozi-ai/permissions/`, auth or security code.
- **Review:**
  - Opus reads the helper's diff (`git diff`) and runs or reads the checks before accepting it.
  - Anything touching auth, authorization, schemas, security policies or production infrastructure gets a line-by-line review. Until then it is not applied or reported as done.
- **Failure:** if a helper's result is wrong twice, Opus does the piece itself.
- **Independent pieces:** they may run in parallel helpers. They must not edit the same files.
- **Telling the user:** each wrap-up says, in one line, which tier did which part (e.g. "Sonnet builder wrote the 16 exercise entries; Haiku checker ran tests; Opus reviewed and wired them").

## Project rules helpers must also follow

Opus copies the relevant ones into each brief.
- The user commits and pushes through GitHub Desktop. Never commit, push, force-push, reset, clean or stash.
- Keep exercise IDs stable. They are saved in plans, routines, logs and Rozi actions.
- Don't change the AI model order (`ROZI_AI_CHAIN`): gpt-oss-20b → gpt-oss-120b → Gemini Flash-Lite.
- Never print or hardcode keys. No secrets in `NEXT_PUBLIC_*`. No personal data in requests to outside services.
- Every change is recorded in `docs/SETUP_AND_HISTORY.md` and the relevant docs. Opus writes these entries.
