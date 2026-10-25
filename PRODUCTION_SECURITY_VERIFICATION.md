# Production security verification

**Status: verified locally and on the live site https://furia-ninja.vercel.app (26 October 2026).**

| Area | Check | Result |
| --- | --- | --- |
| Authentication | anonymous visitor on `/ninjas`, `/admin` | redirected to `/login` (307), tested locally and in the browser run |
| Authorization | regular user on any `/admin` page | 404; every write is rejected with Forbidden (17 operations in tests); administrator only for users, content and database management |
| Sessions | cookie | HttpOnly, SameSite, **Secure when `NODE_ENV=production`**; sessions are stored in the database, so they persist across serverless instances (verified in the PostgreSQL run: sign-in, access and sign-out through the production build) |
| Caching | private pages | `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`; `/api/health` is `no-store`; no private page is served from a shared cache |
| Security headers | all routes | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Powered-By` removed |
| Public endpoint | `GET /api/health` | answers only `{"status":"ok"}` or 503; reveals no data |
| Gems | `/gems` | 404 for everyone while `FEATURE_GEMS=false` |
| Secrets | repository audit | `.env`, `.vercel`, local databases, backups and `.local-pg` are git-ignored; no connection string, password or token is committed (the PostgreSQL schema test fails if one appears); the only password-like string in the repository is the fixed placeholder of the throw-away local test server in `scripts/pg-embedded.mjs` (it listens on 127.0.0.1 only and holds no real data) |
| `NEXT_PUBLIC_` | variables | none exist |
| Upload content | `.vercelignore` | `docs/` (client screenshots and source packages), backups, `*.db`, `*.zip`, `*.pdf`, tests and prompts are never uploaded by a CLI deployment; Git deployments contain only what is committed, which excludes the same material |
| Accounts | defaults | no default or debug account exists; the development database holds 0 users; the first administrator is created by the owner with a password of his choice, never stored in a file |
| Account safeguards | self-demotion, last administrator, session end on deactivation | covered by tests and the browser run |
| Runtime files | writes to disk | none at run time; the only runtime file read is `data/reference/lexicon.json`, traced into the serverless admin routes |
| Dependencies | additions | `embedded-postgres` (development only, used for local verification; not used at run time) |

## Verified on the live site (`PRODUCTION_SMOKE_TEST_RESULTS.md`, 37 of 37)
- Anonymous, regular user and administrator tested over HTTPS: redirect to login, 404 on `/admin` for the regular user, administrator access.
- Session cookie observed in the live browser: **Secure, HttpOnly, SameSite=Lax**; HSTS enabled; private pages `no-store`.
- Function logs inspected: no error after the data was loaded.
- Environment variables reviewed by name only; `DIRECT_URL`, `SESSION_DAYS` and `FEATURE_GEMS` are stored as secrets; the temporary preview bypass secret was revoked (0 left); the local `.env.local` token file was deleted.
- Production and Preview use different Neon databases; the browser test script refuses to target the production address.

## Still to do by the owner
- Create the first administrator (`scripts/create-admin.mjs`); no account exists and no default or debug account exists.
- A write made in production surviving a new deployment is guaranteed by the external database; it can be confirmed after the first administrator exists by editing a harmless field.
