# Milestone 3: acceptance checklist (after the Supporter sync)

VERIFIED = checked by an automated test and/or the real-browser run in this round. PARTIAL = built and tested, limited by missing source data or an open decision. BLOCKED = cannot be delivered without material or a decision.

| # | Agreed requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Search for ninjas | VERIFIED | name, Spanish name and all aliases, accent and case insensitive; new Supporters found by name in the browser |
| 2 | Search for game items (equipment, jewelry, gems, sets) | VERIFIED (with test data) | tests and browser; no real items exist |
| 3 | Filter by role, item type, set, statistics, other attributes | VERIFIED | rank, formation, type, category, class, effects, item category, set |
| 4 | Several filters at once | VERIFIED | OR inside a filter, AND between filters |
| 5 | Minimum and maximum statistic filters | VERIFIED | ninja base stats and item statistics |
| 6 | Sort by statistic, both directions | VERIFIED | missing values last, pagination without repeats |
| 7 | Detail pages: ninjas | VERIFIED | all 177 have a page; Natsu, Tayuya, Kimono, Isshiki, Moon's Eye, Yasaka, Anko opened in the browser |
| 8 | Detail pages: equipment, jewelry | VERIFIED (with test data) | own statistics apart from set tiers |
| 9 | Detail pages: gems | PARTIAL | built and tested; hidden (404) as the client asked; no gem data |
| 10 | Detail pages: sets | VERIFIED (with test data) | tiers shown as stored, unknown stacking warned, never summed |
| 11 | Related effects and statistics | VERIFIED | glossary search and edit |
| 12 | Conditional effects and requirements clearly shown | VERIFIED | unchanged, extended |
| 13 | Selectable talents without implying all are active | VERIFIED | unchanged |
| 14 | Admin panel: add, edit, remove | VERIFIED | 111 browser checks |
| 15 | Regular users cannot manage the database | VERIFIED | 404 on admin pages, Forbidden on every write, anonymous redirected |
| 16 | Spanish interface across the new functionality | VERIFIED | |
| 17 | Gems menu hidden | VERIFIED | `/gems` 404 after the import |
| 18 | No Discord integration, no planner or simulator | VERIFIED | existing scan test |
| | **Client decisions** | | |
| 19 | Assaulter = Center | VERIFIED | |
| 20 | Five name matches as aliases | VERIFIED | |
| 21 | Four unresolved identities not linked | VERIFIED | still staged only; new Neji Hyūga card not merged with the old entry |
| 22 | English is the original; Spanish fills omitted numbers only | VERIFIED | 25 rows `VALUE_FROM_ES` |
| 23 | Power = Constitución; S. Attack separate | VERIFIED | 9 cards print Power, kept as printed |
| 24 | Ranks D to SSR | VERIFIED | 15 stored |
| 25 | Awakening: Hinata, Kusanagi Kyo, First Hokage, Sage Jugo | VERIFIED | |
| 26 | Awakening: Natsu Dragneel, Cursed Tayuya | VERIFIED | text imported, rules attached, tested |
| 27 | Other awakening rules unknown, never summed | VERIFIED | 113 UNKNOWN |
| | **Data** | | |
| 28 | All supplied Supporters imported | VERIFIED | 79 of 79 cards, 63 of 63 text files, 0 duplicate ninjas, second run +0 |
| 29 | Kimono Kurenai Spanish complete | PARTIAL | source ends early; flagged, not invented |
| 30 | Mitarashi Anko HP | PARTIAL | stored as printed (45000), awaiting client answer |
| 31 | Equipment, jewelry, gems data | BLOCKED | no source supplied |
| 32 | Import: dry run, idempotent, no duplicates, backup | VERIFIED | |
| 33 | Database integrity | VERIFIED | |
| 34 | Typecheck, lint, build, tests | VERIFIED | 252 tests, clean, build ok |
| 35 | Desktop and mobile browser | VERIFIED | 111 checks, 390 px without horizontal scrolling |
| 36 | Milestone closed | BLOCKED | needs client review and acceptance |
