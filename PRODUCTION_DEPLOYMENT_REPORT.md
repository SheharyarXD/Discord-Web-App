# Production deployment report

**Status: BLOCKED on one account action in the client's Vercel team.** Everything that can be prepared and verified outside Vercel is finished. Nothing was deployed, no database was created in the cloud, and no billing resource was created.

Date: 26 October 2026. Branch `milestone-4`, last commit of this round pushed to `origin/milestone-4`.

## 1. Access check

| Check | Result |
| --- | --- |
| Vercel CLI | 59.11.7, signed in through the supported device flow (the account owner approved it in the browser) as `sheharyarxd-3241` |
| Team `furia-ninja` (FURIA NINJA, plan Pro) | visible to the account |
| Role of the account in the team | **Developer** |
| Existing projects in the team | none |
| Creating the project `furia-ninja` | **refused: 403 "You don't have permission to create the project"** |
| Installing Neon from the Marketplace | refused until the Marketplace terms are accepted in the browser (`action_required`) |
| Personal account `xd-gamings-projects` | **not used**; nothing was created there |

## 2. What the account owner must do (smallest set)

1. **Role.** In the Vercel dashboard open the team `furia-ninja`, Settings, Members, and change the role of the developer account (`sheharyarxd-3241`) from *Developer* to *Member* (or *Owner*). A Developer cannot create projects, install integrations or deploy to production. Alternative: the client creates the project himself (step 3) and gives the developer the Member role.
2. **Database terms.** Open https://vercel.com/furia-ninja/~/integrations/accept-terms/neon?source=cli and accept the Neon Marketplace terms. Choose the **Free** plan. No paid plan is needed for this data (about 9,000 rows). Any paid upgrade needs the client's decision.
3. **Git connection.** The repository `SheharyarXD/Discord-Web-App` belongs to a personal GitHub account. The Vercel GitHub app must be installed on that account (Vercel project, Settings, Git, Connect). Production branch: **`milestone-4`**, because it holds the final tested release. (`main` is still the Milestone 1 code. Merging `milestone-4` into `main` is a separate decision for the owner.)

After these three actions the remaining work is mechanical and scripted (section 5). Estimated time: under one hour.

## 3. What is ready

- PostgreSQL schema derived from the single source schema (`prisma/postgres/schema.prisma`), baseline migration with the 16 integrity triggers translated to PostgreSQL, and a test that fails when the derived file is out of date.
- Data migration script with all-or-nothing transaction, per-table content checksums and a refusal to write into a populated database; rehearsed successfully (see `PRODUCTION_DATABASE_MIGRATION_REPORT.md`).
- The application builds with the PostgreSQL client exactly as Vercel will build it (`npm run vercel-build`) and passes the whole real-browser run against PostgreSQL (see `PRODUCTION_SMOKE_TEST_RESULTS.md`).
- Name searches are case-insensitive on PostgreSQL; the parser vocabulary file is traced into the serverless admin routes; `.vercelignore` keeps client screenshots, source packages, backups and local databases out of any CLI upload; `engines.node` is 22.x.

## 4. Deployment architecture

| Part | Choice |
| --- | --- |
| Hosting | Vercel (Next.js 16, serverless functions), team `furia-ninja` |
| Database | Neon PostgreSQL through the Vercel Marketplace, Free plan; region near the Vercel function region |
| Connections | `DATABASE_URL` pooled (runtime), `DIRECT_URL` direct (migrations only) |
| Sessions | database-backed sessions with a Secure, HttpOnly cookie in production, so they persist across serverless instances |
| Environments | Production, Preview (separate Neon branch with safe test data), local development (SQLite or local PostgreSQL) |
| Local development | unchanged: SQLite file; the PostgreSQL schema is generated from the same source |

Environment variables (names found in the code; values are set in Vercel, never committed):

| Variable | Production | Preview |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection | Neon preview-branch pooled connection |
| `DIRECT_URL` | Neon direct connection | Neon preview-branch direct connection |
| `SESSION_DAYS` | 14 | 14 |
| `FEATURE_GEMS` | false | false |

No `NEXT_PUBLIC_` variable exists or is needed. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used only once, on the owner's machine, to create the administrator (section 5, step 6); they are not stored in Vercel.

## 5. Runbook once access is granted

1. `vercel link --yes --project furia-ninja --scope furia-ninja`; set framework Next.js, Node 22.x, build command `npm run vercel-build`, production branch `milestone-4`.
2. `vercel integration add neon --scope furia-ninja` (Free plan); create a separate Neon branch for Preview; map `DATABASE_URL` and `DIRECT_URL` (= the unpooled URL) in Production and Preview; set `SESSION_DAYS` and `FEATURE_GEMS`.
3. Back up: copy `prisma/dev.db` (done again immediately before migration) and note the Neon restore point.
4. Preview database: `prisma migrate deploy --schema prisma/postgres/schema.prisma`, then `TARGET_DATABASE_URL=<preview direct url> node scripts/migrate-sqlite-to-postgres.mjs --csv ...`.
5. Preview deployment from the final commit; log in with a staging administrator created only in the preview database; run the browser checks against the preview URL; read the build and runtime logs.
6. Production: same migration and checksum comparison on the production database, then `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed` from the owner's machine pointed at the production `DIRECT_URL` (creates the first administrator; the password is chosen by the owner and never written to a file).
7. Promote to production; verify `https://<project>.vercel.app/api/health`, sign in, run the read-only smoke list, check function logs.
8. Rollback plan: Vercel "Instant Rollback" to the previous deployment; database is never reset; restore from the Neon restore point or from the SQLite backup plus a repeat of step 4 on an empty database.

## 6. Costs and approvals outstanding
- Neon Free plan and Vercel Pro (already owned by the client): no extra cost expected. Nothing paid was started.
- Custom domain: optional, not purchased.
- Approvals needed from the account owner: the three actions in section 2.
