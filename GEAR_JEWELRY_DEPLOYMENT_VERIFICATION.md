# Equipment and jewelry add-on: deployment verification

Date: 4 November 2026. Status: **LIVE AND VERIFIED** at https://furia-ninja.vercel.app. Not accepted or closed.

| Item | Value |
| --- | --- |
| Project | Vercel team `furia-ninja`, project `furia-ninja` |
| Deployed commit | `60c441ecb02d3bf07ca0e6536d8dc4b0c2d7361f`, branch `milestone-4` (read from the deployment metadata, clean tree) |
| Production deployment | `dpl_GjWgLSWo1p4wpbVu7DWNnJf62QjQ` , aliased to https://furia-ninja.vercel.app. Earlier in the round `dpl_AccAwe3vP9g7qSbWBXCfPSnekBa6` ran `b071872` and `dpl_3UZkidvYvdsLSTsk3bkh4oi9X8Sw` ran `a064c32` |
| Production branch setting | still `main` (dashboard only). Ignored Build Step `if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 0; else exit 1; fi` confirmed. `main` is at `37d74fb` and was never touched or deployed |
| Database | Neon `neon-indigo-blanket` (Production) and `furia-preview` (Preview), separate projects |
| Migration | `20261103180000_gear_families`, additive, applied to Preview then Production |

## Order followed

1. Read the package, the brief and the repository; confirmed the branch, the guard and the setup state (`/setup` 404, no `SETUP_TOKEN`).
2. Production backup `production-20261103-pre-gear` (41 tables, 9,084 rows), verified, git-ignored.
3. Transcribed and planned the import; dry run: 71 names, 68 sourced, 3 name only, 143 of 143 images assigned, 78 equipment and 63 jewelry versions.
4. Local suites: SQLite, PostgreSQL, `tsc`, `eslint`, build, local browser suite.
5. Preview: migration, import twice (identical), same commit tested on the real Preview database through a local server (72 of 73; the HSTS check cannot apply to http). The deployed Preview URL was not browsed: creating a protection-bypass secret on the client's project was denied by the permission check and was not worked around.
6. Production: migration, import twice (identical), every row of the backup confirmed present and unchanged, then one `vercel deploy --prod` from a clean pushed tree.
7. Two small wording fixes (tier labels, and a version without printed statistics saying «0 piezas») went through the same gates and two more production deployments. Commits after `60c441e` are documentation only.

## Live checks (production, HTTPS, read-only, 75 of 75)

Health and HSTS; session cookie Secure and HttpOnly; anonymous visitors redirected; regular user 404 on `/admin`; administrator access; `/gems` 404; 177 ninjas; client corrections still visible. New: catalogue counts equal the stored rows (78 + 63 = 141); Sand Burial three cards; Warlord four cards; variants named «variante»; name-only sets show no card; tier and statistic filters equal the stored values (55 sets with an 8-piece bonus, 28 with Speed 70000 or more); effect search «aturdir» on equipment 2 of 2 stored; Match Any = union and Match All = intersection (equipment, jewelry, ninjas); duplicates count once; the mode survives paging, reload and Clear; detail pages for Sand Burial R1, Warlord and Mekansm; 143 private source sheets registered; source path answers 404; 390 px without horizontal scrolling.

## Data after release

| Table group | Before | After |
| --- | --- | --- |
| Ninjas, abilities, ninja effects, users, ninja source assets | 177, 316, 4,395, 4, 394 | 177, 316, 4,395, 4, 394 |
| Gear: families, equipment versions, jewelry versions, pieces, categories, tiers, effects | 0 | 71, 78, 63, 462, 252, 541, 2,281 |
| Source assets and records added | 0 | 143 and 144 |

Logs: no error entries after the release. Setup page: 404. Secrets: none in Git, reports or the PDF.

## Rollback

Vercel Instant Rollback returns the code (the migration is additive, so old code ignores the new columns and table). Data: delete the gear rows by slug, or restore `production-20261103-pre-gear` into an empty database with `scripts/pg-backup-restore.mjs`. The production database was never reset.

## Addendum: value sort release

| Item | Value |
| --- | --- |
| Deployed commit | `d43c7ade548dad59f3c0bf5b02c9c73890551d33`, branch `milestone-4` (metadata read, clean tree, one deploy command) |
| Production deployment | `dpl_6aKGgtVztRX1nLKYSZwYnJvy9RVS`, aliased to https://furia-ninja.vercel.app |
| Database | no schema change, no migration, no import; production counts identical before and after; no backup needed (the verified backup of 3 November stays) |
| Branch guard | production branch setting still `main`; Ignored Build Step unchanged; `main` at `37d74fb`, never touched |
| Live checks | 93 of 93 over HTTPS, run twice, including the value sort on equipment, jewelry and ninjas |
| Preview | Preview deployment built and Ready; its address could not be browsed (protection) and the Preview database is too slow to read from this machine, so the commit was tested against a local PostgreSQL with the full catalogue (92 of 93, HSTS cannot apply to http) |
| Logs and setup | no error entries; `/setup` answers 404 |
