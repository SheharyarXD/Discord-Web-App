import type { PrismaClient } from "@prisma/client";
import { assertCan, type Action, type Actor } from "../server/auth/permissions";
import { getEquipmentSet, getJewelrySet, itemVocabulary, listSets, upsertEquipmentSet, upsertJewelrySet } from "./items";
import { getNinjaDetail, listNinjas, upsertNinja, vocabulary } from "./ninjas";
import { recordEvidence, registerAsset } from "./provenance";
import { ensureStatusCategory, findStatusEffectsByTerm, getStatusEffect, listStatusEffects, upsertStatusEffect } from "./status-effects";
import { setTalentSelection } from "./talents";

type Tail<F> = F extends (db: never, ...rest: infer R) => unknown ? R : never;
type Bound<F extends (...args: never[]) => unknown> = (...args: Tail<F>) => ReturnType<F>;

/**
 * The game-data API as seen by ONE actor. Every call re-checks that actor's permission before
 * touching the database, so a caller cannot reach a mutation by skipping a UI check:
 *
 *   reads      → content:read   (any approved, active user)
 *   mutations  → content:write  (administrator only)
 *
 * Milestone 3's admin screens and server actions are expected to go through this object
 * (see src/server/game-api.ts for the request-scoped instance).
 */
export function gameApi(db: PrismaClient, actor: Actor) {
  const guarded =
    <F extends (db: PrismaClient, ...rest: never[]) => unknown>(action: Action, fn: F): Bound<F> =>
    (...args) => {
      assertCan(actor, action);
      return (fn as unknown as (db: PrismaClient, ...rest: unknown[]) => ReturnType<F>)(db, ...args);
    };
  const read = <F extends (db: PrismaClient, ...rest: never[]) => unknown>(fn: F) => guarded("content:read", fn);
  const write = <F extends (db: PrismaClient, ...rest: never[]) => unknown>(fn: F) => guarded("content:write", fn);

  return {
    // reads
    listNinjas: read(listNinjas),
    /** The viewer is always the actor: nobody can read another user's talent picks. */
    getNinja: (slug: string) => {
      assertCan(actor, "content:read");
      return getNinjaDetail(db, slug, { viewerId: actor.id, includeUnpublished: actor.role === "ADMIN" });
    },
    listStatusEffects: read(listStatusEffects),
    getStatusEffect: read(getStatusEffect),
    findStatusEffectsByTerm: read(findStatusEffectsByTerm),
    listSets: read(listSets),
    getEquipmentSet: read(getEquipmentSet),
    getJewelrySet: read(getJewelrySet),

    /** A user's own build choice — allowed for any approved user, only ever for themselves. */
    selectTalent: (groupId: string, optionIds: string[]) => {
      assertCan(actor, "content:read");
      return setTalentSelection(db, actor.id, groupId, optionIds);
    },

    // mutations (administrator only)
    upsertNinja: write(upsertNinja),
    upsertStatusEffect: write(upsertStatusEffect),
    upsertEquipmentSet: write(upsertEquipmentSet),
    upsertJewelrySet: write(upsertJewelrySet),
    ensureStatusCategory: write(ensureStatusCategory),
    ensureRating: write(vocabulary.rating),
    ensureNinjaType: write(vocabulary.ninjaType),
    ensureStatistic: write(vocabulary.statistic),
    ensureFormation: write(vocabulary.formation),
    ensureRole: write(vocabulary.role),
    ensureNature: write(vocabulary.nature),
    ensureEquipmentSlot: write(itemVocabulary.equipmentSlot),
    ensureJewelryType: write(itemVocabulary.jewelryType),
    registerAsset: write(registerAsset),
    recordEvidence: write(recordEvidence),
  };
}
export type GameApi = ReturnType<typeof gameApi>;
