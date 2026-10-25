# Milestone 4: final technical report

**Status: PARTIALLY READY for client review.** All development that can be done from the supplied material is finished and verified. Three things cannot be completed without the client or the owner: new source material for a few records, the deployment itself (it needs the owner's approval and the server details), and the final production verification that follows the deployment. Milestone 4 is not accepted and not closed.

Branch `milestone-4` (created from `milestone-2` at commit `afa766a`). All figures below were recomputed from the database in this round.

## 1. Milestone 4 scope (from the signed project description)

| Deliverable | State |
| --- | --- |
| Complete the agreed initial population of ninja, equipment, jewelry, gem and related data from the provided reference | **Ninjas: complete for everything supplied** (177 ninjas, 79 Supporter cards, 175 full cards). **Equipment, jewelry, gems: no source material has been supplied; 0 records, nothing invented** |
| Review populated data for consistency with the agreed structure | Done: consistency tests (`m4-consistency`), database integrity and foreign-key checks, full re-audit of the 79 Supporter cards, one reproducible counting method (`scripts/final-audit.mjs`) |
| Complete remaining Spanish interface and content work | Interface: every dynamic text key resolved, no English left over (test `m4-spanish-ui`). Content: Kimono Kurenai completed with the client's text; Sai, Guren and Final Sasuke still wait for source text |
| Responsive optimization for desktop, tablet and mobile | Done and fixed: the navigation overflowed the screen at 1024 px (184 px of sideways scrolling on every page). It now collapses into the menu below 1280 px. Checked on 13 pages at 360, 768, 1024 and 1280 px |
| Test navigation, database, search, filters, sorting, detail pages, admin | 264 automated tests and 165 real-browser checks (section 6) |
| Verify access levels for the client and approved users | Browser and automated tests: anonymous visitors are not served the admin area, regular users get 404 on admin pages and Forbidden on every write, gems return 404 |
| Fix issues found in final testing | Navigation overflow, a Hikari and Isshiki HP error (earlier round), alias and count corrections |
| Configure and deploy the application | **Prepared, not performed.** `DEPLOYMENT.md` (steps, environment variables, backup, verification), `GET /api/health`. Deployment needs the owner's approval and the hosting details |
| Final production verification | **Pending the deployment.** The checklist is in `DEPLOYMENT.md` and is covered locally by the browser run |
| Deliver the source code | The repository on GitHub (branch `milestone-4`); private material is git-ignored |

## 2. Client corrections implemented

See `MILESTONE_4_CLIENT_CORRECTIONS_LEDGER.csv` (20 rows: decision, previous behavior, new behavior, verification, status).

- **Each new awakening replaces the previous one.** A numbered stage with an earlier numbered stage in the same talent or skill now replaces it (REPLACES_PRIOR, naming the stage it replaces and quoting the client decision). Talent and skill awakenings are separate lists. Rules from the source or from a specific client decision are never overwritten (First Hokage level 3 cancels level 2; Sage Jugo and Cursed Tayuya level 3 and Natsu's skill awakening upgrade the base; Natsu talent 2, Kusanagi Kyo 2 and Hinata 2 replace). First stages stay UNKNOWN against the base because nothing states it, and five unnumbered stages stay UNKNOWN. Awakenings added in the administration follow the same rule. The Spanish page says «Decisión del cliente».
- **Shodai Hokage = First Hokage.** The alias is now VERIFIED and marked as client confirmed. It is one ninja; nothing was duplicated.
- **Kimono Kurenai.** The client's final Spanish lines are stored exactly (`data/reference/client-supplied/kimono-kurenai-skill-es.md`): 10 of 10 lines, the three alternatives stay mutually exclusive.
- **Unchanged and re-tested:** Center = Assaulter, the five confirmed aliases, 15 ranks, Power / Chakra / Force / S. Attack, English authoritative.
- **Not applied (no evidence in the workspace):** Illusion God Itachi (the brief does not say which ninja it equals), Nagato Uzumaki (the screenshots are not here), Neji Hyuga, Immortal Madara, and Sai's complete Spanish (the screenshots are not here). Nothing was merged or invented.

## 3. Verified database figures

| Measure | Value |
| --- | --- |
| Distinct ninjas | 177 (no duplicate) |
| Cards imported / full cards | 175 |
| Supporter cards | 79, linked to 79 distinct ninjas |
| Ninjas whose card prints the Support formation | 83 (79 Supporters plus 4 Alien cards); not the Supporter count |
| English text | 177 |
| Spanish complete / partial / none | 174 / 1 (Sai (Errant Knight)) / 2 (Guren, Final Sasuke) |
| Text blocks and their Spanish | 484: 477 complete, 1 partial, 6 missing |
| Status definitions | 9: 7 with Spanish, 2 English only (Natsu Dragneel, optional text) |
| Awakening stages | 120 (111 talent, 9 skill) on 92 ninjas |
| Stages with a rule | 21: 17 REPLACES_PRIOR (14 by the general client rule), 1 CANCELS_PRIOR, 3 UPGRADES_BASE |
| Stages UNKNOWN | 99: 94 first stages, 5 unnumbered |
| Effect rows | 4,395 (3,876 structured, 105 need review, 414 kept as source text) |
| Aliases | 76 (70 verified, 6 reviewed: the six judgement matches) |
| Unresolved identities | 4 staged entries (Immortal Madara, Neji Hyuga, Illusion God Itachi, Nagato Uzumaki) |
| Equipment, jewelry, gems | 0, 0, 0 |
| Ranks in use | S 6, SS 4, SSS 119, SR 24, SSR 22; 10 of the 15 ranks exist and are unused |

Definitions (identical in every report): an awakening stage is one stored talent or skill awakening level, counted once; Spanish complete means every text block has uncut Spanish; a full card has rating, formation, type and four attributes.

## 4. Supporter revalidation

`scripts/verify-supporters.mjs --csv MILESTONE_4_SUPPORTER_FINAL_AUDIT.csv` checks each of the 79 cards against the original source packages and writes the actual result per card: identity, rating, formation and type, four statistics and growth rates, talent and skill names against the card, 1,942 English and Spanish lines word for word in their source files and stored on the right ninja, awakening stages and rules, the card file and its SHA-256. **No mismatch.** What is not claimed as verified is listed per card in the last column: Chinese-card labels (transcribed from small images, not translated), card labels cut by the layout, the three five-digit HPs (Mitarashi Anko 45000, Uchiha Hikari 46000, Ōtsutsuki Isshiki 38000, stored as printed), Shikamaru Nara's «Explosive Shadow Stab» against «Shadow Fang» (both kept), the two Normal and Special skills of Christmas Mito and Hyakki Sasori, and Natsu's two English-only status definitions.

## 5. Changes in the code

`src/domain/awakenings.ts` (general rule and its text), `src/game/profile-loader.ts` (applies the rule, verified text names, `data/` assets), `src/game/ability-editor.ts` (administration follows the rule), `src/components/game/ability-body.tsx` and `src/i18n/es.ts` (Spanish explanation), `src/components/layout/main-nav.tsx` and `app-header.tsx` (menu below 1280 px), `src/app/api/health/route.ts`. No schema change and no migration. Data: `identity-map.json`, `supporters-m3.json`, `translation-flags.json`, `client-decisions-m4.md`, `client-supplied/`.

## 6. Verification

See `MILESTONE_4_TEST_RESULTS.md`. Summary: 264 tests in 17 files pass; `tsc` and `eslint` clean; production build succeeds; dry run and real import +0 on every table; `integrity_check` ok and `foreign_key_check` empty; 165 of 165 real-browser checks pass (desktop, tablet and 390 px, search, combined filters, sorting, awakening display, administration and roles, gems 404, health endpoint).

## 7. Open points

1. **Implementation defects:** none known.
2. **Missing source material:** equipment, jewelry and gems; cards for Might Guy and Sasuke (Taka); Spanish for Guren and Final Sasuke; the Spanish screenshot of Sai; the Nagato Uzumaki screenshots.
3. **Client decisions:** which ninja Illusion God Itachi is; the six judgement name matches; the three five-digit HPs; Shikamaru's skill name; Neji Hyuga and Immortal Madara; English-versus-Spanish wording where the texts differ (26 ninjas, English wins).
4. **Owner action:** approve and carry out the deployment (`DEPLOYMENT.md`), then run the production verification. The owner's real email address still exists in older Git history.
5. **Out of scope:** future game updates and content after the initial version.
