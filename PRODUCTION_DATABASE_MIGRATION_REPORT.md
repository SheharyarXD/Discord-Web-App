# Production database migration report

**Status: migrated and verified on Preview and on Production (26 October 2026).** Local rehearsal first, then the Neon Preview database, then the Neon Production database.

## 1. Approach
SQLite stays the local and CI database. The production target is PostgreSQL (Neon). One source schema (`prisma/schema.prisma`) produces the PostgreSQL schema with `prisma/make-postgres-schema.mjs`; the committed result is checked by a test. Prisma 6.19 and Next.js 16 were not upgraded.

| Item | SQLite (kept) | PostgreSQL (new) |
| --- | --- | --- |
| Schema | `prisma/schema.prisma` | `prisma/postgres/schema.prisma` (generated, `DATABASE_URL` pooled + `DIRECT_URL` direct) |
| Migrations | `prisma/migrations` (3, unchanged; rollback and local history) | `prisma/postgres/migrations/20261026000000_postgres_baseline` (one baseline: 41 tables, indexes, foreign keys, 16 triggers) |
| Integrity rules | 16 SQLite triggers | 16 PostgreSQL triggers (plpgsql, `check_violation`, same messages) |
| Decimal numbers | NUMERIC affinity | exact decimals |
| Name search | LIKE (case-insensitive for ASCII) | `mode: insensitive` through `src/server/search-mode.ts` |
| Accent-insensitive search | normalized columns | unchanged (normalized columns) |

Differences handled: trigger syntax, case-insensitive `contains`, SQLite-only tests (the M1 to M2 upgrade chain and `PRAGMA` checks are skipped on PostgreSQL; PostgreSQL enforces foreign keys at all times). Not reproduced: collation. The local test server uses binary ordering (`C`); Neon uses its own default collation, so the order of names containing accented letters may differ slightly from the local order.

## 2. Data migration script
`scripts/migrate-sqlite-to-postgres.mjs`
- reads the 41 tables through the Prisma models, in foreign-key order; self-referencing tables (Ability, Formation) are loaded parents first so no foreign key or trigger is bypassed;
- writes everything in **one transaction** (all or nothing; a failed run leaves nothing and can be run again);
- **refuses to write into a database that already holds data**;
- afterwards reads both sides again and compares row counts and a SHA-256 of every table's content (dates, decimals and nulls normalised); exits with an error on any difference;
- never prints a connection string.

## 3. Rehearsal (local PostgreSQL 18.4, throw-away database)

| Check | Result |
| --- | --- |
| Baseline migration applies | yes, on an empty database |
| Tables / rows copied | 41 tables, 9,074 rows (those tables that hold data: 25) |
| Count and content checksum comparison | **all 41 tables MATCH** (`PRODUCTION_DATA_RECONCILIATION.csv`) |
| Second run into the populated database | refused (`the target is not empty`) |
| First attempt (self-reference order bug) | failed inside the transaction and left nothing; fixed; this is the safe-retry behaviour |
| Key figures after the copy | 177 ninjas, 79 Supporter cards linked, 175 full cards, 120 awakening stages, 4,395 effect rows, 76 aliases, 394 source assets, 1,650 source records: identical to SQLite |
| Users | the development database holds **0 users** (all test accounts are removed after each test run). No password hash had to be migrated; the production administrator is created by the owner (runbook step 6) |
| Equipment, jewelry, gems | 0, 0, 0 (copied as empty; nothing invented) |
| Whole test suite on PostgreSQL (`npm run test:pg`) | 261 passed, 7 skipped (SQLite-only), 0 failed |
| Real-browser run on the PostgreSQL production build | 165 of 165 pass |

Client corrections confirmed present in the copied data by the tests and checksums: Shodai Hokage verified as an alias of First Hokage (one ninja); each later awakening replaces the previous (17 replace, 1 cancels, 3 upgrade; Natsu Dragneel, Cursed Tayuya, Kusanagi Kyo, First Hokage, Hinata, Sage Jugo cases tested); Kimono Kurenai's Spanish complete (10 of 10 lines); Mitarashi Anko 45000, Uchiha Hikari 46000, Ōtsutsuki Isshiki 38000 unchanged; Sai still flagged partial (the Spanish screenshot has not been supplied to the workspace); all 15 ranks present; gems hidden.

## 4. Executed on Neon (Preview, then Production)

| Step | Preview database | Production database |
| --- | --- | --- |
| Backup before | `prisma/backups/dev-pre-neon-20261026.db` | `prisma/backups/dev-pre-production-migration-20261026.db` (integrity ok, 177 ninjas) |
| `prisma migrate deploy` (direct URL) | applied | applied |
| Data copy, one transaction | committed | committed |
| Comparison | 41 of 41 MATCH | 41 of 41 MATCH |
| First production attempt | | stopped before writing anything: the default Prisma client was still the PostgreSQL one used for the preview test; fixed by regenerating the SQLite client; no data was touched |
| Users | 0 | 0 (the owner creates the administrator with `scripts/create-admin.mjs`) |

## 5. Restore strategy
1. Take a fresh copy of `prisma/dev.db` and record the Neon restore point.
2. `prisma migrate deploy --schema prisma/postgres/schema.prisma` with the direct URL (never `migrate dev` or `migrate reset`).
3. Run the migration script with `TARGET_DATABASE_URL` set to the direct URL; keep the CSV.
4. If anything fails: nothing was written (single transaction). Fix and run again. If a later problem is found: restore from the Neon history window (short on the Free plan) or drop and recreate the empty database and repeat; the SQLite file is the untouched source of truth. `--verify-only` compares an existing database with the source at any time.
5. The production database is never reset after users exist.

`PRODUCTION_DATA_RECONCILIATION.csv` is the comparison of the real production database with the SQLite source: 41 of 41 tables identical by row count and content checksum (9,074 rows).
