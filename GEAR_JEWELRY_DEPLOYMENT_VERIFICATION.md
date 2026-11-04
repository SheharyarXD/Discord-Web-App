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

## Addendum: exact piece counts, jewelry slot and 8-piece bonus release

| Item | Value |
| --- | --- |
| Deployed commit | `2c8e9ccf7c5d1b6498d58fadbd3496540879614d`, branch `milestone-4` (metadata read, clean tree, one deploy command); the feature commit is `457c8c4` |
| Production deployment | `dpl_9mXMySeF4deGfhTcEhxWEZLTiTQY`, aliased to https://furia-ninja.vercel.app |
| Database | no schema change, no migration, no import; production counts identical before and after (ninjas 177, abilities 316, ninja effects 4,395, users 4; gear 71 families, 78 equipment versions, 63 jewelry versions, 462 pieces, 252 categories, 541 tiers, 2,281 effects, 143 assets, 144 records); no backup needed (the verified backup of 3 November stays) |
| Branch guard | production branch setting still `main`; Ignored Build Step unchanged; `main` at `37d74fb`, never touched |
| Live checks | 111 of 111 over HTTPS, including the exact Agility + 2 pieces + Control Rate + highest to lowest scenario compared with the stored data, exact piece counts on equipment, the 8-piece block, Match All / Any and 390 px; the temporary accounts were removed and no game data changed |
| Preview | Preview deployment built and Ready; its address could not be browsed (protection) and the Preview database is too slow to read from this machine, so the commit was tested on a local PostgreSQL with the full catalogue (110 of 111, HSTS cannot apply to http) |
| Logs and setup | no error entries after the release; `/setup` answers 404; `/api/health` answers ok |

**Note on live data after that release.** While the live smoke checks were being repeated for screenshots, an administrator created a new equipment set, `BLAZZTRY` (no family or version, one piece, one 2-piece bonus: Force +110% and Agility +110%, created 2026-11-04 between 18:55 and 18:58 UTC) through the admin form. This is the owner's own entry, not an effect of any release, and it was left untouched. Production therefore holds 79 equipment sets, 463 pieces, 235 equipment bonuses and 6,680 effects; the catalogue list shows only sets linked to a named family (78 equipment versions). The counts quoted for the releases were read before this and were identical before and after each deployment. Correction of an earlier guess: the single failed live check (0 shown, 1 stored for Control Rate at 2 pieces) was my own test oracle counting that family-less set; the check now counts catalogue sets only.

## Addendum: confirmed cumulative bonuses release

| Item | Value |
| --- | --- |
| Deployed commit | `e533df9d141da506e2c70d8fd105d87df0e0ec86`, branch `milestone-4` (metadata read, clean tree, one deploy command) |
| Production deployment | `dpl_6GwvUAqDgr9Fd1jxxuAb8jCpGKec`, aliased to https://furia-ninja.vercel.app (previous production deployment: `dpl_9mXMySeF4deGfhTcEhxWEZLTiTQY`, commit `2c8e9cc`) |
| Before the release | production on `2c8e9cc`; `main` at `37d74fb`; gear counts read first: 71 families, 78 equipment versions, 63 jewelry versions, 462 pieces, 252 categories, 235 equipment bonuses (234 + the owner's BLAZZTRY), 307 jewelry bonuses, 2,285 gear effects (2,281 + BLAZZTRY), 143 assets, 144 records; ninjas 177, abilities 316, ninja effects 4,395, users 4 |
| Database | no schema change (two comment lines reworded), no migration, no import, no reset; no backup needed (the verified backup of 3 November stays); the stored `tierStacking` column is not read any more, so no data was touched |
| Branch guard | production branch setting still `main`; Ignored Build Step unchanged; `main` never touched |
| Preview | Preview deployment of `e533df9` built and Ready; its address cannot be browsed (protection) and the Preview database is too slow to read from this machine, so the commit was tested on a local PostgreSQL with the full catalogue: 123 of 124 (HSTS cannot apply to http) |
| Live checks | 124 of 124 over HTTPS, including Deatbone with 6 pieces (+70% with the breakdown on the card and on the detail page), the cumulative order against the stored data, the 2, 4 and 6 piece counts, the Agility 2-piece Control Rate example, the 8-piece block, Match All / Any, 390 px; temporary accounts removed |
| Logs and setup | no error entries after the release; `/setup` answers 404; `/api/health` answers ok |
