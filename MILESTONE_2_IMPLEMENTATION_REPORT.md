# Milestone 2 — Implementation Report

**Milestone:** Core Game Database & Data Management
**Date:** 12 October 2026
**Stack (unchanged from Milestone 1):** Next.js 16, TypeScript strict, Prisma 6 on SQLite, Tailwind 4, Vitest

Milestone 2 is implemented and verified: 114 of 114 tests pass, type check and lint are clean, the production build succeeds, and the migration was tested both on an empty database and on top of a Milestone 1 database with data in it.

Three things to know before reading on:

1. **Data entry has started, and it is small on purpose.** 167 ninjas are in with their name and release month, one ninja has its full card, and the 49-entry status guide is in. No equipment or jewelry has been entered, because no equipment or jewelry screenshot was supplied.
2. **Nothing has been committed.** All changes are in the working tree for review.
3. **Seven questions for the client are still open** (section 10). None of them blocked the work; each is stored in a way that loses nothing whichever way it is answered.

---

## 1. Scope completed vs pending

| M2 deliverable | Status | Notes |
|---|---|---|
| Core database for ninjas, equipment, jewelry, gems, sets, statistics, abilities, effects | Done | 15 new tables, 17 existing tables extended. |
| Ninja information: roles, skills, passives, awakenings, talent options | Done | Plus release month, rating, type, formation, base stats with growth rate, natures, client Tank/DPS label. |
| Selectable talent representation | Done | Options stay available; a pick is per user and never part of the ninja's record. Works in the browser. |
| Conditional effects, nature requirements, restrictions | Done | Structured conditions with AND, OR and NOT; text-only and unreviewed requirements are still treated as conditional. |
| Equipment statistics and set relationships; 2/4/6 tiers | Done (structure) | Any threshold is supported. **No equipment data entered: none was supplied.** |
| Jewelry effects and set bonuses | Done (structure) | Per-group 2-piece effects, a full-set tier such as 8, or specific named pieces. **No jewelry data entered: none was supplied.** |
| Gem and statistic structures | Done | Gem tables kept; the Gems section is hidden. Statistics dictionary extended. |
| Consistent relationships between items, sets, effects and statistics | Done | One effect-usage table shared by all owners, with exactly one owner per row enforced by the database. |
| Begin population of the initial game data | Started | See section 5 for exact counts. |
| Data ready for Milestone 3 search, filter, sort, detail | Done | Indexed; a bounded, filterable list service already exists in the backend. |

**Deliberately not done (later milestones):** the search and filter interface, min/max stat filters and sorting controls, final detail pages for equipment, jewelry and sets, the admin CRUD screens and user management, the complete dataset, translations of game text, deployment. No team planner, damage engine or simulator was built.

---

## 2. Milestone 1 audit

**Baseline before any change:** type check clean, lint clean, 20 of 20 tests passing. The dev database held only structural vocabulary (4 ability types, 7 condition types, 3 effect targets): no users, no ninjas, no items.

**How Milestone 1 was preserved**

- Framework, auth, session handling, Spanish i18n, layout, admin scaffold and the admin "ninja roles" demo are unchanged. The demo was re-run in a browser after the migration and still creates a role.
- All 20 Milestone 1 tests still pass. One line of one M1 test fixture was edited, because the condition view type gained two required fields.
- The M1 `Effect` table was kept and extended instead of replaced. In M2 terms it **is** the per-usage record.
- No table or column was dropped.

**Issues found in Milestone 1 and what was done**

| Issue | Action |
|---|---|
| `.env.example` contained the client's real admin email. | Replaced with a placeholder. **It is still in the history of the pushed commit `37d74fb`.** Rewriting history was not done; that needs your decision. |
| `TalentOption.isDefault` was drawn in the interface as a selected option, which made a ninja's record look like it had chosen a talent. | The column is kept for compatibility but no longer rendered as a selection. Selection now comes only from the viewer's own stored pick. |
| The component preview page was reachable by any logged-in user. | Now administrator only (checked on the server). |
| Three numeric columns were floating point. | Converted to decimal (see section 3). |
| Known M1 limits that still apply: no login attempt limit; a missing page inside the app answers HTTP 200 with the "not found" page. | Unchanged. Not in M2 scope. |

---

## 3. Schema change log

One migration: `prisma/migrations/20261012012742_m2_core_game_data` (825 lines, 79 index statements, 22 triggers).

**New tables (15)**

| Table | Purpose |
|---|---|
| `SourceAsset`, `SourceRecord` | Provenance: each supplied file, and each piece of evidence read from it. |
| `Formation` | In-game position (Support, Center, Vanguard) with its primary stat and the client-stated team limit. |
| `NinjaRating`, `NinjaType` | Extensible rating (S, SS, SSS, SR, SSR) and type (for example Genjutsu). |
| `NinjaBaseStat` | One row per printed stat per ninja: value plus growth rate. |
| `NinjaNature` | A ninja's natures. Optional. |
| `StatusEffect`, `StatusEffectAlias`, `StatusCategory`, `StatusEffectCategory`, `StatusEffectModifier` | The reusable status dictionary: definition, alternative names, category facets, default components. |
| `UserTalentSelection` | A user's own talent pick. |
| `JewelryGroup` | Sub-group inside a jewelry set. |
| `StatisticAlias` | Alternative names for a statistic. Created for Milestone 3 search; **not populated yet.** |

**Extended tables (17).** Thirteen were rebuilt by SQLite's create, copy, drop, rename pattern (`Ability`, `Condition`, `Effect`, `Equipment`, `EquipmentSet`, `Jewelry`, `JewelrySet`, `JewelrySetBonus`, `Ninja`, `NinjaRole`, `Statistic`, `TalentGroup`, `TalentOption`); every one copies its rows before the old table is dropped. Four got plain added columns (`ConditionValue`, `EquipmentSetBonus`, `EquipmentSlot`, `JewelryType`).

**Type change.** `Effect.value`, `Effect.chancePercent` and `Condition.numericValue` went from `Float` to `Decimal`. Existing values are preserved: the upgrade test stores 12.5, 37.5 and 30.25 under M1 and reads them back unchanged.

**Integrity rules enforced by the database (22 triggers, reference copy in `prisma/constraints.sql`)**

- Release month is 1 to 12 and never stored without a year.
- Client combat class is `TANK`, `DPS` or empty.
- An effect has exactly one owner.
- An activation chance is 0 to 100; a magnitude override requires a status.
- Evidence points at one entity at most.
- A ninja's nature must be a nature.
- A user cannot hold more talent picks in a group than the group allows.
- Set thresholds are positive; closed value sets on status and condition fields.

**Preservation and backup**

- A copy of the dev database was taken before migrating: `prisma/backups/dev-pre-m2-20261012.db` (not committed).
- The migration is additive. `prisma migrate deploy` never resets a database.
- **There is no down migration.** To roll back, restore the backup taken before deploying. On a database with real data, take that backup first: for SQLite copy the file, for PostgreSQL take a dump.

**Three caveats worth knowing**

1. **A later migration can silently remove triggers.** When Prisma rebuilds a table on SQLite, that table's triggers go with it and must be re-added in that migration. A test fails if any of the 22 is missing after migrating, so this cannot go unnoticed.
2. **Prisma hides trigger messages.** A write rejected by a trigger surfaces as a generic constraint error (`P2003`, worded as a foreign key failure). The services validate first and give clear messages, so users do not see this; a developer writing directly to the database will.
3. **SQLite decimals are exact to about 15 significant digits**, which covers every value in the game. PostgreSQL stores them exactly.

---

## 4. Game mechanics: how each rule works in code

**Rating.** A lookup table, so a new rating is a new row. A ninja may have none. The stored order is the order the client listed them in and is only a display order; a test asserts it is not alphabetical.

**Formation, source category and Tank/DPS are three separate things.**

- `Ninja.formationId` is the in-game position. It is set only from direct evidence, such as the word "Support" printed on a card.
- `Ninja.roleId` is the source category: the label the reference forum files the ninja under (`supporters`, `assaulters`, `vanguards`).
- A category resolves to a formation only when its mapping is marked `APPROVED` (`resolveFormation` in `src/domain/ninja.ts`). All three mappings are currently `PROPOSED`, so **a ninja filed under `assaulters` has no formation today**, and does not appear when filtering by Center.
- `Ninja.clientCombatClass` is a single nullable column, so "both" cannot be stored. It is never derived from stats. It stays empty until the client assigns it.

**Primary stat.** Each formation points at its primary statistic (Support to Chakra, Center and Vanguard to Force). It is derived on read and never overwrites anything: Madara (Moon's Eye) is Support with Chakra marked as primary, and its Force 22500 is still stored and shown.

**Base stats and growth rates.** Four separate rows for Madara, each with its own value and growth rate. Growth rate is its own column; it is not stored as a percentage bonus or an effect.

**Optional abilities.** Nothing is required beyond a name. A ninja with no awakening, nature, talent or stats reads back with empty lists; no placeholder is created.

**Talent alternatives.** A talent group holds any number of options. Which one is active is a `UserTalentSelection` row belonging to one user. The service replaces that user's previous pick; the database refuses a second pick in a one-of group. Verified in a browser: nothing is selected by default, picking B then A leaves exactly one, it survives a reload, and a second user sees no pick.

**Conditional effects.** A condition has a scope: `ACTIVATION` (must hold for the effect to apply) or `TARGET` (narrows who receives it). An effect counts as unconditional only when it is positively known to be. The evaluator is three-valued: when information is missing the answer is `UNKNOWN`, never "active".

**The 15% to 20% override (the critical case).**

- The dictionary entry for Shatter Storm / Breaking Wind holds two default components: attack +15% and defenses +15%.
- A usage (an `Effect` row) may carry `magnitudeOverride`. For "(20%) shatter storm" that is 20.
- `resolveEffectUsage` (`src/domain/effects.ts`) returns, per component, the effective number and whether it came from the default or the override. It is a pure function and never writes to the definition.
- Strength, chance, duration and target are four independent fields. `chancePercent` stays empty unless a chance is actually stated.

Tested against the client's regression file `04_TEMPLATES/shatter_storm_regression_cases.json`: no override gives 15 and 15; the override gives 20 and 20 with chance empty and duration 2; another ninja's usage stays at 15; changing one override leaves the definition and the other usage untouched.

---

## 5. Reference-data inventory

All 19 supplied screenshots were inspected individually. The per-file review log is `data/reference/staging/source_review_log.csv`.

**What is in the database now**

| Item | Count | Source |
|---|---|---|
| Ninjas | 167 | Release-order list |
| Ninjas with a full card | 1 | `ninja_and_UI/image(10).png` |
| Base stat rows | 4 | Same card |
| Abilities | 1 (name only) | Same card |
| Talent options | 1 (name only) | Same card |
| Status dictionary entries | 49 (46 statuses, 3 terms) | Five guide screenshots |
| Entries with structured components | 15 (14 with a default number) | Same |
| Effect usages on ninjas or items | 0 | See "staged, not inserted" below |
| Statistics | 17 (4 from the card, 13 guide terms) | Card and guide |
| Formations / ratings / source categories | 3 / 5 / 3 | Card, formation screen, client statements |
| Equipment sets and pieces | 0 | **No source supplied** |
| Jewelry sets and pieces | 0 | **No source supplied** |
| Gems | 0 | Section hidden; none requested |
| Evidence records | 287 | One per appearance of a fact in a file |

**Release list (8 screenshots)**

- 167 entries, one per month from November 2012 to September 2026.
- No gap months and no two entries in the same month.
- Every entry is fully legible in at least one capture. Overlapping captures added evidence rows, not extra ninjas.
- **One join is not cross-checked.** The capture ending at Princess Hinata (November 2019) and the one starting at Guren (December 2019) share no fully legible line. The months are consecutive, so no gap is expected, but this is the one place a missing line could hide.
- Names are stored exactly as written, including the list's own spelling differences (Gai and Guy, Susano and Susanoo).
- Same-character variants are separate records: eight ninjas have "Madara" in the name.
- 166 of the 167 have a name and a release month and nothing else.

**Madara (Moon's Eye) card.** Stored: rating SSR, type Genjutsu, formation Support, source category `supporters`, the quote, and Force 22500 / 22.5, Agility 44500 / 44.5, Chakra 44000 / 44, HP 440000 / 44. The skill "Truth-Seeking Pierce" and talent "Infinite Tsukuyomi" are stored by name only, marked as partly confirmed, because the card does not show what they do or whether an alternative talent exists. "Source: Other" was not stored, as the client asked.

**Status guide.** Classification follows the guide's own headings. Three entries are only partly confirmed:

- *Sticky acid*: classified as a cleansable DoT only from where it sits on the page.
- *Crit resistance reduction*: an on-screen button hides one word.
- *Wind Escape/Shield*: the heading can be read two ways.

**Staged, not inserted (2 items)**

| Evidence | Why it is not a game record |
|---|---|
| "Makes ally assaulters enter (20%) shatter storm state for 2 rounds." | **The screenshot does not show which ninja or ability it belongs to.** It is stored as evidence with the client-confirmed reading, ready to attach once the owner is known. |
| "Restaura 68 de furia propia y 30 para los aliados." | Tail of an earlier message in Madara's thread; the ability it belongs to is cut off. Linked to that ninja as evidence only. |

Two details differ from the written brief, and the screenshot was followed in both: the image reads "Makes ally assaulters", without "all"; and the two captures of that line are the same content, so they count as one usage.

**Not used for data:** the M1 admin screenshot (our own app), the formation screen beyond the three Spanish position names, the "Source: Other" crop.

**Translation status.** All 49 dictionary entries, the ninja quote and the ability and talent names are stored in the original English and marked `MISSING`. The interface shows them with an "Original (EN)" marker. The only verified Spanish game terms are Apoyo, Centro and Vanguardia, which are printed on the in-game formation screen. My own reviewer notes shown in the interface are written in Spanish.

---

## 6. Backend integration

**Services** (`src/game/`, about 2,400 lines). Each takes the database client as an argument, so the app, the tests and the loader all run the same code.

| Module | What it does |
|---|---|
| `schemas.ts` | Input validation for every write. |
| `ninjas.ts` | `upsertNinja`, `listNinjas` (paged, filterable, newest first), `getNinjaDetail`, vocabulary upserts. |
| `effects.ts` | Writes effect usages and conditions; maps rows to the view with the status already resolved for that usage. |
| `status-effects.ts` | Dictionary upsert, list by facet, lookup by name or alias. |
| `items.ts` | Equipment and jewelry set upserts and reads. |
| `talents.ts` | A user's talent pick. |
| `provenance.ts` | Registers assets and evidence. |
| `api.ts` | The same functions bound to one actor, with the permission checked on every call. |

**Write behaviour.** Every write validates first, runs in one transaction, and is idempotent on a stable key. A failing child rolls back the whole record (tested: no partial ninja, no orphaned ability). Unknown references are rejected; nothing is created on the fly.

**Reading.** `listNinjas` always paginates (48 by default, 100 at most) and uses the same number of queries for 5 rows as for 60 (tested). It already accepts rating, formation, source category, type, combat class, name and release-range filters, combined with AND across filters and OR inside one. There is no interface for these yet.

**Local ingestion.** `npm run db:ingest` loads the reviewed files in `data/reference/`. It is operator-run, re-runnable and never deletes: a second run creates 0 records and updates 167. It reads local files only.

**Read surfaces added (minimal, read-only)**

- `/ninjas`: newest first, four pages of 48.
- `/ninjas/[slug]`: profile, base stats, abilities, talents with the viewer's pick, sources.
- `/effects`: the glossary with facets and default numbers.
- `/sets`: list of stored sets (empty for now).
- `/preview` (admin): the default versus override comparison using the real dictionary entry.
- A status name opens its definition on hover, keyboard focus and tap, showing the numbers for that usage.

---

## 7. Quality verification

Commands run on 12 October 2026, with their actual results.

| Command | Result |
|---|---|
| `npx prisma validate` | Schema valid. |
| `npx prisma migrate status` | 2 migrations, database up to date. |
| `npm run typecheck` | Clean, exit 0. |
| `npm run lint` | Clean, exit 0. |
| `npm test` | **8 files, 114 tests, all passed.** |
| `npm run build` | Compiled; 15 routes. |
| `npm run db:ingest` (run repeatedly) | First run created 167 ninjas; every later run created 0, with totals unchanged. |

**Tests by file**

| File | Passed | Covers |
|---|---|---|
| `schema.test.ts` (M1) | 13 | Original M1 schema cases. |
| `domain.test.ts` (M1) | 7 | Original M1 domain cases. |
| `m2-ninjas.test.ts` | 26 | Cases 1 to 8, 13, 18, and transaction rollback. |
| `m2-effects.test.ts` | 18 | Cases 9, 10, 11. |
| `m2-items.test.ts` | 9 | Case 12. |
| `m2-platform.test.ts` | 17 | Cases 14, 15, 16, provenance, triggers, no-Discord scan. |
| `m2-reference.test.ts` | 19 | The loader, the release list, the loaded guide. |
| `migration-upgrade.test.ts` | 5 | Case 17. |

All 18 acceptance cases in the brief have at least one test that runs against the real schema and services.

**Migration checks**

- *Clean database:* the test suite builds its database by running the real migrations every time.
- *Upgrade from Milestone 1:* a database is created with only the M1 migration, filled with M1-shaped rows across 23 tables, then upgraded. Every row and value survives, new columns get safe defaults, the foreign key check and integrity check come back clean, and all 22 triggers exist.

**Browser checks (Edge, production build)**

- New pages render with no page errors.
- No horizontal overflow at 390, 820 and 1280 pixels wide on home, ninja list, ninja detail, glossary and preview. The sets page was checked at 390 only.
- Tooltip opens on hover, focus and tap; closes on mouse leave, Escape and tap elsewhere; stays inside a 390-pixel screen.
- Talent pick flow as described in section 4.

**Failures during development, all fixed:** seven test assertions initially failed because Prisma replaces trigger messages with a generic error (caveat 2 in section 3). The triggers were working; the assertions now check the rejection code, and one test proves the trigger texts through raw SQL.

**Not verified**

- The equipment and jewelry services are tested with placeholder numbers only, since no real set exists to check against.
- The staged Shatter Storm line has never been stored as a real usage, because its owner is unknown. The same path is exercised by tests with a test ninja.
- No load test beyond the 60-row query-count check.

---

## 8. Security check

**No Discord integration.** There is no bot, API call, scraper, sync or import. A test scans `src`, `prisma` and `data` for Discord endpoints, tokens and webhooks, checks that no Discord package is installed, and checks that the game services and the loader contain no network call. All data was typed by hand from the supplied images.

**Route protection (HTTP checks against the production build)**

| Caller | Result |
|---|---|
| Anonymous, 10 routes including `/ninjas`, `/effects`, `/admin` | All redirect to `/login`. |
| Forged session cookie | Redirects to `/login`. |
| Regular user, app routes | 200. |
| Regular user, `/admin` and `/admin/roles` | 404. |
| Regular user, `/gems` and `/preview` | The "not found" page (HTTP 200, the M1 quirk noted in section 2). |
| Administrator | 200 on all, including the admin area. |

**Mutation protection.** Every mutation in `src/game/api.ts` checks `content:write` on the server. A test calls each of them as a regular user and as an anonymous caller and expects a refusal, then confirms nothing was written. A user can set only their own talent pick: the user id comes from the session, never from the form.

**Secrets.** No password, token or secret is in the code or the data files. The real admin email was removed from `.env.example`; see section 2 about git history. The dev database currently has no user accounts.

---

## 9. Changes

| Area | Files | Why |
|---|---|---|
| Schema | `prisma/schema.prisma`, the M2 migration, `prisma/constraints.sql` | The model in section 3. |
| Domain | `src/domain/effects.ts`, `ninja.ts`, `sets.ts`, `localize.ts`, `talents.ts`, `constants.ts` | Pure rules: override resolution, condition evaluation, release ordering, formation resolution, tier selection, translation fallback. |
| Services | `src/game/*` (10 files, new) | Section 6. |
| Auth | `src/server/auth/permissions.ts`, `guards.ts`, `src/server/game-api.ts` | `assertCan` and the per-request API. No change to login or sessions. |
| Reference data | `data/reference/*.json`, `data/reference/staging/*.csv`, `prisma/ingest-reference.ts` | Staged transcription and its loader. |
| Interface | `/ninjas`, `/ninjas/[slug]`, `/effects`, `/sets`, `/preview`; `effect-line`, `talent-group`, `status-term`, `status-definition`, `localized`, `review-badge` | Minimal read surfaces. |
| Navigation | `src/config/features.ts`, `nav-items.ts`, `main-nav.tsx`, `app-header.tsx`, `/gems` | Gems hidden behind a switch (`FEATURE_GEMS=true` restores it). |
| i18n | `src/i18n/es.ts` | New Spanish strings. |
| Tests | 6 new test files, `tests/helpers.ts` | Section 7. |
| Housekeeping | `README.md`, `.env.example`, `.gitignore`, `package.json` | New scripts `db:ingest` and `db:ingest:staging`; no new dependency. |

---

## 10. Open questions and follow-ups

**For the client**

1. **Is `assaulters` the same as Center?** And are `supporters` and `vanguards` the same as Support and Vanguard? One card supports the first; nothing supports the other two yet. Approving a mapping is a one-field change and immediately gives every ninja in that category its formation.
2. **Which ninja and ability does the "(20%) shatter storm" line belong to?** Once known, it can be entered as the first real override.
3. **Do set tiers stack?** When a 6-piece bonus is active, does the 4-piece one still apply, or is it replaced? Until answered, tiers are shown separately and no total is computed.
4. **Jewelry structure.** Is the jewelry screenshot discussed earlier one set with paired sub-groups and a shared 8-piece bonus, or several sets? The model handles both; I need the original image.
5. **Do DoTs and CCs count as debuffs?** The guide lists them apart from "debuffs", so they are stored without a buff or debuff label. This matters for a state like Superarmor ("Immunity to debuffs").
6. **Are these the same stat?** "final damage" and "final damage dealt"; and which defenses does "defenses" cover? They are kept as separate terms for now.
7. **Spanish game terms.** Should status names and descriptions be translated, or kept in English as the game shows them? If translated, the client's wording for terms such as "avoid injury" and "block rate" is needed.

**Source material still needed**

- Equipment and jewelry screenshots. None are in this batch.
- Cards for the other 166 ninjas, and the ability and talent texts for all of them.
- The names of the natures. None appear in the supplied material, so none are stored.

**Technical follow-ups**

- Decide whether to remove the admin email from git history.
- The client mentioned conditions such as "male ninjas only". The condition kind exists, but a ninja has no gender field yet.
- An override replaces every overridable component of a status with one number, which is what the client confirmed. A per-component override is not modelled.
- Login attempt limiting, before going live.

---

## 11. Milestone 3 handoff

**Ready to build on**

| Need | What exists |
|---|---|
| Search and filters | `listNinjas` already accepts every planned ninja filter and returns pages. Indexes exist for release date, rating, formation, combat class, type, name, item set and status, and for stat plus unit plus value. |
| Unit-safe stat filters | Values carry their unit (`FLAT`, `PERCENT`, `MULTIPLIER`); the stat index includes the unit, so flat and percentage values are never compared. |
| Detail pages | `getNinjaDetail`, `getEquipmentSet`, `getJewelrySet` return complete read models, with effects already resolved per usage. |
| Tooltips | `StatusTerm` and `StatusDefinitionBody` are reusable anywhere an effect is shown. |
| Admin forms | `getGameApi()` returns every mutation with the permission already enforced. Forms only need to collect input and show the validation messages. |
| Tank/DPS assignment | One field on the ninja, validated, with an "unassigned" filter ready. |
| Mapping approval | One field per source category. |
| Provenance | Each record can show where it came from and how far it was checked. |

**Purposefully left for Milestone 3**

- The search box, filter controls, min/max stat filters and sort options.
- List and detail pages for equipment and jewelry, and detail pages for sets.
- Admin create, edit and delete screens for every entity, and user management.
- Filtering by a stat inside effects, which needs a decision on question 6 first.
- Spanish translations of game text, pending question 7.

**Rules to keep when building it**

- Never show a ninja's talent as selected unless the viewer picked it.
- Never show "Siempre activo" unless the effect is known to be unconditional.
- Never add set tiers together while stacking is unknown.
- Never derive Tank or DPS, or a formation from an unapproved category.
- A change to one ninja's effect value goes on that usage, never on the dictionary entry.
