# Production smoke test results

**Live production URL: none yet** (deployment blocked, see `PRODUCTION_DEPLOYMENT_REPORT.md`). The results below were produced on 26 October 2026 against the **production build running on a local PostgreSQL** that holds a verified copy of the real data. They prove the production configuration, not the Vercel environment.

| Check | Result |
| --- | --- |
| `vercel-build` (PostgreSQL client generation and `next build`) | succeeds |
| `tsc --noEmit` with the PostgreSQL client | clean |
| `eslint .` | clean |
| Automated tests, SQLite (local and CI database) | 267 passed, 1 skipped, 0 failed (268 tests in 18 files) |
| Automated tests, PostgreSQL (`npm run test:pg`) | 261 passed, 7 skipped (SQLite-only), 0 failed (268 tests in 18 files) |
| Real-browser run (Edge) on the PostgreSQL production build | **165 of 165 checks pass**: sign-in, anonymous redirect, regular-user 404, search by name and alias, combined filters, sorting, ninja pages with awakenings (Natsu Dragneel, Cursed Tayuya, Kimono Kurenai, Ōtsutsuki Isshiki, Madara (Moon's Eye), Yasaka Itachi, Mitarashi Anko), administration create, edit and delete, accounts and roles, 360, 390, 768, 1024 and 1280 px without sideways scrolling, gems 404, health endpoint |
| Test data created by the browser run | removed afterwards (checked) |
| Data copy | 41 of 41 tables identical by count and content checksum |

## To run on the live URL (after the deployment)
Read-only: `/api/health`, sign-in as the administrator, `/ninjas` (177 results), search "Shodai" and "gai", `/ninjas/natsu-dragneel`, `/ninjas/cursed-tayuya`, `/ninjas/kimono-kurenai`, `/search`, `/gems` (404), `/admin` as a regular user (404) and anonymous (redirect). The browser script `scripts/browser-check.mjs` must not be pointed at production (it creates and deletes test accounts); a read-only variant list is above. Preview deployments use the Neon preview branch only.
