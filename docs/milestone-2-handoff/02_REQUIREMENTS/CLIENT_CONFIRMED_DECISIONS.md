# Client-confirmed decisions and carefully separated inferences

Source: user's pasted client conversation (6–7 October 2026) and original screenshots bundled in this package.

## Confirmed requirements

1. This is a private, responsive Spanish-default website for client + approved friends. Only the client's admin account can change game content. Existing M1 authentication is to be retained.
2. Initial agreed project includes ninjas, equipment and jewelry/accessories, their abilities/stats, relationships and set tiers; complete entry scheduled for M4, beginning in M2. The client does not need a separate *visible* Gems section at present, but its M1 data structures must be kept for future activation.
3. The `release-order` channel identifies ninja release *month and year*, and list is displayed **newest first**. Same character can have variants.
4. Ratings include S, SS, SSS, SR, SSR, with extensible categories.
5. Client wants a manually assigned `Tank` OR `DPS` classification per ninja, never both; unknown until the client classifies is acceptable for ingestion.
6. Support, Center, Vanguard describe formation positions (rear, middle, front). They are NOT Tank/DPS classes.
7. All Support units primarily use Chakra; Center/Vanguard primarily use Force. This does not negate other base values displayed on ninja cards.
8. Future teams contain four ninjas; max 3 Support, 2 Center, 1 Vanguard. Team selection feature NOT in M2.
9. Game card's acquisition `Source` value (e.g., `Other`) is unimportant: don't make it a required/displayed field. Technical **data provenance** remains required for verification.
10. Ninja card supports game Type (e.g., Genjutsu), displayed base stats with growth rate, formation position, rating and skill/talent label.
11. Some effects require a certain nature or other condition; explicitly label the requirement. Do not show them as unconditional.
12. Some ninjas have two alternative talents but can select only one. Don't imply both active. Older ninjas may have no awakening and no elemental affinity.
13. Special-effect tooltip on hover, keyboard focus, mobile tap with clear description, reusable across records (final UI principally M3).
14. Shatter Storm/Breaking Wind default grants Attack and Defense +15%; `(20%)` in an individual ninja's ability text means **effective stat increase +20%** on both, overriding that specific usage. This is **not a 20% chance of activation**. No parenthesized override -> default +15%. Updating one ninja's value must not modify other usages.
15. Statuses include buffs/debuffs, cleansable/uncleansable, damage over time (DoT), crowd control (CC). Some have exceptions and particular definitions; the guide images are reference truth.
16. Only provided screenshots/text/manual sources may be used. No Discord bot/API/scraper/sync/import integration.
17. Spanish is the initial/default UI language, and game translation must preserve source meaning and numbers.

## Known unresolved items — do NOT silently make assumptions

- The Discord channels are named `supporters`, `assaulters`, `vanguards`, while client called in-game formation `Support`, `Center`, `Vanguard`. **Assaulter = Center is not proven.** Keep source labels and game position separated until clear.
- Gear set 4-piece vs 6-piece overlapping bonuses: do the tiers stack or replace? Unknown. Preserve the raw tier definitions.
- Jewelry screenshot may represent four subgroups of a single set vs several separate sets, with one shared 8-piece effect; not fully established.
- Current screenshots do not show the full contents of the game's Discord; all ninja abilities, all gear sets, all accessories and exact item counts remain unverified.
- Some screenshots show only portion of effect descriptions; do not infer unseen continuation.
- Exact Spanish translations for uncertain game-specific names/terms may need client review.
- Full source game copyright/Discord permissions were represented by the client as no problem; do not implement scraping or assume provider technical access.
