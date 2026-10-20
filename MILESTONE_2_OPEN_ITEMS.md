# Milestone 2: open items and blockers

## 0. Text that was waiting for files: now imported (third round)

| # | Item | State |
| --- | --- | --- |
| 0.1 | English and Spanish ability text of 58 Assaulters | Imported (60 of 60 Assaulters have text). Pending an exact comparison with the original messages. |
| 0.2 | Spanish text of the first 16 Supporters | Imported, joined to the existing English. |
| 0.3 | Awakening rules for Kusanagi Kyo and First Hokage | Stored (First Hokage after the identity check). |

New items from this import:

| # | Item | State |
| --- | --- | --- |
| N1 | English and Spanish disagree in 21 ninjas | Both kept and flagged. Client decision. |
| N2 | Exact comparison of the recovered text with the original messages | Not possible from the package. Needs the original messages. |
| N3 | Several skills per ninja against one card skill name (Hades, Kushina (Summer), Jigen, Pain Animal Path, 4-Tail Roshi, Hotaru, Urashiki) | Stored as separate blocks, card name not assigned where unclear. |
| N4 | Names printed as `[Talent]`, `[Skill]`, `<Nombre>` | Card names used and flagged; no title invented. |
| N5 | "Shodai Hokage" vs "First Hokage" | Linked by position and manifest name; stored as a reviewed name. Client to confirm. |

## A. Genuinely missing source material (blocks completeness, not correctness)

| # | Item | Effect |
| --- | --- | --- |
| A1 | Supporters channel is only partly supplied (16 cards). The total is unknown. | Most Supporters are name and date only. Do not claim the Supporters or the whole dataset as imported. |
| A3 | Spanish text for Guren and Final Sasuke. | English original shown, marked as untranslated. |
| A4 | Card for Might Guy (supplied file is a copy of the Kakashi & Gai card) and Sasuke (Taka). | No rating, formation, type or stats for them. |
| A5 | Equipment, jewelry and gems source material. | None imported. Gems menu stays hidden. |
| A6 | Natures per ninja. | None assigned. Nature-dependent effects keep their requirement as a condition. |

## B. Decisions needed from the client

| # | Question | Current state |
| --- | --- | --- |
| B1 | Is the card label "Assaulter" the same position as "Center"? | Proposed only. Center's rule (Force as main stat, max 2 per team) is not applied until approved. |
| B2 | Do the five reviewed name matches hold? The Seventh Hokage = 7th Hokage, Ay-Bee Combo = A-B Combo, Might Gai = Might Guy, Nadeshiko Shizuka = Shizuka, 10-Tailed Obito = 10-Tails Obito. | Loaded with evidence, shown as "reviewed, pending confirmation". |
| B3 | Who are Immortal Madara, Neji Hyuga, Illusion God Itachi and Nagato uzumaki? | Staged only, no ninja created. Neji Hyuga might be Hyūga Neji. |
| B4 | Do awakening levels add up, replace or cancel each other? | Only Hinata (Soccer Star) level 2 (stated in the source) is a replacement. The other 29 are "unknown" and are never summed. |
| B5 | Which English or Spanish wording is right where they disagree (4 flagged places plus 2 line-count differences)? | Both stored, flagged. |
| B6 | Is the text headed "7th Hokage & Sasuke" the ability text of 7th Hokage & Shadow? | Attached, marked for review. |
| B7 | Are `Power` and `Chakra` the same attribute? And `s.attack`/strategy attack, `CC resistance`/control resistance, the other look-alike terms in the lexicon? | Kept as separate entries with a note. |
| B8 | Which skill of Pain Animal Path is "Psychic Hellhound"? | Not matched. |
| B9 | Tank or DPS per ninja. | Unassigned, never inferred. |

## C. Data quality still open

- 59 effect rows flagged NEEDS_REVIEW (side not stated, "and/or", bracketed percentage may cover earlier stats).
- 212 effect rows kept as source text only (wording the parser does not cover in full).
- 16 ninjas are PARTIALLY_CONFIRMED (reviewed alias, other-language card, or missing card).
- 21 statuses named only in ability texts have no definition in the status guide; they carry a note and no description.

## D. Housekeeping for the owner

- The project owner's real email address still exists in git history from an earlier round. History was not rewritten (requires owner approval).
- The `C:` drive is almost full (about 6 GB free, was 128 MB during this round). `.next` was rebuilt; `docs/m2-handoff` is 30 MB untracked and should not be committed with the screenshots of cards if the repository is public.
- Nothing from this round is committed. Review the working tree, then decide on commit and push.
