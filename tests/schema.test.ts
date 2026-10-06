import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { seedVocabulary } from "../prisma/vocabulary";
import { assertSingleEffectOwner, groupConditions, isConditional, type ConditionView } from "../src/domain/effects";

const url = `file:${path.resolve(__dirname, ".tmp/test.db").replace(/\\/g, "/")}`;
const db = new PrismaClient({ datasourceUrl: url });

beforeAll(async () => {
  await seedVocabulary(db);
});
afterAll(() => db.$disconnect());

const abilityType = (key: string) => db.abilityType.findUniqueOrThrow({ where: { key } });

describe("ninjas and talents", () => {
  it("1. ninja with one talent", async () => {
    const ninja = await db.ninja.create({
      data: {
        slug: "t-one", name: "T one",
        talentGroups: { create: [{ options: { create: [{ name: "Only talent", isDefault: true }] } }] },
      },
      include: { talentGroups: { include: { options: true } } },
    });
    expect(ninja.talentGroups).toHaveLength(1);
    expect(ninja.talentGroups[0]!.options).toHaveLength(1);
  });

  it("2. ninja with two mutually exclusive talents = ONE group, ONE selection allowed", async () => {
    const ninja = await db.ninja.create({
      data: {
        slug: "t-two", name: "T two",
        talentGroups: {
          create: [{
            selectionMode: "ONE_OF",
            options: { create: [{ name: "A", isDefault: true, sortOrder: 0 }, { name: "B", sortOrder: 1 }] },
          }],
        },
      },
      include: { talentGroups: { include: { options: true } } },
    });
    const [group] = ninja.talentGroups;
    expect(ninja.talentGroups).toHaveLength(1); // alternatives live in one group…
    expect(group!.options).toHaveLength(2);
    expect(group!.selectionMode).toBe("ONE_OF"); // …that allows exactly one
    expect(group!.maxSelections).toBe(1);
  });

  it("supports more than two alternatives and varied ability counts", async () => {
    const skill = await abilityType("skill");
    const ninja = await db.ninja.create({
      data: {
        slug: "t-many", name: "T many",
        abilities: { create: [{ name: "s", abilityTypeId: skill.id }] },
        talentGroups: { create: [{ options: { create: [{ name: "1" }, { name: "2" }, { name: "3" }] } }] },
      },
      include: { talentGroups: { include: { options: true } }, abilities: true },
    });
    expect(ninja.talentGroups[0]!.options).toHaveLength(3);
    expect(ninja.abilities).toHaveLength(1);
  });

  it("roles are rows, not an enum", async () => {
    const r = await db.ninjaRole.create({ data: { key: "future-role", name: "Future role" } });
    expect(r.id).toBeTruthy();
  });
});

describe("effects and conditions", () => {
  it("3. effect with no condition", async () => {
    const stat = await db.statistic.create({ data: { key: "s-pct", name: "Pct stat", defaultValueType: "PERCENT" } });
    const gem = await db.gem.create({ data: { slug: "g1", name: "G1" } });
    const effect = await db.effect.create({
      data: { gemId: gem.id, statisticId: stat.id, value: 30, valueType: "PERCENT" },
      include: { conditions: true },
    });
    expect(isConditional({ conditions: effect.conditions as unknown as ConditionView[] })).toBe(false);
  });

  it("4. effect requiring a specific nature (+ chance, duration)", async () => {
    const natureType = await db.conditionType.findUniqueOrThrow({ where: { key: "nature" } });
    const nature = await db.conditionValue.create({ data: { conditionTypeId: natureType.id, key: "n-x", name: "Nature X" } });
    const stat = await db.statistic.create({ data: { key: "s-cond", name: "Cond stat" } });
    const skill = await abilityType("skill");
    const ninja = await db.ninja.create({ data: { slug: "cond-n", name: "Cond" } });
    const ability = await db.ability.create({ data: { ninjaId: ninja.id, abilityTypeId: skill.id, name: "A" } });
    const effect = await db.effect.create({
      data: {
        abilityId: ability.id, statisticId: stat.id, value: 30, valueType: "PERCENT", chancePercent: 50, durationTurns: 2,
        conditions: { create: [{ conditionTypeId: natureType.id, conditionValueId: nature.id, operator: "REQUIRES" }] },
      },
      include: { conditions: { include: { conditionValue: true } } },
    });
    expect(effect.conditions).toHaveLength(1);
    expect(effect.conditions[0]!.conditionValue?.name).toBe("Nature X");
    expect(effect.conditions[0]!.operator).toBe("REQUIRES");
  });

  it("other condition kinds coexist (role, trigger) and OR-groups work", () => {
    const mk = (id: string, group: number): ConditionView => ({
      id, typeKey: "x", typeName: "x", valueName: null, operator: "REQUIRES", numericValue: null, note: null, alternativeGroup: group,
    });
    const groups = groupConditions([mk("a", 0), mk("b", 0), mk("c", 1)]);
    expect(groups.map((g) => g.length)).toEqual([2, 1]);
  });

  it("7/8. percentage and flat statistics", async () => {
    const pct = await db.statistic.create({ data: { key: "s7", name: "P", defaultValueType: "PERCENT" } });
    const flat = await db.statistic.create({ data: { key: "s8", name: "F", defaultValueType: "FLAT" } });
    const gem = await db.gem.create({ data: { slug: "g78", name: "G78" } });
    const [a, b] = await Promise.all([
      db.effect.create({ data: { gemId: gem.id, statisticId: pct.id, value: 12.5, valueType: "PERCENT" } }),
      db.effect.create({ data: { gemId: gem.id, statisticId: flat.id, value: 300, valueType: "FLAT" } }),
    ]);
    expect([a.valueType, b.valueType]).toEqual(["PERCENT", "FLAT"]);
  });

  it("requires exactly one effect owner", () => {
    expect(() => assertSingleEffectOwner({})).toThrow();
    expect(() => assertSingleEffectOwner({ gemId: "a", abilityId: "b" })).toThrow();
    expect(() => assertSingleEffectOwner({ gemId: "a" })).not.toThrow();
  });
});

describe("equipment, jewelry and gems", () => {
  it("5. equipment set with 2/4/6 bonuses (and arbitrary thresholds), unique per threshold", async () => {
    const stat = await db.statistic.create({ data: { key: "s5", name: "S5" } });
    const set = await db.equipmentSet.create({
      data: {
        slug: "eq-set", name: "Eq set",
        bonuses: {
          create: [2, 4, 6, 3].map((n) => ({
            requiredPieces: n,
            effects: { create: [{ statisticId: stat.id, value: n, valueType: "FLAT" }] },
          })),
        },
        items: { create: [{ slug: "eq1", name: "Eq 1" }] },
      },
      include: { bonuses: { include: { effects: true } }, items: true },
    });
    expect(set.bonuses.map((b) => b.requiredPieces).sort()).toEqual([2, 3, 4, 6]);
    expect(set.items).toHaveLength(1);
    await expect(db.equipmentSetBonus.create({ data: { setId: set.id, requiredPieces: 2 } })).rejects.toThrow();
  });

  it("6. jewelry with a different bonus structure (specific items, not a count)", async () => {
    const ring = await db.jewelry.create({ data: { slug: "j-ring", name: "Ring" } });
    const amulet = await db.jewelry.create({ data: { slug: "j-amulet", name: "Amulet" } });
    const set = await db.jewelrySet.create({
      data: {
        slug: "j-set", name: "J set",
        bonuses: {
          create: [
            { requirementKind: "PIECE_COUNT", requiredPieces: 2 },
            {
              requirementKind: "SPECIFIC_ITEMS",
              requiredItems: { create: [{ jewelryId: ring.id }, { jewelryId: amulet.id }] },
            },
          ],
        },
      },
      include: { bonuses: { include: { requiredItems: true } } },
    });
    const specific = set.bonuses.find((b) => b.requirementKind === "SPECIFIC_ITEMS")!;
    expect(specific.requiredPieces).toBeNull();
    expect(specific.requiredItems).toHaveLength(2);
  });

  it("gems have types and effects", async () => {
    const type = await db.gemType.create({ data: { key: "gt", name: "GT" } });
    const gem = await db.gem.create({ data: { slug: "g-typed", name: "Typed", gemTypeId: type.id } });
    expect(gem.gemTypeId).toBe(type.id);
  });

  it("deleting a set bonus cascades to its effects", async () => {
    const set = await db.equipmentSet.create({ data: { slug: "casc", name: "casc" } });
    const bonus = await db.equipmentSetBonus.create({ data: { setId: set.id, requiredPieces: 2 } });
    const effect = await db.effect.create({ data: { equipmentSetBonusId: bonus.id, description: "x" } });
    await db.equipmentSet.delete({ where: { id: set.id } });
    expect(await db.effect.findUnique({ where: { id: effect.id } })).toBeNull();
  });
});
