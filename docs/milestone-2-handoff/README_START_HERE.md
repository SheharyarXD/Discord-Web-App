# Milestone 2 — Claude Code Handoff Package

**Purpose:** give Claude Code the complete set of currently supplied images and the client-confirmed mechanics, plus a detailed implementation brief for Milestone 2.

## How to use

1. Open Claude Code **inside the existing Milestone 1 project repository**, with its working source code and database/migration history available. **This ZIP does not include your Milestone 1 source repository.**
2. Unzip this folder into the repo as `docs/milestone-2-handoff/` or another read-only reference location. Confirm screenshots are accessible to Claude Code for visual inspection. Do **not** put screenshots in the public `public/` directory unless intended for public visibility.
3. Ask Claude Code: `Read docs/milestone-2-handoff/01_PROMPT/MILESTONE_2_MASTER_PROMPT.md in full. Inspect every referenced image and requirement file. Implement MILESTONE 2 ONLY in this existing repository, preserve all M1 functionality, run migrations/tests/build, and produce MILESTONE_2_IMPLEMENTATION_REPORT.md. Do not stop at planning.`
4. Make sure the project has a **development/test database**, not just production access. Back up any real M1 data before applying migrations. Provide `.env.example` with placeholder variable names, not live secrets. Keep real `.env` local, private.
5. At completion review the report, changed files, schema migration and live local UI before accepting the milestone.

## Files

- `01_PROMPT/MILESTONE_2_MASTER_PROMPT.md` — full implementation instructions and acceptance tests.
- `02_REQUIREMENTS/AGREED_FULL_SCOPE_VERBATIM.md` — client-agreed full project and four milestones.
- `02_REQUIREMENTS/AGREED_SCOPE.md` — boundary of M2 vs later milestones.
- `02_REQUIREMENTS/CLIENT_CONFIRMED_DECISIONS.md` — factual client decisions including the critical 15%/20% effect rule.
- `02_REQUIREMENTS/REFERENCE_AUDIT_AND_UNCERTAINTIES.md` — what images prove and what remains unknown.
- `03_REFERENCE_IMAGES/IMAGE_INDEX.md` — 19 uploaded original images, categorized and annotated.
- `03_REFERENCE_IMAGES/**` — image files, preserved with original names.
- `04_TEMPLATES/ninja_release_staging.csv`, `effect_usage_staging.csv`, `source_review_log.csv` — empty/import staging examples, no fictional game records.
- `04_TEMPLATES/shatter_storm_regression_cases.json` — explicitly client-confirmed test scenarios, **not** purported game imports.

## Essential caveats

- The screenshots do **not** provide the entire game's dataset. Full initial data completion is Milestone 4 and will require additional source material.
- The existing Milestone 1 code is NOT attached here; Claude must inspect the actual repository before implementing anything.
- A game role/source channel name (`assaulters`) is not conclusively proven to equal in-game formation `center`. Preserve both until reconciled.
- In Shatter Storm `(20%)` refers to a 20% **stat bonus replacing a 15% default**, not a 20% activation chance.
- Client chose to hide Gems from navigation; don't delete Gem schema/data.
- Keep admin authentication/access enforced server-side.
