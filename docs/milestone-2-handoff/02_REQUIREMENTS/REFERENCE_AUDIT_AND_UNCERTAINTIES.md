# Source review: screenshot-grounded examples and ambiguity handling

All source images are in `03_REFERENCE_IMAGES`. This document is NOT a substitute for inspecting them individually.

## Release-order series

- Screenshots show a `release-order` Discord message, starting Cursed Seal Sasuke in **November 2012**, continuing through **Sasuke (Taka), September 2026**. Multiple captures overlap and leave obscured lines/possible gaps. Don't announce the full roster has been verified until every month/name is checked against all provided originals.
- The screenshot list is chronological in ascending time; site needs newest first. Preserve character variants exactly as distinct rows. Release data alone does not confirm role, rating or abilities.
- The separately supplied `image(8).png` overlaps the more recent release screenshots.

## Madara reference card

`image(10).png`: Uchiha Madara (Moon's Eye), Discord thread `supporters`; image appears to show SSR, Type Genjutsu, Formation Support, Skill Truth-Seeking Pierce, Talent Infinite Tsukuyomi, Force 22500 with Growth Rate 22.5, Agility 44500 with 44.5, Chakra 44000 with 44, HP 440000 with 44. Also acquisition Source Other (client says ignore as game attribute). Cross-check all characters and numbers visually. The release list shows March 2026. The card image is NOT proof of every ability/effect for Madara; do not make them up.

`image(20261012-010500).png`: formation screenshot with Support/Center/Vanguard positions. This illustrates placement and maximum group counts discussed by client, but it is not a request to build team-composition logic now.

`image(9).png`: existing Milestone 1 Spanish admin Roles screen, evidence of app shell and admin scaffold. **Use repository code as authority for whether this feature actually works**, not the screenshot alone. Do not rewrite it.

## Effect semantics

`image(20261012-010554).png` and `...010611.png`: duplicate/alternate crop of `Makes all assaulters enter (20%) shatter storm state for 2 rounds.` Client explicitly clarified that 20% overrides the DEFAULT magnitude of affected Attack and defenses bonuses normally 15%, not a proc chance.

`image(20261012-010624).png`: definitions for piercing/penetration, DoT and defense shields. Explanations should be reference/glossary data—not used to fabricate a damage calculation engine.

`image(20261012-010628).png`: cleansable DoTs, uncleanseable DoT and CC examples. Treat categories as orthogonal from harmful/helpful.

`image(20261012-010631).png`: cleansable/uncleansable debuffs and effect meanings.

`image(20261012-010647).png`: uncleansable buffs and descriptions. Includes Shatter Storm / Breaking Wind default **Attack and defenses +15% unless otherwise stated**.

`image(20261012-010652).png`: cleansable buffs.

## Earlier project audit (user-provided textual synopsis, NOT source images in this package)

Earlier Discord examples described Shikamaru Nara (Jan 2026), one equipment set with 2/4/6 tier effects, and likely jewelry/accessories with distinct paired 2-piece and 8-piece effects. Those earlier gear/jewelry images themselves are **not uploaded in the current batch**, so these earlier values should be treated as conversation references and NOT blindly imported. If they are needed for actual data entry, ask for the original screenshots or the previously validated source records. The schema should support them now regardless.

## Guardrails

- Source date/time shown in Discord screenshot is NOT equal to release date; release month/year comes from release-order list.
- A client's examples clarify semantics, but don't prove the numeric fields of every character.
- Every ingested row must carry confidence/review state and source filename.
- Preserve source wording; any translation or normalization should be additional, not destructive.
- Anything not visible or confirmed is NULL / pending, never invented.
