# Milestone 4: final acceptance checklist (deployment round)

VERIFIED = checked in this round. PENDING OWNER = needs an account action in the client's Vercel team. BLOCKED = cannot be completed before that action.

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Development scope of Milestones 1 to 4 | VERIFIED | `MILESTONE_4_ACCEPTANCE_CHECKLIST.md`, 268 tests (267 pass, 1 skipped), 165 browser checks |
| 2 | Client corrections incorporated (awakenings, Shodai Hokage, Kimono Kurenai, aliases, ranks, terminology, English first) | VERIFIED | `MILESTONE_4_CLIENT_CORRECTIONS_LEDGER.csv`; present in the PostgreSQL copy (checksums) |
| 3 | Production database engine chosen and prepared (Neon PostgreSQL) | VERIFIED (prepared) | derived schema, baseline migration with 16 triggers, schema-sync test |
| 4 | Data migration verified | VERIFIED | Preview and Production databases: 41 of 41 tables match by count and content checksum; refusal on a populated target |
| 5 | Whole test suite on PostgreSQL | VERIFIED | 261 passed, 7 skipped, 0 failed |
| 6 | Production build with the PostgreSQL client | VERIFIED | `npm run vercel-build` |
| 7 | Real-browser run on the production build with PostgreSQL | VERIFIED | 165 of 165 |
| 8 | Security configuration (cookies, roles, caching, secrets) | VERIFIED (live) | `PRODUCTION_SECURITY_VERIFICATION.md` |
| 9 | Vercel project created in team `furia-ninja` | VERIFIED | project `furia-ninja`, Member role granted by the client |
| 10 | Neon databases in the client's team | VERIFIED | production `neon-indigo-blanket` and a separate `furia-preview`, both Free plan |
| 11 | Git repository connected | VERIFIED (branch note) | `SheharyarXD/Discord-Web-App` connected; Vercel's production branch is still `main` (the API would not change it); the release was made from `milestone-4`; the owner decides the branch |
| 12 | Preview deployment verified | VERIFIED | 165 of 165 browser checks over HTTPS |
| 13 | Production deployment and live verification | VERIFIED | https://furia-ninja.vercel.app, 41 of 41 tables identical, 37 of 37 live checks |
| 14 | Final PDF with screenshots of the live application | VERIFIED | `MILESTONE_4_FINAL_DELIVERY_REPORT_EN.pdf` (8 pages) |
| 15 | Source code delivered | VERIFIED | branch `milestone-4` on GitHub |
| 16 | Handover document | VERIFIED | `FINAL_PROJECT_HANDOVER.md` |
| 17 | First administrator account created | PENDING OWNER | `scripts/create-admin.mjs`; the owner chooses e-mail and password |
| 18 | Milestone 4 accepted and closed | BLOCKED | the client must review the live site and accept |
