# Milestone 4: final client change verification (search by effect)

Written for: the project owner and the client, as the record of the last requested change.
Date: 27 October 2026. Status: **LIVE AND VERIFIED** at https://furia-ninja.vercel.app. Milestone 4 is not accepted or closed until the client says so.

## 1. The client's request
"Everything looks good, though I'd like the filters to also include the option to search for specific effects, rather than just statistics."

## 2. What was implemented
On the ninja list, directly under the name search, there is a new field **Buscar por efecto** (placeholder: "Buscar efectos: aturdir, curación, velocidad, inmunidad...").
- Type an effect and press Enter or Aplicar. Suggestions appear while typing (about 150, only effects that exist in the data).
- Each chosen effect becomes a chip with an "x" to remove it. Several effects can be added.
- **Several effects mean "any of them"**, the same rule the other filters use inside one category (rank A or rank B). Different filters are combined with AND.
- Works together with rank, formation, type, category, class, statistic ranges, the older "Efectos que modifican" statistic selector, sorting and paging. Counts are exact and a ninja never appears twice.
- The chosen effects are kept in the address (`fx=aturdir`), so a search can be shared and reloaded. "Quitar filtros" removes them.
- If nothing matches, a Spanish message names the effect and suggests what to try.
- The existing statistic selector stays as it was. It finds ninjas whose effects change a statistic; the new field finds a specific effect.

## 3. How it works
- Every stored effect of every ninja is checked: normal and special skills, talents, talent awakenings, skill awakenings and other abilities.
- **Structured effects** are matched by their stored fields: the status (stun, seal...), the kind (heal, fury, dispel, immunity), the statistic and the sign of the value (increase or reduction), and the target (self, ally, enemy).
- **Source-text-only effects** (not yet structured) are matched by their real wording, in English and in Spanish. Negated wording such as "cannot be stunned" or "immune to stun" is not counted as applying the effect.
- Case and accents do not matter. English and Spanish give the same result: aturdir = stun, sellar = seal, curación = heal.
- A result means: a stored skill, talent option or awakening of that ninja contains the effect. It does not claim that all awakenings or all talent choices are active together. Conditions and "one of these" choices are shown on the ninja page.
- Applying and being immune are different searches: "aturdir" finds ninjas that stun, "inmunidad a aturdir" finds ninjas immune to stun.
- A statistic is never confused with an effect of a similar name: "curación" is the Heal effect, "tasa de curación" is the statistic.
- Words for the side can be added: "aturdir enemigos", "aturdir aliados", "inmunidad a aturdir propia".

## 4. Terms that work (examples, all verified on the real data)
| Type | Examples (Spanish or English) | Ninjas found |
| --- | --- | --- |
| Status applied | aturdir / stun, sellar / seal, silenciar, congelar, aprisionar, petrificar, paralizar, cegar, encantar, caos, envenenar, sangrado, maldecir, semilla de muerte | stun 20, seal 11, silence 11, freeze 20 |
| Immunity | inmunidad a aturdir / immune to stun, inmunidad a sellar, inmunidad a congelar, inmunidad (any) | stun 25, seal 7, any immunity 164 |
| Statistic up or down | aumento de velocidad / speed increase, reducción de ataque / attack reduction, aumento de defensas, tasa de bloqueo, resistencia al control / control resistance | speed up 165, attack down 93, control resistance up 30 |
| Damage reduction | reducción de daño / damage reduction | 25 |
| Heal | curación / heal / curar | 64 |
| Fury | restaurar furia / fury restoration, reducir furia | restore 166, reduce 18 |
| Debuff and buff removal | eliminar debuffs / debuff removal, disipar buffs enemigos / dispel buffs | debuffs 76, buffs 46 |

Any other word or phrase that is not in the vocabulary is searched inside the stored effect text (for example "reflejo" or "tasa del 70").

## 5. Limitations (stated plainly)
- Names the client has not translated yet stay in their English source name in the suggestions (for example "shatter storm/breaking wind"). Typing a Spanish word that is not in the data finds nothing; the message says so.
- Text-only effects are classified from their wording. Unusual wording can be missed by the vocabulary; typing the exact stored word still finds it.
- Negation is recognised close to the word (a few words before it), not across long sentences.
- Administrator edits to effects appear in the search within about 30 seconds.
- The search only reports what is stored. Effects that are still missing from the source data cannot be found (see section 9).

## 6. Automated results
| Check | Result |
| --- | --- |
| Test suite on SQLite | 290 passed, 1 skipped (291 tests, 20 files); 17 new tests in `tests/m6-effect-search.test.ts` |
| Test suite on PostgreSQL | 281 passed, 10 skipped (SQLite-only and real-data checks) |
| Typecheck, lint, production build | clean |
| New tests cover | Spanish and English names, accents and case, synonyms, structured and text-only matching, talents, skills and awakenings, immunity versus applying, conditional and mutually exclusive choices, side words, statistic versus effect names, combined filters, paging without repeats, empty results, clearing, URL terms, suggestions resolving to ninjas, and result sets on the real 177-ninja data compared with independent queries |
| Existing tests | none weakened; one list of read-only API names (`tests/m2-platform.test.ts`) gained the new read-only function |

## 7. Real-browser results
- Local production build: 183 of 183 checks (180 earlier checks plus 3 added for this change, repeated after the layout change).
- Preview deployment `e812303` (own Preview database): **183 of 183**, including result sets compared with the database, chips, keyboard entry, 390 px layout, pagination and clearing. The first attempt stopped at 158 passed because the free database connection dropped; the full rerun passed.
- Live production smoke test: **47 of 47** (37 earlier checks plus 10 for the effect search), read-only. Examples: "aturdir" 20 ninjas (11 with a structured Stun effect plus 9 with stun wording), "inmunidad a aturdir" 25, "curación" 64, "aumento de velocidad" 165; with HP at least 100000 it narrows to 132, with SSR and Center to 9; "aturdir" or "sellar" 30 ninjas over two pages with no repeats; an unknown effect shows the Spanish message; at 390 px there is no horizontal scrolling.

## 8. Release record
| Item | Value |
| --- | --- |
| Production URL | https://furia-ninja.vercel.app |
| Project | `furia-ninja` (Vercel team `furia-ninja`) |
| Commit deployed | `e81230342c2372721d59a1dbec5c1b1a1c7323b7`, branch `milestone-4` (read from the deployment metadata, clean working tree) |
| Production deployment | `dpl_CSnAR1vmy8i9pieVHWcRKVfX8Eg5`. A second identical production deployment of the same commit (`dpl_FzgvrfLLsg7mbwp28zhLQeHFXpmB`) was created by a repeated command; it is harmless |
| Preview verified first | `furia-ninja-m5ty4jvb0-furia-ninja.vercel.app`, Preview database only. Preview logs: no errors. The temporary test access secret was revoked (0 left) |
| Production branch setting | still `main` in the Vercel dashboard (dashboard-only setting). The Ignored Build Step stops any build of `main`, so the old Milestone 1 code cannot replace the live app |
| Database | no schema change, no migration, no reset. Backup taken before the release (41 tables, 9,077 rows, verified). After the release all 41 tables still match that backup by count and content checksum |
| Data now | 177 ninjas, 316 abilities, 4,395 effects, 1 administrator account (created by the client) |
| Logs | production runtime error log: no entries |

## 9. Security and first administrator
- The client completed the first-administrator setup. The one-time `SETUP_TOKEN` was removed from Production and Preview, the local setup link and token files were deleted, and `/setup` answers 404 with or without a token.
- Login, roles and the administration area were re-tested live: anonymous visitors are sent to the login, a regular user gets 404 on `/admin`, the administrator can open the administration, the session cookie is Secure and HttpOnly, Gems stay hidden.
- No password, token or connection string appears in the repository, the reports or the PDF.

## 10. Outstanding source-data items (unchanged, not part of this change)
Equipment, jewelry and gem source material; cards for Might Guy and Sasuke (Taka); Spanish text for Guren, Final Sasuke and the end of Sai's text; Nagato Uzumaki screenshots; the answers listed in `MILESTONE_4_OPEN_ITEMS.md`.
