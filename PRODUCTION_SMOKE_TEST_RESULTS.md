# Production smoke test results

Run on 26 October 2026 against the **live site https://furia-ninja.vercel.app** with `scripts/production-smoke.mjs`. It is read-only: the only writes were two throw-away accounts (random passwords, never printed) and their sessions, deleted at the end. Row counts before and after were identical (177 ninjas, 316 abilities, 4,395 effects, 0 users).

**37 of 37 checks passed.**

| Area | Checks |
| --- | --- |
| Availability and transport | health endpoint answers `{"status":"ok"}` over HTTPS; HSTS enabled (`max-age=63072000; includeSubDomains; preload`) |
| Anonymous visitor | redirected to the login on `/ninjas`, `/admin`, `/search` and a ninja page (307); each private response is `private, no-cache, no-store`; `/gems` is 404 |
| Regular user | can sign in; `/admin` answers 404; `/ninjas` answers 200 |
| Administrator | can sign in; session cookie is **Secure and HttpOnly** (SameSite=Lax); `/admin`, `/admin/ninjas`, `/admin/users` open; `/gems` is 404 even for the administrator; the session persists across repeated requests |
| Data | 177 ninjas listed; Center and Assaulter filters return the same list; search «shodai» finds First Hokage; «might gai» finds Might Guy; accent-insensitive «otsutsuki» finds the Ōtsutsuki ninjas; Support formation lists 83 (79 Supporters and 4 Alien cards) |
| Client corrections visible | Natsu Dragneel (550% skill awakening and the replacement rule); Cursed Tayuya (88% and 92%); Kimono Kurenai's final Spanish line; Yamanaka Ino shows «Decisión del cliente»; Mitarashi Anko HP 45000 as printed |
| Mobile | no horizontal scrolling at 390 px on `/ninjas`, a ninja page, `/search` and `/admin` |
| Cleanup | smoke accounts removed, no game data changed |

## Before production (Preview deployment, same code, Preview database)
`scripts/browser-check.mjs` was run against `https://furia-ninja-d1isyjlen-furia-ninja.vercel.app`: **165 of 165 checks passed** (sign-in, access rules, search, combined filters, sorting, ninja pages and awakenings, administration create, edit and delete, accounts, 360 to 1280 px widths, gems 404, health endpoint). The script refuses to run against the production address.

## Local verification (same round)
SQLite suite 267 passed, 1 skipped, 0 failed (268 tests); PostgreSQL suite 261 passed, 7 skipped (SQLite-only), 0 failed (268 tests); `tsc` and `eslint` clean; `vercel-build` succeeds; PostgreSQL production build with the full browser run 165 of 165.

## Logs
Production runtime logs: no error after the data was loaded. The only errors in the log are two requests to `/` at 01:54 local time, made before the production database had its tables (see `PRODUCTION_DEPLOYMENT_REPORT.md`, section 4).
