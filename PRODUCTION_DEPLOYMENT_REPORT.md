# Production deployment report

**Status: LIVE AND VERIFIED** at **https://furia-ninja.vercel.app** (alias https://furia-ninja-furia-ninja.vercel.app). Date: 26 October 2026. Milestone 4 is not accepted and not closed; the first administrator account still has to be created by the owner (section 7).

## 1. Where it runs

| Item | Value |
| --- | --- |
| Vercel team / project | `furia-ninja` (FURIA NINJA, Pro) / `furia-ninja` (framework Next.js, Node 22.x) |
| Account used | `sheharyarxd-3241`, role Member (upgraded by the client from Developer after the first attempt was refused with 403) |
| Git | repository `SheharyarXD/Discord-Web-App`, branch **`milestone-4`** (the final tested release) |
| Production deployment | `dpl_GXvzE8hAHXV4xnYMXNqebJ1nbciq`, built from commit **`1873342`** (application code identical to the later documentation commits), region iad1 |
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
- **Production branch.** Vercel's API would not change the project's production branch, so it is still `main` (which holds the Milestone 1 code). Pushing to `main` would deploy that old code to production. Safe release method until the owner decides: `vercel deploy --prod` from `milestone-4`, **or** change the production branch to `milestone-4` in the dashboard (Project, Settings, Git), **or** merge `milestone-4` into `main`. Pushes to `milestone-4` now create Preview deployments that use the Preview database.
- **Preview isolation.** The Preview database is a separate Neon project (stronger than a branch). Preview deployments cannot reach production data.
- **Neon Free limits.** 1 GB storage, short point-in-time history, compute that sleeps when idle (first request after a pause is slower). Current data is a few MB. Keep a periodic copy (handover guide).

## 5. Rollback
- Code: Vercel Instant Rollback to the previous production deployment (or redeploy a previous commit).
- Data: the production database is never reset. Restore from the Neon history window, or recreate an empty database and rerun the migration script from the SQLite file (kept untouched and backed up).

## 6. Not done on purpose
- No custom domain, no paid plan, no change to the production branch, no merge into `main`.
- No administrator account was created: the password is the owner's choice.

## 7. Owner actions that remain
1. **Create the first administrator** (on the owner's machine, nothing is stored):
   `npx prisma generate --schema prisma/postgres/schema.prisma`, then
   `ADMIN_EMAIL=<email> ADMIN_PASSWORD='<10+ characters>' node scripts/with-vercel-env.mjs production -- node scripts/create-admin.mjs`, then `npx prisma generate` to return the local client to SQLite. Regular approved users are then created from the administration screen.
2. Decide the production branch (section 4).
3. Review and accept Milestone 4 after seeing the live site.
