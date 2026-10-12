import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activeTiers, unlockedTiers } from "../src/domain/sets";
import { UnknownReferenceError, ValidationError } from "../src/game/db";
import { getEquipmentSet, getJewelrySet, itemVocabulary, listSets, upsertEquipmentSet, upsertJewelrySet } from "../src/game/items";
import { upsertStatusEffect } from "../src/game/status-effects";
import { vocabulary } from "../src/game/ninjas";
import { dbRejects, TRIGGER_REJECTION, seedTestVocabulary, testDb } from "./helpers";

const db = testDb();

beforeAll(async () => {
  await seedTestVocabulary(db);
  await itemVocabulary.equipmentSlot(db, { key: "t12-weapon", name: "T12 Weapon" });
  await itemVocabulary.equipmentSlot(db, { key: "t12-armor", name: "T12 Armor" });
  await itemVocabulary.jewelryType(db, { key: "t12-ring", name: "T12 Ring" });
  await vocabulary.nature(db, { key: "t12-nature", name: "T12 Nature" });
  await upsertStatusEffect(db, {
    key: "t12-status", name: "T12 Status", polarity: "BUFF", cleansability: "UNCLEANSABLE",
    modifiers: [{ statLabel: "defenses", statisticKey: "defenses", magnitude: 20 }],
  });
});
afterAll(() => db.$disconnect());

// Placeholder numbers that only exercise the structure. Not game data.
const equipmentSet = () => ({
  name: "T12 Test Set",
  bonuses: [
    { requiredPieces: 2, effects: [{ statisticKey: "attack", value: 5, valueType: "PERCENT" as const }] },
    {
      requiredPieces: 4,
      effects: [
        { statisticKey: "attack", value: 8, valueType: "PERCENT" as const },
        { statisticKey: "hp", value: 1500, valueType: "FLAT" as const, conditions: [{ typeKey: "nature", valueKey: "t12-nature" }] },
      ],
    },
    { requiredPieces: 6, effects: [{ statusKey: "t12-status", magnitudeOverride: 25, durationTurns: 2, chancePercent: 50, triggerText: "when hit" }] },
  ],
  items: [
    { name: "T12 Blade", slotKey: "t12-weapon", effects: [{ statisticKey: "force", value: "1200.5", valueType: "FLAT" as const }, { statisticKey: "attack", value: 3, valueType: "PERCENT" as const }] },
    { name: "T12 Vest", slotKey: "t12-armor", effects: [{ statisticKey: "hp", value: 9000, valueType: "FLAT" as const }] },
  ],
});

describe("12. equipment sets", () => {
  it("stores 2 / 4 / 6 tiers with structured, conditional and triggered effects", async () => {
    const { slug } = await upsertEquipmentSet(db, equipmentSet());
    const set = (await getEquipmentSet(db, slug))!;
    expect(set.tiers.map((t) => t.requiredPieces)).toEqual([2, 4, 6]);
    expect(set.tiers[1]!.effects.map((e) => [e.statisticName, e.value, e.valueType])).toEqual([["attack", 8, "PERCENT"], ["HP", 1500, "FLAT"]]);
    expect(set.tiers[1]!.effects[1]!.conditions.map((c) => c.valueKey)).toEqual(["t12-nature"]);
    const six = set.tiers[2]!.effects[0]!;
    expect(six.status!.resolved.modifiers.map((m) => [m.statLabel, m.effectiveMagnitude, m.origin])).toEqual([["defenses", 25, "OVERRIDE"]]);
    expect([six.durationTurns, six.chancePercent, six.triggerText]).toEqual([2, 50, "when hit"]);
  });

  it("keeps a piece's own stats apart from the set tiers, with flat and percent units intact", async () => {
    const set = (await getEquipmentSet(db, "t12-test-set"))!;
    const blade = set.items.find((i) => i.name === "T12 Blade")!;
    expect(blade.categoryName).toBe("T12 Weapon");
    expect(blade.effects.map((e) => [e.statisticName, e.value, e.valueType])).toEqual([["Force", 1200.5, "FLAT"], ["attack", 3, "PERCENT"]]);
    const pieceEffects = await db.effect.count({ where: { equipment: { set: { slug: "t12-test-set" } } } });
    const tierEffects = await db.effect.count({ where: { equipmentSetBonus: { set: { slug: "t12-test-set" } } } });
    expect([pieceEffects, tierEffects]).toEqual([3, 4]);
    expect(await db.effect.count({ where: { equipmentId: { not: null }, equipmentSetBonusId: { not: null } } })).toBe(0);
    // Filtering by stat keeps units apart: a FLAT hp value is never compared with a PERCENT one.
    const flatHp = await db.effect.findMany({ where: { statistic: { key: "hp" }, valueType: "FLAT", value: { gte: 5000 }, equipment: { set: { slug: "t12-test-set" } } } });
    expect(flatHp).toHaveLength(1);
  });

  it("supports arbitrary thresholds and is idempotent", async () => {
    const before = await db.equipment.count();
    const again = await upsertEquipmentSet(db, { ...equipmentSet(), bonuses: [...equipmentSet().bonuses, { requiredPieces: 3, effects: [{ description: "T12 odd tier" }] }] });
    expect(again.created).toBe(false);
    expect((await getEquipmentSet(db, again.slug))!.tiers.map((t) => t.requiredPieces)).toEqual([2, 3, 4, 6]);
    expect(await db.equipment.count()).toBe(before);
    await upsertEquipmentSet(db, equipmentSet());
    expect((await getEquipmentSet(db, again.slug))!.tiers.map((t) => t.requiredPieces)).toEqual([2, 4, 6]);
    expect(await dbRejects(() => db.equipmentSetBonus.create({ data: { setId: again.id, requiredPieces: 0 } }))).toBe(TRIGGER_REJECTION);
  });

  it("never invents cumulative arithmetic: with unknown stacking no total exists", async () => {
    const set = (await getEquipmentSet(db, "t12-test-set"))!;
    expect(set.tierStacking).toBe("UNKNOWN");
    expect(unlockedTiers(set.tiers, 5).map((t) => t.requiredPieces)).toEqual([2, 4]);
    const active = activeTiers(set.tiers, 6, set.tierStacking);
    expect(active.status).toBe("STACKING_UNKNOWN");
    expect("tiers" in active).toBe(false);
    // Each tier keeps exactly the numbers it was given — the 4-piece 8% is not 5% + something.
    expect(set.tiers.map((t) => t.effects[0]!.value)).toEqual([5, 8, null]);
    // Once the client confirms a rule, it selects tiers; it still does not add values.
    expect(activeTiers(set.tiers, 6, "CUMULATIVE")).toMatchObject({ status: "RESOLVED", tiers: [{ requiredPieces: 2 }, { requiredPieces: 4 }, { requiredPieces: 6 }] });
    expect(activeTiers(set.tiers, 6, "REPLACES")).toMatchObject({ status: "RESOLVED", tiers: [{ requiredPieces: 6 }] });
    expect(activeTiers(set.tiers, 1, "CUMULATIVE")).toEqual({ status: "RESOLVED", tiers: [] });
  });

  it("rolls back the whole set when a tier is invalid", async () => {
    await expect(
      upsertEquipmentSet(db, { name: "T12 Broken Set", bonuses: [{ requiredPieces: 2, effects: [{ statisticKey: "nope", value: 1 }] }], items: [{ name: "T12 Orphan" }] }),
    ).rejects.toBeInstanceOf(UnknownReferenceError);
    expect(await db.equipmentSet.count({ where: { slug: "t12-broken-set" } })).toBe(0);
    expect(await db.equipment.count({ where: { slug: "t12-orphan" } })).toBe(0);
  });
});

describe("12. jewelry sets", () => {
  it("supports per-group 2-piece effects and an 8-piece full-set tier, without 2/4/6 assumptions", async () => {
    const { slug } = await upsertJewelrySet(db, {
      name: "T12 Jewelry",
      groups: [{ key: "pair-a", name: "Pair A" }, { key: "pair-b", name: "Pair B" }],
      items: [
        { name: "T12 Ring 1", typeKey: "t12-ring", groupKey: "pair-a", effects: [{ statisticKey: "attack", value: 2, valueType: "PERCENT" }] },
        { name: "T12 Ring 2", typeKey: "t12-ring", groupKey: "pair-a" },
        { name: "T12 Ring 3", typeKey: "t12-ring", groupKey: "pair-b" },
      ],
      bonuses: [
        { groupKey: "pair-a", requiredPieces: 2, effects: [{ statisticKey: "speed", value: 4, valueType: "PERCENT" }] },
        { groupKey: "pair-b", requiredPieces: 2, effects: [{ statisticKey: "hp", value: 700, valueType: "FLAT" }] },
        { requiredPieces: 8, description: "T12 full set", effects: [{ statusKey: "t12-status" }] },
        { requirementKind: "SPECIFIC_ITEMS", requiredItemNames: ["T12 Ring 1", "T12 Ring 3"], effects: [{ description: "T12 named pair" }] },
      ],
    });
    const set = (await getJewelrySet(db, slug))!;
    expect(set.structureStatus).toBe("UNCONFIRMED");
    expect(set.bonuses.map((b) => [b.requirementKind, b.groupKey, b.requiredPieces])).toEqual([
      ["PIECE_COUNT", "pair-a", 2],
      ["PIECE_COUNT", "pair-b", 2],
      ["PIECE_COUNT", null, 8],
      ["SPECIFIC_ITEMS", null, null],
    ]);
    expect(set.bonuses[3]!.requiredItemNames.sort()).toEqual(["T12 Ring 1", "T12 Ring 3"]);
    expect(set.bonuses[2]!.effects[0]!.status!.resolved.modifiers.map((m) => [m.effectiveMagnitude, m.origin])).toEqual([[20, "DEFAULT"]]);
    expect(set.items.map((i) => [i.name, i.groupKey])).toEqual([["T12 Ring 1", "pair-a"], ["T12 Ring 2", "pair-a"], ["T12 Ring 3", "pair-b"]]);
    expect(set.items[0]!.effects).toHaveLength(1);
  });

  it("the same description used by several groups stays ONE bonus per row given — nothing is multiplied", async () => {
    const before = (await getJewelrySet(db, "t12-jewelry"))!.bonuses.length;
    await upsertJewelrySet(db, {
      name: "T12 Jewelry",
      groups: [{ key: "pair-a", name: "Pair A" }, { key: "pair-b", name: "Pair B" }],
      items: [{ name: "T12 Ring 1", groupKey: "pair-a" }, { name: "T12 Ring 3", groupKey: "pair-b" }],
      bonuses: [
        { groupKey: "pair-a", requiredPieces: 2, effects: [{ statisticKey: "speed", value: 4, valueType: "PERCENT" }] },
        { requiredPieces: 8, description: "T12 full set", effects: [{ statusKey: "t12-status" }] },
      ],
    });
    const set = (await getJewelrySet(db, "t12-jewelry"))!;
    expect(before).toBe(4);
    expect(set.bonuses.map((b) => b.requiredPieces)).toEqual([2, 8]);
    expect(await db.jewelry.count({ where: { set: { slug: "t12-jewelry" } } })).toBe(3); // pieces are not pruned
  });

  it("validates requirements", async () => {
    await expect(upsertJewelrySet(db, { name: "T12 bad", bonuses: [{ requirementKind: "PIECE_COUNT" }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(upsertJewelrySet(db, { name: "T12 bad", bonuses: [{ groupKey: "missing", requiredPieces: 2 }] })).rejects.toBeInstanceOf(UnknownReferenceError);
    expect(await db.jewelrySet.count({ where: { slug: "t12-bad" } })).toBe(0);
    const set = await db.jewelrySet.findUniqueOrThrow({ where: { slug: "t12-jewelry" } });
    expect(await dbRejects(() => db.jewelrySetBonus.create({ data: { setId: set.id, requirementKind: "PIECE_COUNT" } }))).toBe(TRIGGER_REJECTION);
  });

  it("lists both kinds of set with their stored thresholds", async () => {
    const sets = (await listSets(db)).filter((s) => s.name.startsWith("T12 "));
    expect(sets.map((s) => [s.kind, s.name, s.pieceCount, s.thresholds])).toEqual([
      ["equipment", "T12 Test Set", 2, [2, 4, 6]],
      ["jewelry", "T12 Jewelry", 3, [2, 8]],
    ]);
  });
});
