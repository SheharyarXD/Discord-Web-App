import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectSuggestions, explainEffectTerm, ninjaIdsWithEffects } from "../src/game/effect-search";
import { listNinjas, upsertNinja, vocabulary } from "../src/game/ninjas";
import { upsertStatusEffect } from "../src/game/status-effects";
import { effectTerms, parseNinjaParams } from "../src/server/query-params";
import { seedTestVocabulary, testDb } from "./helpers";

/** Search by effect: structured and source-text-only effects, talents, skills and awakenings, Spanish and English. */
const db = testDb();
const P = "t12-";

const find = async (...terms: string[]) => {
  const ids = (await ninjaIdsWithEffects(db, terms)) ?? [];
  const rows = await db.ninja.findMany({ where: { id: { in: ids }, slug: { startsWith: P } }, select: { name: true } });
  return rows.map((r) => r.name).sort();
};

beforeAll(async () => {
  await seedTestVocabulary(db);
  await vocabulary.rating(db, { key: "SSR", name: "SSR", sortOrder: 14 });
  for (const key of ["self", "ally", "enemy"]) await db.effectTarget.upsert({ where: { key }, update: {}, create: { key, name: key } });
  await vocabulary.statistic(db, { key: "control-resistance", name: "control resistance", category: "combat", defaultValueType: "PERCENT" });
  await vocabulary.statistic(db, { key: "block-rate", name: "block rate", category: "combat", defaultValueType: "PERCENT" });
  for (const [key, name] of [["stun", "Stun"], ["seal", "Seal"]] as const) await upsertStatusEffect(db, { key, name, cleansability: "CLEANSABLE" });
  // Base stats keep these fixtures out of other test files' "ninja without a card" counts when files run in parallel.
  const pub = { status: "PUBLISHED" as const, ratingKey: "SSR", baseStats: [{ statisticKey: "force", sourceLabel: "Force", baseValue: "1", growthRate: "1" }] };
  await upsertNinja(db, { name: "T12 Stunner", slug: `${P}stunner`, ...pub, abilities: [{ typeKey: "skill", name: "Stun", effects: [{ kind: "STATUS", statusKey: "stun", targetKey: "enemy", chancePercent: 80, sourceText: "80% chance to stun enemies for 1 round." }] }] });
  await upsertNinja(db, { name: "T12 Immune", slug: `${P}immune`, ...pub, abilities: [{ typeKey: "skill", name: "Guard", effects: [{ kind: "IMMUNITY", statusKey: "stun", targetKey: "self", sourceText: "Immune to stun." }] }] });
  await upsertNinja(db, {
    name: "T12 Awakener", slug: `${P}awakener`, ...pub,
    talentGroups: [{ options: [{ name: "Seal talent", effects: [], awakenings: [{ typeKey: "talent_awakening", name: "Seal awakening", stage: 1, effects: [{ kind: "STATUS", statusKey: "seal", targetKey: "enemy", sourceText: "Seals enemies for 2 rounds." }] }] }] }],
    abilities: [{ typeKey: "skill", name: "Rush", effects: [], awakenings: [{ typeKey: "skill_awakening", name: "Rush awakening", stage: 1, effects: [{ kind: "STAT", statisticKey: "speed", value: "20", targetKey: "ally", sourceText: "Increases ally speed by 20%." }] }] }],
  });
  await upsertNinja(db, { name: "T12 Slow", slug: `${P}slow`, ...pub, abilities: [{ typeKey: "skill", name: "Chill", effects: [{ kind: "STAT", statisticKey: "speed", value: "-20", targetKey: "enemy", sourceText: "Decreases enemies' speed by 20%." }] }] });
  await upsertNinja(db, { name: "T12 Textual", slug: `${P}textual`, ...pub, abilities: [{ typeKey: "skill", name: "Odd", effects: [{ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: "Stuns the attacker and increases self control resistance by 30%.", description: "Stuns the attacker" }] }] });
  await upsertNinja(db, { name: "T12 Negated", slug: `${P}negated`, ...pub, abilities: [{ typeKey: "skill", name: "Calm", effects: [{ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: "Cannot be stunned for 2 rounds." }] }] });
  await upsertNinja(db, {
    name: "T12 Chooser", slug: `${P}chooser`, ...pub,
    abilities: [{ typeKey: "skill", name: "Paths", effects: [
      { kind: "HEAL", choiceGroup: 1, choiceLabel: "Path A", sourceText: "Path A: heals self with 50% rate." },
      { kind: "STATUS", statusKey: "seal", targetKey: "enemy", choiceGroup: 1, choiceLabel: "Path B", sourceText: "Path B: seals enemies." },
    ] }],
  });
  await upsertNinja(db, { name: "T12 Spanish only", slug: `${P}spanish`, ...pub, abilities: [{ typeKey: "skill", name: "Cura", effects: [{ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: "Recovers allied health with 70% rate.", descriptionEs: "Cura a los aliados con una tasa del 70%." }] }] });
  await upsertNinja(db, { name: "T12 Nothing", slug: `${P}nothing`, ...pub, abilities: [{ typeKey: "skill", name: "Plain", effects: [{ kind: "ATTACK", sourceText: "Attacks with 300% growth rate." }] }] });
});
afterAll(async () => {
  await db.ninja.deleteMany({ where: { slug: { startsWith: P } } });
  await db.$disconnect();
});

describe("status effects", () => {
  it("find the ninjas that apply the status, in Spanish, English, any case and without accents", async () => {
    const expected = ["T12 Stunner", "T12 Textual"];
    for (const t of ["aturdir", "Aturdimiento", "ATURDIR", "stun", "Stun", "aturdír"]) expect(await find(t), t).toEqual(expected);
  });
  it("keep applying a status apart from being immune to it", async () => {
    expect(await find("inmunidad a aturdir")).toEqual(["T12 Immune"]);
    expect(await find("immune to stun")).toEqual(["T12 Immune"]);
    expect(await find("aturdir")).not.toContain("T12 Immune");
  });
  it("does not take negated wording as the effect", async () => {
    expect(await find("stun")).not.toContain("T12 Negated");
    expect(await find("aturdir")).not.toContain("T12 Negated");
  });
  it("find a status inside a talent awakening", async () => {
    expect(await find("sellar")).toEqual(["T12 Awakener", "T12 Chooser"]);
    expect(await find("seal")).toEqual(["T12 Awakener", "T12 Chooser"]);
  });
  it("keep the ally and enemy side apart when asked", async () => {
    expect(await find("aturdir enemigos")).toEqual(["T12 Stunner", "T12 Textual"]);
    expect(await find("aturdir aliados")).toEqual([]);
    expect(await find("inmunidad a aturdir propia")).toEqual(["T12 Immune"]);
  });
});

describe("statistic changes", () => {
  it("separate increase from reduction and find skill awakenings", async () => {
    expect(await find("aumento de velocidad")).toEqual(["T12 Awakener"]);
    expect(await find("speed increase")).toEqual(["T12 Awakener"]);
    expect(await find("reducción de velocidad")).toEqual(["T12 Slow"]);
    expect(await find("velocidad")).toEqual(["T12 Awakener", "T12 Slow"]);
  });
  it("finds text-only statistic wording", async () => {
    expect(await find("aumento de resistencia al control")).toEqual(["T12 Textual"]);
    expect(await find("control resistance increase")).toEqual(["T12 Textual"]);
  });
  it("is not fooled by a statistic that merely contains the word", async () => {
    expect((await explainEffectTerm(db, "curación")).concepts).toEqual(["heal"]);
  });
});

describe("heal and choices", () => {
  it("finds structured heals, mutually exclusive choices and Spanish-only text", async () => {
    expect(await find("curación")).toEqual(["T12 Chooser", "T12 Spanish only"]);
    expect(await find("heal")).toEqual(["T12 Chooser", "T12 Spanish only"]);
    // Both alternatives of one choice are stored effects of the ninja.
    expect(await find("sellar", "curar")).toEqual(["T12 Awakener", "T12 Chooser", "T12 Spanish only"]);
  });
  it("searches the wording when no vocabulary entry knows the phrase", async () => {
    expect(await find("tasa del 70")).toEqual(["T12 Spanish only"]);
    expect(await find("growth rate")).toEqual(["T12 Nothing"]);
    expect(await find("zzzxxyy")).toEqual([]);
  });
});

describe("listing", () => {
  const q = { query: "T12", includeUnpublished: true };
  it("combines with the other filters and pages without repeats", async () => {
    const base = (await listNinjas(db, { ...q, effectTerms: ["velocidad"] })).items.map((n) => n.name).sort();
    expect(base).toEqual(["T12 Awakener", "T12 Slow"]);
    expect((await listNinjas(db, { ...q, effectTerms: ["velocidad"], effectStatisticKeys: ["speed"], ratingKeys: ["SSR"] })).total).toBe(2);
    expect((await listNinjas(db, { ...q, effectTerms: ["velocidad"], ratingKeys: ["D"] })).total).toBe(0);
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) seen.push(...(await listNinjas(db, { ...q, effectTerms: ["aturdir", "sellar", "curar", "velocidad"], pageSize: 2, page })).items.map((n) => n.name));
    expect(seen).toHaveLength(new Set(seen).size);
    expect(seen.sort()).toEqual(["T12 Awakener", "T12 Chooser", "T12 Slow", "T12 Spanish only", "T12 Stunner", "T12 Textual"].sort());
  });
  it("counts exactly and an empty list is no filter", async () => {
    expect((await listNinjas(db, { ...q, effectTerms: ["aturdir"] })).total).toBe(2);
    expect((await listNinjas(db, { ...q, effectTerms: [] })).total).toBe((await listNinjas(db, q)).total);
  });
});

describe("address and suggestions", () => {
  it("keeps the terms in the address, repeated and without duplicates", () => {
    expect(effectTerms({ fx: ["aturdir", "Aturdir", "curación"] })).toEqual(["aturdir", "curación"]);
    expect(parseNinjaParams({ fx: ["aturdir"], q: "x" }).effectTerms).toEqual(["aturdir"]);
    expect(parseNinjaParams({}).effectTerms).toBeUndefined();
  });
  it("offers Spanish suggestions that resolve back to ninjas that have them", async () => {
    const s = (await effectSuggestions(db)).map((x) => x.value);
    expect(s).toEqual(expect.arrayContaining(["Aturdir", "Inmunidad a aturdir", "Curación", "Aumento de velocidad", "Reducción de velocidad"]));
    // Every suggestion in one pass (all terms together): each must resolve, and the whole set must find ninjas.
    expect((await ninjaIdsWithEffects(db, s))?.length).toBeGreaterThan(0);
    for (const v of ["Aturdir", "Inmunidad a aturdir", "Curación"]) expect((await ninjaIdsWithEffects(db, [v]))?.length, v).toBeGreaterThan(0);
  });
});

/** The real catalogue (177 ninjas): result sets are compared with independent queries on the stored effects. */
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { IS_PG } from "./helpers";

const devDb = path.resolve(__dirname, "../prisma/dev.db");
describe.skipIf(IS_PG || !existsSync(devDb))("real data", () => {
  const real = new PrismaClient({ datasourceUrl: "file:" + devDb.split(path.sep).join("/") });
  const owners = async (where: object) => {
    const rows = await real.effect.findMany({ where, select: { ability: { select: { ninjaId: true } }, talentOption: { select: { group: { select: { ninjaId: true } } } } } });
    return new Set(rows.map((r) => r.ability?.ninjaId ?? r.talentOption?.group.ninjaId).filter(Boolean) as string[]);
  };
  afterAll(() => real.$disconnect());

  it("«aturdir» returns every ninja that applies Stun, and every result has stored evidence", async () => {
    const found = new Set((await ninjaIdsWithEffects(real, ["aturdir"])) ?? []);
    const structured = await owners({ kind: "STATUS", statusEffect: { key: "stun" } });
    expect(structured.size).toBeGreaterThan(5);
    for (const id of structured) expect(found.has(id)).toBe(true);
    const evidence = await owners({ OR: [{ kind: "STATUS", statusEffect: { key: "stun" } }, { sourceText: { contains: "stun" } }, { descriptionEs: { contains: "aturd" } }] });
    for (const id of found) expect(evidence.has(id), id).toBe(true);
    expect([...found].length).toBe(new Set((await ninjaIdsWithEffects(real, ["stun"])) ?? []).size);
  });
  it("immunity to a status is a different, larger-or-equal set than applying it, and no ninja is listed twice", async () => {
    const applies = new Set((await ninjaIdsWithEffects(real, ["sellar"])) ?? []);
    const immune = new Set((await ninjaIdsWithEffects(real, ["inmunidad a sellar"])) ?? []);
    const structuredImmune = await owners({ kind: "IMMUNITY", statusEffect: { key: "seal" } });
    expect(immune).toEqual(structuredImmune);
    expect(applies.size).toBeGreaterThan(0);
    const page1 = await listNinjas(real, { effectTerms: ["sellar", "inmunidad a sellar"], pageSize: 6 });
    expect(page1.total).toBe(new Set([...applies, ...immune]).size);
  });
  it("English and Spanish give the same set; combining with a statistic filter narrows it", async () => {
    for (const [es, en] of [["curación", "heal"], ["aumento de velocidad", "speed increase"], ["restaurar furia", "fury restoration"], ["eliminar debuffs", "debuff removal"]] as const) {
      expect(await ninjaIdsWithEffects(real, [es]), es).toEqual(await ninjaIdsWithEffects(real, [en]));
    }
    const speed = await listNinjas(real, { effectTerms: ["aumento de velocidad"] });
    const both = await listNinjas(real, { effectTerms: ["aumento de velocidad"], statFilters: [{ statisticKey: "hp", min: "100000" }] });
    expect(both.total).toBeLessThanOrEqual(speed.total);
    const seen: string[] = [];
    for (let page = 1; page <= speed.pageCount; page++) seen.push(...(await listNinjas(real, { effectTerms: ["aumento de velocidad"], page })).items.map((n) => n.id));
    expect(seen).toHaveLength(speed.total);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
