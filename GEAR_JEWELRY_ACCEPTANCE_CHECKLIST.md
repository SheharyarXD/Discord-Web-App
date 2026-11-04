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
| 29 | Sort by the value of the selected effect (equipment, jewelry, ninjas), highest to lowest and back | VERIFIED (live) | commit `d43c7ad`; live smoke 93 of 93; `tests/m8-effect-sort.test.ts` |
| 30 | Sorted by the selected effect only; increases, enemy reductions, flat values and other states kept apart | VERIFIED | tests; the bare «tasa de control» lists increases first, reductions after, labelled |
| 31 | With several effects the sorting effect is chosen; the first is the default; Match Any / All intact | VERIFIED | live check; tests |
| 32 | Transparent tie rule; Susanoo example (variant B before variant A at 6 pieces: 58% against 55% with the tiers added) | VERIFIED | real catalogue test and live check |
| 33 | Wording-only effects stay searchable, labelled, after the numbers | VERIFIED | tests |
| 34 | Sort works with filters, chips, paging, back and forward, reload and 390 px | VERIFIED | browser suite 235 of 235; live 93 of 93 |
| 35 | Piece counts: a 2-piece search never returns sets that have the effect only at 4 or 6 pieces; with 4 or 6 pieces the lower tiers count too (they accumulate, see 43) | VERIFIED (live) | commit `e533df9`; equipment Control Rate with 2 / 4 / 6 pieces: 0 / 9 / 10 sets, equal to the stored bonuses of that tier and the lower ones |
| 36 | Results show the piece count and the total for it, with the printed bonuses it is made of | VERIFIED | live result cards
| 37 | Jewelry slot choice (Fuerza, Chakra, Agilidad, Poder, one at a time) enforced in the query, using the existing categories | VERIFIED | tests; live: no other slot in an Agility search |
| 38 | Agility + 2 pieces + Control Rate + highest to lowest: only Agility 2-piece bonuses, ranked by percentage | VERIFIED (live) | the 8 stored sets: +25% x6, +20%, +10% |
| 39 | Separate «Bono de 8 piezas» under a 2-piece result; «stronger» note where the 8-piece bonus prints the same additive effect, with the total for the complete set | VERIFIED | tests; live: Agility Control Rate 2 sets (Crystalys 32% and 35%), Damage Rate 3 sets |
| 40 | Match All / Any, name search, stat ranges, versions, paging, back and forward, reset and 390 px still work | VERIFIED | browser suite 253 of 253; live 111 of 111 |
| 41 | Slot choice uses the four jewelry categories («gem sockets» in the request) | CONFIRMED by the client ("I've checked everything and it's all correct") | no Gems feature was activated |
| 42 | Client acceptance of this add-on | ACCEPTED IN PRINCIPLE by the client; administrative closure by the owner is separate | the client wrote "I think we can consider this finished"; this checklist is not the closure |
| 43 | Bonuses of unlocked tiers accumulate: equipment 2 / 2+4 / 2+4+6; jewelry slot 2-piece bonus, plus the 8-piece bonus for the complete set | VERIFIED (live) | commit `e533df9`; tests `tests/m10-cumulative.test.ts`; live smoke 124 of 124 |
| 44 | Deatbone: Damage Rate +30% (2 pieces) + +40% (6 pieces) = **+70%** with 6 pieces, with the breakdown; the 4-piece tier does not need it | VERIFIED (live) | card and detail page; screenshots in the PDF |
| 45 | A 2-piece search never matches an effect printed only at 4 or 6 pieces; Agilidad never returns Fuerza, Chakra or Poder | VERIFIED | tests and live checks |
| 46 | Only comparable additive values are added (same statistic, unit, target, direction, slot); conditional, chance, timed and wording-only effects are shown as printed | VERIFIED | unit and fixture tests |
| 47 | Ranking by the cumulative total at the selected piece count, highest to lowest and back; ties, paging, Match All / Any, address and back / forward intact | VERIFIED | tests; browser suite 266 of 266; live |
| 48 | «Bonos individuales», «Total acumulado», «Desglose por piezas» on result cards and detail pages, in agreement; readable at 390 px | VERIFIED | every equipment detail page checked against its card |
| 49 | No text says stacking is unconfirmed or that tiers are never added | VERIFIED | automated text test; documents updated |
| 50 | Cross-slot total for jewelry (all four slots worn together) | OPEN (client, only if wanted) | slots are shown apart; no rule was given for adding slots |
| 51 | Administrative closure of the add-on | OPEN (owner) | the client has indicated acceptance; closure is recorded by the owner |
