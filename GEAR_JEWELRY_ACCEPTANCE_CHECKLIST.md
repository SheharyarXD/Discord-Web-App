# Equipment and jewelry add-on: acceptance checklist

Date: 4 November 2026. VERIFIED = checked in this round with the evidence shown. OPEN = needs the client or a human check. This add-on is separate from Milestone 4 and stays open until the client accepts it.

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | All 143 source images mapped to 71 named sets (68 sourced, 3 name only) | VERIFIED | `GEAR_JEWELRY_IMPORT_LEDGER.csv`; 143 of 143 assigned; test `source reconciliation` |
| 2 | Equipment: six slots with printed statistics, tiers at 2, 4 and 6 pieces | VERIFIED (stored as read) | 78 versions, 462 pieces, 234 tiers in production |
| 3 | Jewelry: four categories, 2-piece effect per category, shared 8-piece effect | VERIFIED (stored as read) | 63 versions, 252 categories, 307 tiers |
| 4 | Equipment and jewelry kept as separate categories under one named set | VERIFIED | `GearFamily`; tests; Sand Burial and Warlord pages |
| 5 | Version labels only where the source or the client says so | VERIFIED | Sand Burial jewelry R1 (client), Warlord Base / SSR5 and R1 / R2 (printed); ten sets with unlabeled variants shown as «variante A, B, C» |
| 6 | Warlord upgrade costs kept as costs, SSR5 not relabelled R2 | VERIFIED | detail page and tests |
| 7 | Mekansm / MEKA discrepancy flagged, not renamed | VERIFIED | detail page shows the printed title |
| 8 | Legendary, Fate, Totsuka: no invented data | VERIFIED | no card, listed as open items |
| 9 | Every record linked to its source image | VERIFIED | 143 source assets, 144 source records; detail page lists the sheets |
| 10 | Source images private (not in Git, not served) | VERIFIED | `.gitignore`; live `/gear-source/...` answers 404 |
| 11 | Catalogue: search, version, category, tier, printed statistic ranges, effects | VERIFIED | live smoke 75 of 75 |
| 12 | Match Any / Match All on ninjas, equipment and jewelry | VERIFIED | live: ALL = A + B - (A or B) on all three lists, not empty for equipment |
| 13 | Mode and effects kept in the address, through paging, sorting, reload, chips and Clear | VERIFIED | tests and live checks |
| 14 | Duplicate selections count once; unknown effect handled | VERIFIED | tests and live check |
| 15 | Inflicting vs immunity, effect vs statistic, negation, ally vs enemy | VERIFIED | tests |
| 16 | Results say the effect is at a stated tier, not that it is equipped | VERIFIED | live result cards |
| 17 | Responsive at 390 px, keyboard use | VERIFIED | no horizontal scroll; Match All chosen with the keyboard (browser suite 217 of 217) |
| 18 | Idempotent import; zero duplicates on the second run | VERIFIED | Preview and Production, each imported twice |
| 19 | Production backed up, unchanged tables unchanged | VERIFIED | backup verified; every backup row present and unchanged; 28 tables identical, 13 only gained rows |
| 20 | Tests, typecheck, lint, build | VERIFIED | SQLite 327 passed, 1 skipped; PostgreSQL 316 passed, 12 skipped |
| 21 | Preview verified | PARTIAL | Preview deployments built; the same commit tested on the real Preview database through a local server. The deployed Preview URL was not browsed (see technical report, section 5) |
| 22 | Production live and verified | VERIFIED | https://furia-ninja.vercel.app, commit `60c441e`, live smoke 75 of 75, no errors in logs |
| 23 | First administrator and setup token | VERIFIED | one administrator exists; `/setup` answers 404; no `SETUP_TOKEN` variable |
| 24 | Production branch setting | OPEN (owner) | still `main` in the dashboard; builds of `main` are blocked by the Ignored Build Step |
| 25 | Human check of every transcribed value against its image | OPEN | 15 of 143 images read twice; 128 read once; nothing marked verified |
| 26 | Client decisions on version labels, Mekansm name and the unusual printed values | OPEN | `GEAR_JEWELRY_OPEN_ITEMS.md` |
| 27 | Source material for Legendary, Fate and Totsuka | OPEN | `GEAR_JEWELRY_OPEN_ITEMS.md` |
| 28 | Client acceptance of this add-on | OPEN | not accepted and not closed |
