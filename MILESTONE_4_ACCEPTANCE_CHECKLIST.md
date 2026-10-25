# Milestone 4: acceptance checklist

VERIFIED = checked by an automated test and/or the real-browser run in this round. PARTIAL = built and tested, limited by missing source data or an open decision. PENDING OWNER = needs the owner's approval or the hosting details. BLOCKED = cannot be delivered without material.

| # | Milestone 4 deliverable (signed scope) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Complete the initial population of ninja data from the reference | VERIFIED for what was supplied | 177 ninjas, 79 Supporter cards, 175 full cards, English text for all 177, 79 of 79 Supporter cards re-audited with no mismatch |
| 2 | Complete the initial population of equipment, jewelry and gem data | BLOCKED | no source material supplied; 0 records; nothing invented |
| 3 | Review populated data for consistency | VERIFIED | `m4-consistency` tests, integrity and foreign-key checks, import repeat +0, one counting method |
| 4 | Spanish interface complete | VERIFIED | `m4-spanish-ui` tests; no English left; the new awakening explanation is in Spanish |
| 5 | Spanish content complete | PARTIAL | 174 of 177 ninjas complete; Sai partial; Guren and Final Sasuke have no Spanish yet |
| 6 | Responsive: desktop | VERIFIED | 1280 px, 13 pages |
| 7 | Responsive: tablet | VERIFIED | 768 and 1024 px, 13 pages each; a 184 px overflow at 1024 px was found and fixed |
| 8 | Responsive: mobile | VERIFIED | 360 and 390 px, no sideways scrolling |
| 9 | Test navigation, database, search, filters, sorting, detail pages, admin | VERIFIED | 264 tests, 165 browser checks |
| 10 | Access levels for the client and approved users | VERIFIED | administrator, regular user, anonymous visitor tested; 404 on admin for regular users, Forbidden on every write; gems 404 |
| 11 | Fix issues found in final testing | VERIFIED | navigation overflow fixed; counts and alias status corrected |
| 12 | Configure the application for deployment | VERIFIED (prepared) | `DEPLOYMENT.md`, environment variables, `GET /api/health` |
| 13 | Deploy the application | PENDING OWNER | needs approval and the hosting details |
| 14 | Final production verification | PENDING OWNER | the list is in `DEPLOYMENT.md`; runs after the deployment |
| 15 | Deliver the source code | VERIFIED | repository branch `milestone-4`; private material git-ignored |
| | **Client corrections** | | |
| 16 | Center = Assaulter | VERIFIED | |
| 17 | Shodai Hokage = First Hokage | VERIFIED | alias VERIFIED, one ninja |
| 18 | Five confirmed aliases | VERIFIED | |
| 19 | 15 ratings | VERIFIED | |
| 20 | Power, Chakra, Force, S. Attack kept apart | VERIFIED | |
| 21 | English authoritative | VERIFIED | 26 ninjas carry a flagged difference; Spanish never changes a mechanic |
| 22 | Each new awakening replaces the previous one | VERIFIED | 17 stages replace, 1 cancels, 3 upgrade the base; 94 first stages and 5 unnumbered stages stay UNKNOWN; tests for the generic rule and each special case |
| 23 | Natsu Dragneel, Cursed Tayuya, Kusanagi Kyo, First Hokage, Hinata, Sage Jugo rules | VERIFIED | |
| 24 | Kimono Kurenai complete Spanish | VERIFIED | 10 of 10 lines, alternatives exclusive |
| 25 | Sai (Errant Knight) Spanish | PENDING SOURCE | the Spanish screenshot is not in the workspace |
| 26 | Illusion God Itachi, Nagato Uzumaki, Neji Hyuga, Immortal Madara | PENDING CLIENT | no evidence to apply; nothing merged |
| 27 | Equipment, jewelry and gems not invented; Gems hidden | VERIFIED | 0 records; `/gems` 404 |
| | **Closing** | | |
| 28 | Milestone 4 accepted and closed | BLOCKED | needs the client's explicit acceptance after the deployment |
