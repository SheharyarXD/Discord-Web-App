# Milestone 3: open items and blockers (after the Supporter sync)

## A. Source material still missing

| # | Item | Effect |
| --- | --- | --- |
| A1 | Spanish line for Kimono Kurenai's skill (the fury restoration line). The supplied Spanish ends after alternative 3. Also the end of Sai (Errant Knight)'s Spanish, which is cut in its source (`[TRUNCATED IN SOURCE]`) | Spanish shown as far as it goes, flagged `ES_TEXT_CUT`. Nothing invented. Send the exact lines, or authorise an English fallback |
| A2 | Cards for Might Guy (the supplied file is a copy of another ninja's card) and Sasuke (Taka) | No rating, type or statistics for these two |
| A3 | Spanish text for Guren and Final Sasuke | English shown, marked untranslated |
| A4 | Spanish copy of the two status definitions in Natsu Dragneel's text (Armor Break, Crit Resistance Reduction). Optional text: his ability text is fully translated | English shown |
| A5 | Equipment, jewelry and gem source material | None exists in the application. Search, filters, sorting, detail pages and admin forms are ready and tested with test data |
| A6 | Natures per ninja | None assigned; nature requirements stay conditions on effects |
| A7 | The original Discord messages to compare the recovered texts exactly | The texts are transcriptions |

## B. Questions for the client

| # | Question |
| --- | --- |
| B1 | Are the six judgement matches right? Uchiha Sakura = Sakura Uchiha, 6-tail Utakata = Utakata, Terumi Mei (Summer) = Terumi Mei, Neji Hyūga = Hyūga Neji, Orochimaru (New Era) = Orochimaru from Boruto, Susanoo Itachi & Sasuke = Susano Itachi&Sasuke |
| B2 | Who are Immortal Madara, Neji Hyuga (awakening channel), Illusion God Itachi and Nagato Uzumaki? Still no evidence in the files. The new Neji Hyūga card was not merged with the old «Neji Hyuga» entry |
| B3 | Is «Shodai Hokage» First Hokage? (linked by position, kept as a reviewed name) |
| B4 | Which text is right where English and Spanish differ? 27 ninjas have such lines; English is kept as the original |
| B5 | Do other awakenings add up, replace or cancel? 113 stages are unknown and are never summed |
| B6 | Three cards print a five digit HP where similar cards print six: Mitarashi Anko 45000, Uchiha Hikari 46000, Ōtsutsuki Isshiki 38000. Are these the real values or a missing digit? Stored as printed, flagged |
| B7 | Shikamaru Nara: the card says «Explosive Shadow Stab», the text says «Shadow Fang». Which name is correct? |
| B8 | Do the Support and Vanguard collections match the Support and Vanguard positions for ninjas without a card? Only Assaulter = Center was confirmed |
| B9 | Tank or DPS per ninja: none assigned; the admin can set it |

## C. Data quality still open

- 105 effect rows need review (side not stated, "and/or", a bracketed percentage that may cover earlier statistics).
- 414 effect rows are kept as source text only (conditions on gender or nature, hp thresholds, statuses not in the glossary yet). Kimono Kurenai's three «A, OR B» lines are among them.
- 16 of the new cards are Chinese: their labels were transcribed from small images and are not translated; rating, type and formation are matched by position.
- Several skill names on cards are cut by the card layout; the full name comes from the text and the cut label is kept beside it.
- Skill labels: ninjas with several skills (Christmas Mito, Hyakki Sasori and earlier ones) are not matched to the card's single skill name.

## D. Technical notes for Milestone 4

- The ability editor reads `data/reference/lexicon.json` at run time: ship it with the deployment.
- Deployment is not done and was not requested.

## E. Housekeeping for the owner

- The owner's real email address still exists in older Git history. History was not rewritten.
- Client card screenshots and source packages (`docs/m2-handoff/`, `docs/m3-handoff/`), database backups and the prompt files are ignored by Git and are not published.
- Milestone 3 is not closed until the client has reviewed and accepted it.
