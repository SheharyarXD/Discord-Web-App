# Milestone 2: final technical report (third round, supplementary text import)

Status: **delivered for client review. Not closed.** Nothing was committed, pushed or deployed.

## 0. Post-import figures (these replace the pre-import figures in the older sections where they differ)

Source: `M2_Supplementary_Text_Recovery_58_Assaulters_16_Supporters` (now under `docs/m2-handoff/`). Backup before import: `prisma/backups/dev-pre-m2c-supplementary.db`. Dry run on a copy first, then the real load, then a second load that changed nothing.

| Measure | Before | After |
| --- | --- | --- |
| Ninjas | 177 | 177 (no ninja added or duplicated) |
| With a full card | 113 | 113 (112 from the packages + Uchiha Madara (Moon's Eye), earlier delivery) |
| With ability text as effects | 57 | **115** |
| Assaulters with ability text | 2 of 60 | **60 of 60** |
| Supporters with English and Spanish | 0 of 16 | **16 of 16** (rest of the channel not collected) |
| Ability rows | 148 | 198 (+50: skills, awakenings, 5 status definitions) |
| Effect rows | 1315 | **2781** (2510 structured, 59 needs review, 212 source text only) |
| Effect rows with Spanish line | 974 | 2622 |
| Awakening stages | 31 | **69** on 51 ninjas |
| Awakening rules stated | 2 | **4** (Hinata L2 replaces L1, Kusanagi Kyo L2 replaces L1, First Hokage L3 cancels L2, Sage Jugo upgrade); 65 unknown |
| Conditional effect rows | 155 | 297 |
| Per-usage strength overrides | 11 | 15 |
| Source records / assets | 788 / 192 | 1152 / 266 |
| Release-list ninjas with name and date only | 61 | 61 |

Tests 182 pass, typecheck and lint clean, production build succeeds, second load +0 on every table, `foreign_key_check` empty, `integrity_check` ok, 30 triggers. Browser check (Edge, built app): unauthenticated requests redirect to login, awakening, alternatives and bilingual screens render, 390 px width has 0 px overflow, Gems menu hidden, temporary reviewer account deleted (0 users left).

### What was done with the package
- Per-profile files are the import records. The grouped replicas were used only as a check: their bullet lines are identical to the per-profile lines (1511 Assaulter lines, 118 Supporter lines), and the SHA-256 of every per-profile file matches `profile_index.json`. This is a consistency check of the package, **not** a comparison with the original messages, which are not available. The texts remain recovery transcriptions pending audit.
- Matching: by entry number, then by name. The transcript name equals the existing entry or its card name for 56 of 58; the two exceptions (#25 "Might Gai / Might Guy", #44 "First Hokage (Shodai Hokage)") are stored as reviewed source names. Existing reviewed aliases (#18, #24, #34) were not re-decided.
- Spanish for the 16 Supporters is joined block by block to the existing English (same slots, same order). English was not re-imported.
- Alternatives: Hiruko's "Applies one from each" with three groups of two is stored as three groups of alternatives (6 rows), labelled by position only (Option 1, Option 2); nothing is chosen by default. A defect found and fixed in this pass: the first conversion had flattened them into plain effects.
- Variants kept distinct: 4-Tail Roshi, Hotaru, Urashiki Otsutsuki (normal and special skill), Hades, Uzumaki Kushina (Summer), Otsutsuki Jigen (two skills each), Charm definitions (220% and 160%) as separate status definition notes, never effects.
- Placeholders `[Talent]`/`[Skill]` (Kawaki, First Hokage) and `<Nombre>` (Six Paths Sage) were not turned into names. The card names are used and the block is flagged NAME_NOT_SUPPLIED.
- Awakening rules: Kusanagi Kyo (source note quoted in both languages) and First Hokage (identity check recorded in `awakening-rules.json`: Shodai is the Japanese word for First; position 44; manifest name "First Hokage"; release-list neighbours Kawaki and Cyber Naruto).
- Reviewed English/Spanish differences (21 ninjas flagged): numbers differ (for example the English leaves agility without a value and the Spanish gives it 15%), line counts differ (Cursed Seal Sasuke, Warrior Sakura, Awakened Kawaki), wording differs (s.attack vs ataque, "ignore defense" vs "resistencia a la ignorancia de defensa", Earth missing in the Spanish for Danzo, "probabilidad" for "rate" in Kakashi (Kamui), "aliados enemigos" for Shin Uchiha). Nothing was corrected.

### New uncertainties
- The recovered text has no independent exact comparison yet.
- Which side is right in each of the 21 flagged ninjas.
- Ninjas with two skills under one card skill name (Hades, Kushina Summer, Jigen, Pain Animal Path, 4-Tail Roshi, Hotaru, Urashiki): the card name is not assigned where unclear.
- A talent renamed on re-import loses a viewer's stored pick (no viewer had picks).

---

# Previous round (second round), kept for history

Status: **delivered for client review. Not closed.** Milestone 2 is not declared complete, approved or closed until the client has reviewed it, accepted it and the milestone payment is received.

This report covers the work done on top of the first round (`MILESTONE_2_IMPLEMENTATION_REPORT.md`). Nothing was committed, pushed or deployed in this round. All changes are in the working tree of branch `milestone-2`.

## 1. What was supplied and how it was used

Five archives were unpacked in `docs/m2-handoff/` (30 MB, untracked): core handoff, Vanguards + Alien + Awakening, Assaulters 1 to 30, Assaulters 31 to 60, Supporters (partial).

| Item | Count | Notes |
| --- | --- | --- |
| Card images | 113 files, 112 distinct cards | Read twice by eye and diffed against the collector manifests: 0 discrepancies |
| Source entries | 121 | 28 Vanguards, 60 Assaulters, 16 Supporters, 10 Alien, 7 Awakening |
| Distinct ninjas they resolve to | 115 | 105 release-list ninjas + 10 Alien ninjas |
| Ability blocks | 166 | 759 English lines, 503 Spanish lines |

Only these supplied files were used. No Discord access of any kind, no network access in the loader.

## 1b. Count reconciliation and correction (source recovery pass)

- 121 source entries - 4 unresolved = 117 resolved entries; - 2 cross-channel duplicates (Six Paths Sage, Cursed Seal Sasuke) = **115 distinct resolved ninjas** (105 release list + 10 Alien).
- Fully populated cards in the database: **113 = 112 distinct cards from the latest packages + Uchiha Madara (Moon's Eye)** from the earlier delivery (verified: it is the only ninja with base stats and no profile record; 112 ninjas have both).
- **Source text that exists but was not exported (not "missing"):** English and Spanish ability text of 58 Assaulters (collected in ChatGPT, omitted from the ZIP) and the Spanish text of the first 16 Supporters (only English was exported). Neither is imported. They will be loaded when the supplementary files arrive; nothing is derived from screenshots.
- **Genuinely not collected:** the rest of the Supporters channel, equipment, jewelry, gems, cards for Might Guy and Sasuke (Taka).
- Awakening rules documented by the client side but not yet storable: Kusanagi Kyo (L2 replaces L1) and First Hokage (L3 cancels L2, identity to verify). They are attached once their ability text arrives; until then no row exists to carry them. Hinata (Soccer Star) and Sage Jugo are stored.

## 2. Data coverage (accurate counts, dev database)

| Measure | Value |
| --- | --- |
| Ninjas in the database | 177 (167 release list + 10 Alien) |
| With release month/year | 167 (the 10 Alien ninjas have none: not in the release list) |
| With rating, formation, type and four base stats from a card | 113 |
| With ability text structured into effects | 57 |
| With at least one awakening stored | 21 |
| With a nature assigned | 0 (no source gives the nature of a ninja) |
| With Tank/DPS class | 0 (never inferred; client decision) |
| Release-list ninjas with nothing beyond name and date | 61 |
| Equipment, jewelry, gems, sets | 0 (no source supplied; nothing fabricated) |

Completeness per resolved ninja (115): card and text 55, card only 57, text only 2, name only 1 (Might Guy). Four more source entries are staged evidence only (section 4).

Effect rows: 1315 total. 1245 structured, 23 flagged NEEDS_REVIEW, 47 kept as source text only. 155 rows carry conditions, 11 carry a per-usage strength override. 974 rows carry the supplied Spanish line next to the English original.

Review state of ninjas: 161 CONFIRMED, 16 PARTIALLY_CONFIRMED, 0 NEEDS_REVIEW.

**Not imported:** most Supporters (only 16 of an unknown total were supplied; the channel is marked PARTIAL), ability text for 58 Assaulters (the collector notes it was pasted in a chat that was not exported), Spanish text for all Supporters, Guren and Final Sasuke, any equipment and jewelry. See `MILESTONE_2_OPEN_ITEMS.md`.

## 3. What changed

**Schema (migration `m2_ninja_profiles`)**: formation equivalence (`Formation.equivalentTo*`), ninja aliases (`NinjaAlias`), ability slots and awakening links (`parentAbilityId`, `talentOptionId`, `stackingRule`, `supersedesId`, `ruleSourceText`, card label fields), effect fields that keep strength, chance, rate, duration and target apart (`kind`, `rateValue`+`rateKind`, `replacesValue`, `targetCount`, `targetSelector`, `excludesSelf`, `choiceGroup`, `choiceLabel`, `sourceLine`, `note`). The migration drops and re-creates all 30 triggers because SQLite table rebuilds drop them. It is applied to the dev database (backup: `prisma/backups/dev-pre-m2b-20261013.db`, git-ignored).

**Parser** (`src/domain/ability-text.ts`, pure): a clause is structured only if a pattern matches it from first to last character; everything else is stored verbatim as TEXT_ONLY. Covers attacks, heals, fury, dispels, immunities, born-with, stat groups, statuses, chance wrappers, triggers, choice lines, PvE/PvP riders. Coverage over the corpus: 759 lines, 705 fully structured (93%).

**Awakenings** (`src/domain/awakenings.ts`, pure): replace/cancel/upgrade/unknown resolution. Stages with an unknown rule are never combined.

**Loader** (`src/game/profile-loader.ts`): `planProfiles` is pure (no database) and returns the ledger; `applyProfilePlan` writes it. Wired into `npm run db:ingest`, which now also supports `--dry-run` (works on a temporary copy of the database and prints row counts before and after) and `--ledger <file>`.

**UI** (read only): ability lines grouped by source line with supplied Spanish above the English original, rate/chance/strength/duration/target shown apart, "one of these" boxes for alternatives, awakening stages with their stacking rule, aliases, formation label with its equivalence note, review notes.

## 4. Mechanics, how each requirement is met

1. **Per-ability override of a shared default**: `(20%) shatter storm` is stored as `magnitudeOverride = 20` on that usage. The dictionary default (15%) is untouched and shown as "replaces the default". Never stored as a chance. Sai: 10% strength, 60% chance, 2 rounds, one random ally, after being attacked, all in separate fields.
2. **Conditional effects**: nature, gender, trait, PvE/PvP requirements become conditions (alternatives via `alternativeGroup`); wording that cannot be structured is kept in `conditionText`, which still marks the row conditional. A test asserts that no line naming a chakra nature yields only unconditional rows.
3. **Mutually exclusive talents**: a talent group is ONE_OF with no default selection. The supplied material lists exactly one talent per ninja, so no alternatives exist yet. A ninja listing several talents without saying so is flagged `SEVERAL_TALENTS` and shown separately.
4. **Awakening levels**: Hinata (Soccer Star) level 2 `REPLACES_PRIOR` level 1, backed by the quoted source sentence. Jugo Sage stage 3 `UPGRADES_BASE` (83% to 86%, with its card-specific condition). All other 29 awakenings are `UNKNOWN`, displayed separately with a visible note. The First Hokage and Kusanagi Kyo rules named in the handoff notes are not stored because those ninjas have no ability text in the archive.
5. **Chance vs magnitude, duration, targets, alternatives, random targeting**: separate fields. `"rate"` wording is stored as a rate with a kind (growth, intensity, application) and is never promoted to a chance. "A, OR B" lines become choice groups. PvE and PvP numbers stay two rows.
6. **Tank/DPS**: stored only as an explicit client label, never derived. 0 assigned.

## 5. Identity resolution

121 source entries: 97 exact, 5 same words in another order (mechanical), 5 reviewed judgement calls (`The Seventh Hokage`, `Ay-Bee Combo`, `Might Gai`, `Nadeshiko Shizuka`, `10-Tailed Obito`, each stored as a reviewed alias with its evidence and listed for client confirmation), 10 new Alien records, **4 unresolved** (`Immortal Madara`, `Neji Hyuga`, `Illusion God Itachi`, `Nagato uzumaki`): staged as evidence only, no ninja created or changed.

Two ninjas posted in two channels (Six Paths Sage, Cursed Seal Sasuke) are stored once; text was identical.

## 6. Findings in the supplied material

- `25_185523.png` (card of Might Gai) is a byte-for-byte copy of `15_181046.png` (Kakashi & Gai). Might Guy therefore has no card. Sasuke (Taka) has no card either.
- Chinese cards print 中坚 where English cards print "Assaulter". Used as evidence for Assaulter = Center, which remains a **proposal** (`PROPOSED`) until the client confirms.
- Four cards print "Power" where others print "Chakra"; stored as printed, as a separate statistic.
- Cursed Seal Sasuke talent awakening: 7 English lines vs 8 Spanish; the English says "Immune to 100% of enemy defenses", the Spanish "Ignora el 100% de las defensas enemigas".
- Warrior Sakura talent: 10 English lines vs 9 Spanish; heading typo `akura·Yin Seal` kept.
- Sasuke (Taka) Spanish says "reducción de daño" for "avoid injury" and "tasa de perforación" for "punch rate".
- Sai Spanish line is cut off in the source.
- 7th Hokage & Shadow: the text is headed "7th Hokage & Sasuke" and has a second skill the card does not show. Attached, marked NEEDS_REVIEW.
- Pain Animal Path: the card skill is "Psychic Hellhound", the text has "Normal Skill" and "Special Skill". Not matched.
- Source entries whose card skill name is cut off by the card layout: stored as printed and flagged.

All differences are preserved in both languages and flagged; none was resolved by choosing a side.

## 7. Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| `vitest run` | 178 tests, 10 files, all pass (includes parser, awakenings, identity, plan, database load, idempotency, upgrade from an M1 database, 30 triggers) |
| `next build` | succeeds, 15 routes |
| Idempotent load | second `db:ingest` run: every table count +0 |
| Dry run | `--dry-run` reports counts on a copy, real database unchanged |
| Integrity | `PRAGMA foreign_key_check` empty, `integrity_check` ok, 30 triggers |
| Verbatim check | all 1262 supplied lines found word for word in the source files (test runs when `docs/m2-handoff` is present) |
| Browser (Edge, built app) | unauthenticated requests redirect to /login (307); logged-in list, detail pages, tooltip with per-ninja values, mobile width 390 px with 0 px horizontal overflow; Gems still hidden in the menu |

Screenshots of this check were captured from the real running application. The temporary reviewer account used for them was deleted afterwards (0 users remain in the dev database).

## 8. Constraints kept

No commit, push, deploy or history rewrite. No Discord access. No credentials in source. No invented stats, translations, equipment or jewelry. The Supporters collection is partial and is not claimed as complete. The admin email that exists in git history from an earlier round remains there; it was not rewritten and should be handled by the owner.

## 9. Go / no go

**GO for client review** of the delivered scope. **NO GO** for closing the milestone: open items in `MILESTONE_2_OPEN_ITEMS.md` need client answers or further source material first.
