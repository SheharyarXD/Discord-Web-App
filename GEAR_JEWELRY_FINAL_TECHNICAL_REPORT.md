# Equipment and jewelry add-on: technical report

Written for: the project owner (technical reader). Date: 4 November 2026. Live at https://furia-ninja.vercel.app, commit `60c441ecb02d3bf07ca0e6536d8dc4b0c2d7361f` on branch `milestone-4`. This add-on is separate from Milestone 4 and is not accepted or closed until the client says so.

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
| Local browser suite on a production build | **217 of 217** (183 earlier checks plus 34 for gear and Match All / Any) |
| Preview database (real PostgreSQL, full data), read-only smoke through a local server | 72 of 73. The one miss is the HTTPS and HSTS check, which cannot apply to `http://127.0.0.1` |
| Live production smoke over HTTPS (`scripts/production-smoke.mjs`) | **75 of 75** |

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
| Production deployment | `dpl_GjWgLSWo1p4wpbVu7DWNnJf62QjQ`, target Production, commit `60c441e` (metadata read, clean tree, one deploy command). Earlier in the round: `dpl_AccAwe3vP9g7qSbWBXCfPSnekBa6` at `b071872` and `dpl_3UZkidvYvdsLSTsk3bkh4oi9X8Sw` at `a064c32`, before two small wording fixes (tier label and «0 piezas») |
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

## 9. Addendum: sorting by the value of a selected effect

Client request: «When you search, for example, for control rate, there's no way to sort the results from highest to lowest. I know which item has the most in the entire game, and I'd like it to appear at the very top, followed by the next one, and so on.»

Live at commit `d43c7ade548dad59f3c0bf5b02c9c73890551d33` (`dpl_6aKGgtVztRX1nLKYSZwYnJvy9RVS`). No schema change and no data change.

**Updated by section 11.** The client has since confirmed that bonuses accumulate, so the value a result is ranked by is the cumulative total available with the selected piece count, not the largest single printed value. This section has been corrected where it would otherwise contradict that rule; the release record and counts below describe what was true at that release.

**What was added**
- The «Ordenar por» control of Ninjas, Equipamiento, Joyería and Conjuntos has two new options once an effect is selected: «Valor del efecto elegido: de mayor a menor» and «de menor a mayor» (`sort=fx:desc` or `fx:asc`).
- With two or more selected effects a second control, «Efecto que ordena» (`fxs=<effect>`), says which one controls the order. The default is the first selected effect. Match Any and Match All keep filtering exactly as before.
- Each result shows the total it was ranked by («Total acumulado con N piezas») with the printed bonuses it adds («Desglose por piezas»), and the individual printed bonuses («Bonos individuales»).

**How the ranking works** (`analyseEffects`, `compareRanks` in `src/game/effect-search.ts`)
1. Only the chosen effect is looked at. Every stored effect that matches it is put in a measure class made of what it does and its unit: increase of a statistic (percent or flat), damage reduction, fury gained or lost, or immunity to one state. An increase of Control Rate (+40%) is never compared with a reduction of the enemy's Control Rate (-20%), with a flat value, or with a different state's immunity.
2. Inside one class an owner's value is its cumulative total: the comparable additive set bonuses of every unlocked tier added together (section 11). A value that cannot be added (a ninja effect, a conditional effect) counts as a single printed value. A bigger reduction still counts as bigger.
3. Order, highest first: the best total; on a tie the printed value at the highest piece count, then at the next lower one; then alphabetical by name; then a fixed identity order (category, version key, slug). Lowest first reverses the numbers and keeps the same tie rule. A missing tier counts as the lowest.
4. The measures present are ordered: increases first, then damage reduction, fury gained, immunity, reductions, fury lost. The most-used unit of the first group is the primary measure; the others follow, grouped and labelled («Otra medida»). With a bare «tasa de control» the increases therefore come first and the enemy reductions after, apart.
5. After every number come, in this order: effects that exist only as source wording («Sin valor comparable»), effects with no number (a state, a heal), and, with Match Any, owners found only through another selected effect. They stay searchable and are labelled; nothing is invented. Wording-only effects are never turned into numbers, because their meaning is not unambiguous.
6. Negated wording («Cannot increase control rate») no longer matches a text-only statistic phrase either.

**Client's Susanoo example, on the real data:** both versions print Increase CC Rate +40% at 4 pieces; at 6 pieces variant A prints +15% and variant B +18%. Descending, variant B comes first; ascending, variant A. With the confirmed rule the values used are 58% for variant B (40 + 18) and 55% for variant A (40 + 15), so B is still first. In the whole Control Rate list the order is now Susanoo B 58%, Black Feather (equipment) 55%, Susanoo A 55%, Black Feather (jewelry, Chakra) 50%, Infernity 50%, then the sets at 40% (Crystalys B in Chakra, Indora, Amegakure).

**Tests (at that release; the current counts are in section 11)**
| Check | Result |
| --- | --- |
| SQLite suite | **347 passed, 1 skipped** (348 tests, 22 files); 20 new in `tests/m8-effect-sort.test.ts`: the comparison rule, address parameters, descending and ascending, ties, the Susanoo example on the real catalogue, several selected effects, a flat value, an enemy reduction, a negated phrase, wording-only effects, paging in both directions, empty results, ninjas |
| PostgreSQL suite | **331 passed, 17 skipped** (SQLite-only and real-catalogue tests) |
| `tsc`, `eslint`, production build | clean |
| Local browser suite on a production build | **235 of 235** (13 new checks) |
| Full catalogue on a local PostgreSQL (the Preview database could not be used from this machine, see below) | 92 of 93; the one miss is the HTTPS check, which cannot apply to `http://127.0.0.1` |
| Live production smoke over HTTPS | **93 of 93**, run twice. The top Control Rate result carried the largest value of the rule then in force; values never rise; ascending never falls; Susanoo B before A with the tiers shown apart; paging shows each set once; back, forward and reload keep the order; the choice of ordering effect works; 390 px without sideways scrolling; ninjas sort by Speed increase |

**Release record:** no migration and no backup were needed (no database change). The existing verified backup `production-20261103-pre-gear` remains; production tables were re-counted before and after (ninjas 177, abilities 316, ninja effects 4,395, users 4, gear unchanged). Preview deployment of the commit built and was Ready. Reading the full effect index from this machine to the Preview database took minutes (about 4 minutes for one query over this link; Vercel runs next to Neon), so the Preview smoke timed out. The same commit was instead tested against a local PostgreSQL holding the full catalogue. `main` and the production-branch guard were not touched. Production error log: no entries.

**Limits**
- Only structured values are ranked. About 15 percent of gear effect rows are wording only; they come after the numbers with an honest label.
- A state (stun, freeze) or a heal has no printed amount, so sorting by them leaves the order alphabetical.
- Printed values are still «pendiente de revisión»; a wrong transcription would rank wrongly.

## 10. Addendum: exact piece counts, jewelry slot and the separate 8-piece bonus

Client request: when searching a 2-piece bonus, 4 and 6 piece sets kept appearing; jewelry has fixed slots, so an Agility search must return only Agility pieces with the highest percentage of the chosen effect, and the full 8-piece bonus should be pointed out when it is stronger.

Live at commit `2c8e9ccf7c5d1b6498d58fadbd3496540879614d` (`dpl_9mXMySeF4deGfhTcEhxWEZLTiTQY`), branch `milestone-4`. No schema change, no migration, no data change. Terminology: the client wrote «gem sockets»; this means the four existing jewelry categories (Fuerza, Chakra, Agilidad, Poder). The hidden Gems feature was not activated.

**Data model facts checked first (no new fields needed)**
- Equipment bonuses carry `requiredPieces` 2, 4 or 6.
- Jewelry bonuses are of two shapes: `2:group` (one per category, `groupId` set) and `8:set` (set-wide, `groupId` null). Every one of the 252 jewelry pieces has a type key equal to its category key, so slot enforcement uses real data.

**What was built**
- `tier` is a piece count when an effect is selected (`EffectScope` and `inScope` in `src/game/effect-search.ts`). An effect printed only at a HIGHER piece count never qualifies, so a 2-piece search never shows an effect that exists only at 4 or 6 pieces; the bonuses of the selected tier and of the lower ones count together (section 11). Text-only wording at those tiers stays searchable and labelled. The detail page lists every bonus.
- New address parameter `slot` (`force|chakra|agility|power`, jewelry only; choosing it implies jewelry). It is enforced in the database query in `src/game/gear.ts` (`groups: { some: { key } }` and, for a tier, a bonus condition `OR [groupId null, group.key = slot]`) and again in the in-memory effect scope, so list, count and paging agree. The set-wide 8-piece bonus is not narrowed by the slot.
- Interface: «Ranura de la joya» radio group (Todas, Fuerza, Chakra, Agilidad, Poder) on `/jewelry` only; tier choices are 2, 4, 6 for equipment, 2 and 8 for jewelry, all four on `/sets`. Each ranked result shows the exact value large with its piece count and slot.
- Ranking uses the total available at the selected piece count and slot (section 11), with the same measure classes and tie rules as section 9.
- «Bono de 8 piezas» block (`FullSetBlock`): under a jewelry result that matched through a bonus at another tier, the set's 8-piece effects of the same version, as printed, with «Requiere el conjunto completo». A comparison is shown only when the same additive effect is printed in the 8-piece bonus: the total for the complete set (the slot's 2-piece bonus plus the 8-piece bonus) is shown next to the total for the selected pieces, with «Nota: el conjunto completo ofrece un bono mayor para este efecto.»; otherwise the block says no value of the same effect exists to add. It does not say the bonuses are active: that depends on the pieces worn.
- Match All / Any, effect chips, autocomplete, name search, printed-statistic ranges, version filter, existing sorts, pagination and counts keep working inside the selected slot and tier. With several effects the sorting effect is still chosen with «Efecto que ordena».

**Real-data results**
| Scenario | Result |
| --- | --- |
| Joyería, Agilidad, 2 piezas, aumento de tasa de control, mayor a menor | exactly the 8 sets whose Agility 2-piece bonus has it: six at +25%, then +20%, +10%; no other slot. Crystalys prints Control Rate +7% and +10% at 8 pieces, so with the complete set they total 32% and 35% and carry the «stronger» note |
| Same, Damage Rate | 3 sets show the «stronger» note (for example Kumogakure variant A: +25% at 2 pieces, 55% with the full set: 25 + 30) |
| Equipment Control Rate with 2 / 4 / 6 pieces | 0 / 9 / 10 sets (the tier and the lower ones), equal to the stored bonuses; the 2-piece search says nothing matches |
| Jewelry 8-piece Control Rate reduction | 8 sets matched on their 8-piece bonus alone |
| Match All / Any, slot Agility, tier 2 | All = A + B - Any |

**Tests**
| Check | Result |
| --- | --- |
| SQLite suite | **371 passed, 1 skipped** (372 tests, 23 files); 24 new in `tests/m9-tier-slot.test.ts` (piece-count scope, upgraded versions, wording-only and negated text, slot filtering, asc/desc, flat vs percent, 2 vs 8 pieces, the 8-piece block and its stronger/lower/equal/unrelated cases, Match All/Any in scope, chosen sorting effect, paging both directions, address parsing, plus real-catalogue tests against an independent database oracle) |
| PostgreSQL suite | **350 passed, 22 skipped** on the final run (two consecutive runs). One earlier run showed a single failure in a ninja value-sort test from the previous release that did not repeat; recorded here as an unexplained one-off, not hidden |
| `tsc`, `eslint`, production build | clean |
| Local browser suite on a production build | **253 of 253** (18 new checks, desktop and 390 px) |
| Full catalogue on a local PostgreSQL | 110 of 111; the one miss is the HTTPS check, which cannot apply to `http://127.0.0.1` |
| Live production smoke over HTTPS | **111 of 111** (see the deployment verification) |

**Release record:** commits `457c8c4` (feature) and `2c8e9cc` (smoke screenshots). One `vercel deploy --prod` from a clean tree; the deployment metadata reports `2c8e9cc` on `milestone-4`. `main` stayed at `37d74fb`; the production branch setting and the Ignored Build Step were not touched. The Preview deployment built and was Ready; as before, its address could not be browsed and the Preview database is too slow to read from this machine, so the commit was tested on a local PostgreSQL holding the full catalogue instead. Production error log: no entries. Production counts unchanged.

**Limits**
- Bonuses accumulate (confirmed); see section 11 for what is added and what is not.
- Wording-only effects are searchable but have no value to rank.
- A «stronger» note needs the same measure of the same effect printed in the 8-piece bonus; different effects (an own increase against an enemy reduction) are not compared.
- Printed values are still «pendiente de revisión».

**Note on live data after that release.** While the live smoke checks were being repeated for screenshots, an administrator created a new equipment set, `BLAZZTRY` (no family or version, one piece, one 2-piece bonus: Force +110% and Agility +110%, created 2026-11-04 between 18:55 and 18:58 UTC) through the admin form. This is the owner's own entry, not an effect of any release, and it was left untouched. Production therefore holds 79 equipment sets, 463 pieces, 235 equipment bonuses and 6,680 effects, of which 78 equipment versions are in the catalogue list (the list shows only sets linked to a named family). The counts quoted for the releases (71 families, 78 equipment versions, 462 pieces, 6,676 effects) were read before this and were identical before and after each deployment. Correction of an earlier guess: the single failed live check (0 shown, 1 stored for Control Rate at 2 pieces) was my own test oracle counting that family-less set while the catalogue list correctly does not show it. The check now counts catalogue sets only.

## 11. Addendum: confirmed cumulative bonuses

Client confirmation: «Regarding whether the bonuses stack, yes, they do. You can show them as a combined total», with a real screenshot: Deatbone, 2 pieces Damage Rate +30%, 6 pieces Damage Rate +40%, «they add up to 70%». The 4-piece tier has no Damage Rate and the 2-piece bonus stays active.

Live at commit `e533df9d141da506e2c70d8fd105d87df0e0ec86` (`dpl_6GwvUAqDgr9Fd1jxxuAb8jCpGKec`), branch `milestone-4`. No schema change (two comment lines of `prisma/schema.prisma` were reworded; no migration) and no data change.

**The rule** (`src/domain/cumulative.ts`)
- Equipment: with 2 pieces the 2-piece bonuses count; with 4 pieces the 2 and 4 piece ones; with 6 pieces the 2, 4 and 6 piece ones.
- Jewelry: each slot (Fuerza, Chakra, Agilidad, Poder) has its own 2-piece bonus. The complete set (8 pieces) adds the set-wide 8-piece bonus to the slot's 2-piece bonus. Slots are never added to each other; without a chosen slot every slot is its own total and the best one ranks.
- Only comparable additive values are added: the same statistic (or the same immunity), the same unit (percent or flat), the same target (own, ally, enemy) and the same direction, structured and unconditional. An own increase and a weakening of the enemy, a percentage and a flat value, and different statistics are never added.
- Not added, kept visible as printed: effects with a chance, a duration, a trigger, a condition, a target selection or alternatives, wording-only effects, effects with no number. A conditional number never outranks or joins an additive total.
- Nothing is invented: a total is a sum of printed values, listed part by part.
- The stored column `tierStacking` (UNKNOWN on every set) is no longer read: the rule applies to every equipment and jewelry set without touching the data. The admin field label says so.

**Search and ranking** (`src/game/effect-search.ts`, `src/game/gear.ts`)
- With an effect selected, the tier is the number of pieces equipped: bonuses at that tier and at lower tiers count; a bonus printed only at a higher tier never qualifies (a 2-piece search never matches an effect found only at 4 or 6 pieces). With several tiers selected the highest counts. Without an effect a tier still means «has a bonus at that piece count». Without a tier the complete set counts (6 or 8 pieces as printed).
- The database queries use the same scope (`requiredPieces <= N`, and for jewelry the slot condition) so the list, the count and the paging agree.
- A result is ranked by its best total; ties use the printed value at the highest piece count, then the next, then the name. Highest to lowest and lowest to highest, paging, Match All / Any, the choice of the sorting effect, URL parameters, back and forward are unchanged.
- Ninjas have no piece counts: their ranking still uses the single printed value (awakenings replace each other by the client's earlier rule).

**Interface** (Spanish)
- Result cards: «Bonos individuales» (each printed bonus at its piece count), then «Total de «efecto»», «Total acumulado con N piezas: +X%» shown large with the slot for jewelry, and «Desglose por piezas» (2 piezas: +30% + 6 piezas: +40% = +70%).
- Detail pages (`SetTiers`, `SetTotals`): «Bonos individuales» lists every threshold as printed; «Total acumulado» lists, for each threshold the set has, every additive total with its «Desglose por piezas». Result cards and detail pages use one function, so they agree (tested on every equipment set of the real catalogue).
- Removed: «No está confirmado si los niveles se suman o se sustituyen», «No se suman niveles», «porque no está confirmado si se acumulan» and «No se indica que los bonos se sumen». A test fails if they come back.
- Works at 390 px (browser checks on the result card and the detail page).

**Real-data results**
| Scenario | Result |
| --- | --- |
| Deatbone, Damage Rate, 6 pieces | **+70%** = 2 piezas +30% + 6 piezas +40% (the 4-piece tier has none); with 4 pieces +30%; with 2 pieces +30%. Also Avoid-injury +70% (30 + 40), Agility +35,000 (15,000 + 20,000), Defense +20% |
| Equipment, Damage Rate, 6 pieces, highest first | Sunfire 80%, Warlord SSR5 75%, then Deatbone, Hyuga, Moonlit and Butterfly at 70% (ties broken by the value at the highest piece count, then name), Warlord and Sarutobi 60% |
| Equipment, Damage Rate, 2 pieces | Kumogakure, Sakura, Tarrasque 40%, then Sand Burial 35%; nothing that only has it at 4 or 6 pieces |
| Joyería, Agilidad, 8 piezas, Damage Rate | Kumogakure (variants A and B) 55% = 25 + 30, then Hyuga and Pain 50% (8-piece bonus only), Sunfire 50% = 25 + 25 |
| Susanoo, Control Rate | variant B 58% (40 + 18), variant A 55% (40 + 15) |

**Tests**
| Check | Result |
| --- | --- |
| SQLite suite | **404 passed, 1 skipped** (405 tests, 24 files). 33 new in `tests/m10-cumulative.test.ts`: the additive identity, `cumulate` (Deatbone 30 + 40 = 70, a tier without the effect does not stop it, unlike things are not added, jewelry slots, rounding), fixtures for Deatbone and its R1 variant, several additive bonuses, a chance effect not added, an own increase against an enemy reduction, wording-only effects, equipment 2/4/6, jewelry 2/8 with slot compatibility, cumulative sorting both ways, Match All / Any, paging, address parameters, detail page against result card, the removed wording, and real-catalogue tests against an independent database oracle (the whole equipment list at 6 pieces, every detail page, jewelry Agility at 8 pieces). The m8 and m9 suites were updated to the confirmed rule |
| PostgreSQL suite | **379 passed, 26 skipped** (SQLite-only and real-catalogue tests); an earlier PostgreSQL run in this round had one transient serialization failure in an unrelated reference-data test and was run again with `--maxWorkers=3` |
| `tsc`, `eslint`, production build | clean |
| Local browser suite on a production build | **266 of 266** (desktop and 390 px; Deatbone card and page, cumulative sort against the stored data, counts at 2, 4 and 6 pieces, no «unconfirmed» text) |
| Full catalogue on a local PostgreSQL | 123 of 124; the one miss is the HTTPS check, which cannot apply to `http://127.0.0.1` |
| Live production smoke over HTTPS | **124 of 124** |

**Release record:** commit `e533df9` on `milestone-4`; Preview deployment of that commit built and was Ready (as before it cannot be browsed behind its protection, so the same commit was tested against a local PostgreSQL with the full catalogue). One `vercel deploy --prod` from a clean tree; the deployment metadata reports `e533df9d141da506e2c70d8fd105d87df0e0ec86` on `milestone-4`. `main` stayed at `37d74fb`; the production branch setting and the Ignored Build Step were not touched. No migration, no import, no backup needed (no database change; the verified backup of 3 November remains). Production error log: no entries; `/setup` answers 404.

**Limits**
- Jewelry slots are not added to each other: the client's rule confirms that tiers accumulate, not that the four slots do. With all eight pieces worn every slot's 2-piece bonus is active in the game; the website shows each slot separately and ranks the best one. If the client wants a cross-slot total it needs a separate rule.
- Immunity chances of the same status are added like other percentages; none of the real sets has the same immunity at two tiers.
- Totals use printed values that are still «pendiente de revisión»; a wrong transcription would add up wrongly.
- Whether an effect is active depends on the pieces worn; the pages say what is available with N pieces.
