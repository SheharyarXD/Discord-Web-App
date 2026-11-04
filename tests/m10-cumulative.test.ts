import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { additiveKey, cumulate, type BonusLine } from "../src/domain/cumulative";
import { setTotals } from "../src/domain/set-totals";
import { getEquipmentSet, getJewelrySet, itemVocabulary, upsertEquipmentSet, upsertJewelrySet } from "../src/game/items";
import { listGearSets } from "../src/game/gear";
import { parseGearParams } from "../src/server/query-params";
import { IS_PG, seedTestVocabulary, testDb } from "./helpers";

/**
 * CONFIRMED by the client: the bonuses of every unlocked threshold accumulate. With 6 pieces, Deatbone's Damage Rate +30% (2 pieces)
 * and +40% (6 pieces) make +70%, although the 4-piece tier has no Damage Rate. Only comparable additive values are added.
 */

const line = (pieces: number, key: string | null, value: number | null, extra: Partial<BonusLine> = {}): BonusLine => ({ pieces, group: null, key, value, unit: "PERCENT", label: "Damage Rate", text: `Damage Rate +${value}%`, ...extra });
const DR = "stat:damage-rate|PERCENT|self|+";

describe("additive identity (no database)", () => {
  const base = { kind: "STAT", structured: true, value: 30, unit: "PERCENT", statKey: "damage-rate", statusKey: null, side: "self", conditional: false };
  it("is the statistic, unit, target and direction", () => {
    expect(additiveKey(base)).toBe(DR);
    expect(additiveKey({ ...base, side: null })).toBe(DR); // no target stored means the wearer
    expect(additiveKey({ ...base, side: "enemy", value: -30 })).toBe("stat:damage-rate|PERCENT|enemy|-");
    expect(additiveKey({ ...base, unit: "FLAT" })).toBe("stat:damage-rate|FLAT|self|+");
    expect(additiveKey({ ...base, kind: "IMMUNITY", statKey: null, statusKey: "stun" })).toBe("immune:stun|PERCENT|self|+");
  });
  it("is null for anything that is not a plain number", () => {
    expect(additiveKey({ ...base, conditional: true })).toBeNull(); // a chance, a duration, a trigger, a condition, alternatives
    expect(additiveKey({ ...base, structured: false })).toBeNull(); // wording only
    expect(additiveKey({ ...base, value: null })).toBeNull();
    expect(additiveKey({ ...base, kind: "TEXT" })).toBeNull();
    expect(additiveKey({ ...base, kind: "STATUS", statKey: null, statusKey: "freeze" })).toBeNull();
  });
});

describe("cumulate (no database)", () => {
  it("adds the tiers up to the piece count; a tier without the effect does not stop it (Deatbone: 30 + 40 = 70)", () => {
    const lines = [line(2, DR, 30), line(4, "stat:agility|FLAT|self|+", 15000, { unit: "FLAT", label: "Agility" }), line(6, DR, 40)];
    const six = cumulate(lines, 6).find((t) => t.key === DR)!;
    expect(six).toMatchObject({ value: 70, pieces: 6, slot: null });
    expect(six.parts.map((p) => [p.pieces, p.value])).toEqual([[2, 30], [6, 40]]);
    expect(cumulate(lines, 4).find((t) => t.key === DR)!.value).toBe(30);
    expect(cumulate(lines, 2).find((t) => t.key === DR)!.value).toBe(30);
    expect(cumulate(lines, 1)).toEqual([]);
  });
  it("does not add unlike things: unit, direction, target, effect", () => {
    const lines = [line(2, DR, 30), line(4, "stat:damage-rate|FLAT|self|+", 1000, { unit: "FLAT" }), line(4, "stat:damage-rate|PERCENT|enemy|-", -20), line(6, "stat:hp|PERCENT|self|+", 10, { label: "HP" })];
    const totals = cumulate(lines, 6);
    expect(totals).toHaveLength(4);
    expect(totals.find((t) => t.key === DR)!.value).toBe(30);
    expect(totals.find((t) => t.key === "stat:damage-rate|PERCENT|enemy|-")!.value).toBe(-20);
  });
  it("ignores lines that are not additive or have no threshold", () => {
    const lines = [line(2, DR, 30), line(4, null, 25), { ...line(6, DR, 40), pieces: null }];
    expect(cumulate(lines, 6)).toHaveLength(1);
    expect(cumulate(lines, 6)[0]!.value).toBe(30);
  });
  it("jewelry: every slot keeps its own 2-piece bonus; the complete set adds the set-wide 8-piece bonus to it; slots are never added", () => {
    const lines = [line(2, DR, 20, { group: "agility" }), line(2, DR, 30, { group: "force" }), line(8, DR, 25)];
    expect(cumulate(lines, 2).map((t) => [t.slot, t.value])).toEqual([["agility", 20], ["force", 30]]);
    expect(cumulate(lines, 8).map((t) => [t.slot, t.value])).toEqual([["agility", 45], ["force", 55]]);
    expect(cumulate(lines, 8, "agility").map((t) => [t.slot, t.value])).toEqual([["agility", 45]]);
    expect(cumulate(lines, 8, "power").map((t) => [t.slot, t.value])).toEqual([[null, 25]]); // no Power bonus: only the set-wide one, no slot named
  });
  it("adds two lines of the same effect inside one tier, and rounds away floating-point noise", () => {
    const lines = [line(2, DR, 0.1), line(2, DR, 0.2), line(4, DR, 0.3)];
    expect(cumulate(lines, 4)[0]!.value).toBe(0.6);
  });
});

// ───────────────────────── fixtures ─────────────────────────

const db = testDb();
const P = "t16-";
const DMG = "aumento de tasa de daño";
const AVOID = "aumento de evasión de daño";
const AGI = "aumento de agilidad";
const stat = (statisticKey: string, value: string, valueType: string, text: string, extra: object = {}) => ({ kind: "STAT", statisticKey, value, valueType, targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED", ...extra });
const dr = (v: string, extra: object = {}) => stat("damage-rate", v, "PERCENT", `Damage Rate +${v}%`, extra);
const avoid = (v: string) => stat("avoid-injury", v, "PERCENT", `Avoid-Injury Rate +${v}%`);
const agi = (v: string) => stat("agility", v, "FLAT", `Agility +${v}`);
const def = (v: string) => stat("defenses", v, "PERCENT", `Defense +${v}%`);
const own = (v: string) => stat("attack", v, "PERCENT", `ATK +${v}%`);
const weaken = (v: string) => stat("attack", `-${v}`, "PERCENT", `Weaken enemy's ATK +${v}%`, { targetKey: "enemy" });
const poison = { kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: "After attack Poison (100% DOT) enemy for 2 rounds", triggerText: "After attack", targetKey: "enemy" };
const words = (t: string) => ({ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: t });

const link = async (kind: "equipment" | "jewelry", slug: string, family: string, name: string, key = "base", label: string | null = null) => {
  const fam = await db.gearFamily.upsert({ where: { slug: family }, update: {}, create: { slug: family, name } });
  const data = { familyId: fam.id, versionKey: key, versionLabel: label, versionBasis: label ? "PRINTED" : null };
  if (kind === "equipment") await db.equipmentSet.update({ where: { slug }, data });
  else await db.jewelrySet.update({ where: { slug }, data });
};
const slugOf = (name: string, version?: { key: string }) => `${P}${name.toLowerCase().replace(/\s+/g, "-")}${version ? `-${version.key}` : ""}`;
const eq = async (name: string, bonuses: [number, object[]][], version?: { key: string; label: string }) => {
  const slug = slugOf(name, version);
  await upsertEquipmentSet(db, { name: `T16 ${name}`, slug, bonuses: bonuses.map(([requiredPieces, effects]) => ({ requiredPieces, effects: effects as never })) });
  await link("equipment", slug, `${P}${name.toLowerCase().replace(/\s+/g, "-")}`, `T16 ${name}`, version?.key, version?.label);
};
const SLOTS = ["force", "chakra", "agility", "power"] as const;
const jw = async (name: string, twoPiece: Partial<Record<(typeof SLOTS)[number], object[]>>, eight: object[] = []) => {
  const slug = slugOf(name);
  await upsertJewelrySet(db, {
    name: `T16 ${name}`,
    slug,
    groups: SLOTS.map((k) => ({ key: k, name: k })),
    items: SLOTS.map((k) => ({ name: `T16 ${name} ${k}`, slug: `${slug}-${k}`, typeKey: k, groupKey: k, effects: [] })),
    bonuses: [
      ...SLOTS.filter((k) => twoPiece[k]).map((k) => ({ groupKey: k, requirementKind: "PIECE_COUNT" as const, requiredPieces: 2, requiredItemNames: [], effects: twoPiece[k] as never })),
      ...(eight.length ? [{ groupKey: null, requirementKind: "PIECE_COUNT" as const, requiredPieces: 8, requiredItemNames: [], effects: eight as never }] : []),
    ],
  });
  await link("jewelry", slug, slug, `T16 ${name}`);
};

beforeAll(async () => {
  await seedTestVocabulary(db);
  for (const key of ["self", "ally", "enemy"]) await db.effectTarget.upsert({ where: { key }, update: {}, create: { key, name: key } });
  for (const [key, name, unit] of [["damage-rate", "Damage Rate", "PERCENT"], ["avoid-injury", "Avoid Injury", "PERCENT"]] as const) await db.statistic.upsert({ where: { key }, update: {}, create: { key, name, category: "combat", defaultValueType: unit } });
  for (const [i, k] of SLOTS.entries()) await itemVocabulary.jewelryType(db, { key: k, name: k, sortOrder: i });

  // The client's example, as printed: 2 pieces Damage Rate +30%, 6 pieces Damage Rate +40%, nothing for it at 4 pieces.
  await eq("Deatbone", [[2, [avoid("30"), dr("30")]], [4, [agi("15000"), avoid("40"), def("20")]], [6, [agi("20000"), dr("40"), poison]]]);
  await eq("Deatbone", [[2, [avoid("35"), dr("35")]], [4, [agi("16000"), avoid("45")]], [6, [dr("45")]]], { key: "r1", label: "R1" }); // an upgraded version keeps its own values
  await eq("Solo Six", [[6, [dr("60")]]]);
  await eq("Solo Two", [[2, [dr("75")]]]);
  await eq("Chance", [[2, [dr("10")]], [4, [dr("25", { chancePercent: "50" })]], [6, [words("Increases damage rate by 90% after attacking")]]]); // a chance is not added
  await eq("Mix", [[2, [own("10")]], [4, [weaken("20")]], [6, [weaken("15")]]]); // an own increase and an enemy reduction never meet
  await eq("Plain Text", [[2, [words("Increases damage rate by 80% after attacking")]]]);

  // Jewelry: Agility 20, Force 30, set-wide 25. Slots are never added to each other.
  await jw("Slotted", { agility: [dr("20")], force: [dr("30")], chakra: [avoid("10")] }, [dr("25"), words("After attack heal")]);
  await jw("Slot Only", { agility: [dr("15")] });
  await jw("Eight Only", { power: [avoid("5")] }, [dr("40")]);
}, 300_000);

afterAll(async () => {
  await db.equipment.deleteMany({ where: { set: { slug: { startsWith: P } } } });
  await db.jewelry.deleteMany({ where: { set: { slug: { startsWith: P } } } });
  await db.equipmentSet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.jewelrySet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.gearFamily.deleteMany({ where: { slug: { startsWith: P } } });
  await db.$disconnect();
});

const run = (kind: "equipment" | "jewelry", extra: Parameters<typeof listGearSets>[1] = {}) => listGearSets(db, { kinds: [kind], query: "T16", pageSize: 100, ...extra });
const names = (r: Awaited<ReturnType<typeof run>>) => r.items.map((i) => i.title.replace("T16 ", ""));
const totalOf = (r: Awaited<ReturnType<typeof run>>, title: string) => r.items.find((i) => i.title === `T16 ${title}`)!.rank!.total!;

describe("Deatbone: +30% at 2 pieces and +40% at 6 pieces make +70% with 6 pieces", () => {
  it("shows the total, the breakdown and keeps the printed bonuses apart", async () => {
    const r = await run("equipment", { effectTerms: [DMG], tiers: [6], query: "T16 Deatbone" });
    const base = r.items.find((i) => i.title === "T16 Deatbone")!;
    expect(base.rank!.total).toMatchObject({ value: 70, pieces: 6, unit: "PERCENT" });
    expect(base.rank!.total!.parts.map((p) => [p.pieces, p.value])).toEqual([[2, 30], [6, 40]]); // the 4-piece tier has no Damage Rate and does not matter
    expect(base.rank!.uses.map((u) => [u.pieces, u.value])).toEqual([[6, 40], [2, 30]]); // individual bonuses, as printed
    expect(base.evidence.map((e) => e.pieces).sort()).toEqual([2, 6]);
  });

  it("with fewer pieces the later tiers do not count yet", async () => {
    expect(totalOf(await run("equipment", { effectTerms: [DMG], tiers: [2], query: "T16 Deatbone" }), "Deatbone")).toMatchObject({ value: 30, pieces: 2 });
    expect(totalOf(await run("equipment", { effectTerms: [DMG], tiers: [4], query: "T16 Deatbone" }), "Deatbone")).toMatchObject({ value: 30, pieces: 4 });
    expect(totalOf(await run("equipment", { effectTerms: [DMG], query: "T16 Deatbone" }), "Deatbone")).toMatchObject({ value: 70, pieces: 6 }); // no count chosen: the complete set
  });

  it("several additive bonuses in the same set are each totalled: Avoid injury 30 + 40, Agility 15000 + 20000, Defense 20", async () => {
    const six = { tiers: [6], query: "T16 Deatbone" };
    expect(totalOf(await run("equipment", { effectTerms: [AVOID], ...six }), "Deatbone")).toMatchObject({ value: 70 });
    const agility = totalOf(await run("equipment", { effectTerms: [AGI], ...six }), "Deatbone");
    expect(agility).toMatchObject({ value: 35000, unit: "FLAT" });
    expect(agility.parts.map((p) => p.value)).toEqual([15000, 20000]);
    expect(totalOf(await run("equipment", { effectTerms: ["aumento de defensa"], ...six }), "Deatbone")).toMatchObject({ value: 20 });
  });

  it("a different version keeps separate values: R1 is 35 + 45 = 80, the base stays 70", async () => {
    const r = await run("equipment", { effectTerms: [DMG], tiers: [6], query: "T16 Deatbone", sort: { by: "effect", direction: "desc" } });
    expect(r.items.map((i) => [i.title.replace("T16 ", ""), i.rank!.total!.value])).toEqual([["Deatbone R1", 80], ["Deatbone", 70]]);
    expect(totalOf(r, "Deatbone R1").parts.map((p) => p.value)).toEqual([35, 45]);
  });
});

describe("what is never added", () => {
  it("a conditional effect with a chance is listed as printed and not added (10 stays 10, not 35)", async () => {
    const r = await run("equipment", { effectTerms: [DMG], tiers: [6], query: "T16 Chance" });
    const t = totalOf(r, "Chance");
    expect(t.value).toBe(10);
    expect(t.parts.map((p) => p.pieces)).toEqual([2]);
    expect(r.items[0]!.rank!.uses.map((u) => u.value).sort((a, b) => a - b)).toEqual([10, 25]); // the 25 stays visible as an individual bonus
  });

  it("an increase of the wearer's attack and a reduction of the enemy's attack are separate; reductions add to reductions", async () => {
    const up = totalOf(await run("equipment", { effectTerms: ["aumento de ataque"], tiers: [6], query: "T16 Mix" }), "Mix");
    expect(up).toMatchObject({ value: 10 });
    const down = await run("equipment", { effectTerms: ["reducción de ataque"], tiers: [6], query: "T16 Mix" });
    expect(totalOf(down, "Mix")).toMatchObject({ value: -35 }); // -20 at 4 pieces and -15 at 6 pieces
    expect(totalOf(down, "Mix").parts.map((p) => p.value)).toEqual([-20, -15]);
  });

  it("wording-only effects stay searchable, have no total, and come last", async () => {
    const r = await run("equipment", { effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction: "desc" } });
    const words = r.items.find((i) => i.title === "T16 Plain Text")!;
    expect(words.rank).toMatchObject({ status: "text-only", total: null });
    expect(names(r).at(-1)).toBe("Plain Text");
  });
});

describe("equipment thresholds 2, 4 and 6", () => {
  it("a 2-piece search never matches an effect printed only at 4 or 6 pieces", async () => {
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [2] })).sort()).toEqual(["Chance", "Deatbone", "Deatbone R1", "Plain Text", "Solo Two"]);
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [2] }))).not.toContain("Solo Six");
  });
  it("4 pieces adds the 2-piece tier; 6 pieces adds both; a higher tier never counts", async () => {
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [4] })).sort()).toEqual(["Chance", "Deatbone", "Deatbone R1", "Plain Text", "Solo Two"]);
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [6] })).sort()).toEqual(["Chance", "Deatbone", "Deatbone R1", "Plain Text", "Solo Six", "Solo Two"]);
    expect(totalOf(await run("equipment", { effectTerms: [DMG], tiers: [6] }), "Solo Two")).toMatchObject({ value: 75, pieces: 6 }); // its 2-piece bonus is still active with 6 pieces
  });
});

describe("cumulative sorting", () => {
  it("highest to lowest by the total with the selected pieces; lowest to highest reverses it", async () => {
    // 6 pieces: R1 80, Solo Two 75, Deatbone 70, Solo Six 60, Chance 10; wording last.
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction: "desc" } }))).toEqual(["Deatbone R1", "Solo Two", "Deatbone", "Solo Six", "Chance", "Plain Text"]);
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction: "asc" } }))).toEqual(["Chance", "Solo Six", "Deatbone", "Solo Two", "Deatbone R1", "Plain Text"]);
    // 2 pieces: Solo Two 75 first (nothing else has accumulated yet), then R1 35, Deatbone 30, Chance 10.
    expect(names(await run("equipment", { effectTerms: [DMG], tiers: [2], sort: { by: "effect", direction: "desc" } }))).toEqual(["Solo Two", "Deatbone R1", "Deatbone", "Chance", "Plain Text"]);
  });
  it("Deatbone is ranked by 70, not by its printed 40", async () => {
    const r = await run("equipment", { effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction: "desc" } });
    const d = r.items.find((i) => i.title === "T16 Deatbone")!;
    expect(d.rank!.magnitude).toBe(70);
    // 70 beats Solo Six's printed 60 and loses to Solo Two's 75: with the printed 40 alone it would be last of the numbers.
    expect(names(r).indexOf("Deatbone")).toBeLessThan(names(r).indexOf("Solo Six"));
  });
  it("pages without repeats or gaps, in both directions, with the count intact", async () => {
    for (const direction of ["desc", "asc"] as const) {
      const whole = names(await run("equipment", { effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction } }));
      const seen: string[] = [];
      for (let page = 1; page <= 3; page++) seen.push(...names(await run("equipment", { effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction }, pageSize: 2, page })));
      expect(seen).toEqual(whole);
      expect(new Set(seen).size).toBe(seen.length);
    }
    expect((await run("equipment", { effectTerms: [DMG], tiers: [6], pageSize: 2 })).total).toBe(6);
  });
});

describe("Match All and Match Any with accumulated tiers", () => {
  it("Match All needs every effect among the bonuses up to the selected pieces", async () => {
    // Deatbone prints Damage Rate (2 and 6) and Avoid injury (2 and 4); with 2 pieces both are already there.
    expect(names(await run("equipment", { effectTerms: [DMG, AVOID], effectMode: "all", tiers: [2] })).sort()).toEqual(["Deatbone", "Deatbone R1"]);
    expect(names(await run("equipment", { effectTerms: [DMG, AVOID], effectMode: "all", tiers: [6] })).sort()).toEqual(["Deatbone", "Deatbone R1"]);
    expect(names(await run("equipment", { effectTerms: [DMG, AGI], effectMode: "all", tiers: [2] }))).toEqual([]); // Agility only starts at 4 pieces
    expect(names(await run("equipment", { effectTerms: [DMG, AGI], effectMode: "all", tiers: [4] })).sort()).toEqual(["Deatbone", "Deatbone R1"]);
  });
  it("Match Any lists the sets with either, and the chosen effect controls the order", async () => {
    const any = await run("equipment", { effectTerms: [AGI, DMG], effectMode: "any", tiers: [6], sort: { by: "effect", direction: "desc", effectTerm: DMG } });
    expect(names(any).slice(0, 3)).toEqual(["Deatbone R1", "Solo Two", "Deatbone"]);
  });
  it("the piece count and the sort are read from the address and kept through paging", () => {
    expect(parseGearParams({ fx: DMG, tier: ["6"], sort: "fx:desc", page: "2" })).toMatchObject({ tiers: [6], page: 2, sort: { by: "effect", direction: "desc" } });
  });
});

describe("jewelry: slots, 2 pieces and the complete set", () => {
  it("2 pieces: only the chosen slot's own 2-piece bonus", async () => {
    const r = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [DMG], sort: { by: "effect", direction: "desc" } });
    expect(names(r)).toEqual(["Slotted", "Slot Only"]);
    expect(totalOf(r, "Slotted")).toMatchObject({ value: 20, slot: "agility", pieces: 2 });
    expect(names(await run("jewelry", { slot: "force", tiers: [2], effectTerms: [DMG] }))).toEqual(["Slotted"]);
    expect(names(await run("jewelry", { slot: "chakra", tiers: [2], effectTerms: [DMG] }))).toEqual([]); // Chakra prints Avoid injury, not Damage Rate
  });
  it("the complete set adds the 8-piece bonus to that slot's 2-piece bonus, never another slot's", async () => {
    const r = await run("jewelry", { slot: "agility", tiers: [8], effectTerms: [DMG], sort: { by: "effect", direction: "desc" } });
    expect(names(r)).toEqual(["Slotted", "Eight Only", "Slot Only"]);
    expect(totalOf(r, "Slotted")).toMatchObject({ value: 45, slot: "agility", pieces: 8 }); // 20 + 25, not 20 + 30 + 25
    expect(totalOf(r, "Slotted").parts.map((p) => `${p.pieces}:${p.group ?? "-"}:${p.value}`)).toEqual(["2:agility:20", "8:-:25"]);
    expect(totalOf(r, "Eight Only")).toMatchObject({ value: 40, slot: null }); // only the set-wide bonus, no slot
    expect(totalOf(r, "Slot Only")).toMatchObject({ value: 15, slot: "agility" });
    const force = await run("jewelry", { slot: "force", tiers: [8], effectTerms: [DMG], sort: { by: "effect", direction: "desc" } });
    expect(totalOf(force, "Slotted")).toMatchObject({ value: 55, slot: "force" });
  });
  it("without a slot every slot is its own total and the best one ranks", async () => {
    const r = await run("jewelry", { tiers: [8], effectTerms: [DMG], sort: { by: "effect", direction: "desc" } });
    expect(totalOf(r, "Slotted")).toMatchObject({ value: 55, slot: "force" });
    expect(names(r)).toEqual(["Slotted", "Eight Only", "Slot Only"]);
  });
  it("under a 2-piece result the 8-piece bonus is listed apart with the total for the complete set", async () => {
    const r = await run("jewelry", { slot: "agility", tiers: [2], effectTerms: [DMG], sort: { by: "effect", direction: "desc" } });
    const slotted = r.items.find((i) => i.title === "T16 Slotted")!;
    expect(slotted.fullSet!.comparison).toMatchObject({ status: "stronger", matching: { value: 20, pieces: 2 }, fullSet: { value: 45, pieces: 8, slot: "agility" } });
    expect([...slotted.fullSet!.effects].sort()).toEqual(["After attack heal", "Damage Rate +25%"]); // as printed, wording included
    expect(r.items.find((i) => i.title === "T16 Slot Only")!.fullSet).toBeNull();
  });
});

describe("the detail page agrees with the result cards", () => {
  it("equipment: the totals per threshold equal the ranked totals", async () => {
    const detail = (await getEquipmentSet(db, slugOf("Deatbone")))!;
    const totals = setTotals(detail.tiers.map((t) => ({ requiredPieces: t.requiredPieces, effects: t.effects })));
    expect(totals.thresholds.map((t) => t.pieces)).toEqual([2, 4, 6]);
    const at = (pieces: number, key: string) => totals.thresholds.find((t) => t.pieces === pieces)!.totals.find((x) => x.key === key);
    expect(at(6, DR)).toMatchObject({ value: 70 });
    expect(at(6, DR)!.label.toLowerCase()).toBe("damage rate");
    expect(at(6, DR)!.parts.map((p) => [p.pieces, p.value])).toEqual([[2, 30], [6, 40]]);
    expect(at(4, DR)!.value).toBe(30);
    expect(at(6, "stat:agility|FLAT|self|+")!.value).toBe(35000);
    expect(at(6, "stat:avoid-injury|PERCENT|self|+")!.value).toBe(70);
    expect(totals.nonAdditive).toBe(1); // the poison wording is shown as printed, not added
    for (const pieces of [2, 4, 6]) {
      const card = totalOf(await run("equipment", { effectTerms: [DMG], tiers: [pieces], query: "T16 Deatbone" }), "Deatbone");
      expect(at(pieces, DR)!.value, `at ${pieces}`).toBe(card.value);
    }
  });
  it("jewelry: the totals per threshold and slot equal the ranked totals", async () => {
    const detail = (await getJewelrySet(db, slugOf("Slotted")))!;
    const totals = setTotals(detail.bonuses.map((b) => ({ requiredPieces: b.requiredPieces, groupKey: b.groupKey, effects: b.effects })));
    const eight = totals.thresholds.find((t) => t.pieces === 8)!.totals.filter((x) => x.key === DR);
    expect(eight.map((x) => [x.slot, x.value])).toEqual([[null, 25], ["agility", 45], ["force", 55]]); // [no slot] = the set-wide 8-piece bonus alone, for a slot that has no Damage Rate of its own
    const two = totals.thresholds.find((t) => t.pieces === 2)!.totals.filter((x) => x.key === DR);
    expect(two.map((x) => [x.slot, x.value])).toEqual([["agility", 20], ["force", 30]]);
  });
});

describe("no statement that stacking is unconfirmed remains", () => {
  it("the interface text says the bonuses add up", () => {
    const es = readFileSync(path.resolve(__dirname, "../src/i18n/es.ts"), "utf8");
    expect(es).not.toMatch(/stackingUnknown/);
    expect(es).not.toMatch(/no está confirmado si los niveles/i);
    expect(es).not.toMatch(/no se suman niveles/i);
    expect(es).not.toMatch(/porque no está confirmado si se acumulan/i);
    expect(es).toContain('total: "Total acumulado"');
    expect(es).toContain('individual: "Bonos individuales"');
    expect(es).toContain('breakdown: "Desglose por piezas"');
  });
});

// ───────────────────────── the real imported catalogue ─────────────────────────

describe.skipIf(IS_PG || !existsSync(path.resolve(__dirname, "../prisma/dev.db")))("real imported catalogue: Deatbone and the whole list", () => {
  const real = new PrismaClient({ datasourceUrl: `file:${path.resolve(__dirname, "../prisma/dev.db").split(path.sep).join("/")}` });
  afterAll(() => real.$disconnect());
  const have = async () => (await real.gearFamily.count()) > 0;

  it("Deatbone with 6 pieces: Damage Rate +30% (2) and +40% (6) make +70%", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const six = await listGearSets(real, { kinds: ["equipment"], query: "deatbone", effectTerms: [DMG], tiers: [6], sort: { by: "effect", direction: "desc" } });
    const d = six.items.find((i) => i.slug === "deatbone")!;
    expect(d.rank!.total).toMatchObject({ value: 70, pieces: 6, unit: "PERCENT" });
    expect(d.rank!.total!.parts.map((p) => [p.pieces, p.value])).toEqual([[2, 30], [6, 40]]);
    expect(d.rank!.magnitude).toBe(70);
    const two = await listGearSets(real, { kinds: ["equipment"], query: "deatbone", effectTerms: [DMG], tiers: [2] });
    expect(two.items.find((i) => i.slug === "deatbone")!.rank!.total).toMatchObject({ value: 30, pieces: 2 });
    const four = await listGearSets(real, { kinds: ["equipment"], query: "deatbone", effectTerms: [DMG], tiers: [4] });
    expect(four.items.find((i) => i.slug === "deatbone")!.rank!.total!.value).toBe(30);
  });

  it("the whole equipment list with 6 pieces equals the sum of the stored Damage Rate bonuses of tiers 2, 4 and 6", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const rows = await real.effect.findMany({
      where: { kind: "STAT", statistic: { key: "damage-rate" }, valueType: "PERCENT", structuredStatus: "STRUCTURED", value: { gt: 0 }, target: { key: "self" }, equipmentSetBonus: { requiredPieces: { lte: 6 }, set: { familyId: { not: null } } } },
      select: { value: true, chancePercent: true, durationTurns: true, triggerText: true, conditionText: true, equipmentSetBonus: { select: { setId: true } } },
    });
    const oracle = new Map<string, number>();
    for (const r of rows) oracle.set(r.equipmentSetBonus!.setId, (oracle.get(r.equipmentSetBonus!.setId) ?? 0) + Number(r.value!.toString()));
    const list = await listGearSets(real, { kinds: ["equipment"], tiers: [6], effectTerms: [DMG], sort: { by: "effect", direction: "desc" }, pageSize: 100 });
    const ranked = list.items.filter((i) => i.rank!.status === "ranked");
    expect(ranked.map((i) => i.id).sort()).toEqual([...oracle.keys()].sort());
    for (const i of ranked) expect(i.rank!.total!.value, i.title).toBeCloseTo(oracle.get(i.id)!, 6);
    const values = ranked.map((i) => i.rank!.total!.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(values[0]).toBe(Math.max(...oracle.values()));
    // 2 pieces: nothing accumulated yet, so only the 2-piece bonuses; no set that has Damage Rate only at 4 or 6 pieces appears.
    const twoRows = await real.equipmentSetBonus.findMany({ where: { requiredPieces: 2, set: { familyId: { not: null } }, effects: { some: { statistic: { key: "damage-rate" }, kind: "STAT" } } }, select: { setId: true } });
    const two = await listGearSets(real, { kinds: ["equipment"], tiers: [2], effectTerms: [DMG], pageSize: 100 });
    expect(two.items.filter((i) => i.rank!.status === "ranked").map((i) => i.id).sort()).toEqual([...new Set(twoRows.map((r) => r.setId))].sort());
  });

  it("every equipment detail page and the result card give the same totals", { timeout: 300_000 }, async () => {
    if (!(await have())) return;
    const list = await listGearSets(real, { kinds: ["equipment"], effectTerms: [DMG], sort: { by: "effect", direction: "desc" }, pageSize: 100 });
    expect(list.items.length).toBeGreaterThan(20);
    for (const i of list.items.filter((x) => x.rank!.status === "ranked")) {
      const detail = (await getEquipmentSet(real, i.slug))!;
      const totals = setTotals(detail.tiers.map((t) => ({ requiredPieces: t.requiredPieces, effects: t.effects })));
      const top = totals.thresholds.at(-1)!;
      const shown = top.totals.filter((x) => x.key === DR);
      expect(shown.length, i.title).toBeGreaterThan(0);
      expect(Math.max(...shown.map((x) => Math.abs(x.value))), i.title).toBeCloseTo(i.rank!.magnitude!, 6);
    }
  });

  it("jewelry with the complete set: slot 2-piece bonus plus the 8-piece bonus equals the stored values", { timeout: 180_000 }, async () => {
    if (!(await have())) return;
    const rows = await real.jewelrySetBonus.findMany({
      where: { set: { familyId: { not: null } }, OR: [{ requiredPieces: 8, groupId: null }, { requiredPieces: 2, group: { key: "agility" } }] },
      select: { setId: true, requiredPieces: true, effects: { where: { kind: "STAT", statistic: { key: "damage-rate" }, valueType: "PERCENT", value: { gt: 0 }, structuredStatus: "STRUCTURED", target: { key: "self" } }, select: { value: true } } },
    });
    const oracle = new Map<string, number>();
    for (const b of rows) for (const e of b.effects) oracle.set(b.setId, (oracle.get(b.setId) ?? 0) + Number(e.value!.toString()));
    const list = await listGearSets(real, { kinds: ["jewelry"], slot: "agility", tiers: [8], effectTerms: [DMG], sort: { by: "effect", direction: "desc" }, pageSize: 100 });
    for (const i of list.items.filter((x) => x.rank!.status === "ranked")) {
      expect(i.rank!.total!.value, i.title).toBeCloseTo(oracle.get(i.id)!, 6);
      expect(["agility", null]).toContain(i.rank!.total!.slot);
    }
  });
});
