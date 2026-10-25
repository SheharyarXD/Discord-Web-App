# Furia Ninja: project handover

Status on 26 October 2026: **live at https://furia-ninja.vercel.app**, verified (`PRODUCTION_SMOKE_TEST_RESULTS.md`). Remaining: create the first administrator (below) and the client's acceptance.

## What was delivered
- Private, Spanish-first web application: ninjas (177, with 79 Supporter cards and 175 full cards), skills, talents, awakenings with the client's replacement rules, effects and conditions, equipment, jewelry, gems (hidden) and sets (structures ready, no data supplied), search, filters, sorting, detail pages, administration with roles, responsive layout.
- Source code: https://github.com/SheharyarXD/Discord-Web-App, branch `milestone-4` (the final tested release).
- Reports of every milestone and the data audit files in the repository root.

## Stack
Next.js 16, React 19, TypeScript, Prisma 6, Tailwind 4. SQLite for local development and tests; PostgreSQL (Neon) for production.

## Daily commands
| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Local database and data | `npx prisma migrate deploy`, `npm run db:ingest` |
| First administrator (local) | `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed` |
| Run | `npm run dev` |
| Tests (SQLite) | `npm test` |
| Tests (PostgreSQL, local server downloaded by a dev dependency) | `npm run test:pg` |
| Typecheck, lint, build | `npm run typecheck`, `npm run lint`, `npm run build` |
| Regenerate the PostgreSQL schema after changing `prisma/schema.prisma` | `npm run db:pg:schema` (a test fails if it is stale) |
| Apply PostgreSQL migrations | `DATABASE_URL=... DIRECT_URL=... npm run db:pg:deploy` |
| Copy the SQLite data to an EMPTY PostgreSQL database | `TARGET_DATABASE_URL=<direct url> node scripts/migrate-sqlite-to-postgres.mjs --csv PRODUCTION_DATA_RECONCILIATION.csv` (add `--verify-only` to compare later) |

## First administrator
`npx prisma generate --schema prisma/postgres/schema.prisma`, then `ADMIN_EMAIL=<email> ADMIN_PASSWORD='<10+ characters>' node scripts/with-vercel-env.mjs production -- node scripts/create-admin.mjs`, then `npx prisma generate` (back to the local SQLite client). The password is chosen by the owner and never stored.

## Releasing a new version
Pushes to `milestone-4` create **Preview** deployments (Preview database). Vercel's production branch is still `main`: release with `vercel deploy --prod` from the tested branch, or change the production branch in the dashboard, or merge into `main`. Database changes: edit `prisma/schema.prisma`, run `npm run db:pg:schema`, add a PostgreSQL migration, and apply it with `node scripts/with-vercel-env.mjs production -- npx prisma migrate deploy --schema prisma/postgres/schema.prisma` after a backup.

## Production configuration
Variables (set in Vercel, never in Git): `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations), `SESSION_DAYS`, `FEATURE_GEMS`. Build command `npm run vercel-build`, Node 22.x. Vercel production branch: `main` (see "Releasing a new version"); the live release was made from `milestone-4`.

## Changing the data after launch
Use the administration for content. Bulk reference data lives in `data/reference/` and is loaded with `npm run db:ingest` against the target database (it is repeatable and never duplicates). Take a Neon restore point first.

## Backups and rollback
Neon restore points (Pro projects keep history) plus a copy of the database before each release. Rollback of code: Vercel Instant Rollback. The production database is never reset.

## Private material (not in Git, not uploaded)
`docs/m2-handoff`, `docs/m3-handoff` (client screenshots and source texts), `prisma/backups`, `*.db`. Keep them in the owner's storage.

## Open data requests
Equipment, jewelry and gem source material; cards for Might Guy and Sasuke (Taka); Spanish for Guren, Final Sasuke and the end of Sai's text; Nagato Uzumaki screenshots; the client's answers listed in `MILESTONE_4_OPEN_ITEMS.md`.
