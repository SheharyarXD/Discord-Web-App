# Milestone 4: final acceptance checklist (deployment round)

VERIFIED = checked in this round. PENDING OWNER = needs an account action in the client's Vercel team. BLOCKED = cannot be completed before that action.

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Development scope of Milestones 1 to 4 | VERIFIED | `MILESTONE_4_ACCEPTANCE_CHECKLIST.md`, 268 tests (267 pass, 1 skipped), 165 browser checks |
| 2 | Client corrections incorporated (awakenings, Shodai Hokage, Kimono Kurenai, aliases, ranks, terminology, English first) | VERIFIED | `MILESTONE_4_CLIENT_CORRECTIONS_LEDGER.csv`; present in the PostgreSQL copy (checksums) |
| 3 | Production database engine chosen and prepared (Neon PostgreSQL) | VERIFIED (prepared) | derived schema, baseline migration with 16 triggers, schema-sync test |
| 4 | Data migration verified | VERIFIED (rehearsal) | 41 of 41 tables match by count and content checksum; refusal on a populated target |
| 5 | Whole test suite on PostgreSQL | VERIFIED | 261 passed, 7 skipped, 0 failed |
| 6 | Production build with the PostgreSQL client | VERIFIED | `npm run vercel-build` |
| 7 | Real-browser run on the production build with PostgreSQL | VERIFIED | 165 of 165 |
| 8 | Security configuration (cookies, roles, caching, secrets) | VERIFIED (code and local) | `PRODUCTION_SECURITY_VERIFICATION.md` |
| 9 | Vercel project created in team `furia-ninja` | PENDING OWNER | the account has the Developer role; creation is refused (403). Role change or project creation needed |
| 10 | Neon database created in the client's team | PENDING OWNER | Marketplace terms must be accepted in the browser; Free plan |
| 11 | Git repository connected, production branch `milestone-4` | PENDING OWNER | Vercel GitHub app must be installed on the repository's GitHub account |
| 12 | Preview deployment verified | BLOCKED | needs items 9 to 11 |
| 13 | Production deployment and live verification | BLOCKED | needs item 12 and the owner's release approval |
| 14 | Final PDF with screenshots of the live application | BLOCKED | needs item 13 |
| 15 | Source code delivered | VERIFIED | branch `milestone-4` on GitHub |
| 16 | Handover document | VERIFIED | `FINAL_PROJECT_HANDOVER.md` |
| 17 | Milestone 4 accepted and closed | BLOCKED | the client must accept after the site is live |
