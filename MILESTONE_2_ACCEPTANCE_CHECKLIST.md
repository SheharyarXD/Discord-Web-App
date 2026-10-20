# Milestone 2: acceptance checklist

VERIFIED = checked by a test or a real run in this round. PARTIAL = delivered, limited by missing source or an open decision. BLOCKED = cannot be delivered without material or a decision.

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Release month and year, newest first | VERIFIED | 167 ninjas; list test; browser list |
| 2 | Rating S, SS, SSS, SR, SSR | VERIFIED | 113 from cards; tests |
| 3 | Formation Support, Assaulter, Vanguard from cards | PARTIAL | Stored as printed. Assaulter = Center is a proposal (B1) |
| 4 | Type, base stats and growth | VERIFIED for 113 ninjas | card tests; 112 cards read twice |
| 5 | Talent and skill names and descriptions | PARTIAL | Text for 115 ninjas (all 60 Assaulters, 16 Supporters); release-only ninjas have none (A1) |
| 6 | Normal and special skills, passives | PARTIAL | Normal/special skill slots stored where the source has them (1 ninja) |
| 7 | Awakenings and talent options | PARTIAL | 69 stages on 51 ninjas; rule stated for 4, unknown for 65 (B4) |
| 8 | Nature dependent effects | VERIFIED as conditions | parser and plan tests; natures per ninja not supplied (A6) |
| 9 | Targets, durations, percentages | VERIFIED | parser tests, 1315 rows |
| 10 | EN and ES descriptions, nothing invented | VERIFIED | verbatim test; 0 Spanish names invented |
| 11 | Conflicting EN/ES kept and flagged | VERIFIED | translation flags and plan tests; 21 ninjas flagged |
| 12 | Never match a card without evidence | VERIFIED | 5 reviewed aliases with evidence; 4 unresolved not loaded |
| 13 | Override of a shared default (Shatter Storm) | VERIFIED | Sai test; default stays 15 |
| 14 | Conditional never shown unconditional | VERIFIED | nature-line test; UI state labels |
| 15 | Exclusive talents not combined | VERIFIED | one talent per ninja; ONE_OF without default |
| 16 | Awakening replace/cancel never stacked | VERIFIED | Hinata, Kusanagi Kyo, First Hokage tests; resolver tests |
| 17 | Chance, magnitude, duration, target separate | VERIFIED | schema, parser, UI |
| 18 | Alternatives preserved | VERIFIED | choice group tests incl. Hiruko three groups |
| 19 | Tank/DPS never guessed | VERIFIED | 0 assigned; tests |
| 20 | Equipment, sets 2/4/6, jewelry, gems structures | PARTIAL | Structures exist and are tested with fixtures; no source data (A5) |
| 21 | Gems menu hidden | VERIFIED | nav test; browser nav list |
| 22 | Idempotent import, no duplicates | VERIFIED | second run +0; 167 + 10 ninjas |
| 23 | Database backup before change | VERIFIED | `prisma/backups/dev-pre-m2b-20261013.db` |
| 24 | Upgrade from M1 database | VERIFIED | migration-upgrade tests |
| 25 | Typecheck, lint, build, tests | VERIFIED | clean; 182 tests |
| 26 | Authentication on all data pages | VERIFIED | 307 to /login without session |
| 27 | Mobile layout | VERIFIED | 390 px, 0 px overflow |
| 28 | All Supporters imported | BLOCKED | A1: only 16 collected; their Spanish is imported |
| 29 | Whole initial dataset imported | BLOCKED | A1, A5; recovered text pending exact comparison (N2) |
| 30 | Milestone closed | BLOCKED | Needs client review, acceptance and payment |
| 31 | Recovered Assaulter and Supporter texts imported | VERIFIED as transcribed | 60 of 60 Assaulters, 16 of 16 Supporter Spanish; lines match the package; not compared with the original messages |
