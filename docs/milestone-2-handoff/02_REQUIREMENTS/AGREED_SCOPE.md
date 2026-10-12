# Contract scope summary — four milestones

## Whole product

Private responsive Spanish-first web app for browsing/managing ninjas, equipment, jewelry/accessories, stats, abilities/effects and set bonuses, with approved viewers and client-only administration. Original written scope included a future gem data structure; client subsequently asked to hide Gems as a visible category for now. Discord is a source/reference only; no bot, scraping, automated import/synchronization or Discord integration. Includes source code at end.

## Milestone 1 — ALREADY REPORTED COMPLETE

Architecture, database foundations/relationships, Spanish-first UI shell, responsive layout foundation, login/admin permission structure, roles and abilities/talents/effects/conditions/item/gem schemas, primary navigation, conditional/talent UI primitives. Inspect actual repo and preserve working implementations.

## Milestone 2 — CURRENT ONLY

- Implement core persistent database functionality and relations for ninjas, roles, skills/passives/awakenings/talent alternatives, equipment, jewelry, set bonuses, effects/conditions and existing gem/stat structures.
- Actual domain/repository services supporting correct data creation/update/read and linking.
- Model nature requirements and special conditional effects; handle per-ninja effect usages and overrides; distinct buff/debuff, cleansability, DoT, CC.
- Ninja metadata (rating, formation, Tank/DPS client-label, release month/year, type, base stats + growth rates) based on client clarifications.
- Equipment 2/4/6 and jewelry varying 2/8 unlock tiers, while supporting arbitrary thresholds.
- Begin and continue manual reference-data population from supplied material; complete dataset is M4.
- Prepare searchable/queryable data structures for M3 without implementing final advanced search UI.

## Milestone 3 — LATER

Search by names/categories/stats; simultaneous multiple conditions, min/max filters and highest/lowest sorting; final detailed pages; client-only admin interface for full CRUD and user management; Spanish integration; accessible tooltip UI for special effects.

## Milestone 4 — LATER

Finish full agreed initial dataset and translations; final responsive optimization; end-to-end testing; verified private access and security; deployment and production validation; source code delivery. New game releases after agreed dataset are future update work.

## Scope exclusions

No Discord integration/API/bot/scraping/sync; no team planner, game simulator, damage engine or optimizer. No promise of a complete dataset from partial screenshots. M2 implementation report must plainly separate implemented data vs data still awaiting additional sources.
