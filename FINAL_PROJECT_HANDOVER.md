# Furia Ninja: project handover

Status on 27 October 2026: **live at https://furia-ninja.vercel.app**, verified (`PRODUCTION_SMOKE_TEST_RESULTS.md`), including the client's last request, search by effect (`MILESTONE_4_FINAL_CLIENT_CHANGE_VERIFICATION.md`). The first administrator exists. Remaining: the client's acceptance.

## What was delivered
- Private, Spanish-first web application: ninjas (177, with 79 Supporter cards and 175 full cards), skills, talents, awakenings with the client's replacement rules, effects and conditions, equipment, jewelry, gems (hidden) and sets (structures ready, no data supplied), search, filters (including **Buscar por efecto**, a search for a specific effect such as aturdir, curación, velocidad or inmunidad), sorting, detail pages, administration with roles, responsive layout.
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

## First administrator (done)
The client created the administrator account on the private one-time page. The one-time token was then removed from Vercel (Production and Preview), the local link file was deleted, and `/setup` answers 404. Further users are created from the administration screen. The script `scripts/create-admin.mjs` remains as a fallback for the owner.

## Search by effect
The code is in `src/game/effect-search.ts` (index, Spanish and English vocabulary, matching rules); the field is in `src/components/game/list-controls.tsx`; the address parameter is `fx` (repeatable). To add Spanish names for effects or statistics, edit the `STATUS_ES` and `STAT_ES` tables at the top of that file; a test checks that every suggestion finds ninjas. Several effects mean "any of them". See `MILESTONE_4_FINAL_CLIENT_CHANGE_VERIFICATION.md` for terms and limitations.

## Releasing a new version
- Pushes to `milestone-4` create **Preview** deployments (Preview database); pushes to `main` build nothing (Ignored Build Step, because `main` still holds Milestone 1).
- Release to production from a clean checkout of the tested commit: `vercel deploy --prod --scope furia-ninja` (run it once; a repeat creates a second identical deployment), then check `GET /api/health` and run `scripts/production-smoke.mjs` (read-only). Or set Settings, Environments, Production, Branch Tracking to `milestone-4` in the dashboard so that pushes release automatically.
- Database changes: edit `prisma/schema.prisma`, `npm run db:pg:schema`, add a PostgreSQL migration, take a backup, apply `node scripts/with-vercel-env.mjs production -- npx prisma migrate deploy --schema prisma/postgres/schema.prisma`.

## Backup and restore (tested)
- Backup (read-only, about 7 MB uncompressed): `node prisma/make-postgres-schema.mjs --local && npx prisma generate --schema .local-pg/schema.prisma` once, then `node scripts/with-vercel-env.mjs production -- node scripts/pg-backup-restore.mjs backup prisma/backups/production-YYYYMMDD.json.gz`. The file contains account password hashes: keep it in the git-ignored `prisma/backups` folder or private storage. Do this before every release and weekly.
- Check a backup against the database: `... pg-backup-restore.mjs verify <file>`.
- Restore into an EMPTY database (a new Neon database, or after dropping the tables): `... pg-backup-restore.mjs restore <file>` (one transaction, refuses a populated target, compares checksums afterwards). Tested: the production backup of 26 October (41 tables, 9,074 rows) restored identically on a clean server.
- Neon also keeps point-in-time history (short on the Free plan). The original SQLite file and its dated copies stay in `prisma/backups`.

## Production configuration
Variables (set in Vercel, never in Git): `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations), `SESSION_DAYS`, `FEATURE_GEMS`. Build command `npm run vercel-build`, Node 22.x. The Vercel production branch is still `main` (dashboard-only setting, see "Releasing a new version"); the live release was made from `milestone-4`, commit `e812303` (effect search). The earlier release was `89cb71b`.

## Changing the data after launch
Use the administration for content. Bulk reference data lives in `data/reference/` and is loaded with `npm run db:ingest` against the target database (it is repeatable and never duplicates). Take a Neon restore point first.

## Backups and rollback
Neon restore points (Pro projects keep history) plus a copy of the database before each release. Rollback of code: Vercel Instant Rollback. The production database is never reset.

## Private material (not in Git, not uploaded)
`docs/m2-handoff`, `docs/m3-handoff` (client screenshots and source texts), `prisma/backups`, `*.db`. Keep them in the owner's storage.

## Open data requests
Equipment, jewelry and gem source material; cards for Might Guy and Sasuke (Taka); Spanish for Guren, Final Sasuke and the end of Sai's text; Nagato Uzumaki screenshots; the client's answers listed in `MILESTONE_4_OPEN_ITEMS.md`.
