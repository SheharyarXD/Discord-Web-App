# Milestone 3: final delivery verification

**Recommendation: GO for client review.** Milestone 3 is not accepted and not closed. It closes only when the client accepts it.

Everything below was recomputed or re-run in the final audit round. Nothing is carried over from earlier reports.

## 1. Final data totals and counting definitions

Definitions (one methodology, implemented in `scripts/final-audit.mjs`, used by every report and CSV):
- **Awakening stage**: one stored talent or skill awakening level, counted once.
- **Stated rule**: an awakening stage whose stacking rule is not UNKNOWN.
- **Text block**: a talent, a skill (normal or special) or an awakening stage that has English text. Status definitions (for example Armor Break) are optional text and counted separately.
- **Spanish complete (ninja)**: every text block has uncut Spanish text. Line counts may differ when the Spanish merges or splits lines; numbers are compared and differences are flagged.
- **Full card**: rating, formation, type and four base statistics.

| Measure | Value |
| --- | --- |
| Ninjas in the database (no duplicate slug) | 177 |
| Supporter cards supplied and linked | 79 (16 earlier + 63 new) to 79 distinct existing ninjas |
| Ninjas in the Supporter channel | 79 |
| Ninjas whose card prints Support | 83 (the 79 Supporters plus 4 Alien cards that also print Support) |
| Ninjas with a full card | 175 (without: Might Guy, Sasuke (Taka)) |
| Ninjas with English ability text | 177 |
| Spanish complete / partial / none | 173 / 2 (Kimono Kurenai, Sai (Errant Knight)) / 2 (Guren, Final Sasuke) |
| Text blocks (English) and their Spanish | 484: 476 complete, 2 partial, 6 missing |
| Status definitions | 9: 7 with Spanish, 2 English only (Natsu Dragneel) |
| Awakening stages | 120 (111 talent, 9 skill) on 92 ninjas; per-ninja sum 120 |
| Stages with a stated rule | 7 (Hinata Soccer Star L2, Kusanagi Kyo L2, Natsu L2 replaces, First Hokage L3 cancels, Natsu skill L1 upgrades base, Jugo Sage L3 upgrades base, Cursed Tayuya L3 upgrades base); 113 UNKNOWN |
| Effect rows | 4,395 (3,876 structured, 105 need review, 414 kept as source text) |
| Ranks in use | S 6, SS 4, SSS 119, SR 24, SSR 22; the other 10 of 15 exist, unused |
| Aliases | 76 (69 verified, 7 reviewed: the 6 new judgement matches and Shodai Hokage) |
| Equipment, jewelry, gems | 0, 0, 0 (nothing invented); gems hidden (404) |

## 2. Corrections made in this round

| Finding | Correction |
| --- | --- |
| Awakening counts: the reconciliation CSV summed to 231 because talent awakenings were counted twice | One definition; the CSV now sums to 120 stages and 7 stated rules, equal to the database and the report |
| Spanish: 174 ninjas were reported complete, Natsu was flagged partial | Sai (Errant Knight) has Spanish cut in its source, so complete is 173 with 2 partial. Natsu's ability text is complete; only two optional status definitions are English only. All CSVs, reports and the PDF agree |
| Metrics CSV said the Natsu and Tayuya rules were waiting for text | Removed; the metrics file is generated from the database with no hard-coded statements |
| Support formation count (83) could be read as the Supporter count | Explained everywhere it appears |
| Uchiha Hikari and Ōtsutsuki Isshiki HP were transcribed as 460000 and 380000, but the cards print 46000 and 38000 | Found by re-reading all 79 cards against the images. Corrected, flagged like Mitarashi Anko's 45000, reimported (second run +0), covered by a test |
| Report screenshots were small | New screenshots taken from the built application at a narrower window and higher scale |

## 3. Card, text and mapping verification

- All 79 cards: stored rating and four statistics with growth rates compared with the card images (two visual passes, plus a dedicated HP pass) and with the staged values by `scripts/verify-supporters.mjs`. No mismatch after the correction above.
- 1,941 English and Spanish lines: each is word for word in its source file and stored on the right ninja. Awakening levels equal the source headings. Talent and skill names agree with the card labels (Christmas Mito and Hyakki Sasori have a Normal and a Special skill, so their single card skill label is kept beside them, documented).
- 79 entries map to 79 distinct ninja names; no ninja was created. Yasaka Itachi and Madara (Moon's Eye) enrich their existing records.
- The six judgement matches remain marked `REVIEWED` and listed for client confirmation.
- Client decisions checked: Assaulter = Center; five confirmed aliases; English authoritative (25 `VALUE_FROM_ES` rows only); Power, Chakra and S. Attack kept apart; 15 ranks; Natsu talent L2 replaces L1; Natsu skill awakening replaces the base target and growth rate only; Tayuya special awakening replaces the values it restates; all other awakenings UNKNOWN; no invented equipment, jewelry or gem data.

## 4. Test and browser results (final audit run)

| Check | Result |
| --- | --- |
| Import dry run on a copy | ninja, alias, base stat, ability, effect, source rows all +0 |
| Import idempotency (real run) | +0 on every table |
| `integrity_check` / `foreign_key_check` | ok / empty |
| `vitest run` | 252 tests in 14 files, all pass |
| `tsc --noEmit` | clean |
| `eslint .` | clean, no warnings |
| `next build` | succeeds |
| Real browser run, built application, Edge (`scripts/browser-check.mjs`) | 111 of 111 checks pass: sign-in and access rules, search, combined filters, sorting, ninja pages and awakening display (Natsu, Tayuya, Kimono, Isshiki, Moon's Eye, Yasaka, Anko), admin create, edit and delete, accounts and roles, gems 404, 390 px without horizontal scrolling; all test data removed |
| Database backup before this round | `prisma/backups/dev-pre-m3-final-audit-20261020.db` (ignored by Git) |

## 5. Final deliverables

`MILESTONE_3_CLIENT_DELIVERY_REPORT_EN.pdf` (11 pages), `MILESTONE_3_CHANGE_SUMMARY_FOR_CLIENT.md`, `MILESTONE_3_FINAL_TECHNICAL_REPORT.md`, `MILESTONE_3_ACCEPTANCE_CHECKLIST.md`, `MILESTONE_3_OPEN_ITEMS.md`, `MILESTONE_3_DATA_RECONCILIATION.csv` (177 ninjas), `MILESTONE_3_SUPPORTER_SYNC_AUDIT.csv` (79 cards), `MILESTONE_3_DATA_METRICS.csv`, `MILESTONE_3_IMPORT_LEDGER.csv` (184 source entries), this file. Scripts: `scripts/final-audit.mjs`, `scripts/verify-supporters.mjs`, `scripts/ninja-reconciliation.mjs`, `scripts/browser-check.mjs`.

## 6. Questions that need client input

Needed to accept the finished functionality: none. All of these are data-completion matters, not software defects:
1. Confirm the six name matches (Uchiha Sakura = Sakura Uchiha, 6-tail Utakata = Utakata, Terumi Mei (Summer) = Terumi Mei, Neji Hyūga = Hyūga Neji, Orochimaru (New Era) = Orochimaru from Boruto, Susanoo Itachi & Sasuke = Susano Itachi&Sasuke).
2. Three cards print a five digit HP (Mitarashi Anko 45000, Uchiha Hikari 46000, Ōtsutsuki Isshiki 38000): real values or a missing digit? Stored as printed.
3. Shikamaru Nara: card says Explosive Shadow Stab, text says Shadow Fang. Which is correct?
4. Missing Spanish: the end of Kimono Kurenai's skill and the end of Sai (Errant Knight)'s text (both cut in the source); Spanish for Guren and Final Sasuke; Spanish of Natsu's two status definitions (optional).
5. Cards for Might Guy and Sasuke (Taka).
6. Who are Immortal Madara, Neji Hyuga (old entry), Illusion God Itachi and Nagato Uzumaki? Is Shodai Hokage the First Hokage?
7. Do other awakenings add up, replace or cancel? (113 stages stay UNKNOWN.)
8. Which text is right where English and Spanish differ (27 ninjas)?
9. Equipment, jewelry and gem source material.

## 7. Git and privacy

Earlier commit `01ec88b` (Milestone 3 and Supporter sync) is on `origin/milestone-2`. The final audit changes are committed on the same branch and pushed under the owner's Git identity; the hash is in the delivery message. History was not rewritten. No private screenshots, source packages, database backups, prompts or credentials are committed (`docs/m2-handoff/`, `docs/m3-handoff/`, `prisma/backups/`, `*.db` and the audit scratch file are ignored). The owner's real email address still exists in older Git history. Nothing was deployed, sent or closed.

## 8. Message the owner can forward to the client

> Hello,
>
> Milestone 3 is now ready for your review.
>
> We have completed the synchronization of all 79 Supporter cards, including their supplied ability descriptions, and implemented the agreed search, filtering, sorting, ninja detail pages, and administration functionality.
>
> The application now contains 177 ninjas, with 175 complete character cards. All available English ability descriptions have been imported, and the remaining Spanish translation gaps are clearly documented.
>
> Natsu Dragneel, Cursed Tayuya, and their awakening rules have also been implemented according to the supplied information.
>
> The report includes application screenshots, verification results, and the remaining data clarifications.
>
> Please review the attached Milestone 3 report and confirm whether the milestone is accepted, or let us know if any corrections are required.
>
> Equipment, jewelry, and gems remain pending their source material and are documented separately.
>
> Thank you.

Report note: the screenshots hide the empty picture boxes of ninja cards, because no character images have been supplied.
