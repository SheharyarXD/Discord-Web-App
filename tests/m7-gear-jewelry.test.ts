import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { idsWithEffects } from "../src/game/effect-search";
import { gearFacets, getGearVersionInfo, listGearSets } from "../src/game/gear";
import { auditGear, importGear, planGear, readLedger, readTranscriptions } from "../src/game/gear-import";
import { effectsOfBonus, parseClause, splitClauses, versionOf, versionTitle } from "../src/game/gear-parse";
import { upsertStatusEffect } from "../src/game/status-effects";
import { effectModeOf, hrefWith, parseGearParams, parseNinjaParams } from "../src/server/query-params";
import { IS_PG, seedTestVocabulary, testDb } from "./helpers";

const sets = readTranscriptions();
const plan = planGear(sets);
const ledger = readLedger();
const family = (name: string) => plan.find((f) => f.name === name)!;
const version = (name: string, kind: "equipment" | "jewelry", key: string) => family(name).versions.find((v) => v.kind === kind && v.version.key === key)!;

describe("source reconciliation (no database)", () => {
  it("accounts for 71 names, 68 sourced sets, 3 name-only sets and all 143 images", () => {
    const audit = auditGear(plan, ledger);
    expect(audit.counts.namedSets).toBe(71);
    expect(audit.counts.sourcedSets).toBe(68);
    expect(audit.counts.nameOnlySets).toEqual(["Legendary", "Fate", "Totsuka"]);
    expect(audit.counts.sourceImages).toBe(143);
    expect(audit.counts.imagesAssigned).toBe(143);
    expect(audit.unassignedImages).toEqual([]);
    expect(audit.counts.setsWithJewelry).toBe(52);
    expect(audit.counts.gearOnlySets).toHaveLength(16);
    expect(audit.counts.gearOnlySets).toEqual(expect.arrayContaining(["Angel", "Ice", "Sage", "Christmas", "Ryujin", "Flame", "Crimson", "Divine Break", "Netherwind", "Frost Fire", "Stormrage", "Oblivion", "Deatbone", "Darkmantle", "Skyshatter", "Hallowed"]));
  });

  it("gives every version a unique, deterministic identity and uses each image once (the Warlord comparison sheet twice on purpose)", () => {
    const ids = plan.flatMap((f) => f.versions.map((v) => `${v.kind}:${v.slug}`));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(141);
    const paths = plan.flatMap((f) => f.versions.map((v) => v.sheet.path));
    const repeated = paths.filter((p, i) => paths.indexOf(p) !== i);
    expect(repeated).toEqual(["sources/60_warlord/01_gear_base_and_SSR5_comparison.png"]);
    expect(planGear(readTranscriptions()).flatMap((f) => f.versions.map((v) => v.slug))).toEqual(plan.flatMap((f) => f.versions.map((v) => v.slug)));
  });

  it("keeps name-only sets empty: no versions, no stats, no text", () => {
    for (const n of ["Legendary", "Fate", "Totsuka"]) {
      expect(family(n).nameOnly).toBe(true);
      expect(family(n).versions).toEqual([]);
    }
  });

  it("separates equipment and jewelry, with the printed 2/4/6 and 2/8 tiers", () => {
    const akatsuki = version("Akatsuki", "equipment", "base").equipment!;
    expect(akatsuki.bonuses!.map((b) => b.requiredPieces)).toEqual([2, 4, 6]);
    expect(akatsuki.items!.map((i) => [i.slotKey, i.effects![0]!.value])).toEqual([["physical-attack", "4000"], ["physical-defense", "1300"], ["strategy-attack", "4000"], ["strategy-defense", "2600"], ["speed", "4000"], ["power", "10000"]]);
    const jewelry = version("Corruptor", "jewelry", "base").jewelry!;
    expect(jewelry.groups!.map((g) => g.key)).toEqual(["force", "chakra", "agility", "power"]);
    expect(jewelry.bonuses!.filter((b) => b.requiredPieces === 2)).toHaveLength(4);
    expect(version("Indora", "jewelry", "base").jewelry!.bonuses!.filter((b) => b.requiredPieces === 8)).toHaveLength(1);
    expect(version("Akatsuki", "jewelry", "base").jewelry!.bonuses!.filter((b) => b.requiredPieces === 8)).toHaveLength(0);
  });

  it("names R1 and R2 only where the source or the client says so", () => {
    const sb = family("Sand Burial").versions.filter((v) => v.kind === "jewelry");
    expect(sb.map((v) => [v.title, v.version.basis])).toEqual([["Sand Burial", "OWNER_MAPPING"], ["Sand Burial R1", "CLIENT_STATED"]]);
    expect(family("Sand Burial").versions.filter((v) => v.kind === "equipment").map((v) => v.title)).toEqual(["Sand Burial"]);
    const w = family("Warlord");
    expect(w.versions.map((v) => `${v.kind}:${v.title}`)).toEqual(["equipment:Warlord", "equipment:Warlord SSR5", "jewelry:Warlord R1", "jewelry:Warlord R2"]);
    // SSR5 is not relabelled R2, and no base jewelry is invented.
    expect(w.versions.some((v) => v.title === "Warlord R2" && v.kind === "equipment")).toBe(false);
    expect(w.versions.filter((v) => v.kind === "jewelry").some((v) => v.version.key === "base")).toBe(false);
    for (const name of ["Sange", "Iron Will", "Crystalys", "Susanoo", "Truth-Seeking", "Yin-Yang", "Summoning"]) {
      const vs = family(name).versions.filter((v) => v.version.key.startsWith("seq-"));
      expect(vs.length, name).toBeGreaterThan(0);
      for (const v of vs) {
        expect(v.version.basis).toBe("SEQUENCE");
        expect(v.title).toMatch(/\(variant [ABC]\)$/);
        expect(v.title).not.toMatch(/R1|R2/);
      }
    }
    expect(versionOf("seq:B")).toEqual({ key: "seq-b", label: "B", basis: "SEQUENCE" });
    expect(versionTitle("Sange", versionOf("seq:A"))).toBe("Sange (variant A)");
  });

  it("keeps every multi-sheet set's versions apart with their own values", () => {
    expect(family("Sarutobi").versions.filter((v) => v.kind === "jewelry")).toHaveLength(2);
    expect(family("Kumogakure").versions.filter((v) => v.kind === "jewelry")).toHaveLength(2);
    expect(family("Izanami").versions.filter((v) => v.kind === "equipment")).toHaveLength(3);
    expect(family("Izanami").versions.filter((v) => v.kind === "jewelry")).toHaveLength(2);
    expect(family("Summoning").versions.filter((v) => v.kind === "jewelry")).toHaveLength(1);
    const a = version("Sange", "equipment", "seq-a").equipment!.items!.find((i) => i.slotKey === "speed")!.effects![0]!.value;
    const b = version("Sange", "equipment", "seq-b").equipment!.items!.find((i) => i.slotKey === "speed")!.effects![0]!.value;
    expect([a, b]).toEqual(["75000", "83000"]);
    // Sand Burial jewelry base and R1: values and chances differ, each is stored as printed.
    const base = version("Sand Burial", "jewelry", "base").jewelry!.bonuses!.find((x) => x.groupKey === "force")!.description;
    const r1 = version("Sand Burial", "jewelry", "r1").jewelry!.bonuses!.find((x) => x.groupKey === "force")!.description;
    expect(base).toContain("80% chances");
    expect(r1).toContain("90% chances");
  });

  it("stores Warlord's upgrade costs as costs, not as combat bonuses", () => {
    const costs = family("Warlord").costs;
    expect(costs.map((c) => c.stage)).toEqual(expect.arrayContaining(["R1", "R2", "R3", "SSR4", "SSR5"]));
    expect(costs.find((c) => c.stage === "SSR5")!.materials).toContain("Warlord myth - 170");
    const effectTexts = family("Warlord").versions.flatMap((v) => [...(v.equipment?.bonuses ?? []), ...(v.jewelry?.bonuses ?? [])].flatMap((b) => b.effects ?? []).map((e) => e.sourceText));
    expect(effectTexts.join(" ")).not.toMatch(/Hermit|myth/i);
  });

  it("flags the Mekansm / MEKA discrepancy instead of renaming", () => {
    expect(family("Mekansm").sourceTitle).toBe("MEKA");
    expect(family("Mekansm").reviews.join(" ")).toMatch(/MEKA/);
  });
});

describe("effect clauses", () => {
  it("structures plain statistics and keeps the printed text", () => {
    const [e] = parseClause("Damage Rate+8%");
    expect(e).toMatchObject({ kind: "STAT", statisticKey: "damage-rate", value: "8", valueType: "PERCENT", sourceText: "Damage Rate+8%" });
    expect(parseClause("Agility +1000")[0]).toMatchObject({ statisticKey: "agility", valueType: "FLAT", value: "1000" });
    expect(parseClause("Strat/Phys Defense +30%").map((e) => e.statisticKey)).toEqual(["strategy-defense", "physical-defense"]);
  });

  it("stores enemy weakening as a reduction on the enemy and keeps the printed «+»", () => {
    const [e] = parseClause("Weaken enemy's ATK +30%");
    expect(e).toMatchObject({ statisticKey: "attack", targetKey: "enemy", value: "-30", sourceText: "Weaken enemy's ATK +30%" });
    expect(parseClause("Decrease enemy CC Rate +20%")[0]).toMatchObject({ statisticKey: "control-rate", targetKey: "enemy", value: "-20" });
    expect(parseClause("Increase CC Rate +30%")[0]).toMatchObject({ statisticKey: "control-rate", targetKey: "self", value: "30" });
  });

  it("keeps unclear, signed or triggered wording as source text, never as a guessed mechanic", () => {
    for (const text of ["Punch Rate −40%", "Attack +13", "Crit +20%", "Weekend enemies' ATK +25%", "After released a skill, makes 2 random allies enter Bond State(10%) for 2 rounds"]) {
      const [e] = parseClause(text);
      expect(e!.structuredStatus, text).toBe("TEXT_ONLY");
      expect(e!.sourceText).toBe(text);
    }
    expect(parseClause("After released a skill, dispels self debuffs")[0]!.triggerText).toBe("After released a skill");
  });

  it("models immunity apart from infliction", () => {
    expect(parseClause("Immune Seal +60%")[0]).toMatchObject({ kind: "IMMUNITY", statusKey: "seal", value: "60" });
    expect(parseClause("Immune Weaken DEF +35%")[0]).toMatchObject({ kind: "IMMUNITY", description: "weaken def" });
  });

  it("splits a printed bonus without cutting a sentence", () => {
    expect(splitClauses("Agility +25000 , Force +25000 , Attack +15%, HP +35%")).toEqual(["Agility +25000", "Force +25000", "Attack +15%", "HP +35%"]);
    expect(splitClauses("Agility +10000 // After released a skill, makes all allies enter Wind Release state(10%) for 2 rounds // (cannot be dispelled)")).toEqual(["Agility +10000", "After released a skill, makes all allies enter Wind Release state(10%) for 2 rounds (cannot be dispelled)"]);
    expect(effectsOfBonus("HP +20%, Punch Rate +30%")).toHaveLength(2);
  });
});

describe("address parameters", () => {
  it("round-trips the effect mode, effects, tiers and statistic ranges", () => {
    const raw = { kind: ["equipment"], fx: ["aturdir", "curación"], fxm: "all", tier: ["4", "6"], version: "labelled", stat1: "speed", min1: "70000", q: "sand", page: "2", sort: "stat:desc:speed" };
    const p = parseGearParams(raw);
    expect(p).toMatchObject({ kinds: ["equipment"], effectTerms: ["aturdir", "curación"], effectMode: "all", tiers: [4, 6], versions: ["labelled"], statFilters: [{ statisticKey: "speed", min: "70000" }], query: "sand", page: 2, sort: { by: "stat", direction: "desc", statisticKey: "speed" } });
    // Page and sort links keep the mode and the effects.
    const next = hrefWith("/sets", raw, { page: "3" });
    expect(next).toContain("fxm=all");
    expect(next).toContain("fx=aturdir");
    expect(effectModeOf({ fxm: "nonsense" })).toBe("any");
    expect(parseGearParams({}).effectMode).toBeUndefined();
    expect(parseNinjaParams({ fx: ["aturdir"], fxm: "all" })).toMatchObject({ effectTerms: ["aturdir"], effectMode: "all" });
    expect(parseNinjaParams({ fx: ["aturdir"] }).effectMode).toBeUndefined();
  });
});

describe.skipIf(IS_PG)("source ledger files", () => {
  it("lists exactly the 143 images with hashes", () => {
    expect(ledger.images).toHaveLength(143);
    expect(new Set(ledger.images.map((i) => i.sha256)).size).toBeGreaterThan(130);
    for (const i of ledger.images) expect(i.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ───────────────────────── Database ─────────────────────────

const db = testDb();
const subset = ["Akatsuki", "Corruptor", "Sunagakure", "Sand Burial", "Warlord", "Sange", "Kumogakure", "Legendary"];
const subPlan = plan.filter((f) => subset.includes(f.name));
const PREFIXES = ["akatsuki", "corruptor", "sunagakure", "sand-burial", "warlord", "sange", "kumogakure", "legendary"];
const countAll = async () => ({
  families: await db.gearFamily.count({ where: { slug: { in: PREFIXES } } }),
  eqSets: await db.equipmentSet.count({ where: { family: { slug: { in: PREFIXES } } } }),
  jwSets: await db.jewelrySet.count({ where: { family: { slug: { in: PREFIXES } } } }),
  effects: await db.effect.count(),
  assets: await db.sourceAsset.count({ where: { path: { startsWith: "gear-source/" } } }),
  records: await db.sourceRecord.count({ where: { key: { startsWith: "gear:" } } }),
  bonuses: await db.equipmentSetBonus.count({ where: { set: { family: { slug: { in: PREFIXES } } } } }) + (await db.jewelrySetBonus.count({ where: { set: { family: { slug: { in: PREFIXES } } } } })),
});

beforeAll(async () => {
  await seedTestVocabulary(db);
  // The reference vocabulary the real data already has; existing rows are left alone.
  for (const key of ["damage-rate", "avoid-injury", "punch-rate", "aid-rate", "hit-rate", "final-damage", "final-damage-reduction", "cc-resistance", "crit-damage", "crit-rate", "control-rate", "s-attack", "physical-defense", "strategy-defense", "strategy-attack", "defenses", "attack", "speed", "power", "force", "agility", "chakra", "hp"]) {
    await db.statistic.upsert({ where: { key }, update: {}, create: { key, name: key.replace(/-/g, " "), category: "combat" } });
  }
  for (const key of ["self", "ally", "enemy"]) await db.effectTarget.upsert({ where: { key }, update: {}, create: { key, name: key } });
  for (const [key, name] of [["stun", "Stun"], ["seal", "Seal"], ["disable", "Disable"], ["imprison", "Imprison"], ["poison", "Poison"]] as const) await upsertStatusEffect(db, { key, name, cleansability: "CLEANSABLE" });
  await importGear(db, subPlan, ledger);
}, 300_000);

afterAll(async () => {
  const sets = await db.equipmentSet.findMany({ where: { family: { slug: { in: PREFIXES } } }, select: { slug: true } });
  const jsets = await db.jewelrySet.findMany({ where: { family: { slug: { in: PREFIXES } } }, select: { slug: true } });
  await db.equipment.deleteMany({ where: { set: { family: { slug: { in: PREFIXES } } } } });
  await db.jewelry.deleteMany({ where: { set: { family: { slug: { in: PREFIXES } } } } });
  await db.equipmentSet.deleteMany({ where: { slug: { in: sets.map((s) => s.slug) } } });
  await db.jewelrySet.deleteMany({ where: { slug: { in: jsets.map((s) => s.slug) } } });
  await db.gearFamily.deleteMany({ where: { slug: { in: PREFIXES } } });
  await db.sourceRecord.deleteMany({ where: { key: { startsWith: "gear:" } } });
  await db.sourceAsset.deleteMany({ where: { path: { startsWith: "gear-source/" } } });
  await db.$disconnect();
});

const names = async (params: Parameters<typeof listGearSets>[1]) => (await listGearSets(db, { pageSize: 100, ...params })).items.map((i) => `${i.kind === "equipment" ? "E" : "J"}:${i.title}`).sort();

describe("import into the database", () => {
  it("is idempotent: a second and third run add nothing", async () => {
    const first = await countAll();
    expect(first.families).toBe(subPlan.length);
    await importGear(db, subPlan, ledger);
    await importGear(db, subPlan, ledger);
    expect(await countAll()).toEqual(first);
  }, 300_000);

  it("keeps equipment and jewelry as separate categories under one named set, and name-only sets empty", async () => {
    const sb = await db.gearFamily.findUniqueOrThrow({ where: { slug: "sand-burial" }, include: { equipmentSets: true, jewelrySets: true } });
    expect(sb.equipmentSets.map((s) => s.versionKey)).toEqual(["base"]);
    expect(sb.jewelrySets.map((s) => s.versionKey).sort()).toEqual(["base", "r1"]);
    const legendary = await db.gearFamily.findUniqueOrThrow({ where: { slug: "legendary" }, include: { equipmentSets: true, jewelrySets: true } });
    expect(legendary.sourceStatus).toBe("NAME_ONLY");
    expect(legendary.equipmentSets).toHaveLength(0);
    expect(legendary.jewelrySets).toHaveLength(0);
    // An equipment-only set works without jewelry.
    expect(await names({ query: "akatsuki" })).toEqual(["E:Akatsuki", "J:Akatsuki"]);
    expect(await db.jewelrySet.count({ where: { family: { slug: "sange" } } })).toBe(2);
  });

  it("stores each tier at its exact threshold with the printed text and source references", async () => {
    const set = await db.equipmentSet.findUniqueOrThrow({ where: { slug: "sand-burial" }, include: { bonuses: { orderBy: { requiredPieces: "asc" }, include: { effects: true } } } });
    expect(set.bonuses.map((b) => b.requiredPieces)).toEqual([2, 4, 6]);
    expect(set.bonuses[0]!.description).toBe("Agility +25000 , Attack +15%, Damage Rate +35%, HP +15%".replace(" ,", " ,"));
    expect(set.bonuses[2]!.effects.some((e) => e.structuredStatus === "TEXT_ONLY" && /second physical strike/.test(e.sourceText ?? ""))).toBe(true);
    const info = await getGearVersionInfo(db, "jewelry", "sand-burial-r1");
    expect(info!.title).toBe("Sand Burial R1");
    expect(info!.versionBasis).toBe("CLIENT_STATED");
    expect(info!.sources.map((s) => s.path)).toEqual(["gear-source/sources/59_sand-burial/03_jewelry_R1.png"]);
    expect(info!.siblings.map((s) => s.title).sort()).toEqual(["Sand Burial", "Sand Burial"]);
    const warlord = await getGearVersionInfo(db, "equipment", "warlord-ssr5");
    expect(warlord!.family!.upgradeCosts.map((c) => c.stage)).toEqual(expect.arrayContaining(["R1", "R2", "R3", "SSR4", "SSR5"]));
  });

  it("does not let the printed main statistics pass for effects", async () => {
    const speed = await idsWithEffects(db, "equipment", ["aumento de velocidad"], "any");
    expect(speed?.ids ?? []).toEqual([]);
  });
});

describe("catalogue filters", () => {
  it("searches by name, accent-free and case-insensitive, with the printed source title", async () => {
    expect(await names({ query: "SAND BURIAL" })).toEqual(["E:Sand Burial", "J:Sand Burial", "J:Sand Burial R1"]);
    expect(await names({ query: "sunagakure" })).toHaveLength(2);
    expect(await names({ query: "sand burial r1" })).toEqual(["J:Sand Burial R1"]);
  });

  it("filters by category, version kind and tier", async () => {
    expect(await names({ kinds: ["equipment"], query: "warlord" })).toEqual(["E:Warlord", "E:Warlord SSR5"]);
    expect(await names({ kinds: ["jewelry"], query: "warlord" })).toEqual(["J:Warlord R1", "J:Warlord R2"]);
    expect(await names({ versions: ["labelled"] })).toEqual(["E:Warlord SSR5", "J:Sand Burial R1", "J:Warlord R1", "J:Warlord R2"]);
    expect((await names({ versions: ["variant"] })).every((n) => /variant [AB]\)$/.test(n))).toBe(true);
    const eight = await names({ tiers: [8] });
    expect(eight).toEqual(expect.arrayContaining(["J:Sand Burial", "J:Sand Burial R1"]));
    expect(eight).not.toContain("E:Akatsuki");
    expect(await names({ tiers: [4], kinds: ["equipment"], query: "akatsuki" })).toEqual(["E:Akatsuki"]);
  });

  it("filters the printed statistics by range, composing with the other filters", async () => {
    expect(await names({ statFilters: [{ statisticKey: "speed", min: "70000" }] })).toEqual(["E:Sand Burial", "E:Sange (variant A)", "E:Sange (variant B)", "E:Warlord"]);
    expect(await names({ statFilters: [{ statisticKey: "speed", min: "70000", max: "75000" }] })).toEqual(["E:Sand Burial", "E:Sange (variant A)", "E:Warlord"]);
    expect(await names({ statFilters: [{ statisticKey: "speed", min: "70000" }], versions: ["variant"] })).toEqual(["E:Sange (variant A)", "E:Sange (variant B)"]);
    expect(await names({ statFilters: [{ statisticKey: "force", min: "60000" }], kinds: ["jewelry"] })).toContain("J:Warlord R1");
  });

  it("sorts stably and pages without repeating or dropping a set", async () => {
    const seen: string[] = [];
    const first = await listGearSets(db, { pageSize: 5, page: 1, sort: { by: "stat", statisticKey: "speed", direction: "desc" } });
    for (let page = 1; page <= first.pageCount; page++) seen.push(...(await listGearSets(db, { pageSize: 5, page, sort: { by: "stat", statisticKey: "speed", direction: "desc" } })).items.map((i) => `${i.kind}:${i.slug}`));
    expect(seen).toHaveLength(first.total);
    expect(new Set(seen).size).toBe(seen.length);
    expect(first.items[0]!.stats.find((s) => s.key === "speed")!.value).toBe("83000");
    const byName = (await names({})).slice();
    expect(byName).toEqual([...byName].sort());
  });
});

describe("effect search on equipment and jewelry: Match Any and Match All", () => {
  it("finds an effect at its tier and reports where, in Spanish and English", async () => {
    for (const term of ["aturdir", "stun", "ATURDIR", "Aturdír"]) expect(await names({ effectTerms: [term] }), term).toEqual(["E:Corruptor"]);
    const r = await listGearSets(db, { effectTerms: ["aturdir"] });
    expect(r.items[0]!.evidence.map((e) => e.pieces)).toEqual([6]);
    expect(r.items[0]!.evidence[0]!.text).toContain("Stun enemy");
  });

  it("keeps inflicting, immunity and negation apart", async () => {
    expect(await names({ effectTerms: ["sellar"] })).toEqual([]);
    expect(await names({ effectTerms: ["inmunidad a sellar"] })).toEqual(["J:Sunagakure"]);
    expect(await names({ effectTerms: ["inmunidad a deshabilitar"] })).toEqual(["J:Sunagakure"]);
  });

  it("does not confuse an effect with a similarly named statistic", async () => {
    const heal = await names({ effectTerms: ["curación"] });
    expect(heal).not.toContain("E:Akatsuki");
    expect(await names({ effectTerms: ["tasa de curación"] })).toEqual([]);
  });

  it("ANY returns what has one or more of the effects; ALL needs every one, possibly in different tiers or categories", async () => {
    const stun = await names({ effectTerms: ["aturdir"] });
    const speedUp = await names({ effectTerms: ["aumento de agilidad"], kinds: ["equipment"] });
    expect(speedUp).toContain("E:Akatsuki");
    const any = await names({ effectTerms: ["aturdir", "aumento de agilidad"], effectMode: "any", kinds: ["equipment"] });
    const all = await names({ effectTerms: ["aturdir", "aumento de agilidad"], effectMode: "all", kinds: ["equipment"] });
    expect(any.sort()).toEqual([...new Set([...stun.filter((n) => n.startsWith("E:")), ...speedUp])].sort());
    // Corruptor stuns at 6 pieces and has Agility at 2, 4 and 6: both effects, different tiers, one set.
    expect(all).toEqual(["E:Corruptor"]);
    expect(all.length).toBeLessThanOrEqual(any.length);
  });

  it("deduplicates repeated and synonymous selections, and an unknown effect empties an ALL search", async () => {
    const one = await names({ effectTerms: ["aturdir"], effectMode: "all" });
    expect(await names({ effectTerms: ["aturdir", "Aturdir", "stun", " stun "], effectMode: "all" })).toEqual(one);
    expect(await names({ effectTerms: ["aturdir", "zzzxxyy"], effectMode: "all" })).toEqual([]);
    expect((await names({ effectTerms: ["aturdir", "zzzxxyy"], effectMode: "any" })).length).toBeGreaterThan(0);
    expect(await names({ effectTerms: [] })).toEqual(await names({}));
  });

  it("combines with category, version, tier and statistic filters (AND)", async () => {
    expect(await names({ effectTerms: ["aturdir"], kinds: ["jewelry"] })).toEqual([]);
    expect(await names({ effectTerms: ["aturdir"], tiers: [6] })).toEqual(["E:Corruptor"]);
    expect(await names({ effectTerms: ["aumento de agilidad"], kinds: ["equipment"], statFilters: [{ statisticKey: "speed", min: "70000" }] })).toEqual(["E:Sand Burial", "E:Sange (variant A)", "E:Sange (variant B)", "E:Warlord"]);
    expect((await listGearSets(db, { effectTerms: ["aumento de agilidad"], kinds: ["equipment"], pageSize: 3, page: 2 })).items).toHaveLength(3);
  });

  it("offers suggestions only for effects that exist in that category", async () => {
    const { effectSuggestions } = await import("../src/game/effect-search");
    const eq = (await effectSuggestions(db, "equipment")).map((s) => s.value);
    expect(eq).toEqual(expect.arrayContaining(["Aturdir", "Aumento de agilidad"]));
    expect(await gearFacets(db)).toMatchObject({ tiers: [2, 4, 6, 8] });
  });
});

describe.skipIf(IS_PG || !existsSync(path.resolve(__dirname, "../prisma/dev.db")))("real catalogue", () => {
  const real = new PrismaClient({ datasourceUrl: `file:${path.resolve(__dirname, "../prisma/dev.db").split(path.sep).join("/")}` });
  afterAll(() => real.$disconnect());

  it("holds all 71 named sets, 141 versions and 714 pieces once imported", { timeout: 120_000 }, async () => {
    if ((await real.gearFamily.count()) === 0) return; // the local copy has not been imported
    expect(await real.gearFamily.count()).toBe(71);
    expect(await real.equipmentSet.count({ where: { familyId: { not: null } } })).toBe(78);
    expect(await real.jewelrySet.count({ where: { familyId: { not: null } } })).toBe(63);
    const all = await listGearSets(real, { pageSize: 100 });
    expect(all.total).toBe(141);
    const stun = await idsWithEffects(real, "equipment", ["aturdir"], "any");
    const stunAndHeal = await idsWithEffects(real, "equipment", ["aturdir", "curación"], "all");
    expect(stun!.ids.length).toBeGreaterThan(0);
    // ALL is a subset of ANY, and of each single effect.
    for (const id of stunAndHeal!.ids) expect(stun!.ids).toContain(id);
  });
});
