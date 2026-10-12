# CLAUDE CODE MASTER EXECUTION PROMPT — MILESTONE 2

**Project:** Private, Spanish-first game reference database (Ninjas / Equipment / Jewelry / Effects)  
**Current stage:** Milestone 1 has been reported completed by the developer. **Milestone 2 only.**  
**Non-negotiable:** Preserve Milestone 1 work, authentic game facts, data integrity and authorization boundaries.

## Your role and operating contract

You are the senior full-stack engineer, data modeler, game-mechanics analyst and QA owner implementing **Milestone 2 — Core Game Database & Data Management** within the EXISTING repository. This is an execution task: inspect, plan, implement, migrate, test and report. Do not stop after making a plan. Do not present an unimplemented design as completed software.

Before changing code, read all files in this handoff package, especially:

- `02_REQUIREMENTS/AGREED_FULL_SCOPE_VERBATIM.md` (original agreed full scope)
- `02_REQUIREMENTS/AGREED_SCOPE.md` (milestone boundary summary)
- `02_REQUIREMENTS/CLIENT_CONFIRMED_DECISIONS.md`
- `02_REQUIREMENTS/REFERENCE_AUDIT_AND_UNCERTAINTIES.md`
- `03_REFERENCE_IMAGES/IMAGE_INDEX.md` and the original screenshots
- `04_TEMPLATES/` for source-traceability and extraction formats

The attached images are client reference material. **Inspect each relevant original image**, not just this prompt's commentary. Treat screenshots as incomplete evidence and distinguish observed data from user statements, inference and unknowns. Images may be cropped, have overlaps and show the same content in more than one capture. Never count a duplicate screenshot as a separate ninja or status. If an image isn't legible, mark that field pending; never guess. Translation must preserve meaning and numerical values.

**Milestone scope:** Implement all real M2 database/domain/repository/data-management foundations and begin authenticated, source-traceable reference-data population. Do NOT implement Milestone 3's complete advanced search/filter UI or full admin CRUD, or Milestone 4's complete data population, production launch or final polish. A minimal read-only view or test harness is fine if needed to verify domain correctness; do not claim the final detail pages or filter system are done.

**ABSOLUTELY NO** Discord bot, Discord self-bot, Discord API, Discord scraper, automated Discord ingestion, Discord sync or accessing the server. Use only supplied images, authorized client-provided text or files. Preserve manual provenance and review status.

**Never**: hardcode passwords/secrets/admin email, put production secrets in commits, silently drop existing tables, reset databases with actual content, replace the existing framework just because you prefer another, add invented ninjas/stats, silently reinterpret game mechanics, or claim unexecuted tests passed.

---

## PHASE 0 — Repository audit, gap analysis and checkpoints (REQUIRED)

1. Inspect `README`, package manifests/lockfiles, framework, routing, TypeScript config, database adapter, ORM/migrations, auth, i18n, UI components, admin scaffold, tests, existing sample content, migration history and current git diff/status.
2. Map current M1 schema to M2 requirements. Record existing tables and fields. Do not duplicate existing services/components or break working M1 admin-role demo functionality.
3. Assess migrations on the actual target DB engine. Before any migration, identify whether it's safe with existing data; create a backup or instruct the operator on the correct backup procedure if the DB contains non-disposable data. Never apply an unreviewed destructive migration.
4. Write a short implementation plan showing gaps, affected files/tables, order of work and checks. Prefer the repository's current stack. Use additive/backward-compatible migration steps; code and migrations should be reproducible from clean setup.
5. Keep changes within milestone scope. If there is a genuine blocking ambiguity, document it and implement a lossless, extensible representation instead of inventing an interpretation. Only ask a question if safe implementation cannot continue.

### Priority order
Data integrity and accurate mechanics > robust relationships and migrations > maintainable source ingestion > usable read surfaces > cosmetic polish.

---

## PHASE 1 — Canonical domain model and migrations

Implement or extend normalized, relational structures, enforcing referential integrity, uniqueness and appropriate indexes. Names below are conceptual, **adapt to existing schema** rather than renaming/rebuilding everything automatically.

### A. Ninjas, identity, dates, rating and classification

Represent each **named release/variant as a distinct ninja record** (e.g., different Madara or Naruto variants must not be merged by franchise character name). Preserve the original name, display name/localized text, optional artwork URL/local asset, canonical slug, optional description, and provenance.

- `release_year`, `release_month` OR an equivalent YYYY-MM with **month granularity**; do not fabricate a day/time. Validate 1–12, allow nullable for genuinely missing historical records; source screenshot shows monthly ordering from Nov 2012 through Sep 2026 with gaps across the provided captures. Newest-to-oldest must work deterministically, with tie-breaker; capture a source's explicit order when available.
- An extensible rating/category vocabulary supporting **S, SS, SSS, SR, SSR**. Do not assume alphabetical sort reflects ranking or that every ninja has a known value. Screenshot of Madara says SSR.
- Canonical **formation/position** `support`, `center`, `vanguard`, visually described as back/middle/front. This is NOT the same field as Tank/DPS.
- The Discord forum labels are `supporters`, `assaulters`, `vanguards`. Their exact correspondence to gameplay formation labels must not be silently inferred: if an incoming record is labeled `assaulters`, store the original source label and resolve its formation only when justified. Make any proposed mapping explicit and reviewable. Do not conflate separate source categories and game fields.
- `tank` OR `dps` manual client classification, **never both**. Nullable/unassigned is essential because the game does not directly say it; never infer this value from stats without client approval. Mark client-defined classification separately from canonical game data. Admin will set it in M3.
- Type such as `Genjutsu` is independent of rating and position; extensible and nullable.
- The card's acquisition `Source: Other` was declared irrelevant by the client: don't add it as a mandatory ninja field. **Provenance for our data extraction** remains necessary and is different from the game's acquisition Source label.
- Formation determines **primary combat stat category**: Support -> Chakra; Center/Vanguard -> Force (game's client-confirmed rule). Derive this for gameplay semantics, **but do not erase the numeric Force/Chakra values actually shown on a card**. Madara's Support card visibly displays both Force and Chakra; model all printed base attributes and their growth rates.
- Model displayed base stats as normalized per-ninja stat records with optional growth rate (decimal), appropriate units and original labels: Force, Agility, Chakra, HP, etc. Never collapse growth rate into % bonus or misread as a set bonus. Preserve numeric precision.
- Team-size note for future use only: four ninjas, with at most three Support, two Center, one Vanguard. **Do not build a formation planner or team optimizer in M2.** Keep rules documented so later feature can reference them.

### B. Ninja abilities, awakenings and talents

Each ninja may have zero, one or multiple abilities; older ninjas frequently lack awakenings/elemental affinities. No required placeholder awakens. Store ability kind (skill, passive, attack-triggered, awakening, talent, etc.) in an extensible vocabulary, name, sequence, original text, localized text, known trigger and optional rank/awakening stage.

A ninja may have alternative talents in a *mutually exclusive selection group*: zero or one active selection in a group per applicable user selection context. The existence of two available options MUST NOT imply both active. Don't globally assign a selected option to the game's canonical ninja record if the selection is a user/build choice. Design a safe model for option groups and possible future selection state; M2's responsibility is data model + accurate representation, not a full build planner. Allow different numbers of options. Preserve contradictory or unknown rules as `pending_review`, not silent defaults.

### C. Effect dictionary, status taxonomy and individual usages (MOST IMPORTANT)

**Separate a reusable effect definition from each application/usage of that effect.** Every appearance in a ninja ability or a set bonus must retain its **own context-specific magnitude/override, target, duration, explicit chance (if any), trigger, conditions, original wording and provenance**.

A canonical effect definition includes multilingual label/aliases, rich description, component modifiers or an equivalent structured default effect, classification, cleansability, optional default magnitude(s), exceptions and original source text.

An `effect_usage` (or equivalent) belongs to the specific ninja ability, talent, item or set-bonus tier, with its own override, application conditions, target roles/positions, duration in rounds, trigger and explicit application chance only when actually stated. Provide database integrity for ownership relationships: don't rely on an unchecked `owner_type, owner_id` pair with no FKs if the existing stack offers a safer normalized association design.

**Shatter Storm test is critical:**

- Definition: the guide indicates the default state increases **Attack and defenses by 15%**, unless a user specifies a different percentage. Alias `Shatter Storm / Breaking Wind`. Preserve the original game wording and don't assume which defense subdivisions it covers if the screenshot is insufficient.
- Specific ability usage: `Makes all ally assaulters enter (20%) Shatter Storm state for 2 rounds.` Here `(20%)` OVERRIDES THE MAGNITUDE of the effect's stat increases for this one usage. It is **NOT 20% proc/activation probability**. Target = allied assaulters (as source phrased it), duration = two rounds. If no percentage override is given, use 15% default. An explicit separate chance, if present in other abilities, belongs in an entirely different nullable field.
- All affected modifiers defaulted at 15% are replaced by 20% for this usage (the client explicitly confirmed the percentage applies to all relevant modifiers). Changing an override cannot change the canonical 15% default or usages by other ninjas.
- Expose a tested domain resolver such as `resolveEffectUsage` returning effective modifiers plus whether derived from default or override. It must not mutate persisted definition. Cases: default-only -> 15%, usage override -> 20%, other usage unaffected -> 15%. Test undefined chance remains NULL rather than 20%.
- Avoid conflating effect *power*, activation *probability*, duration and application target. Treat these as four independent dimensions.

**Status classification is multidimensional**, not a single enum attempting to cover every facet:

- helpful/harmful: buff vs debuff; some states/systems may be neutral
- category: DoT, CC, stat modifier, immunity, shield, piercing damage etc. A status may have more than one category
- cleansability: cleansable/uncleansable/conditional/unknown (with exceptions)
- status damage timing, scaling stat, chance, duration and special notes if documented
- alias mapping and exact source wording; canonical English/Spanish translations and search synonyms later

Image references contain:

- Cleansable DoTs: Poison, Ignite, Power Loss, Orochi Poison, Vein Damage, Bleed, Split, Unification, Safeguard, Burst, Scorching Flame (exact image text takes precedence).
- Uncleanseable DoT: Incinerate/Burn.
- Uncleanseable CC: Blind, Imprison, Freeze, Wind Bound, Seal, Charm, Curse Fixation.
- Cleansable debuff example: Painful Will.
- Uncleanseable debuff examples: Upwind/Headwind, Weakened, Corrosion, Death Seed, Poisonous Wind, Curse Fixation, Chaotic Storm, Dispirited, Untreatment, Armor Break, Crit Resistance Reduction.
- Uncleanseable buffs: S-Super Dodge, Amenotejikara/Shielding/Position Interchange, Shatter Storm/Breaking Wind, Wind Escape/Shield, Shielding State, Bond, Pyroblast, Superarmor, Acceleration, Strong, Super Defense.
- Cleansable buffs: Super Dodge, Fury Shield, CC-free State, Death Seed Immunity Buff.
- Some status names appear in different categories/situations: retain contextual properties and aliases instead of overwriting one definition with contradictory global behavior. For cases such as Sticky Acid/exception statements, store exemption logic or source note; do not make up simulator logic.
- Dictionary content is **reference text**, not necessarily executable combat calculations. Preserve original definitions verbatim in source record; add validated structured attributes only when unambiguous.

**Terminology:** Pierce/Penetration deals immediate health deduction based on attack as described; DoT is attack-based health deduction at the beginning of an enemy's turn; shields can scale from Physical or Strategy Defense; don't incorrectly implement a full damage algorithm from these explanatory screenshots. Glossary definitions are enough for M2, with reusable linkable IDs for later hover/tap tooltips.

**Tooltip contract preparation:** Create a shared data/query/service representation that later UI can render upon mouse hover, keyboard focus or tap on mobile. UI must show description with this usage's correctly resolved effective magnitude and duration/conditions—not an unconditional copied default. If an M1 UI primitive for tooltip exists, extend it minimally for the M2 read surfaces, but full detail-page UI belongs to M3.

### D. Conditions and nature restrictions

Effects may apply **only if a required nature** or other rule is satisfied. Model conditions explicitly and associate them with the exact usage, allowing nested AND/OR/NOT groups where genuinely needed, target restrictions, affected roles, required nature(s), duration, trigger, optional probability and natural-language caveats. Separate *activation preconditions* from *targets*. If an expression is too complex or undocumented, preserve original text, set `structured_status = needs_review` and display a conditional badge—NEVER treat unknown conditional effects as unconditional. Avoid fabricating a player nature selection system.

### E. Equipment and jewelry

Preserve existing M1 item/set structures and extend them to support:

- Equipment pieces, categories/slots, sets, individual flat/percentage stats and effect usages.
- Equipment set tier bonuses at **2 / 4 / 6** pieces with full structured stats and conditional/triggered effects. Support arbitrary thresholds rather than 2/4/6 hardcoding.
- Jewelry/accessories: individual pieces, category/group, per-group 2-piece effects where applicable and an 8-piece full set bonus where supported, without assuming jewelry follows normal equipment thresholds. The screenshots show several paired-icon groups and repeated 8-piece descriptions; **whether these are one set or multiple sets is not fully established**. Do not convert four repeated descriptions into four different bonuses without verification.
- Distinguish item/base stats vs set unlock-tier stats/effects.
- Set stacking vs replacing: whether equipment 6-piece numbers add to 4-piece numbers is currently **unconfirmed**. Store each tier faithfully and do not silently compute summed totals. Document a pending client clarification before any aggregate calculator.
- All sets and items need source reference and localization status; fields whose image value cannot be trusted remain NULL/pending.

### F. Gems

The client confirmed Gems was mistakenly included in the original scope as a placeholder and does not currently need a visible tab. **Hide the Gems navigation feature**, keeping M1's database types/structures safe for future reactivation. Do not populate invented gems. If the repository already has a feature/config flag, use it. Do not drop gems tables or break migrations.

### G. Global stats, locales, provenance, ingest status

Make stat dictionary canonical and extensible: names/aliases/translated names, unit/kind (`flat`, `percent`, `multiplier`, etc.) and appropriate category. Support decimal precision; avoid floating-point rounding for stored stat values as appropriate for ORM/DB. Same stat can appear across ninjas, gear, jewelry and ability effects. Never sort percentage and flat values as if same unit.

Spanish default UI. Preserve source English terminology and original game strings alongside Spanish versions, with `translation_status` (e.g., verified, draft, missing). Do NOT silently claim untranslated content is translated. Existing translation architecture must remain intact. If a game term has uncertain Spanish meaning, keep the source term and flag for review.

Implement reference provenance on source-derived records: source category (e.g., screenshot, client_message), asset filename, location/line/region reference if feasible, date of capture if known, review/verification status, ambiguity note, timestamps and optional supersession. Never assume screenshot creation time equals game release time. Use manual screenshot ingestion only, not Discord API.

Index the attributes Milestone 3 will need: release date, rating, formation, manual Tank/DPS, name/slug, item category/set, stat type+unit+value, ability/effect usage and condition references. Do not build the full filter UI in M2; ensure future queries can implement AND/OR filters with correct units and source/condition awareness. Preserve foreign keys and uniqueness.

---

## PHASE 2 — Backend/data-management implementation

Implement domain-level validated schemas, repositories/queries/services, safe creation/update/upsert paths (usable by later admin CRUD), and coherent read models, following existing stack patterns. Reuse existing authorization middleware and prevent regular users accessing mutations. If Milestone 1 already implements some admin role CRUD, preserve it; do not create an alternate insecure route. Later admin UI is M3, but the M2 core data must actually be writable/testable through protected service/database-layer operations and read back correctly. Any temporary command-line ingestion must be local/operator-run, idempotent, not publicly exposed and not scraping the internet.

Transactional writes for parent + children; no partial ninja with detached orphan effects after failed import. Provide explicit constraints for ratings/positions, exclusive talent options and effect-usage ownership. Do not require data fields that early-game ninjas don't have. Do not allow cross-user privilege escalation. Sanitize rich descriptions and external image refs when displaying. Do not store client's email inside seed files or project artifacts.

Build minimal M2 preview/list/read surfaces where necessary to demonstrate records, effects, per-usage overrides and condition labels. Reuse Spanish navigation/auth/UI shell from M1; don't replace its design. No full search or admin forms required yet.

---

## PHASE 3 — Reference data processing (begin, do not invent completeness)

You have **partial screenshots**, not an authenticated exhaustive Discord archive. Extract safely in two passes:

**Pass 1 — Audit/staging**
1. Enumerate all source images in `03_REFERENCE_IMAGES/IMAGE_INDEX.md` and visually inspect each.
2. Create a deduplicated staging list from all visible release-order screenshots, earliest to latest as readable. Preserve release month/year and **exact variant name**. Screenshots overlap; dedupe same variant+release period only. Do not assume every month/page is present; maintain a gap report. Do not infer roles, ratings, nature, talent or base stats from the release list unless pictured elsewhere.
3. Stage confirmed Madara card fields and all legible glossary entries. For text only partially visible, stage it as unverified/partial. The client screenshot might show English game names inside Spanish Discord UI; do not translate proper nouns arbitrarily.
4. Record whether each source item was `confirmed`, `partially_confirmed`, or `needs_review`; retain links to source image paths.

**Pass 2 — controlled insertion**
5. Populate valid confirmed minimum factual records appropriate to M2 (e.g. safely captured release order; exact visible Madara details; status dictionary from guide). A release-order-only ninja is a valid sparse record, NOT a complete ability/role profile. Missing fields must stay NULL.
6. Do not create placeholder abilities, invented rarity, Tank/DPS choices, unknown positions, false buff magnitudes or set membership.
7. Any ambiguous duplicate name, unclear character variant or overlapping screenshot must be flagged in staging rather than silently merged or inserted twice.
8. Make the data loading operation idempotent and easy to rerun after corrections; avoid destructive truncation. All source imagery should remain in the read-only project reference folder rather than being accidentally bundled into the public site as sensitive metadata. Real icon/image use is future UI work; the current files are reference screenshots, not crop-ready character art.
9. Provide an explicit inventory: number of release records confidently extracted; number entered; number partial; gap months; terminology/effects entered; equipment and jewelry entries actually supported by attached images. **Do not pretend the screenshot archive contains all equipment and jewelry or the full character abilities.** Full agreed initial dataset completion remains M4, with additional reference material supplied later.

---

## PHASE 4 — Test cases and acceptance gate

Use repo's test framework (or add minimal maintainable tests if needed). Implement tests that must run against actual services/schema, not mere prose or mocked getters:

1. **Distinct variants:** `Uchiha Madara` and `Uchiha Madara (Moon's Eye)` are distinct records; duplicate upload of same release does not create extra record.
2. **Release dates:** month/year stored without fabricated day; newest-first ordering works, unknown dates are handled deterministically; overlap screenshots don't duplicate.
3. **Rating:** allow S/SS/SSS/SR/SSR; new types extensible; missing rating allowed.
4. **Position vs build type:** Support != Tank; Center != DPS. A ninja can be classified only one of Tank or DPS, or unassigned; invalid dual assignment must fail.
5. **Source category independence:** label `assaulters` must not get silently mapped to `center` without approved mapping.
6. **Base stats:** example Force 22500 / growth 22.5; Agility 44500 / 44.5; Chakra 44000 / 44; HP 440000 / 44 for Madara (check visual screenshot before using). These are four separately queryable base records; Chakra primary for Support does not erase Force.
7. **Optional features:** an older ninja may have no awakenings or elemental affinity; no fake entries appear.
8. **Talent exclusivity:** available options stay multiple; stored user selection is at most one from the group; selection is not global canonical default.
9. **Conditional nature:** an effect requiring a nature remains conditional in stored representation; missing condition-resolution data must not imply it activates.
10. **Shatter Storm default/override:** dictionary 15% baseline; 20% usage replaces Attack and relevant defense modifiers in that one usage, another usage remains 15%; chance stays NULL when absent; duration=2 for cited usage. This is a core regression test.
11. **Glossary classification:** buff/debuff, cleansability, CC, DoT are independently represented; distinct effects/aliases preserved; a status can have multiple facets.
12. **Set tiers:** 2,4,6 supported for equipment; jewelry 2/8 (and future arbitrary thresholds); individual effects linked correctly; no fake cumulative arithmetic.
13. **Unit safety:** percent, flat and growth rate not conflated; decimal precision retained.
14. **Gems:** schema survives; UI link hidden; data not deleted.
15. **i18n:** Spanish default, source-English text and translation status preserved; no false translation completion.
16. **Auth:** anonymous requests can't access protected data; regular user can't mutate game records; existing M1 admin tests still pass.
17. **Migrations:** clean DB migration works; upgrades from existing M1 schema preserve original records; FK constraints and indexes valid. Include rollback/restore instructions even if down migrations aren't automatically safe.
18. **Performance:** representative list queries don't generate unbounded N+1 query patterns; pagination or bounded loading is available in backend for future full roster.

Run and report actual commands and results for: tests, typecheck, lint, build, migration/seed validation and authorization checks. If a tool/DB cannot be run in the environment, state the blocker and give reproducible follow-up steps—do not label it passed.

---

## MILESTONE 2 DEFINITION OF DONE

- [ ] Existing M1 application/auth/navigation/i18n/admin foundation remains working.
- [ ] M2 schema migrations applied/tested safely with preservation of existing data.
- [ ] Ninjas support month/year release, distinct variants, extensible rating and game type.
- [ ] Source forum category and formation position are not wrongly conflated.
- [ ] Position/Chakra-vs-Force derivation is correct; printed stats and growth rates stored independently.
- [ ] Tank or DPS is optional/client-assigned and mutually exclusive.
- [ ] Abilities/passives/awakenings/talent option groups model early and late ninjas.
- [ ] Conditions/nature requirements explicitly prevent unconditional interpretation.
- [ ] Reusable effect dictionary and contextual usages with correct 15%/20% override resolution.
- [ ] Buff/debuff, cleansability, DoT and CC taxonomy, glossary and provenance modeled.
- [ ] Backend supports equipment/jewelry individual stats, relationships and flexible thresholds.
- [ ] Gem schema retained but Gem tab hidden.
- [ ] Protected data services and usable reads are implemented without full M3 admin UI.
- [ ] Source screenshot references audited; confirmed content entered with idempotent staging and gap report.
- [ ] Spanish remains default and uncertain translation is visibly marked for review.
- [ ] Critical regression tests execute and pass (or blockers are accurately reported).
- [ ] Full advanced search/filter UI, full admin CRUD, full initial dataset, final deployment still correctly deferred.

## Final report format (REQUIRED)

Deliver a **`MILESTONE_2_IMPLEMENTATION_REPORT.md`** in the repository containing:

1. **Scope completed vs pending**, tied to the exact M2 deliverables.
2. **Existing M1 audit**: baseline, any issues found and how preserved.
3. **Schema change log**: tables, migrations, FK/constraints/indexes and preservation/backup.
4. **Game mechanics evidence**: how rating, formation, Tank/DPS, optional abilities, talent alternatives, conditional nature and 15→20 effect override work in code.
5. **Reference-data inventory**: screenshots reviewed, exact confirmed/staged/inserted counts, screenshot gaps, untranslated/pending fields; direct file references for claims.
6. **Backend integration**: services, read APIs, protected mutations or local ingestion method.
7. **Quality verification**: actual commands/results for tests, lint, typecheck, production build, migration checks; failures and why.
8. **Security check**: no Discord integration; route/protected mutation check.
9. **Changes**: major files/modules and concise rationale; do not paste whole source.
10. **Open questions and follow-ups**: unconfirmed assaulter↔center mapping, gear-set stacking, jewelry group structure, image ambiguity, translation status and missing source data.
11. **Milestone 3 handoff**: what code/interfaces can power later search/filter/detail/admin UI, and what remains purposefully unimplemented.

**Completion standard:** Working, tested data management/domain code—not just UI mocks or a schema proposal. Continue through implementation without stopping at the plan. Never mark unknown or skipped work as completed.
