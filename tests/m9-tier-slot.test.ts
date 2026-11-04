import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { itemVocabulary, upsertEquipmentSet, upsertJewelrySet } from "../src/game/items";
import { listGearSets } from "../src/game/gear";
import { upsertStatusEffect } from "../src/game/status-effects";
import { parseGearParams } from "../src/server/query-params";
import { IS_PG, seedTestVocabulary, testDb } from "./helpers";

/**
 * Exact piece-count search, jewelry slots, the 8-piece bonus under a 2-piece result, and sorting inside that scope.
 * Fixtures cover every edge case; the client's own scenario is also checked on the real imported catalogue.
 */

const db = testDb();
const P = "t15-";
const CC = "aumento de tasa de control";
const cc = (value: string, valueType = "PERCENT", text = `Increase CC Rate +${value}%`) => ({ kind: "STAT", statisticKey: "control-rate", value, valueType, targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED" });
const enemyCc = (value: string) => ({ kind: "STAT", statisticKey: "control-rate", value: `-${value}`, valueType: "PERCENT", targetKey: "enemy", sourceText: `Decrease enemy CC Rate +${value}%`, structuredStatus: "STRUCTURED" });
const weaken = { kind: "STAT", statisticKey: "attack", value: "-30", valueType: "PERCENT", targetKey: "enemy", sourceText: "Weaken enemy's ATK +30%", structuredStatus: "STRUCTURED" };
const freeze = { kind: "STATUS", statusKey: "freeze", targetKey: "enemy", sourceText: "50% chance to freeze enemies for 1 round", structuredStatus: "STRUCTURED" };
const words = (t: string) => ({ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: t });

const link = async (kind: "equipment" | "jewelry", slug: string, family: string, name: string, key = "base", label: string | null = null) => {
  const fam = await db.gearFamily.upsert({ where: { slug: family }, update: {}, create: { slug: family, name } });
  const data = { familyId: fam.id, versionKey: key, versionLabel: label, versionBasis: label ? "PRINTED" : null };
  if (kind === "equipment") await db.equipmentSet.update({ where: { slug }, data });
  else await db.jewelrySet.update({ where: { slug }, data });
};
const eq = async (name: string, bonuses: [number, object[]][], version?: { key: string; label: string }) => {
  const base = `${P}${name.toLowerCase().replace(/\s+/g, "-")}`;
  const slug = version ? `${base}-${version.key}` : base;
  await upsertEquipmentSet(db, { name: `T15 ${name}`, slug, bonuses: bonuses.map(([requiredPieces, effects]) => ({ requiredPieces, effects: effects as never })) });
  await link("equipment", slug, base, `T15 ${name}`, version?.key, version?.label);
};
const SLOTS = ["force", "chakra", "agility", "power"] as const;
/** One jewelry version: the 2-piece effects per category and the set-wide 8-piece effects. */
const jw = async (name: string, twoPiece: Partial<Record<(typeof SLOTS)[number], object[]>>, eight: object[] = []) => {
  const slug = `${P}${name.toLowerCase().replace(/\s+/g, "-")}`;
  await upsertJewelrySet(db, {
    name: `T15 ${name}`,
    slug,
    groups: SLOTS.map((k) => ({ key: k, name: k })),
    items: SLOTS.map((k) => ({ name: `T15 ${name} ${k}`, slug: `${slug}-${k}`, typeKey: k, groupKey: k, effects: [] })),
    bonuses: [
      ...SLOTS.filter((k) => twoPiece[k]).map((k) => ({ groupKey: k, requirementKind: "PIECE_COUNT" as const, requiredPieces: 2, requiredItemNames: [], effects: twoPiece[k] as never })),
      ...(eight.length ? [{ groupKey: null, requirementKind: "PIECE_COUNT" as const, requiredPieces: 8, requiredItemNames: [], effects: eight as never }] : []),
    ],
  });
  await link("jewelry", slug, slug, `T15 ${name}`);
};

beforeAll(async () => {
  await seedTestVocabulary(db);
  for (const key of ["self", "ally", "enemy"]) await db.effectTarget.upsert({ where: { key }, update: {}, create: { key, name: key } });
  await db.statistic.upsert({ where: { key: "control-rate" }, update: {}, create: { key: "control-rate", name: "control rate", category: "combat", defaultValueType: "PERCENT" } });
  await upsertStatusEffect(db, { key: "freeze", name: "Freeze", cleansability: "CLEANSABLE" });
  for (const [i, k] of SLOTS.entries()) await itemVocabulary.jewelryType(db, { key: k, name: k, sortOrder: i });

  // Equipment: where an effect is printed decides everything.
  await eq("EqTwo", [[2, [cc("20")]], [4, [weaken]]]);
  await eq("EqFour", [[4, [cc("40")]]]);
  await eq("EqSix", [[6, [cc("50")]]]);
  await eq("EqAll", [[2, [cc("10")]], [4, [cc("30")]], [6, [cc("60")]]]);
  await eq("EqAll", [[2, [cc("15")]], [4, [cc("35")]], [6, [cc("70")]]], { key: "r1", label: "R1" }); // an upgraded version keeps its own values
  await eq("EqWords", [[2, [words("Increases control rate by 90% after attacking")]]]);
  await eq("EqNegated", [[2, [words("Cannot increase control rate by 70%")]]]);

  // Jewelry: Force carries a HIGHER value than Agility in JewAlpha, to prove the slot decides.
  await jw("JewAlpha", { agility: [cc("25"), freeze], force: [cc("30")] }, [cc("35"), weaken]); // 8 pieces: stronger
  await jw("JewBeta", { agility: [cc("25")], force: [freeze] }, [weaken]); // 8 pieces: unrelated
  await jw("JewDelta", { agility: [cc("25")] }, [cc("7")]); // 8 pieces: lower
  await jw("JewEqual", { agility: [cc("15")] }, [cc("15")]); // 8 pieces: equal
  await jw("JewGamma", { agility: [cc("10")] });
  await jw("JewForce", { force: [cc("50")] }); // Force only
  await jw("JewEight", { chakra: [weaken] }, [cc("40")]); // the effect only at 8 pieces
  await jw("JewFlat", { agility: [cc("5000", "FLAT", "Control Rate +5000")] });
  await jw("JewText", { agility: [words("Increases control rate by 90% after attacking")] });
  await jw("JewEnemy", { agility: [enemyCc("30")] }); // reduces the ENEMY's control rate: another effect
  await jw("JewPower", { power: [cc("45")] });
}, 300_000);

afterAll(async () => {
  await db.equipment.deleteMany({ where: { set: { slug: { startsWith: P } } } });
  await db.jewelry.deleteMany({ where: { set: { slug: { startsWith: P } } } });
  await db.equipmentSet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.jewelrySet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.gearFamily.deleteMany({ where: { slug: { startsWith: P } } });
  await db.$disconnect();
});

const run = (kind: "equipment" | "jewelry", extra: Parameters<typeof listGearSets>[1] = {}) => listGearSets(db, { kinds: [kind], query: "T15", pageSize: 100, ...extra });
const names = (r: Awaited<ReturnType<typeof run>>) => r.items.map((i) => i.title.replace("T15 ", ""));

describe("equipment: the selected piece count is exact", () => {
  it("2 pieces returns only sets whose 2-piece bonus has the effect, not 4 or 6 piece ones", async () => {
    // EqWords prints its control rate as wording only, at 2 pieces: it is found, labelled, and has no value.
    expect(names(await run("equipment", { effectTerms: [CC], tiers: [2] })).sort()).toEqual(["EqAll", "EqAll R1", "EqTwo", "EqWords"]);
    // Nothing is inferred: EqFour (4 pieces) and EqSix (6 pieces) never qualify for a 2-piece search.
    const two = names(await run("equipment", { effectTerms: [CC], tiers: [2] }));
    expect(two).not.toContain("EqFour");
    expect(two).not.toContain("EqSix");
  });

  it("the same rule holds for 4 pieces and 6 pieces", async () => {
    expect(names(await run("equipment", { effectTerms: [CC], tiers: [4] })).sort()).toEqual(["EqAll", "EqAll R1", "EqFour"]);
    expect(names(await run("equipment", { effectTerms: [CC], tiers: [6] })).sort()).toEqual(["EqAll", "EqAll R1", "EqSix"]);
  });

  it("ranks only the value printed at the selected tier, not the best of the other tiers", async () => {
    const two = await run("equipment", { effectTerms: [CC], tiers: [2], sort: { by: "effect", direction: "desc" } });
    expect(names(two)).toEqual(["EqTwo", "EqAll R1", "EqAll", "EqWords"]); // 20, 15, 10 (EqAll's 60 at 6 pieces is not used), wording last
    const ranked = two.items.filter((i) => i.rank!.status === "ranked");
    expect(ranked.map((i) => i.rank!.best!.value)).toEqual([20, 15, 10]);
    expect(ranked.every((i) => i.rank!.best!.pieces === 2 && i.rank!.uses.length === 1)).toBe(true);
    expect(names(await run("equipment", { effectTerms: [CC], tiers: [2], sort: { by: "effect", direction: "asc" } }))).toEqual(["EqAll", "EqAll R1", "EqTwo", "EqWords"]);
    expect(names(await run("equipment", { effectTerms: [CC], tiers: [6], sort: { by: "effect", direction: "desc" } }))).toEqual(["EqAll R1", "EqAll", "EqSix"]);
  });

  it("an upgraded version keeps its own bonuses and values", async () => {
    const six = await run("equipment", { effectTerms: [CC], tiers: [6], sort: { by: "effect", direction: "desc" } });
    expect(six.items.map((i) => [i.title.replace("T15 ", ""), i.rank!.best!.value])).toEqual([["EqAll R1", 70], ["EqAll", 60], ["EqSix", 50]]);
  });

  it("several tiers at once mean any of them; without a tier every tier counts as before", async () => {
    expect(names(await run("equipment", { effectTerms: [CC], tiers: [2, 6] })).sort()).toEqual(["EqAll", "EqAll R1", "EqSix", "EqTwo", "EqWords"]);
    expect(names(await run("equipment", { effectTerms: [CC] })).sort()).toEqual(["EqAll", "EqAll R1", "EqFour", "EqSix", "EqTwo", "EqWords"].sort());
    // Without an effect the tier still means «has a bonus at that piece count».
    expect(names(await run("equipment", { tiers: [6] })).sort()).toEqual(["EqAll", "EqAll R1", "EqSix"]);
  });

  it("wording-only and negated bonuses: searchable, never given a value, never matched when negated", async () => {
    const two = await run("equipment", { effectTerms: [CC], tiers: [2], sort: { by: "effect", direction: "desc" } });
    expect(names(two)).not.toContain("EqNegated");
    const all = await run("equipment", { effectTerms: [CC], sort: { by: "effect", direction: "desc" } });
    const words = all.items.find((i) => i.title === "T15 EqWords")!;
    expect(words.rank).toMatchObject({ status: "text-only", best: null });
    expect(names(all).at(-1)).toBe("EqWords");
  });
});

describe("jewelry: slot and exact 2-piece bonus", () => {
  it("Agility returns only Agility jewelry: Force, Chakra and Power never qualify through an identical effect", async () => {
    const r = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC] });
    expect(names(r).sort()).toEqual(["JewAlpha", "JewBeta", "JewDelta", "JewEqual", "JewFlat", "JewGamma", "JewText"]);
    expect(names(r)).not.toContain("JewForce");
    expect(names(r)).not.toContain("JewPower");
    expect(names(r)).not.toContain("JewEnemy"); // reduces the enemy's control rate: another effect
    expect(r.items.every((i) => i.rank!.uses.every((u) => u.group === "agility" || u.group === null))).toBe(true);
  });

  it("ranks the Agility value even where Force prints a higher one, and shows tier and slot", async () => {
    const r = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "desc" } });
    expect(names(r)).toEqual(["JewAlpha", "JewBeta", "JewDelta", "JewEqual", "JewGamma", "JewFlat", "JewText"]);
    const alpha = r.items[0]!;
    expect(alpha.rank!.best).toMatchObject({ pieces: 2, group: "agility", value: 25 }); // not Force's 30
    expect(r.items.map((i) => i.rank!.status)).toEqual(["ranked", "ranked", "ranked", "ranked", "ranked", "other-measure", "text-only"]);
    const force = await run("jewelry", { slot: "force", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "desc" } });
    expect(names(force)).toEqual(["JewForce", "JewAlpha"]); // 50, 30
  });

  it("descending and ascending are correct and a flat value is not mixed with percentages", async () => {
    const asc = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "asc" } });
    expect(names(asc)).toEqual(["JewGamma", "JewEqual", "JewAlpha", "JewBeta", "JewDelta", "JewFlat", "JewText"]);
    const flat = asc.items.find((i) => i.title === "T15 JewFlat")!;
    expect(flat.rank).toMatchObject({ status: "other-measure", measure: "up|FLAT" });
  });

  it("a 2-piece search does not match an effect that exists only at 8 pieces; an 8-piece search does, separately", async () => {
    expect(names(await run("jewelry", { tiers: [2], effectTerms: [CC] }))).not.toContain("JewEight");
    expect(names(await run("jewelry", { slot: "chakra", tiers: [2], effectTerms: [CC] }))).toEqual([]);
    const eight = await run("jewelry", { tiers: [8], effectTerms: [CC], sort: { by: "effect", direction: "desc" } });
    expect(names(eight)).toEqual(["JewEight", "JewAlpha", "JewEqual", "JewDelta"]); // 40, 35, 15, 7
    expect(eight.items.every((i) => i.rank!.best!.pieces === 8 && i.rank!.best!.group === null)).toBe(true);
    expect(eight.items.every((i) => i.fullSet === null)).toBe(true); // it matched AT 8 pieces: nothing to add underneath
  });

  it("the slot never narrows the set-wide 8-piece bonus", async () => {
    expect(names(await run("jewelry", { slot: "agility", tiers: [8], effectTerms: [CC] })).sort()).toEqual(["JewAlpha", "JewDelta", "JewEight", "JewEqual"]);
  });

  it("the 8-piece bonus of the same version is shown under a 2-piece result, with a note only when it is genuinely stronger", async () => {
    const r = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "desc" } });
    const by = (n: string) => r.items.find((i) => i.title === `T15 ${n}`)!;
    expect(by("JewAlpha").fullSet!.comparison).toMatchObject({ status: "stronger", matching: { value: 25, pieces: 2, group: "agility" }, fullSet: { value: 35, pieces: 8 } });
    expect([...by("JewAlpha").fullSet!.effects].sort()).toEqual(["Increase CC Rate +35%", "Weaken enemy's ATK +30%"].sort());
    expect(by("JewDelta").fullSet!.comparison.status).toBe("lower"); // 7 against 25: no «stronger» note
    expect(by("JewEqual").fullSet!.comparison.status).toBe("equal");
    expect(by("JewGamma").fullSet).toBeNull(); // no 8-piece bonus printed
    // An unrelated 8-piece effect is listed accurately and not compared.
    const beta = await run("jewelry", { slot: "force", tiers: [2], effectTerms: ["congelar"] });
    expect(beta.items.find((i) => i.title === "T15 JewBeta")!.fullSet).toMatchObject({ effects: ["Weaken enemy's ATK +30%"], comparison: { status: "unrelated", fullSet: null } });
  });

  it("without a slot the matching category is named, and the best value across categories ranks", async () => {
    const r = await run("jewelry", { tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "desc" } });
    expect(r.items[0]!.title).toBe("T15 JewForce");
    expect(r.items[0]!.rank!.best).toMatchObject({ group: "force", value: 50 });
  });
});

describe("Match All / Match Any inside the selected slot and tier; choosing the sorting effect", () => {
  const FR = "congelar";
  it("the effects must be in the selected slot and tier", async () => {
    // JewAlpha has both in the Agility 2-piece bonus; JewBeta has the freeze in FORCE only.
    expect(names(await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [FR, CC], effectMode: "all" }))).toEqual(["JewAlpha"]);
    // Without a slot both effects only have to be in the 2-piece bonuses of the version: JewBeta prints the freeze in Force and the control rate in Agility.
    expect(names(await run("jewelry", { tiers: [2], effectTerms: [FR, CC], effectMode: "all" })).sort()).toEqual(["JewAlpha", "JewBeta"]);
  });

  it("Match Any inside the scope, and Match All across different categories when no slot is chosen", async () => {
    expect(names(await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [FR, CC], effectMode: "any" })).sort()).toEqual(["JewAlpha", "JewBeta", "JewDelta", "JewEqual", "JewFlat", "JewGamma", "JewText"]);
  });

  it("the chosen effect controls the numeric order; by default the first one", async () => {
    const byCc = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [FR, CC], effectMode: "any", sort: { by: "effect", direction: "desc", effectTerm: CC } });
    expect(names(byCc).slice(0, 5)).toEqual(["JewAlpha", "JewBeta", "JewDelta", "JewEqual", "JewGamma"]);
    const byFirst = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [FR, CC], effectMode: "any", sort: { by: "effect", direction: "desc" } });
    expect(byFirst.items[0]!.rank!.status).toBe("no-value"); // freezing has no number: JewAlpha first, the rest alphabetical, nothing invented
    expect(names(byFirst)[0]).toBe("JewAlpha");
  });
});

describe("counts, paging, address", () => {
  it("pages without repeats or gaps and the count is exact, in both directions", async () => {
    for (const direction of ["desc", "asc"] as const) {
      const whole = names(await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction } }));
      const seen: string[] = [];
      for (let page = 1; page <= 4; page++) seen.push(...names(await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction }, pageSize: 2, page })));
      expect(seen).toEqual(whole);
      expect(new Set(seen).size).toBe(seen.length);
    }
    expect((await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [CC] })).total).toBe(7);
    expect((await run("jewelry", { slot: "agility", tiers: [2], effectTerms: ["zzzxxyy"] })).total).toBe(0);
  });

  it("a slot implies jewelry, and the slot and tiers are read from the address", () => {
    expect(parseGearParams({ slot: "agility", tier: ["2"], fx: "x", fxm: "all", sort: "fx:desc", fxs: "x" })).toMatchObject({ slot: "agility", tiers: [2], effectMode: "all", sort: { by: "effect", direction: "desc" } });
    expect(parseGearParams({ slot: "gems" }).slot).toBeUndefined(); // only the four existing categories
    expect(parseGearParams({ slot: "" }).slot).toBeUndefined();
  });

  it("a slot search never returns equipment", async () => {
    const r = await listGearSets(db, { query: "T15", slot: "agility", effectTerms: [CC], pageSize: 100 });
    expect(r.items.every((i) => i.kind === "jewelry")).toBe(true);
  });
});

describe.skipIf(IS_PG || !existsSync(path.resolve(__dirname, "../prisma/dev.db")))("real imported catalogue", () => {
  const real = new PrismaClient({ datasourceUrl: `file:${path.resolve(__dirname, "../prisma/dev.db").split(path.sep).join("/")}` });
  afterAll(() => real.$disconnect());
  const have = async () => (await real.gearFamily.count()) > 0;

  /** The stored 2-piece Control Rate increase (percent) of each jewelry version in one category, straight from the tables. */
  const stored = async (slot: string, pieces: number) => {
    const rows = await real.jewelrySetBonus.findMany({
      where: { requiredPieces: pieces, set: { familyId: { not: null } }, ...(pieces === 2 ? { group: { key: slot } } : { groupId: null }), effects: { some: { statistic: { key: "control-rate" }, value: { gt: 0 }, valueType: "PERCENT", structuredStatus: "STRUCTURED" } } },
      select: { setId: true, effects: { where: { statistic: { key: "control-rate" }, value: { gt: 0 }, valueType: "PERCENT" }, select: { value: true } } },
    });
    return new Map(rows.map((r) => [r.setId, Math.max(...r.effects.map((e) => Number(e.value!.toString())))]));
  };

  it("the client's scenario: Joyería, Agilidad, 2 piezas, Control Rate, mayor a menor equals the stored Agility 2-piece values", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const r = await listGearSets(real, { kinds: ["jewelry"], slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "desc" }, pageSize: 100 });
    const oracle = await stored("agility", 2);
    const ranked = r.items.filter((i) => i.rank!.status === "ranked");
    expect(ranked.map((i) => i.id).sort()).toEqual([...oracle.keys()].sort());
    for (const i of ranked) {
      expect(i.rank!.best!.value).toBe(oracle.get(i.id));
      expect(i.rank!.best).toMatchObject({ pieces: 2, group: "agility" });
    }
    const values = ranked.map((i) => i.rank!.best!.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(values.length).toBeGreaterThan(5);
    // No Force, Chakra or Power result: every set listed has its Agility bonus as the match.
    expect(r.items.every((i) => i.rank!.uses.every((u) => u.group === "agility"))).toBe(true);
  });

  it("the 8-piece bonus under those results agrees with the stored 8-piece effects, and «stronger» only where the stored value is higher", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const r = await listGearSets(real, { kinds: ["jewelry"], slot: "agility", tiers: [2], effectTerms: [CC], sort: { by: "effect", direction: "desc" }, pageSize: 100 });
    const eight = await stored("agility", 8);
    const printed = await real.jewelrySetBonus.findMany({ where: { requiredPieces: 8, set: { familyId: { not: null } } }, select: { setId: true, effects: { select: { sourceText: true } } } });
    const printedBy = new Map(printed.map((b) => [b.setId, b.effects.map((e) => e.sourceText)]));
    for (const i of r.items.filter((x) => x.rank!.status === "ranked")) {
      expect(i.fullSet ? [...i.fullSet.effects].sort() : null).toEqual(printedBy.get(i.id) ? [...printedBy.get(i.id)!].sort() : null);
      const eightValue = eight.get(i.id);
      const own = i.rank!.best!.value;
      const expected = eightValue === undefined ? "unrelated" : eightValue > own ? "stronger" : eightValue === own ? "equal" : "lower";
      if (i.fullSet) expect(i.fullSet.comparison.status, i.title).toBe(expected);
    }
    expect(r.items.some((i) => i.fullSet?.comparison.status === "lower")).toBe(true); // real data: Crystalys prints 7 and 10 at 8 pieces
  });

  it("equipment Control Rate at exactly 2, 4 and 6 pieces equals the stored bonuses of each tier", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    for (const tier of [2, 4, 6]) {
      const rows = await real.equipmentSetBonus.findMany({
        where: { requiredPieces: tier, set: { familyId: { not: null } }, effects: { some: { statistic: { key: "control-rate" }, value: { gt: 0 }, valueType: "PERCENT", structuredStatus: "STRUCTURED" } } },
        select: { setId: true },
      });
      const r = await listGearSets(real, { kinds: ["equipment"], tiers: [tier], effectTerms: [CC], sort: { by: "effect", direction: "desc" }, pageSize: 100 });
      expect(r.items.filter((i) => i.rank!.status === "ranked").map((i) => i.id).sort(), `tier ${tier}`).toEqual(rows.map((x) => x.setId).sort());
      expect(r.items.every((i) => i.rank!.uses.every((u) => u.pieces === tier))).toBe(true);
    }
  });

  it("jewelry 8 pieces and every slot match the stored bonuses; slots never leak into each other", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const eight = await listGearSets(real, { kinds: ["jewelry"], tiers: [8], effectTerms: ["reducción de tasa de control"], pageSize: 100 });
    expect(eight.items.length).toBeGreaterThan(3);
    expect(eight.items.every((i) => i.rank === null || i.rank.uses.every((u) => u.pieces === 8))).toBe(true);
    for (const slot of ["force", "chakra", "agility", "power"] as const) {
      const oracle = await stored(slot, 2);
      const r = await listGearSets(real, { kinds: ["jewelry"], slot, tiers: [2], effectTerms: [CC], pageSize: 100 });
      expect(r.items.filter((i) => i.rank!.status === "ranked").map((i) => i.id).sort(), slot).toEqual([...oracle.keys()].sort());
      expect(r.items.every((i) => i.rank!.uses.every((u) => u.group === slot)), slot).toBe(true);
    }
  });

  it("upgraded versions keep separate bonuses and values (Sand Burial, Warlord, Crystalys)", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const r = await listGearSets(real, { kinds: ["jewelry"], slot: "agility", tiers: [2], effectTerms: [CC], query: "warlord", sort: { by: "effect", direction: "desc" } });
    expect(r.items.map((i) => [i.title, i.rank!.best!.value])).toEqual([["Warlord R2", 25], ["Warlord R1", 10]]);
    const crystalys = await listGearSets(real, { kinds: ["jewelry"], slot: "agility", tiers: [2], effectTerms: [CC], query: "crystalys" });
    expect(crystalys.items.map((i) => i.fullSet!.comparison.fullSet!.value).sort((a, b) => a - b)).toEqual([7, 10]); // A prints 7 at 8 pieces, B prints 10
  });
});
