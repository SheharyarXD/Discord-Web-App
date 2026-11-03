# Equipment and jewelry add-on: technical report

Written for: the project owner (technical reader). Date: 4 November 2026. Live at https://furia-ninja.vercel.app, commit `a064c32ba5315a902cfa11732790abf573e49851` on branch `milestone-4`. This add-on is separate from Milestone 4 and is not accepted or closed until the client says so.

## 1. What was built

| Area | Result |
| --- | --- |
| Data | 71 named sets: 68 with source images, 3 name only (Legendary, Fate, Totsuka). 143 source PNGs, all assigned. 78 equipment versions and 63 jewelry versions, 714 pieces, 541 tiers, 2,281 effect rows (239 kept as source text only) |
| Model | New `GearFamily` (the named set). `EquipmentSet` and `JewelrySet` rows are the versions, with `familyId`, `versionKey`, `versionLabel`, `versionBasis`. Pieces, tiers and effects reuse the existing models and trigger-protected rules |
| Pages | `/equipment`, `/jewelry` and `/sets` are one catalogue (one card per version) with search, version, tier, printed statistic and effect filters. `/equipment/pieces` and `/jewelry/pieces` keep the old per-piece lists. `/sets/<kind>/<slug>` is the detail page |
| Effect search | The ninja effect search was generalized to equipment and jewelry, with the new **Match Any / Match All** mode on all three lists (`fxm=all` in the address) |
| Import | `scripts/import-gear.ts` plans from the transcription files, writes through the existing set services, and is idempotent. Dry run, resume and retry options |

## 2. Data model and version rules

- `GearFamily(slug, name, sourceTitle, sourceStatus SOURCED|NAME_ONLY, metadata)`. Warlord's upgrade-cost schedule lives in the family metadata, never as an effect.
- `versionBasis`: `PRINTED` (the sheet prints the label), `CLIENT_STATED` (Sand Burial jewelry R1), `OWNER_MAPPING` (Sand Burial jewelry base, named by the package), `SEQUENCE` (image order only: variant A, B, C).
- A version is named R1 or R2 only when the source or the client says so. Sequence variants are never relabelled from stat size.
- Equipment and jewelry are separate categories (separate tables) linked by the family. Equipment-only sets work without jewelry; Summoning has one jewelry sheet and no jewelry is invented for its second equipment version.
- Each equipment version has six pieces (one per printed slot; a cell with two icons is one piece) and tiers at 2, 4 and 6 pieces. Each jewelry version has four categories (Force, Chakra, Agility, Power), a 2-piece effect per category and, where printed, one shared 8-piece effect. The four printed 8-piece texts are checked to be identical at import.
- Printed main statistics (for example Physical Attack 4000) are stored as piece effects with `note = PRINTED_MAIN_STAT`. Stat filters use them; effect search deliberately ignores them, so «aumento de velocidad» is not satisfied by every set that prints a Speed value.
- Effect rows keep the printed wording in `sourceText`. A clause becomes a structured row only when its wording matches a known pattern. The printed «Weaken enemy's ATK +30%» is stored as a 30 percent reduction on the enemy and keeps the printed text. Unclear wording (minus signs, a missing percent sign, misspellings, «After ...» sentences) is stored as text only with its trigger, never as a guessed mechanic.

## 3. Match Any and Match All

- `src/game/effect-search.ts`: `idsWithEffects(db, owner, terms, mode)` for `ninja`, `equipment` and `jewelry` owners. Each typed term resolves to a concept (state applied, immunity, statistic up or down, heal, fury, dispel) or, if the vocabulary does not know it, to a text search; then:
  - ANY (default) returns owners with at least one term.
  - ALL returns owners that have every distinct term, each possibly in a different ability, awakening, tier or category.
- Terms that resolve to the same concept, side and wording count once (aturdir, Aturdir and stun are one effect).
- Other filters stay ANDed; within a category they are still ORed, as before.
- The address carries `fx` (repeated) and `fxm=all`. Page and sort links, chip removal and reloads keep them. «Quitar filtros» keeps the chosen mode and removes the effects.
- Meaning is preserved: inflicting stun is not immunity to stun; «curación» (the Heal effect) is not the statistic «tasa de curación»; negated wording («cannot be stunned») does not match; ally, enemy and self are kept apart.
- Gear results show the tier where the effect sits («Bonus de 6 piezas») and say it does not mean the set is equipped or that a conditional effect is always active. The detail page no longer labels a tier effect «Siempre activo».

## 4. Test results (actual, this round)

| Check | Result |
| --- | --- |
| SQLite suite (`npx vitest run --maxWorkers=3`) | **327 passed, 1 skipped** (328 tests, 21 files). Before this add-on: 291 tests. 37 new: 31 in `tests/m7-gear-jewelry.test.ts`, 6 Match All / Any ninja tests in `tests/m6-effect-search.test.ts` |
| PostgreSQL suite (`npm run test:pg`, embedded server, real migrations) | **316 passed, 12 skipped** (SQLite-only and real-catalogue tests) |
| `tsc`, `eslint`, production build | clean |
| Existing tests | none weakened. Changes: the read-only API name list (`m2-platform`), and the PostgreSQL schema test now reads the baseline plus the additive migration and also checks that every migration is plain SQL |
| Local browser suite on a production build | **216 of 216** (183 earlier checks plus 33 for gear and Match All / Any) |
| Preview database (real PostgreSQL, full data), read-only smoke through a local server | 72 of 73. The one miss is the HTTPS and HSTS check, which cannot apply to `http://127.0.0.1` |
| Live production smoke over HTTPS (`scripts/production-smoke.mjs`) | **74 of 74** |

Noted honestly: the full vitest run can time out at 5 seconds per test when this machine is heavily loaded or when two runs overlap on the same temp database. Run alone, or with `--maxWorkers=3`, it is stable.

## 5. Release record

| Step | Result |
| --- | --- |
| Backup | `production-20261103-pre-gear` taken before any change: 41 tables, 9,084 rows, verified against the database, git-ignored |
| Branch and guard | production branch setting still `main` (dashboard only); Ignored Build Step unchanged and confirmed; `main` still at `37d74fb`, never touched |
| Migration | `20261103180000_gear_families` (additive: one table, four nullable columns on each set table, two foreign keys). Applied to Preview, then Production |
| Preview database | Imported twice in full; second run changed nothing |
| Preview deployments | Built and Ready from each push. **They were not browsed over HTTPS**: creating a temporary protection-bypass secret on the client's Vercel project was denied by the tool's permission check, and it was not worked around. The same commit was instead built with the PostgreSQL client and tested through a local server on the real Preview database (above) |
| Production import | Imported twice in full; second run changed nothing |
| Unchanged data | Ninjas 177, abilities 316, ninja effects 4,395, users 4, ninja source assets 394 before and after. `scripts/gear-preexisting-check.mjs`: every row of the backup is present and unchanged in all 41 tables; 13 tables only gained rows |
| Production deployment | `dpl_3UZkidvYvdsLSTsk3bkh4oi9X8Sw`, target Production, commit `a064c32` (metadata read, clean tree, one deploy command). Earlier in the round: `dpl_AccAwe3vP9g7qSbWBXCfPSnekBa6` at `b071872` before the tier-label fix |
| Logs | No error entries in the production runtime log |

## 6. Import behaviour and reliability

- The import never deletes or edits rows outside its own slugs; reference rows it needs (three new statistics, six slots, four jewelry types) are created only if missing.
- The direct Neon endpoint dropped connections from this machine now and then (about 230 ms per query). The import therefore retries a family after a transient error and has a `RESUME=1` mode. Prisma's interactive transaction limit was raised to 120 seconds for all services (`src/game/db.ts`); it only matters when a write is slow.
- Rollback: the code can go back with Vercel Instant Rollback. The migration is additive, so old code ignores the new columns and table. The data can be removed by deleting rows by slug, or restored from the backup into an empty database with `scripts/pg-backup-restore.mjs`.

## 7. Files

New: `src/game/gear-parse.ts`, `gear-import.ts`, `gear.ts`; `src/components/game/gear-catalogue.tsx`; pages under `src/app/(app)/equipment|jewelry/pieces`; `scripts/import-gear.ts`, `gear-status.mjs`, `gear-preexisting-check.mjs`; `data/gear-source/` (transcriptions and the image ledger, text only); `tests/m7-gear-jewelry.test.ts`; migrations for SQLite and PostgreSQL.
Changed: `effect-search.ts`, `schemas.ts`, `ninjas.ts`, `query-params.ts`, `list-controls.tsx`, `effect-line.tsx`, `set-bonus-list.tsx`, the three catalogue pages, `es.ts`, the two test helpers and the browser and smoke scripts.
Private and not committed: the four ZIPs, `docs/gear-handoff/` (the 143 images), the prompt files and the backups. `.gitignore` and `.vercelignore` keep them out of Git and out of deployments; the live site answers 404 for the source paths.

## 8. Known limits

- Nothing is marked verified. 15 of the 143 images were read twice with no difference; the other 128 have been read once. A human check against the images is still to be done (`GEAR_JEWELRY_OPEN_ITEMS.md`).
- About 15 percent of effect rows are source text only. They are searchable by their words; the vocabulary may miss unusual wording.
- Names are in English, which is authoritative here. No Spanish translation was invented.
- No item icons were cropped or published.
- The Vercel production branch setting still needs the owner to switch it to `milestone-4` in the dashboard if automatic releases are wanted. Releases here were made with `vercel deploy --prod`.
