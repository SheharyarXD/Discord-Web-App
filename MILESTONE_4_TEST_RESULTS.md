# Milestone 4: test results

All results below were produced in this round, after the last code change. Date of the run: 25 October 2026. Branch `milestone-4`.

| Check | Result |
| --- | --- |
| `vitest run` | **264 tests in 17 files, all pass** (the earlier 252 tests plus 12 new: `m4-awakening-rule` 4, `m4-spanish-ui` 3, `m4-consistency` 5; four existing tests were rewritten for the new awakening rule, the complete Kimono Spanish and the confirmed Shodai alias) |
| `tsc --noEmit` | clean |
| `eslint .` | clean, no warnings |
| `next build` | succeeds; includes the new `/api/health` route |
| Import dry run on a copy | ninja, alias, base stat, ability, effect, condition, source rows: +0 |
| Real import, then repeat | first run changed one source asset (the client-supplied Kimono file); the repeat is +0 on every table |
| `PRAGMA integrity_check` / `foreign_key_check` | ok / empty |
| `scripts/verify-supporters.mjs` | 79 cards, 1,942 text lines, 79 distinct ninjas, no mismatch |
| `scripts/final-audit.mjs` | awakening per-ninja sum equals the database total (120); stated-rule sum equals 21 |
| Real-browser run, built application, Edge (`scripts/browser-check.mjs`) | **165 checks, 165 pass** |

## What the browser run covers
- Sign-in, anonymous redirect on nine addresses, regular user 404 on admin and gems, administrator access.
- Search by name, Spanish name and alias; Center and Assaulter return the same list; 15 ranks; OR within a filter and AND between filters; statistic ranges; both sort directions.
- Ninja pages and awakening display for Natsu Dragneel, Cursed Tayuya, Kimono Kurenai, Ōtsutsuki Isshiki, Madara (Moon's Eye), Yasaka Itachi, Mitarashi Anko.
- Administration: create, edit, delete ninjas, equipment, sets, glossary; ability text pasted and parsed; users created, deactivated, reset, deleted with the safeguards.
- **New in Milestone 4:** 13 pages at 360, 768, 1024 and 1280 px without sideways scrolling (the 1024 px check found and led to the navigation fix); `/api/health` answers `{"status":"ok"}` without signing in and shows no data; an anonymous visitor is not served `/admin`.
- All test accounts and records created by the run are removed afterwards (checked).

## A defect found and fixed by the new tests
At 1024 px every page scrolled sideways by 184 px because the inline navigation (nine entries for an administrator) did not fit. The menu button now takes over below 1280 px; the 1024 px check was re-run and passes.
