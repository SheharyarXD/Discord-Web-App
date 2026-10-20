# Milestone 3: final technical report (Supporter sync round)

**Status: READY_FOR_CLIENT_REVIEW.** Every Supporter source that was supplied (79 cards: the 16 earlier ones and the 63 additional ones) is imported with its English and Spanish text. What is still open is listed in `MILESTONE_3_OPEN_ITEMS.md`. Milestone 3 is **not closed**: it needs the client's review and acceptance.

All figures below were counted from the database after the import, and every automated result was produced in this round. The numbers in the earlier report (241 tests, 97 browser checks, 121 entries, 115 profiled ninjas) are the previous baseline and are not reused as evidence.

## 1. What this round did

| Step | Result |
| --- | --- |
| Protection | Database copied before any change to `prisma/backups/dev-pre-m3-supporters-20261020.db` (opens, integrity ok). Data files copied to `prisma/backups/data-20261020/`. Nothing was reset, cleaned or rewritten in Git |
| Package check | `verify_handoff.py` passed: 16 + 63 = 79 cards, 63 English/Spanish text files, no errors |
| Card reading | All 63 additional cards were read from the images (rating, type, formation, four attributes with growth rates, talent label, skill label). The least legible ones were re-read zoomed |
| Staging | `data/reference/profiles/supporters-m3.json` (63 entries, generated from the 63 text files and the card readings by a script that fails on any mismatch of headings or awakenings) |
| Identity | 63 cards linked to 63 existing ninjas: 56 exact, 1 verified (spacing only: `Indra & Ashura`), 6 reviewed by judgement (see section 3). **0 new ninjas** |
| Dry run | On a copy: ninja +0, alias +23, base stats +248, abilities +118, effects +1,614, nothing else unexpected |
| Real import | Same figures. Second run: **+0 on every table** |
| Integrity | `integrity_check` ok, `foreign_key_check` empty, 177 ninjas |

## 2. Counts before and after

| Measure | Before | After |
| --- | --- | --- |
| Ninjas in the database | 177 | **177** (no duplicates, none added) |
| Source entries in the ledger | 121 | **184** |
| Supporter source entries | 16 | **79** |
| Ninjas with a card | 113 | **175** (Might Guy and Sasuke (Taka) still have no card) |
| Ninjas with English ability text | 115 | **177** |
| Ninjas with complete Spanish text | 112 | **174** (Kimono Kurenai partial, Guren and Final Sasuke none) |
| Release-list ninjas with name and date only | 61 | **0** |
| Awakening stages | 69 | **120**, on 92 ninjas |
| Awakenings with a rule stated by the source or the client | 4 | **7** |
| Effect rows | 2,781 | **4,395** (3,876 structured, 105 need review, 414 kept as source text) |
| Aliases | 53 | **76** |
| Ranks in use | S 6, SS 4, SSS 78, SR 12, SSR 13 | S 6, SS 4, SSS 119, SR 24, SSR 22, none 2 |
| Equipment, jewelry, gems | 0 | 0 (no material supplied; nothing invented) |

By channel after the import: Vanguard 28, Center/Assaulter 60 (58 cards), Supporter 79 (79 cards), Alien 10, plus the ninjas that only come from the awakening channel and the release list, all with a profile. The per-ninja table is `MILESTONE_3_DATA_RECONCILIATION.csv` (177 rows). The 79 Supporter cards, with file, hash, status and notes, are in `MILESTONE_3_SUPPORTER_SYNC_AUDIT.csv`. Each source entry is in `MILESTONE_3_IMPORT_LEDGER.csv` (184 rows). Summary metrics are in `MILESTONE_3_DATA_METRICS.csv`.

## 3. Reconciliation of the 79 Supporter cards

- Cards 1 to 16: unchanged, already imported; their Spanish was already in place.
- Card 17 Yasaka Itachi: **enriches the existing record** that came from the awakening channel. Rating SSS, Support, Genjutsu, its four attributes (second one printed as Power) and Spanish text were added. The two source copies of the English text differ only by doubled spaces; the Supporter copy is stored and the other kept as review evidence.
- Card 77 Madara (Moon's Eye): **enriches the existing record**. The card description stays, the base stats are re-read from the supplied card and the ability text, talent awakening and Spanish are added. One record.
- Cards matched by judgement (`ALIAS_REVIEWED`, searchable, listed for the client to confirm): Uchiha Sakura = Sakura Uchiha, 6-tail Utakata = Utakata, Terumi Mei (Summer) = Terumi Mei, Neji Hyūga = Hyūga Neji, Orochimaru (New Era) = Orochimaru from Boruto, Susanoo Itachi & Sasuke = Susano Itachi&Sasuke. Each is the only release-list entry that fits and sits at the same place in the Supporter order.
- The legacy unresolved entry «Neji Hyuga» (awakening channel) is **not** merged with the new Neji Hyūga card: the new texts say nothing that proves they are the same ninja. The four old unresolved identities stay staged evidence.
- Chinese cards (16 of the 63: cards 21, 30 to 32, 34, 36 to 41, 43, 44, 46, 48 and 49): rating, type and formation are matched by position (`体术`/`幻术`, `后军` = Support), flagged as partly confirmed, names not translated. The label text was transcribed from small images.
- Special card readings: cards that print **Power** instead of Chakra keep `Power` (its own statistic, Constitución): Yasaka Itachi, Reanimated Hiruzen, Sasuke & Itachi, Pain & Konan, Xmas Haku (plus the four from earlier). Mitarashi Anko's HP is stored exactly as printed, **45000**, flagged for review: no digit was added. Several skill labels are cut by the card layout and are stored as printed with the `CARD_LABEL_CUT` flag; the full name comes from the text.
- Shikamaru Nara: the card says «Explosive Shadow Stab» and the text heading says «Shadow Fang». Both are kept and noted.

## 4. Client rules applied to the new data

| Rule | Result |
| --- | --- |
| Natsu Dragneel: talent level 2 replaces level 1 | Stored as `REPLACES_PRIOR` (source line quoted); level 1 stays UNKNOWN |
| Natsu Dragneel: skill awakening 1 replaces the base target and growth rate | Stored as `UPGRADES_BASE`; base «all enemies 330%» and awakening «one random enemy 550%» stay separate; the other base effects are untouched |
| Natsu status lines (Armor Break, Crit Resistance Reduction) | Stored as status definitions (text), not as effects of the ninja |
| Cursed Tayuya: special-card awakening (stage 3) | Stored as `UPGRADES_BASE`; speed 88% → 92% and the other replaced values are kept as `replaces` values, never added to the base |
| All other awakenings | UNKNOWN: shown separately with a warning, never summed (113 stages) |
| Yamanaka Ino awakenings 1 and 2 | Both UNKNOWN |
| Ōtsutsuki Isshiki, Big Box Sky | One group of four alternatives of 25% each, not four hits |
| Kimono Kurenai | The three «A, OR B» lines are kept as printed text and flagged; nothing makes both branches apply. **Spanish is incomplete in the source**: it ends after alternative 3, the English fury line has no Spanish, and none was invented (`ES_TEXT_CUT`) |
| Christmas Mito, Hyakki Sasori | Normal and Special skill kept apart |
| Probabilities above 100% (`110% chance`) | Kept as the printed application rate (`rate 110`, kind APPLICATION). They are not capped and not stored as a probability |
| `(20%)` before a status | Per-usage strength, not chance (unchanged rule) |
| `S. Attack` | Stays its own anti-block statistic |
| English is the original | Spanish never replaces English; 25 rows `VALUE_FROM_ES` (21 older plus 4 new) fill omitted base-stat numbers only |
| Assaulter = Center | Unchanged; Taka still shows Force as primary statistic through the approved rule |
| Gems | Still hidden (`/gems` is 404); no gem, equipment or jewelry data added |

Code changes needed for this round (small, in existing files): the loader reads a third Supporter file and cites assets under `m3-handoff/`; the parser keeps «N% chance» above 100% as a rate and reads «speed 88% → 92%» as a replaced value; the loader carries the card description of Moon's Eye so it is not lost on a fresh database. No schema change, no migration.

## 5. Source quality notes

- English/Spanish differences: 27 ninjas have lines where the two texts differ in count, numbers or wording; both are kept and flagged (6 more than before: Hyuuga Hanabi, Mitsuki, Kimono Kurenai, Christmas Mito, Summer Pain, Kyūbi Minato).
- 414 effect rows stay as source text because the parser does not understand them (conditions on gender, nature, hp thresholds, unknown statuses). They are verbatim and flagged, never guessed. 105 need review for side or bracket ambiguity.
- The 63 texts are transcriptions recovered from a chat, not Discord exports; they were not compared with the original messages.
- The card statistics were read from the supplied images by a person (the model), twice for the unclear ones. They match each card's manifest rating, type and formation.

## 6. Verification (this round)

| Check | Result |
| --- | --- |
| `vitest run` | **252 tests, 14 files, all pass** (new `m3-supporters.test.ts` with 10 tests; profile, reference and decision tests updated to the new counts) |
| `tsc --noEmit` | clean |
| `eslint` | clean |
| `next build` | succeeds |
| Importer | dry run, real run, second run +0 on every table |
| Database | integrity ok, foreign keys empty |
| Real-browser run (Edge, built application, `scripts/browser-check.mjs`) | **111 checks, 111 pass**: the 97 earlier checks plus 14 for the new Supporters (Natsu, Tayuya, Kimono, Isshiki, Moon's Eye, Yasaka, Anko; 177 ninjas listed; search by name; rank filter; gems 404; 390 px without horizontal scrolling on three new pages) |

## 7. Git and deployment

The work is committed on branch `milestone-2` and pushed to the `origin` repository at the end of this round, as authorised by the owner, under the owner's Git identity. Nothing is deployed. Private material (client card screenshots, source packages, database backups, the prompt files) is in `.gitignore` and is not published. The owner's real email address still exists in older Git history; history was not rewritten.

## 8. Known limits

- The administrator's ability editor reads `data/reference/lexicon.json` at run time; the deployment (Milestone 4) must ship it.
- Chinese card labels are transcriptions of small images and may contain misread characters; they are not used for identity.
- Might Guy and Sasuke (Taka) have text but no card. Equipment, jewelry and gems have no source material.
