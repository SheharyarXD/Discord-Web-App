# Production deployment report

**Status: LIVE AND VERIFIED** at **https://furia-ninja.vercel.app** (alias https://furia-ninja-furia-ninja.vercel.app). Date: 26 October 2026. Milestone 4 is not accepted and not closed. The first administrator is created by the client on a private one-time page (section 7); no account exists yet.

## 1. Where it runs

| Item | Value |
| --- | --- |
| Vercel team / project | `furia-ninja` (FURIA NINJA, Pro) / `furia-ninja` (framework Next.js, Node 22.x) |
| Account used | `sheharyarxd-3241`, role Member (upgraded by the client from Developer after the first attempt was refused with 403) |
| Git | repository `SheharyarXD/Discord-Web-App`, branch **`milestone-4`** (the final tested release) |
| Production deployment | `dpl_rVJJmstTrbPxkt529ZJi52diUWPB` (https://furia-ninja-n4xy8roc8-furia-ninja.vercel.app), target Production, built from commit **`89cb71b41f06c2d2fe5a91e0d12b484adac35e52`** on branch `milestone-4` (verified in the deployment metadata, clean working tree), region iad1. It replaced the first deployment `dpl_GXvzE8hAHXV4xnYMXNqebJ1nbciq` (commit `1873342`) |
| Production database | Neon PostgreSQL `neon-indigo-blanket`, **Free** plan, AWS us-east-1 (next to the Vercel functions), connected to **Production only** |
| Preview database | Neon `furia-preview`, **Free** plan, a separate Neon project, connected to **Preview only**. Production and Preview never share a database |
| Preview deployment verified | `https://furia-ninja-d1isyjlen-furia-ninja.vercel.app` (protected by Vercel Authentication; tested with a temporary bypass secret that was revoked afterwards: 0 secrets remain) |
| Costs | none: Neon Free (no payment method), Vercel plan already owned by the client. No domain bought |

## 2. Environment variables (values are never printed or committed)

| Variable | Production | Preview | Source |
| --- | --- | --- | --- |
| `DATABASE_URL` | pooled Neon URL | pooled URL of the preview database | Neon integration |
| `DATABASE_URL_UNPOOLED` | direct URL | direct URL of the preview database | Neon integration |
| `DIRECT_URL` | = direct URL (migrations) | = direct URL | set by `scripts/vercel-set-env.mjs`, stored as a secret |
| `SESSION_DAYS` | 14 | 14 | set by the script |
| `SETUP_TOKEN` | private one-time token (64 hex characters, secret) | a different token | enables `/setup` while no account exists; **remove it after the administrator is created** |
| `FEATURE_GEMS` | false | false | set by the script |
| other `POSTGRES_*`, `PG*`, `NEON_*` | provided by the integration, not used by the code | | |

No `NEXT_PUBLIC_` variable exists. The Development environment has no database variables (local work uses SQLite).

## 3. Sequence actually followed

1. Vercel sign-in through the supported device flow (approved by the account owner); team and role checked.
2. Project linked to the GitHub repository; Neon installed from the Marketplace; the integration first connected one database to all environments, so it was **disconnected and re-connected to Production only**, and a second Neon database was created for Preview.
3. Schema applied to the **Preview** database, data copied and checksummed (41 of 41 tables match), preview deployed, **165 of 165 browser checks passed over HTTPS against it**.
4. Same steps on the **Production** database after a fresh backup of `prisma/dev.db` (`prisma/backups/dev-pre-production-migration-20261026.db`): baseline migration applied, data copied in one transaction, **41 of 41 tables match** (`PRODUCTION_DATA_RECONCILIATION.csv`).
5. Read-only smoke test of the live site: **37 of 37 checks passed** (`PRODUCTION_SMOKE_TEST_RESULTS.md`); the two throw-away accounts were deleted and no game data changed.
6. Runtime logs checked: no error after the data was loaded.

## 4. Incident and deviations (reported plainly)

- **Unplanned early production deployment.** The first Git push after linking created the project's first deployment, and Vercel treats a project's first deployment as Production. It therefore went live at the production address **before the production database had its tables**. For a few minutes the home page returned an error (logged at 01:54 local time); no data was exposed because none existed yet. The migration (step 4) followed immediately and the site then worked. Lesson applied: the later steps were done deployment-first only for Preview.
- **Production branch.** The Vercel production branch is still `main`. It cannot be changed through the API or the CLI (every supported endpoint refuses the property; I tried the project update and link endpoints and the custom-environment endpoint). It is a dashboard setting. **Exact action for a team Member or Owner:** Vercel dashboard, project `furia-ninja`, Settings, Environments, Production, Branch Tracking, set `milestone-4`. Until then:
  - `main` holds the Milestone 1 code. To make sure it can never reach production, the project's **Ignored Build Step** is set to `if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 0; else exit 1; fi`, so a push to `main` builds nothing.
  - Pushes to `milestone-4` create **Preview** deployments that use the Preview database and the Preview `SETUP_TOKEN` only; the Production variables are bound to the Production target and cannot be read by a preview.
  - Production releases are made with `vercel deploy --prod` from a clean checkout of the tested commit (this is how `89cb71b` was released). After the dashboard setting is changed, a push to `milestone-4` will deploy to Production automatically.
- **Preview isolation.** The Preview database is a separate Neon project (stronger than a branch). Preview deployments cannot reach production data.
- **Neon Free limits.** 1 GB storage, short point-in-time history, compute that sleeps when idle (first request after a pause is slower). Current data is a few MB. Keep a periodic copy (handover guide).

## 5. Rollback
- Code: Vercel Instant Rollback to the previous production deployment (or redeploy a previous commit).
- Data: the production database is never reset. Restore from the Neon history window, or recreate an empty database and rerun the migration script from the SQLite file (kept untouched and backed up).

## 6. Not done on purpose
- No custom domain, no paid plan, no change to the production branch, no merge into `main`.
- No administrator account was created: the password is the owner's choice.

## 7. First administrator
A private one-time page replaces the old script-based bootstrap, so the client chooses the e-mail and the password himself and nobody else ever sees them.
- The page `/setup?token=...` answers **404** unless the private token is right **and** the database has no user. It creates exactly one administrator (serializable transaction, so two simultaneous submissions cannot create two), then closes for everyone. Password rules: 12 or more characters, typed twice; stored hashed (bcrypt).
- Tested end to end on a Preview deployment (15 of 15 checks, `scripts/verify-setup-flow.mjs`): hidden without the token, mismatched or short passwords refused, one administrator created, page closed afterwards, sign-in, Secure and HttpOnly cookie, session persistence, role restriction, sign-out; the throw-away accounts were deleted. On production only the read-only states were checked: no token 404, wrong token 404, right token 200.
- The private link is in the owner's file `.setup-link-production.txt` (project folder, git-ignored, never printed in any report). The owner sends it privately to the client.
- **After the client has created the account:** remove the variable (`vercel env rm SETUP_TOKEN production --scope furia-ninja`), redeploy or leave it (the page is already closed by the existing account), and delete the local link file.

## 8. Owner actions that remain
1. Send the private setup link to the client (section 7); afterwards remove `SETUP_TOKEN`.
2. Set the production branch tracking to `milestone-4` in the dashboard (section 4) or keep releasing with `vercel deploy --prod`.
3. Review and accept Milestone 4.
