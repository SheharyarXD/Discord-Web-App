# Furia Ninja: project handover

Status on 26 October 2026: the application, the data and the PostgreSQL migration path are finished and verified locally. The live deployment waits for three account actions in the client's Vercel team (`PRODUCTION_DEPLOYMENT_REPORT.md`, section 2).

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

## Production configuration
Variables (set in Vercel, never in Git): `DATABASE_URL` (pooled), `DIRECT_URL` (direct, migrations), `SESSION_DAYS`, `FEATURE_GEMS`. Build command `npm run vercel-build`, Node 22.x, production branch `milestone-4`.

## Changing the data after launch
Use the administration for content. Bulk reference data lives in `data/reference/` and is loaded with `npm run db:ingest` against the target database (it is repeatable and never duplicates). Take a Neon restore point first.

## Backups and rollback
Neon restore points (Pro projects keep history) plus a copy of the database before each release. Rollback of code: Vercel Instant Rollback. The production database is never reset.

## Private material (not in Git, not uploaded)
`docs/m2-handoff`, `docs/m3-handoff` (client screenshots and source texts), `prisma/backups`, `*.db`. Keep them in the owner's storage.

## Open data requests
Equipment, jewelry and gem source material; cards for Might Guy and Sasuke (Taka); Spanish for Guren, Final Sasuke and the end of Sai's text; Nagato Uzumaki screenshots; the client's answers listed in `MILESTONE_4_OPEN_ITEMS.md`.
