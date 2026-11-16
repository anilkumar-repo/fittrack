# Branches, pipelines and environments

Set up on 2026-11-16. From now on, work never goes straight to `main`.

## The flow

```
feature/<date>-<what>  ──PR──▶  develop  ──PR──▶  main
        │                          │                │
   CI checks                 CI checks +       CI checks +
                             DEV site          PRODUCTION site
                       (rozfit-dev URL)     (rozfit-a.vercel.app)
```

| Branch | What it is | Who deploys it | URL |
|---|---|---|---|
| `main` | Production. Only merged from `develop`. | Vercel, automatically on merge | https://rozfit-a.vercel.app |
| `develop` | Dev / test. Everything is tried here first. | Vercel preview, automatically on push | Set a fixed domain, e.g. `rozfit-dev.vercel.app` (steps below) |
| `feature/*`, `fix/*` | One piece of work each, e.g. `feature/2026-11-16-fixes-profile-rozi`. | Vercel preview per push | The preview link Vercel posts on the pull request |

**Pipelines (GitHub Actions)** — `.github/workflows/ci.yml` runs on every push to these branches and every pull request
into `develop` or `main`: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. A pull request into `main`
also lists any new files in `supabase/migrations/` as a warning, so the database change isn't forgotten.

## One-time setup (you, in the browser)

1. **GitHub Desktop**: the branches `develop` and `feature/2026-11-16-fixes-profile-rozi` were created on this
   computer. In GitHub Desktop choose *Current branch → develop → Publish branch*. Then switch to the feature branch,
   commit the changes, and *Publish branch*.
2. **GitHub → Settings → Branches → Add rule** for `main` (and the same for `develop`):
   - Require a pull request before merging.
   - Require status checks to pass → pick **Test, typecheck, lint, build**.
3. **Vercel → Project → Settings → Domains → Add** `rozfit-dev.vercel.app` (or any free name) and set
   **Git branch = develop**. Now `develop` always has the same dev URL.
4. **Vercel → Settings → Environment Variables**: give the *Preview* environment its own values when you create a dev
   database (step 5). Until then Preview uses the same Supabase as production, so test with a test account only.
   Also set `NEXT_PUBLIC_SITE_URL` per environment (Production: `https://rozfit-a.vercel.app`, Preview: the dev URL).
5. **Supabase (recommended later)**: a second free project `rozfit-dev` for the dev site, so testing never touches real
   people's data. Apply every migration there first, then to production.
6. **Supabase → Authentication → URL configuration → Redirect URLs**: add the dev URL too
   (`https://rozfit-dev.vercel.app/**`) so email sign-in works on the dev site.

## Day-to-day

1. In GitHub Desktop: *Current branch → New branch* from `develop`, named `feature/<date>-<what>`.
2. Commit as you go. *Push* → GitHub Actions runs the checks; Vercel posts a preview link.
3. *Create Pull Request* into `develop`. When checks are green, merge. Test on the dev URL.
4. When `develop` is good, open a pull request `develop → main`. Merge → production deploys.
   Then publish a GitHub **Release** with the template in `docs/RELEASE_NOTES_TEMPLATE.md`
   ("Generate release notes" groups the pull requests by label, set up in `.github/release.yml`).
   Every pull request gets a checklist from `.github/pull_request_template.md`; give it one label
   (feature, fix, design, database, docs or chore).
5. Database migrations: Claude writes them into `supabase/migrations/`; they are applied only after you say
   "Yes, apply it" (dev project first once it exists, then production).

## Troubleshooting

**"fatal: couldn't find remote ref refs/heads/main" in GitHub Desktop (2026-11-16)**
- What happened: on GitHub, `main` had been renamed to `develop`, so `main` no longer existed there and GitHub's
  default branch became `develop`. This computer's git was also set to fetch only `main`, so every fetch failed.
- Fixed on this computer:
  - Git now fetches all branches (`remote.origin.fetch = +refs/heads/*:refs/remotes/origin/*`).
  - Local `main` points at the last production commit (`ee466e7`) and local `develop` tracks `origin/develop`.
  - An older local-only commit is kept as `backup/main-before-fix-a4b133a`; its work is already in the feature commit.
- Still to do in the browser/app:
  1. GitHub Desktop → Current branch → `main` → **Publish branch**. This puts `main` (production) back on GitHub.
  2. GitHub → Settings → General → Default branch → switch to `main`.
  3. Vercel → Settings → Git → Production Branch = `main`.
- Never rename `main`. Make a new branch for `develop` instead.
