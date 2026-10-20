import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gameApi } from "../src/game/api";
import { deletions, getItemDetail, listItemFacets, listItems, listNinjaFacets, saveEquipment, saveGem, saveJewelry, searchAll } from "../src/game/catalog";
import { ValidationError } from "../src/game/db";
import { getNinjaDetail, listNinjas, upsertNinja, vocabulary } from "../src/game/ninjas";
import { itemVocabulary, upsertEquipmentSet, upsertJewelrySet } from "../src/game/items";
import { ForbiddenError } from "../src/server/auth/permissions";
import { seedTestVocabulary, testDb } from "./helpers";

const db = testDb();
const P = "t3-"; // every fixture slug starts with this and is removed afterwards

beforeAll(async () => {
  await seedTestVocabulary(db);
  await vocabulary.ninjaType(db, { key: "taijutsu", name: "Taijutsu" });
  await vocabulary.statistic(db, { key: "crit-rate", name: "Crit rate", category: "combat", defaultValueType: "PERCENT" });
  await itemVocabulary.equipmentSlot(db, { key: "weapon", name: "Weapon", nameEs: "Arma" });
  await itemVocabulary.equipmentSlot(db, { key: "armor", name: "Armor", nameEs: "Armadura" });
  await itemVocabulary.jewelryType(db, { key: "ring", name: "Ring", nameEs: "Anillo" });
  await db.gemType.upsert({ where: { key: "ruby" }, update: {}, create: { key: "ruby", name: "Ruby" } });
});
afterAll(async () => {
  await db.ninja.deleteMany({ where: { slug: { startsWith: P } } });
  await db.equipment.deleteMany({ where: { slug: { startsWith: P } } });
  await db.jewelry.deleteMany({ where: { slug: { startsWith: P } } });
  await db.gem.deleteMany({ where: { slug: { startsWith: P } } });
  await db.equipmentSet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.jewelrySet.deleteMany({ where: { slug: { startsWith: P } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@t3.test" } } });
  await db.$disconnect();
});

const stats = (force: string | null, hp: string | null) => [
  ...(force !== null ? [{ statisticKey: "force", sourceLabel: "Force", baseValue: force, growthRate: "2.5" }] : []),
  ...(hp !== null ? [{ statisticKey: "hp", sourceLabel: "HP", baseValue: hp, growthRate: "3" }] : []),
];
const names = async (params: Parameters<typeof listNinjas>[1]) => (await listNinjas(db, { includeUnpublished: true, ...params })).items.map((n) => n.name);

describe("ranks D to SSR", () => {
  const ranks = ["D", "C", "B-", "B", "B+", "A-", "A", "A+", "S-", "S", "S+", "SS", "SSS", "SR", "SSR"];
  it("all fifteen are accepted and keep their exact spelling", async () => {
    for (const [i, key] of ranks.entries()) await vocabulary.rating(db, { key, name: key, sortOrder: i });
    for (const key of ranks) {
      const { slug } = await upsertNinja(db, { name: `T3 rank ${key}`, slug: `${P}rank-${slugKey(key)}`, ratingKey: key });
      expect((await getNinjaDetail(db, slug, { includeUnpublished: true }))!.rating).toEqual({ key, name: key });
    }
    const stored = await db.ninjaRating.findMany({ where: { key: { in: ranks } }, orderBy: { sortOrder: "asc" } });
    expect(stored.map((r) => r.key)).toEqual(ranks); // the client's listing order, not a power ranking
    expect((await listNinjaFacets(db)).ratings.map((r) => r.key)).toEqual(expect.arrayContaining(ranks));
  });
  it("filters by one or several ranks, with plus and minus signs kept apart", async () => {
    expect(await names({ query: "T3 rank", ratingKeys: ["B+"] })).toEqual(["T3 rank B+"]);
    expect((await names({ query: "T3 rank", ratingKeys: ["S", "S-", "S+"] })).sort()).toEqual(["T3 rank S", "T3 rank S+", "T3 rank S-"]);
  });
});
const slugKey = (k: string) => k.replace("+", "plus").replace("-", "minus").toLowerCase();

describe("ninja search", () => {
  beforeAll(async () => {
    await upsertNinja(db, {
      name: "T3 Might Guy", slug: `${P}might-guy`, nameEs: "T3 Maito Gai", status: "PUBLISHED",
      aliases: [{ alias: "T3 Might Gai", kind: "SOURCE_NAME", status: "VERIFIED" }, { alias: "T3 Ñandú Gai", kind: "CARD_NAME", status: "VERIFIED" }],
    });
    await upsertNinja(db, { name: "T3 Other", slug: `${P}other`, status: "PUBLISHED" });
  });
  it("finds a ninja by its name, its Spanish name or any alias, ignoring case and accents", async () => {
    for (const q of ["t3 might guy", "MAITO", "t3 might gai", "nandu"]) expect(await names({ query: q }), q).toEqual(["T3 Might Guy"]);
    expect(await names({ query: "T3 Othe" })).toEqual(["T3 Other"]);
    expect(await names({ query: "no-such-ninja-xyz" })).toEqual([]);
  });
  it("says which alias matched", async () => {
    const found = await searchAll(db, "t3 might gai");
    expect(found.ninjas).toEqual([{ slug: `${P}might-guy`, name: "T3 Might Guy", nameEs: "T3 Maito Gai", matchedAlias: "T3 Might Gai" }]);
    expect((await searchAll(db, "T3 Might Guy")).ninjas[0]!.matchedAlias).toBeNull();
  });
  it("an empty query returns nothing and the search is bounded", async () => {
    expect(await searchAll(db, "   ")).toMatchObject({ ninjas: [], equipment: [], sets: [] });
    expect((await searchAll(db, "T3", { limit: 2 })).ninjas.length).toBeLessThanOrEqual(2);
  });
});

describe("formation: Assaulter = Center", () => {
  beforeAll(async () => {
    await upsertNinja(db, { name: "T3 Card Assaulter", slug: `${P}card-assaulter`, formationKey: "assaulter", status: "PUBLISHED", baseStats: stats("100", "50") });
    await upsertNinja(db, { name: "T3 Card Center", slug: `${P}card-center`, formationKey: "center", status: "PUBLISHED" });
    await upsertNinja(db, { name: "T3 Card Vanguard", slug: `${P}card-vanguard`, formationKey: "vanguard", status: "PUBLISHED" });
  });
  it("a merely proposed equivalence keeps the labels apart", async () => {
    await db.formation.update({ where: { key: "assaulter" }, data: { equivalenceStatus: "PROPOSED" } });
    expect(await names({ query: "T3 Card", formationKeys: ["center"] })).toEqual(["T3 Card Center"]);
    expect((await getNinjaDetail(db, `${P}card-assaulter`, { includeUnpublished: true }))!.primaryStat).toBeNull();
  });
  it("once approved, one position: either filter finds both, the card keeps its own label, Center's rule applies", async () => {
    await db.formation.update({ where: { key: "assaulter" }, data: { equivalenceStatus: "APPROVED" } });
    try {
      for (const key of ["center", "assaulter"]) expect((await names({ query: "T3 Card", formationKeys: [key] })).sort(), key).toEqual(["T3 Card Assaulter", "T3 Card Center"]);
      expect(await names({ query: "T3 Card", formationKeys: ["vanguard"] })).toEqual(["T3 Card Vanguard"]);
      const card = (await listNinjas(db, { query: "T3 Card Assaulter", includeUnpublished: true })).items[0]!;
      expect(card.formation).toMatchObject({ key: "assaulter", name: "Assaulter", sameAs: { key: "center", name: "Center", nameEs: "Centro" } });
      const detail = (await getNinjaDetail(db, `${P}card-assaulter`, { includeUnpublished: true }))!;
      expect(detail.primaryStat).toEqual({ key: "force", name: "Force" });
      const facets = await listNinjaFacets(db);
      expect(facets.formations.map((f) => f.key)).not.toContain("assaulter"); // listed once
      expect(facets.formations.find((f) => f.key === "center")).toMatchObject({ name: "Centro", cardLabel: "Assaulter" });
      expect((await db.formation.findUniqueOrThrow({ where: { key: "center" } })).maxPerTeam).toBe(2);
    } finally {
      await db.formation.update({ where: { key: "assaulter" }, data: { equivalenceStatus: "PROPOSED" } });
    }
  });
});

describe("ninja statistics: min / max, sort", () => {
  beforeAll(async () => {
    const rows: [string, string | null, string | null][] = [["a", "1000", "90"], ["b", "3000", "10"], ["c", "2000", "50"], ["d", null, "70"], ["e", "3000", null]];
    for (const [k, force, hp] of rows) await upsertNinja(db, { name: `T3 stat ${k}`, slug: `${P}stat-${k}`, status: "PUBLISHED", baseStats: stats(force, hp) });
    await upsertNinja(db, { name: "T3 stat f", slug: `${P}stat-f`, status: "PUBLISHED", baseStats: [{ statisticKey: "force", sourceLabel: "Force", baseValue: "500", growthRate: "9" }] });
  });
  const q = { query: "T3 stat" };
  it("applies a minimum, a maximum, both, and several statistics together", async () => {
    expect((await names({ ...q, statFilters: [{ statisticKey: "force", min: "2000" }] })).sort()).toEqual(["T3 stat b", "T3 stat c", "T3 stat e"]);
    expect((await names({ ...q, statFilters: [{ statisticKey: "force", max: "1000" }] })).sort()).toEqual(["T3 stat a", "T3 stat f"]);
    expect(await names({ ...q, statFilters: [{ statisticKey: "force", min: "1000", max: "2000" }] })).toEqual(expect.arrayContaining(["T3 stat a", "T3 stat c"]));
    expect(await names({ ...q, statFilters: [{ statisticKey: "force", min: "2000" }, { statisticKey: "hp", max: "50" }] }).then((r) => r.sort())).toEqual(["T3 stat b", "T3 stat c"]);
    // A ninja without the statistic never passes a filter on it.
    expect(await names({ ...q, statFilters: [{ statisticKey: "hp", min: "0" }] })).not.toContain("T3 stat e");
  });
  it("rejects a minimum above the maximum", async () => {
    await expect(listNinjas(db, { statFilters: [{ statisticKey: "force", min: "5", max: "1" }] })).rejects.toBeInstanceOf(ValidationError);
  });
  it("sorts highest to lowest and lowest to highest, ninjas without the statistic always last", async () => {
    const desc = await names({ ...q, sort: { by: "stat", statisticKey: "force", direction: "desc" } });
    expect(desc.slice(0, 5)).toEqual(["T3 stat b", "T3 stat e", "T3 stat c", "T3 stat a", "T3 stat f"]); // 3000 3000 (name tie) 2000 1000 500
    expect(desc.at(-1)).toBe("T3 stat d");
    const asc = await names({ ...q, sort: { by: "stat", statisticKey: "force", direction: "asc" } });
    expect(asc.slice(0, 5)).toEqual(["T3 stat f", "T3 stat a", "T3 stat c", "T3 stat b", "T3 stat e"]);
    expect(asc.at(-1)).toBe("T3 stat d");
    const growth = await listNinjas(db, { ...q, includeUnpublished: true, sort: { by: "growth", statisticKey: "force", direction: "desc" } });
    expect(growth.items[0]!.name).toBe("T3 stat f");
    expect(growth.items[0]!.sortStat).toEqual({ key: "force", value: "500", growth: "9" });
  });
  it("paginates a statistic sort without repeating or dropping a ninja", async () => {
    const all: string[] = [];
    for (let page = 1; page <= 4; page++) all.push(...(await names({ ...q, pageSize: 2, page, sort: { by: "stat", statisticKey: "force", direction: "desc" } })));
    expect(all).toHaveLength(new Set(all).size);
    expect(all.sort()).toEqual((await names(q)).sort());
  });
  it("sorting by a statistic needs the statistic; name and release sorts work", async () => {
    await expect(listNinjas(db, { sort: { by: "stat" } })).rejects.toBeInstanceOf(ValidationError);
    const byName = await names({ ...q, sort: { by: "name", direction: "desc" } });
    expect(byName).toEqual([...byName].sort().reverse());
    expect((await listNinjas(db, { ...q, includeUnpublished: true, sort: { by: "release", direction: "asc" } })).total).toBe(6);
  });
  it("filters ninjas by the statistic their effects change", async () => {
    await upsertNinja(db, {
      name: "T3 effect stat", slug: `${P}effect-stat`, status: "PUBLISHED",
      abilities: [{ typeKey: "skill", name: "S", effects: [{ statisticKey: "crit-rate", value: "10", valueType: "PERCENT" }] }],
    });
    expect(await names({ effectStatisticKeys: ["crit-rate"], query: "T3" })).toEqual(["T3 effect stat"]);
    expect(await names({ effectStatisticKeys: ["speed"], query: "T3 effect" })).toEqual([]);
  });
});

describe("equipment, jewelry and gems: lists", () => {
  beforeAll(async () => {
    await upsertEquipmentSet(db, {
      name: "T3 Dragon Set", slug: `${P}dragon-set`, nameEs: "Conjunto Dragón", tierStacking: "UNKNOWN",
      bonuses: [{ requiredPieces: 2, effects: [{ statisticKey: "attack", value: "5", valueType: "PERCENT" }] }, { requiredPieces: 4, effects: [{ statisticKey: "attack", value: "9", valueType: "PERCENT" }] }],
      items: [
        { name: "T3 Dragon Blade", slug: `${P}dragon-blade`, slotKey: "weapon", status: "PUBLISHED", effects: [{ statisticKey: "attack", value: "30", valueType: "PERCENT" }] },
        { name: "T3 Dragon Plate", slug: `${P}dragon-plate`, slotKey: "armor", status: "PUBLISHED", effects: [{ statisticKey: "defenses", value: "20", valueType: "PERCENT" }] },
      ],
    });
    await saveEquipment(db, { name: "T3 Plain Blade", slug: `${P}plain-blade`, slotKey: "weapon", status: "PUBLISHED", effects: [{ statisticKey: "attack", value: "12", valueType: "PERCENT" }, { statisticKey: "speed", value: "4", valueType: "PERCENT" }] });
    await saveEquipment(db, { name: "T3 Draft Blade", slug: `${P}draft-blade`, slotKey: "weapon", status: "DRAFT", effects: [{ statisticKey: "attack", value: "99", valueType: "PERCENT" }] });
    await saveEquipment(db, { name: "T3 Bare Armor", slug: `${P}bare-armor`, slotKey: "armor", status: "PUBLISHED" });
    await upsertJewelrySet(db, {
      name: "T3 Moon Jewels", slug: `${P}moon-jewels`, groups: [{ key: "g1", name: "Pair" }],
      items: [{ name: "T3 Moon Ring", slug: `${P}moon-ring`, typeKey: "ring", groupKey: "g1", status: "PUBLISHED", effects: [{ statisticKey: "speed", value: "7", valueType: "PERCENT" }] }],
      bonuses: [{ requirementKind: "PIECE_COUNT", requiredPieces: 2, effects: [{ statisticKey: "speed", value: "3", valueType: "PERCENT" }] }],
    });
    await saveGem(db, { name: "T3 Ruby 1", slug: `${P}ruby-1`, typeKey: "ruby", level: 1, status: "PUBLISHED", effects: [{ statisticKey: "hp", value: "100" }] });
  });
  const eq = (params: Partial<Parameters<typeof listItems>[1]> = {}) => listItems(db, { kind: "equipment", query: "T3", ...params });
  const eqNames = async (params: Partial<Parameters<typeof listItems>[1]> = {}) => (await eq(params)).items.map((i) => i.name);

  it("hides drafts from users and shows them to the administrator", async () => {
    expect(await eqNames()).not.toContain("T3 Draft Blade");
    expect(await eqNames({ includeUnpublished: true })).toContain("T3 Draft Blade");
  });
  it("searches by piece name, Spanish set name and slug fragment", async () => {
    expect((await eqNames({ query: "T3 Dragon" })).sort()).toEqual(["T3 Dragon Blade", "T3 Dragon Plate"]);
    expect((await eqNames({ query: "dragón" })).sort()).toEqual(["T3 Dragon Blade", "T3 Dragon Plate"]); // accents are ignored through the slug
    expect((await eqNames({ query: "Conjunto Dragón" })).sort()).toEqual(["T3 Dragon Blade", "T3 Dragon Plate"]);
    expect(await eqNames({ query: "plain-blade" })).toEqual(["T3 Plain Blade"]);
  });
  it("filters by slot, by set and by minimum and maximum of a statistic, all together", async () => {
    expect(await eqNames({ typeKeys: ["armor"] })).toEqual(expect.arrayContaining(["T3 Dragon Plate", "T3 Bare Armor"]));
    expect((await eqNames({ setSlugs: [`${P}dragon-set`] })).sort()).toEqual(["T3 Dragon Blade", "T3 Dragon Plate"]);
    expect(await eqNames({ statFilters: [{ statisticKey: "attack", min: "20" }] })).toEqual(["T3 Dragon Blade"]);
    expect((await eqNames({ statFilters: [{ statisticKey: "attack", min: "10", max: "30" }] })).sort()).toEqual(["T3 Dragon Blade", "T3 Plain Blade"]);
    expect(await eqNames({ statFilters: [{ statisticKey: "attack", min: "10" }, { statisticKey: "speed", min: "1" }] })).toEqual(["T3 Plain Blade"]);
    expect(await eqNames({ typeKeys: ["armor"], statFilters: [{ statisticKey: "attack", min: "10" }] })).toEqual([]);
    // Set tiers are not a piece's own statistics: the 9% tier does not make a piece match.
    expect(await eqNames({ statFilters: [{ statisticKey: "attack", min: "8", max: "10" }] })).toEqual([]);
  });
  it("sorts by a statistic in both directions with pieces lacking it last", async () => {
    const desc = await eq({ sort: { by: "stat", statisticKey: "attack", direction: "desc" } });
    expect(desc.items.map((i) => i.name).slice(0, 2)).toEqual(["T3 Dragon Blade", "T3 Plain Blade"]);
    expect(desc.items[0]!.sortStat).toEqual({ key: "attack", value: 30 });
    expect(["T3 Bare Armor", "T3 Dragon Plate"]).toContain(desc.items.at(-1)!.name);
    expect((await eq({ sort: { by: "stat", statisticKey: "attack", direction: "asc" } })).items.map((i) => i.name).slice(0, 2)).toEqual(["T3 Plain Blade", "T3 Dragon Blade"]);
  });
  it("lists jewelry and gems with their own categories", async () => {
    const rings = await listItems(db, { kind: "jewelry", query: "T3", typeKeys: ["ring"] });
    expect(rings.items).toMatchObject([{ name: "T3 Moon Ring", categoryName: "Ring", setName: "T3 Moon Jewels", stats: [{ statisticKey: "speed", value: 7, valueType: "PERCENT" }] }]);
    const gems = await listItems(db, { kind: "gem", query: "T3", typeKeys: ["ruby"], statFilters: [{ statisticKey: "hp", min: "50" }] });
    expect(gems.items.map((g) => g.name)).toEqual(["T3 Ruby 1"]);
  });
  it("offers only the categories, sets and statistics that exist", async () => {
    const facets = await listItemFacets(db, "equipment");
    expect(facets.categories.map((c) => c.key)).toEqual(expect.arrayContaining(["weapon", "armor"]));
    expect(facets.sets.map((s) => s.slug)).toContain(`${P}dragon-set`);
    expect(facets.statistics.map((s) => s.key)).toEqual(expect.arrayContaining(["attack", "defenses", "speed"]));
    expect(facets.statistics.map((s) => s.key)).not.toContain("hp"); // no equipment piece has it
  });
  it("search finds items and sets next to ninjas", async () => {
    const found = await searchAll(db, "T3 Dragon", { includeGems: true });
    expect(found.equipment.map((e) => e.name).sort()).toEqual(["T3 Dragon Blade", "T3 Dragon Plate"]);
    expect(found.sets).toEqual([{ kind: "equipment", slug: `${P}dragon-set`, name: "T3 Dragon Set", nameEs: "Conjunto Dragón" }]);
    expect((await searchAll(db, "T3 Ruby", { includeGems: true })).gems).toEqual([{ slug: `${P}ruby-1`, name: "T3 Ruby 1" }]);
    expect((await searchAll(db, "T3 Ruby")).gems).toEqual([]); // gems stay out while the section is hidden
  });
});

describe("detail views", () => {
  it("shows a piece's own statistics apart from the set tiers, without adding them", async () => {
    const d = (await getItemDetail(db, "equipment", `${P}dragon-blade`))!;
    expect(d).toMatchObject({ kind: "equipment", name: "T3 Dragon Blade", categoryName: "Arma" });
    expect(d.effects.map((e) => [e.statisticName, e.value])).toEqual([["attack", 30]]);
    expect(d.set!.kind).toBe("equipment");
    const set = d.set!.detail as import("../src/game/items").EquipmentSetDetail;
    expect(set.tiers.map((t) => [t.requiredPieces, t.effects[0]!.value])).toEqual([[2, 5], [4, 9]]);
    expect(set.tierStacking).toBe("UNKNOWN");
  });
  it("hides drafts unless asked, and returns null for an unknown slug", async () => {
    expect(await getItemDetail(db, "equipment", `${P}draft-blade`)).toBeNull();
    expect((await getItemDetail(db, "equipment", `${P}draft-blade`, { includeUnpublished: true }))!.status).toBe("DRAFT");
    expect(await getItemDetail(db, "jewelry", "does-not-exist")).toBeNull();
  });
  it("jewelry and gems have their own detail", async () => {
    const ring = (await getItemDetail(db, "jewelry", `${P}moon-ring`))!;
    expect(ring.set!.kind).toBe("jewelry");
    expect(ring.set!.kind === "jewelry" && ring.set!.detail.bonuses[0]!.requiredPieces).toBe(2);
    expect(await getItemDetail(db, "gem", `${P}ruby-1`)).toMatchObject({ name: "T3 Ruby 1", level: 1, categoryName: "Ruby" });
  });
});

describe("administration: save and delete", () => {
  it("saving is an upsert: the same slug updates the piece instead of duplicating it", async () => {
    const first = await saveEquipment(db, { name: "T3 Admin Piece", slug: `${P}admin-piece`, slotKey: "weapon", effects: [{ statisticKey: "attack", value: "1", valueType: "PERCENT" }] });
    const second = await saveEquipment(db, { name: "T3 Admin Piece v2", slug: `${P}admin-piece`, slotKey: "armor", status: "PUBLISHED", effects: [{ statisticKey: "defenses", value: "2", valueType: "PERCENT" }] });
    expect([first.created, second.created, second.id]).toEqual([true, false, first.id]);
    expect(await db.equipment.count({ where: { slug: `${P}admin-piece` } })).toBe(1);
    const detail = (await getItemDetail(db, "equipment", `${P}admin-piece`))!;
    expect([detail.name, detail.categoryKey, detail.effects.map((e) => e.statisticName)]).toEqual(["T3 Admin Piece v2", "armor", ["defenses"]]);
  });
  it("rejects unknown references and invalid values without writing anything", async () => {
    await expect(saveEquipment(db, { name: "T3 Bad slot", slug: `${P}bad-slot`, slotKey: "no-such-slot" })).rejects.toThrow(/Unknown equipment slot/);
    await expect(saveJewelry(db, { name: "T3 Bad set", slug: `${P}bad-set`, setSlug: "no-such-set" })).rejects.toThrow(/Unknown jewelry set/);
    await expect(saveEquipment(db, { name: "", slug: `${P}empty` })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveGem(db, { name: "T3 Bad gem", slug: `${P}bad-gem`, level: -2 })).rejects.toBeInstanceOf(ValidationError);
    expect(await db.equipment.count({ where: { slug: { in: [`${P}bad-slot`, `${P}empty`] } } })).toBe(0);
    expect(await db.jewelry.count({ where: { slug: `${P}bad-set` } })).toBe(0);
  });
  it("deleting a set leaves its pieces; deleting a piece removes its own effects", async () => {
    const piece = await db.equipment.findUniqueOrThrow({ where: { slug: `${P}dragon-plate` } });
    expect(await db.effect.count({ where: { equipmentId: piece.id } })).toBe(1);
    expect(await deletions.equipmentSet(db, `${P}dragon-set`)).toBe(true);
    expect((await db.equipment.findUniqueOrThrow({ where: { slug: `${P}dragon-plate` } })).setId).toBeNull();
    expect(await deletions.equipment(db, `${P}dragon-plate`)).toBe(true);
    expect(await db.effect.count({ where: { equipmentId: piece.id } })).toBe(0);
    expect(await deletions.equipment(db, `${P}dragon-plate`)).toBe(false);
    expect(await deletions.gem(db, `${P}ruby-1`)).toBe(true);
  });
  it("deleting a ninja removes its abilities, stats, aliases and effects", async () => {
    await upsertNinja(db, {
      name: "T3 Doomed", slug: `${P}doomed`, aliases: [{ alias: "T3 Doomed alias", kind: "SOURCE_NAME" }], baseStats: stats("1", "1"),
      abilities: [{ typeKey: "skill", name: "S", effects: [{ statisticKey: "attack", value: "1", valueType: "PERCENT" }] }],
      talentGroups: [{ options: [{ name: "T", awakenings: [{ typeKey: "talent_awakening", name: "A", stage: 1, effects: [{ statisticKey: "attack", value: "2" }] }] }] }],
    });
    const id = (await db.ninja.findUniqueOrThrow({ where: { slug: `${P}doomed` } })).id;
    expect(await deletions.ninja(db, `${P}doomed`)).toBe(true);
    expect(await Promise.all([db.ability.count({ where: { ninjaId: id } }), db.ninjaBaseStat.count({ where: { ninjaId: id } }), db.ninjaAlias.count({ where: { ninjaId: id } }), db.talentGroup.count({ where: { ninjaId: id } })])).toEqual([0, 0, 0, 0]);
    expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
  });
});

describe("permissions", () => {
  const admin = { id: "t3-admin", role: "ADMIN" as const };
  const user = { id: "t3-user", role: "USER" as const };
  it("a regular user can read and search but cannot change or delete anything", async () => {
    const api = gameApi(db, user);
    expect((await api.listItems({ kind: "equipment", query: "T3" })).items.length).toBeGreaterThan(0);
    expect((await api.searchAll("T3")).ninjas.length).toBeGreaterThan(0);
    expect((await api.listNinjas({ query: "T3" })).total).toBeGreaterThan(0);
    const attempts: (() => unknown)[] = [
      () => api.saveEquipment({ name: "T3 nope" }), () => api.saveJewelry({ name: "T3 nope" }), () => api.saveGem({ name: "T3 nope" }),
      () => api.upsertNinja({ name: "T3 nope" }), () => api.deleteNinja(`${P}other`), () => api.deleteEquipment(`${P}plain-blade`),
      () => api.deleteJewelry(`${P}moon-ring`), () => api.deleteGem("x"), () => api.deleteEquipmentSet("x"), () => api.deleteJewelrySet("x"),
      () => api.saveAbilityText({ ninjaSlug: `${P}other`, kind: "skill", name: "n", linesEn: [] }), () => api.deleteAbility("x", "ability"),
      () => api.listUsers(), () => api.createUser({ email: "x@t3.test", password: "0123456789" }), () => api.updateUser("x", { role: "ADMIN" }),
      () => api.resetPassword("x", "0123456789"), () => api.deleteUser("x"),
    ];
    for (const attempt of attempts) expect(() => attempt()).toThrow(ForbiddenError);
    expect(await db.ninja.count({ where: { slug: `${P}other` } })).toBe(1);
  });
  it("an anonymous caller can do nothing", () => {
    const api = gameApi(db, null);
    expect(() => api.listItems({ kind: "equipment" })).toThrow(ForbiddenError);
    expect(() => api.searchAll("x")).toThrow(ForbiddenError);
    expect(() => api.saveEquipment({ name: "x" })).toThrow(ForbiddenError);
  });
  it("an administrator can", async () => {
    const api = gameApi(db, admin);
    expect((await api.saveGem({ name: "T3 Admin gem", slug: `${P}admin-gem` })).created).toBe(true);
    expect(await api.deleteGem(`${P}admin-gem`)).toBe(true);
  });
});
