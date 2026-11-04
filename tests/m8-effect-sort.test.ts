import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { analyseEffects, compareRanks, describeMeasure, type EffectRank } from "../src/game/effect-search";
import { listGearSets } from "../src/game/gear";
import { upsertEquipmentSet } from "../src/game/items";
import { listNinjas, upsertNinja, vocabulary } from "../src/game/ninjas";
import { upsertStatusEffect } from "../src/game/status-effects";
import { parseGearParams, parseNinjaParams, sortEffectOf } from "../src/server/query-params";
import { IS_PG, seedTestVocabulary, testDb } from "./helpers";

/** Sorting by the value of a selected effect: highest to lowest and back, by one chosen effect, never mixing unlike measures. */

const rank = (over: Partial<EffectRank>): EffectRank => ({ status: "ranked", measure: "up|PERCENT", best: null, uses: [], group: 0, magnitude: 40, tierValues: [], ...over });

describe("comparison rule (no database)", () => {
  it("orders by the largest printed value, then by the value at the highest piece count, descending and ascending", () => {
    const susanoA = rank({ magnitude: 40, tierValues: [15, 40] }); // 6 pieces +15%, 4 pieces +40%
    const susanoB = rank({ magnitude: 40, tierValues: [18, 40] });
    expect(compareRanks(susanoB, susanoA, "desc")).toBeLessThan(0); // +18% at 6 pieces comes first
    expect(compareRanks(susanoA, susanoB, "asc")).toBeLessThan(0);
    const only6 = rank({ magnitude: 40, tierValues: [40, -Infinity] });
    const only4 = rank({ magnitude: 40, tierValues: [-Infinity, 40] });
    expect(compareRanks(only6, only4, "desc")).toBeLessThan(0);
    expect(compareRanks(rank({ magnitude: 50 }), rank({ magnitude: 40, tierValues: [99] }), "desc")).toBeLessThan(0);
    expect(compareRanks(susanoA, rank({ magnitude: 40, tierValues: [15, 40] }), "desc")).toBe(0); // a tie is left to the caller (name, identity)
  });

  it("keeps measures in a fixed order and puts wording-only results last in both directions", () => {
    const primary = rank({ group: 0, magnitude: 10 });
    const other = rank({ group: 1, magnitude: 99, status: "other-measure", measure: "up|FLAT" });
    const text = rank({ group: 2, magnitude: null, status: "text-only", measure: null });
    const none = rank({ group: 3, magnitude: null, status: "no-match", measure: null });
    for (const dir of ["asc", "desc"] as const) {
      const ordered = [none, text, other, primary].sort((a, b) => compareRanks(a, b, dir));
      expect(ordered).toEqual([primary, other, text, none]);
    }
    expect(describeMeasure("up|PERCENT")).toEqual({ direction: "up", unit: "PERCENT" });
    expect(describeMeasure("immune:seal|PERCENT").direction).toBe("immune");
  });
});

describe("address parameters", () => {
  it("reads the value sort and the effect that controls it", () => {
    const raw = { fx: ["aturdir", "tasa de control"], fxm: "all", sort: "fx:desc", fxs: "Tasa de Control" };
    expect(parseGearParams(raw).sort).toEqual({ by: "effect", direction: "desc", effectTerm: "Tasa de Control" });
    expect(parseNinjaParams(raw).sort).toEqual({ by: "effect", direction: "desc", effectTerm: "Tasa de Control" });
    expect(parseGearParams({ ...raw, sort: "fx:asc" }).sort).toMatchObject({ direction: "asc" });
    // The controlling effect must be one of the selected ones; otherwise the first selected effect decides.
    expect(sortEffectOf({ ...raw, fxs: "nada" })).toBeUndefined();
    expect(parseGearParams({ ...raw, fxs: "nada" }).sort).toEqual({ by: "effect", direction: "desc" });
    // Without a selected effect the value sort means nothing and is dropped.
    expect(parseGearParams({ sort: "fx:desc" }).sort).toBeUndefined();
    expect(parseNinjaParams({ sort: "fx:desc" }).sort).toBeUndefined();
    expect(parseGearParams({ fx: "x", sort: "fx:sideways" }).sort).toBeUndefined();
  });
});

const db = testDb();
const P = "t14-";
const CC = "aumento de tasa de control";
const eq = async (name: string, bonuses: [pieces: number, effects: object[]][]) => {
  const slug = `${P}${name.toLowerCase().replace(/\s+/g, "-")}`;
  await upsertEquipmentSet(db, {
    name: `T14 ${name}`,
    slug,
    bonuses: bonuses.map(([requiredPieces, effects]) => ({ requiredPieces, effects: effects as never })),
  });
  const family = await db.gearFamily.upsert({ where: { slug }, update: {}, create: { slug, name: `T14 ${name}` } });
  await db.equipmentSet.update({ where: { slug }, data: { familyId: family.id, versionKey: "base" } });
};
const cc = (value: string, valueType = "PERCENT", text = `Increase CC Rate +${value}%`) => ({ kind: "STAT", statisticKey: "control-rate", value, valueType, targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED" });
const enemyCc = (value: string) => ({ kind: "STAT", statisticKey: "control-rate", value: `-${value}`, valueType: "PERCENT", targetKey: "enemy", sourceText: `Decrease enemy CC Rate +${value}%`, structuredStatus: "STRUCTURED" });
const freeze = { kind: "STATUS", statusKey: "freeze", targetKey: "enemy", sourceText: "50% chance to freeze enemies for 1 round", structuredStatus: "STRUCTURED" };
const text = (t: string) => ({ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: t });

beforeAll(async () => {
  await seedTestVocabulary(db);
  await vocabulary.rating(db, { key: "SSR", name: "SSR", sortOrder: 14 });
  for (const key of ["self", "ally", "enemy"]) await db.effectTarget.upsert({ where: { key }, update: {}, create: { key, name: key } });
  await db.statistic.upsert({ where: { key: "control-rate" }, update: {}, create: { key: "control-rate", name: "control rate", category: "combat", defaultValueType: "PERCENT" } });
  await upsertStatusEffect(db, { key: "freeze", name: "Freeze", cleansability: "CLEANSABLE" });
  // Susanoo-like: the same +40% at 4 pieces, then +15% or +18% at 6 pieces. Tiers are never added.
  await eq("Alpha", [[2, [cc("30")]], [4, [cc("40")]], [6, [cc("15")]]]);
  await eq("Beta", [[4, [cc("40")]], [6, [cc("18")]]]);
  await eq("Gamma", [[4, [cc("40")]], [6, [cc("18")]]]); // identical to Beta: alphabetical
  await eq("Theta", [[6, [cc("40")]]]); // +40% at the higher tier only
  await eq("Zeta", [[2, [cc("5000", "FLAT", "Control Rate +5000")]]]); // a flat value: another measure
  await eq("Delta", [[2, [enemyCc("50")]]]); // a reduction of the enemy's control rate: another concept
  await eq("Epsilon", [[2, [text("Increases control rate by 90% after attacking")]]]); // wording only
  await eq("Eta", [[2, [text("Cannot increase control rate by 70%")]]]); // negated
  await eq("Freezer", [[2, [freeze]], [4, [cc("12")]]]); // two different effects at two tiers
  await eq("Iceonly", [[2, [freeze]]]);
  const stats = [{ statisticKey: "force", sourceLabel: "Force", baseValue: "1", growthRate: "1" }];
  const ninja = (name: string, effects: object[]) => upsertNinja(db, { name: `T14 ${name}`, slug: `${P}n-${name.toLowerCase()}`, status: "PUBLISHED", ratingKey: "SSR", baseStats: stats, abilities: [{ typeKey: "skill", name: "S", effects: effects as never }] });
  await ninja("Ten", [cc("10")]);
  await ninja("Thirty", [cc("30")]);
  await ninja("Thirty B", [cc("30"), cc("20")]);
  await ninja("Enemy", [enemyCc("60")]);
  await ninja("Words", [text("Increases control rate by 80% for 2 rounds")]);
  await ninja("Freezing", [freeze]);
}, 300_000);

afterAll(async () => {
  await db.equipment.deleteMany({ where: { set: { slug: { startsWith: P } } } });
  await db.equipmentSet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.gearFamily.deleteMany({ where: { slug: { startsWith: P } } });
  await db.ninja.deleteMany({ where: { slug: { startsWith: P } } });
  await db.$disconnect();
});

const gear = async (terms: string[], direction: "asc" | "desc", extra: Parameters<typeof listGearSets>[1] = {}) =>
  (await listGearSets(db, { query: "T14", pageSize: 100, effectTerms: terms, sort: { by: "effect", direction }, ...extra })).items;
const titles = (items: { title: string }[]) => items.map((i) => i.title.replace("T14 ", ""));

describe("equipment: value of the selected effect", () => {
  it("highest to lowest: largest printed value, then the higher tier, then the name; other measures and wording after", async () => {
    const items = await gear([CC], "desc");
    // Theta (+40% at 6 pieces) first; Beta and Gamma tie on everything (+40% at 4, +18% at 6): alphabetical; Alpha (+15% at 6) after them.
    expect(titles(items)).toEqual(["Theta", "Beta", "Gamma", "Alpha", "Freezer", "Zeta", "Epsilon"]);
    expect(items.map((i) => i.rank!.status)).toEqual(["ranked", "ranked", "ranked", "ranked", "ranked", "other-measure", "text-only"]);
  });

  it("lowest to highest reverses the numbers, keeps the same last places and the same tie rule", async () => {
    expect(titles(await gear([CC], "asc"))).toEqual(["Freezer", "Alpha", "Beta", "Gamma", "Theta", "Zeta", "Epsilon"]);
  });

  it("shows every printed value at its own tier and never adds them", async () => {
    const alpha = (await gear([CC], "desc")).find((i) => i.title === "T14 Alpha")!;
    expect(alpha.rank!.uses.map((u) => [u.pieces, u.value])).toEqual([[6, 15], [4, 40], [2, 30]]);
    expect(alpha.rank!.best).toMatchObject({ pieces: 4, value: 40 }); // not 85
    expect(alpha.rank!.uses.every((u) => u.unit === "PERCENT")).toBe(true);
  });

  it("does not compare an increase with a reduction of the enemy's control rate, a flat value or a negated phrase", async () => {
    const up = titles(await gear([CC], "desc"));
    expect(up).not.toContain("Delta"); // the reduction is not an increase
    expect(up).not.toContain("Eta"); // «Cannot increase ...» is not the effect
    const down = await gear(["reducción de tasa de control"], "desc");
    expect(titles(down)).toEqual(["Delta"]);
    expect(down[0]!.rank!.measure).toBe("down|PERCENT");
    expect(down[0]!.rank!.best!.value).toBe(-50); // shown with its sign, ranked by its size
    const zeta = (await gear([CC], "desc")).find((i) => i.title === "T14 Zeta")!;
    expect(zeta.rank!.measure).toBe("up|FLAT");
    expect(zeta.rank!.status).toBe("other-measure");
  });

  it("a wording-only effect stays searchable but is labelled and has no value", async () => {
    const epsilon = (await gear([CC], "desc")).find((i) => i.title === "T14 Epsilon")!;
    expect(epsilon.rank).toMatchObject({ status: "text-only", best: null, magnitude: null });
    expect(titles(await gear([CC], "desc", { query: "epsilon" }))).toEqual(["Epsilon"]);
  });

  it("a bare «tasa de control» ranks the increases first and puts the reductions after, apart", async () => {
    const items = await gear(["tasa de control"], "desc");
    const order = titles(items);
    expect(order.slice(0, 5)).toEqual(["Theta", "Beta", "Gamma", "Alpha", "Freezer"]);
    expect(order.indexOf("Delta")).toBeGreaterThan(order.indexOf("Freezer"));
    expect(items.find((i) => i.title === "T14 Delta")!.rank!.status).toBe("other-measure");
  });

  it("several selected effects: the first one controls by default, any selected one can be chosen, and Match Any / All still filter", async () => {
    const byFirst = await gear(["congelar", CC], "desc"); // the first selected effect is a state: no number to compare
    expect(byFirst.every((i) => i.rank!.status !== "ranked")).toBe(true);
    // Those that have the controlling effect (a state with no number) come first, then those found only through the other effect; alphabetical inside each.
    expect(byFirst.map((i) => i.rank!.status).slice(0, 2)).toEqual(["no-value", "no-value"]);
    expect(titles(byFirst).slice(0, 2)).toEqual(["Freezer", "Iceonly"]);
    expect(titles(byFirst).slice(2)).toEqual([...titles(byFirst).slice(2)].sort());
    expect(byFirst.slice(2).every((i) => i.rank!.status === "no-match")).toBe(true);
    const byCc = await gear(["congelar", CC], "desc", { sort: { by: "effect", direction: "desc", effectTerm: CC } });
    expect(titles(byCc).slice(0, 5)).toEqual(["Theta", "Beta", "Gamma", "Alpha", "Freezer"]);
    expect(byCc.find((i) => i.title === "T14 Iceonly")!.rank!.status).toBe("no-match"); // Any: found by the other effect, last
    // The same effect typed another way controls the same.
    const typedOther = await gear(["congelar", CC], "desc", { sort: { by: "effect", direction: "desc", effectTerm: "AUMENTO DE TASA DE CONTROL" } });
    expect(titles(typedOther)).toEqual(titles(byCc));
    const all = await gear(["congelar", CC], "desc", { effectMode: "all", sort: { by: "effect", direction: "desc", effectTerm: CC } });
    expect(titles(all)).toEqual(["Freezer"]);
  });

  it("pages without repeating or dropping a set, in both directions, and composes with the other filters", async () => {
    for (const direction of ["desc", "asc"] as const) {
      const whole = titles(await gear([CC], direction));
      const seen: string[] = [];
      for (let page = 1; page <= 4; page++) seen.push(...titles((await listGearSets(db, { query: "T14", effectTerms: [CC], sort: { by: "effect", direction }, pageSize: 2, page })).items));
      expect(seen).toEqual(whole);
      expect(new Set(seen).size).toBe(seen.length);
    }
    expect(titles(await gear([CC], "desc", { tiers: [6] }))).toEqual(["Theta", "Beta", "Gamma", "Alpha"]);
    expect(titles(await gear([CC], "desc", { versions: ["labelled"] }))).toEqual([]);
  });

  it("an effect nobody has gives an empty result, not an error", async () => {
    expect((await listGearSets(db, { effectTerms: ["zzzxxyy"], sort: { by: "effect", direction: "desc" } })).total).toBe(0);
    expect((await listGearSets(db, { effectTerms: [CC], query: "nothing-called-this", sort: { by: "effect", direction: "desc" } })).total).toBe(0);
  });

  it("without a value sort the existing orders are untouched", async () => {
    const byName = titles((await listGearSets(db, { query: "T14", effectTerms: [CC], pageSize: 100 })).items);
    expect(byName).toEqual([...byName].sort());
  });
});

describe("ninjas: value of the selected effect", () => {
  const ninjas = async (terms: string[], direction: "asc" | "desc", extra: Parameters<typeof listNinjas>[1] = {}) =>
    (await listNinjas(db, { query: "T14", effectTerms: terms, sort: { by: "effect", direction }, pageSize: 100, ...extra })).items;
  const n = (items: { name: string }[]) => items.map((i) => i.name.replace("T14 ", ""));

  it("ranks by the largest value a ninja has for the effect; wording-only after the numbers", async () => {
    const items = await ninjas([CC], "desc");
    expect(n(items)).toEqual(["Thirty", "Thirty B", "Ten", "Words"]); // 30, 30 (with a 20 as well: not 50), 10, wording
    expect(items.find((i) => i.name === "T14 Thirty B")!.sortEffect!.best!.value).toBe(30);
    expect(n(await ninjas([CC], "asc"))).toEqual(["Ten", "Thirty", "Thirty B", "Words"]);
    expect(items.find((i) => i.name === "T14 Words")!.sortEffect!.status).toBe("text-only");
  });

  it("keeps an enemy's reduction apart and handles other effects, paging and empty results", async () => {
    expect(n(await ninjas(["reducción de tasa de control"], "desc"))).toEqual(["Enemy"]);
    expect(n(await ninjas(["congelar", CC], "desc", { sort: { by: "effect", direction: "desc", effectTerm: CC } }))[0]).toBe("Thirty");
    const seen: string[] = [];
    for (let page = 1; page <= 4; page++) seen.push(...n(await ninjas([CC], "desc", { pageSize: 1, page })));
    expect(seen).toEqual(["Thirty", "Thirty B", "Ten", "Words"]);
    expect(await ninjas(["zzzxxyy"], "desc")).toEqual([]);
  });
});

describe.skipIf(IS_PG || !existsSync(path.resolve(__dirname, "../prisma/dev.db")))("real imported catalogue", () => {
  const real = new PrismaClient({ datasourceUrl: `file:${path.resolve(__dirname, "../prisma/dev.db").split(path.sep).join("/")}` });
  afterAll(() => real.$disconnect());
  const list = (terms: string[], direction: "asc" | "desc", extra: Parameters<typeof listGearSets>[1] = {}) => listGearSets(real, { effectTerms: terms, sort: { by: "effect", direction }, pageSize: 100, ...extra });

  it("Control Rate: descending never goes up, the strongest comes first, ascending is the same numbers backwards", { timeout: 180_000 }, async () => {
    if ((await real.gearFamily.count()) === 0) return;
    const desc = (await list([CC], "desc")).items;
    const ranked = desc.filter((i) => i.rank!.status === "ranked");
    expect(ranked.length).toBeGreaterThan(10);
    const mags = ranked.map((i) => i.rank!.magnitude!);
    expect(mags).toEqual([...mags].sort((a, b) => b - a));
    expect(mags[0]).toBe(Math.max(...mags));
    const asc = (await list([CC], "asc")).items.filter((i) => i.rank!.status === "ranked").map((i) => i.rank!.magnitude!);
    expect(asc).toEqual([...mags].reverse().sort((a, b) => a - b));
    // Every value shown is a printed value of that set, and the one used is the largest of them: nothing is summed.
    for (const i of ranked) {
      expect(i.rank!.best!.value).toBe(Math.max(...i.rank!.uses.map((u) => u.value)));
      expect(i.rank!.uses.every((u) => u.unit === ranked[0]!.rank!.best!.unit)).toBe(true);
    }
  });

  it("the client's Susanoo example: +40% at 4 pieces in both versions, +15% against +18% at 6 pieces; the +18% version comes first", { timeout: 180_000 }, async () => {
    if ((await real.gearFamily.count()) === 0) return;
    const items = (await list([CC], "desc", { query: "susanoo", kinds: ["equipment"] })).items;
    expect(items.map((i) => i.title)).toEqual(["Susanoo (variant B)", "Susanoo (variant A)"]);
    const [b, a] = items;
    expect(b!.rank!.uses.map((u) => [u.pieces, u.value])).toEqual([[6, 18], [4, 40]]);
    expect(a!.rank!.uses.map((u) => [u.pieces, u.value])).toEqual([[6, 15], [4, 40]]);
    expect(b!.rank!.best!.value).toBe(40); // not 58: the tiers are not added
    expect((await list([CC], "asc", { query: "susanoo", kinds: ["equipment"] })).items.map((i) => i.title)).toEqual(["Susanoo (variant A)", "Susanoo (variant B)"]);
    // Whole catalogue: B is ahead of A.
    const all = (await list([CC], "desc")).items.map((i) => `${i.kind}:${i.title}`);
    expect(all.indexOf("equipment:Susanoo (variant B)")).toBeLessThan(all.indexOf("equipment:Susanoo (variant A)"));
  });

  it("an increase and a reduction of the enemy's control rate are different measures and are never interleaved", { timeout: 180_000 }, async () => {
    if ((await real.gearFamily.count()) === 0) return;
    const bare = (await list(["tasa de control"], "desc")).items;
    const measures = bare.map((i) => i.rank!.measure).filter((m): m is string => m !== null);
    const firstOther = measures.findIndex((m) => m !== measures[0]);
    if (firstOther >= 0) expect(measures.slice(firstOther).every((m) => m !== measures[0])).toBe(true);
    expect(measures[0]).toBe("up|PERCENT");
    const reductions = (await list(["reducción de tasa de control"], "desc")).items.filter((i) => i.rank!.status === "ranked");
    expect(reductions.every((i) => i.rank!.best!.value < 0)).toBe(true);
  });

  it("pages the whole real result without repeats, and several effects can be chosen to control the order", { timeout: 180_000 }, async () => {
    if ((await real.gearFamily.count()) === 0) return;
    const whole = (await list([CC], "desc")).items.map((i) => `${i.kind}:${i.slug}`);
    const seen: string[] = [];
    const first = await listGearSets(real, { effectTerms: [CC], sort: { by: "effect", direction: "desc" }, pageSize: 7 });
    for (let page = 1; page <= first.pageCount; page++) seen.push(...(await listGearSets(real, { effectTerms: [CC], sort: { by: "effect", direction: "desc" }, pageSize: 7, page })).items.map((i) => `${i.kind}:${i.slug}`));
    expect(seen).toEqual(whole);
    expect(new Set(seen).size).toBe(seen.length);
    const analysis = await analyseEffects(real, ["equipment"], ["aturdir", CC], "any", CC);
    expect(analysis!.sortTerm).toBe(CC);
    expect((await analyseEffects(real, ["equipment"], ["aturdir", CC], "any"))!.sortTerm).toBe("aturdir");
  });

  it("works on ninjas too, where the stored values are structured", { timeout: 180_000 }, async () => {
    const items = (await listNinjas(real, { effectTerms: ["aumento de velocidad"], sort: { by: "effect", direction: "desc" }, pageSize: 100 })).items;
    const ranked = items.filter((i) => i.sortEffect!.status === "ranked").map((i) => i.sortEffect!.magnitude!);
    expect(ranked.length).toBeGreaterThan(10);
    expect(ranked).toEqual([...ranked].sort((a, b) => b - a));
    const seen: string[] = [];
    const page1 = await listNinjas(real, { effectTerms: ["aumento de velocidad"], sort: { by: "effect", direction: "desc" }, pageSize: 40 });
    for (let page = 1; page <= page1.pageCount; page++) seen.push(...(await listNinjas(real, { effectTerms: ["aumento de velocidad"], sort: { by: "effect", direction: "desc" }, pageSize: 40, page })).items.map((i) => i.id));
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(page1.total);
  });
});
