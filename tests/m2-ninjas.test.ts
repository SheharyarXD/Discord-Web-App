import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { MAX_PAGE_SIZE } from "../src/domain/constants";
import { compareNewestFirst, formatReleasePeriod, resolveFormation } from "../src/domain/ninja";
import { UnknownReferenceError, ValidationError } from "../src/game/db";
import { getNinjaDetail, listNinjas, upsertNinja, vocabulary } from "../src/game/ninjas";
import { setTalentSelection } from "../src/game/talents";
import { dbRejects, TRIGGER_REJECTION, seedTestVocabulary, testDb, TEST_DB_URL } from "./helpers";

const db = testDb();

beforeAll(async () => {
  await seedTestVocabulary(db);
  await vocabulary.ninjaType(db, { key: "genjutsu", name: "Genjutsu" });
});
afterAll(() => db.$disconnect());

const detail = (slug: string, viewerId?: string) => getNinjaDetail(db, slug, { viewerId, includeUnpublished: true });

describe("1. distinct variants", () => {
  it("keeps 'Uchiha Madara' and 'Uchiha Madara (Moon's Eye)' as two records", async () => {
    const a = await upsertNinja(db, { name: "T1 Uchiha Madara", release: { year: 2014, month: 1 } });
    const b = await upsertNinja(db, { name: "T1 Uchiha Madara (Moon's Eye)", release: { year: 2026, month: 3 } });
    expect(a.id).not.toBe(b.id);
    expect(a.slug).toBe("t1-uchiha-madara");
    expect(b.slug).toBe("t1-uchiha-madara-moon-s-eye");
    expect((await detail(a.slug))!.release).toEqual({ year: 2014, month: 1 });
    expect((await detail(b.slug))!.release).toEqual({ year: 2026, month: 3 });
  });

  it("submitting the same release again updates it instead of duplicating it", async () => {
    const before = await db.ninja.count({ where: { slug: { startsWith: "t1-" } } });
    const again = await upsertNinja(db, { name: "T1 Uchiha Madara (Moon's Eye)", release: { year: 2026, month: 3 } });
    expect(again.created).toBe(false);
    expect(await db.ninja.count({ where: { slug: { startsWith: "t1-" } } })).toBe(before);
  });
});

describe("2. release dates", () => {
  it("stores year and month only — there is no day column to fabricate", async () => {
    const { id } = await upsertNinja(db, { name: "T2 Dated", release: { year: 2025, month: 12 } });
    const row = await db.ninja.findUniqueOrThrow({ where: { id } });
    expect([row.releaseYear, row.releaseMonth]).toEqual([2025, 12]);
    expect(Object.keys(row).filter((k) => /day|releaseDate|releasedAt/i.test(k))).toEqual([]);
    expect(formatReleasePeriod({ year: 2025, month: 12 })).toBe("diciembre de 2025");
  });

  it("rejects an impossible month in the service and in the database", async () => {
    await expect(upsertNinja(db, { name: "T2 Bad", release: { year: 2025, month: 13 } })).rejects.toBeInstanceOf(ValidationError);
    expect(await dbRejects(() => db.ninja.create({ data: { slug: "t2-raw-13", name: "x", releaseYear: 2025, releaseMonth: 13 } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.ninja.create({ data: { slug: "t2-raw-0", name: "x", releaseYear: 2025, releaseMonth: 0 } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.ninja.create({ data: { slug: "t2-raw-noyear", name: "x", releaseMonth: 5 } }))).toBe(TRIGGER_REJECTION);
  });

  it("lists newest first, deterministically, with unknown dates last", async () => {
    const names = {
      "T2o B same month later": { release: { year: 2020, month: 5 }, releaseOrder: 2 },
      "T2o A same month earlier": { release: { year: 2020, month: 5 }, releaseOrder: 1 },
      "T2o Newest": { release: { year: 2021, month: 1 }, releaseOrder: 3 },
      "T2o Undated Z": { release: null },
      "T2o Undated A": { release: null },
      "T2o Oldest": { release: { year: 2019, month: 12 }, releaseOrder: 0 },
    };
    for (const [name, fields] of Object.entries(names)) await upsertNinja(db, { name, status: "PUBLISHED", ...fields });

    const expected = ["T2o Newest", "T2o B same month later", "T2o A same month earlier", "T2o Oldest", "T2o Undated A", "T2o Undated Z"];
    const read = async () => (await listNinjas(db, { nameContains: "T2o " })).items.map((n) => n.name);
    expect(await read()).toEqual(expected);
    expect(await read()).toEqual(expected); // stable across calls

    // The in-memory comparator and the database order agree.
    const rows = await db.ninja.findMany({ where: { name: { startsWith: "T2o " } } });
    expect(rows.sort(compareNewestFirst).map((r) => r.name)).toEqual(expected);
  });
});

describe("3. rating", () => {
  it("accepts S / SS / SSS / SR / SSR, allows none, and is extensible", async () => {
    for (const key of ["S", "SS", "SSS", "SR", "SSR"]) {
      const { slug } = await upsertNinja(db, { name: `T3 rated ${key}`, ratingKey: key });
      expect((await detail(slug))!.rating?.key).toBe(key);
    }
    const none = await upsertNinja(db, { name: "T3 unrated" });
    expect((await detail(none.slug))!.rating).toBeNull();

    await vocabulary.rating(db, { key: "T3-UR", name: "UR", sortOrder: 9 });
    const extended = await upsertNinja(db, { name: "T3 future rating", ratingKey: "T3-UR" });
    expect((await detail(extended.slug))!.rating?.name).toBe("UR");
    await expect(upsertNinja(db, { name: "T3 invented rating", ratingKey: "ZZZ" })).rejects.toBeInstanceOf(UnknownReferenceError);
  });

  it("does not rank ratings alphabetically", async () => {
    const order = (await db.ninjaRating.findMany({ where: { key: { in: ["S", "SS", "SSS", "SR", "SSR"] } }, orderBy: { sortOrder: "asc" } })).map((r) => r.key);
    expect(order).toEqual(["S", "SS", "SSS", "SR", "SSR"]);
    expect(order).not.toEqual([...order].sort());
  });
});

describe("4. position vs combat class", () => {
  it("keeps formation and the client's Tank/DPS label independent", async () => {
    const supportDps = await upsertNinja(db, { name: "T4 support dps", formationKey: "support", clientCombatClass: "DPS" });
    const centerTank = await upsertNinja(db, { name: "T4 center tank", formationKey: "center", clientCombatClass: "TANK" });
    const unassigned = await upsertNinja(db, { name: "T4 unassigned", formationKey: "vanguard" });
    expect((await detail(supportDps.slug))!).toMatchObject({ formation: { key: "support" }, clientCombatClass: "DPS" });
    expect((await detail(centerTank.slug))!).toMatchObject({ formation: { key: "center" }, clientCombatClass: "TANK" });
    expect((await detail(unassigned.slug))!.clientCombatClass).toBeNull();
  });

  it("a ninja is Tank OR DPS or unassigned — a dual assignment fails everywhere", async () => {
    for (const bad of [["TANK", "DPS"], "TANK,DPS", "BOTH", "tank"]) {
      await expect(upsertNinja(db, { name: "T4 dual", clientCombatClass: bad as never })).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await db.ninja.count({ where: { slug: "t4-dual" } })).toBe(0);
    expect(await dbRejects(() => db.ninja.create({ data: { slug: "t4-raw-both", name: "x", clientCombatClass: "TANK,DPS" } }))).toBe(TRIGGER_REJECTION);
    const { id } = await upsertNinja(db, { name: "T4 switch", clientCombatClass: "TANK" });
    expect(await dbRejects(() => db.ninja.update({ where: { id }, data: { clientCombatClass: "BOTH" } }))).toBe(TRIGGER_REJECTION);
    await upsertNinja(db, { name: "T4 switch", clientCombatClass: "DPS" }); // replaces, never accumulates
    expect((await db.ninja.findUniqueOrThrow({ where: { id } })).clientCombatClass).toBe("DPS");
    await upsertNinja(db, { name: "T4 switch", clientCombatClass: null });
    expect((await db.ninja.findUniqueOrThrow({ where: { id } })).clientCombatClass).toBeNull();
  });

  it("is never inferred: omitting it leaves it unassigned whatever the stats say", async () => {
    const { slug } = await upsertNinja(db, {
      name: "T4 tanky numbers",
      baseStats: [{ statisticKey: "hp", sourceLabel: "HP", baseValue: 999999 }],
    });
    expect((await detail(slug))!.clientCombatClass).toBeNull();
  });
});

describe("5. source category is not the formation", () => {
  it("a ninja filed under 'assaulters' gets NO formation while the mapping is only proposed", async () => {
    await db.ninjaRole.update({ where: { key: "assaulters" }, data: { mappingStatus: "PROPOSED" } });
    const { slug } = await upsertNinja(db, { name: "T5 assaulter", roleKey: "assaulters", status: "PUBLISHED" });
    const read = (await detail(slug))!;
    expect(read.role).toMatchObject({ key: "assaulters", mappingStatus: "PROPOSED", proposedFormationName: "Assaulter" });
    expect(read.formation).toBeNull();
    expect(read.primaryStat).toBeNull();
    expect((await db.ninja.findUniqueOrThrow({ where: { slug } })).formationId).toBeNull();
    const centers = await listNinjas(db, { formationKeys: ["center"], nameContains: "T5 " });
    expect(centers.items.map((n) => n.name)).not.toContain("T5 assaulter");
  });

  it("resolves through the mapping only once it is APPROVED, and says where it came from", async () => {
    await vocabulary.role(db, { key: "t5-approved-role", name: "t5 approved", mappedFormationKey: "center", mappingStatus: "APPROVED" });
    const { slug } = await upsertNinja(db, { name: "T5 approved", roleKey: "t5-approved-role", status: "PUBLISHED" });
    const read = (await detail(slug))!;
    expect(read.formation).toMatchObject({ key: "center", origin: "APPROVED_MAPPING" });
    expect(read.primaryStat?.key).toBe("force");
    expect((await listNinjas(db, { formationKeys: ["center"], nameContains: "T5 " })).items.map((n) => n.name)).toEqual(["T5 approved"]);
  });

  it("direct evidence wins over the category", () => {
    const support = { key: "support", name: "Support" };
    const center = { key: "center", name: "Center" };
    expect(resolveFormation({ formation: support, role: { mappingStatus: "APPROVED", mappedFormation: center } })).toEqual({ formation: support, origin: "DIRECT" });
    expect(resolveFormation({ formation: null, role: { mappingStatus: "PROPOSED", mappedFormation: center } })).toBeNull();
    expect(resolveFormation({ formation: null, role: { mappingStatus: "UNMAPPED", mappedFormation: null } })).toBeNull();
  });
});

describe("6 + 13. base stats, growth rates and units", () => {
  const stats = [
    { statisticKey: "force", sourceLabel: "Force", baseValue: "22500", growthRate: "22.5" },
    { statisticKey: "agility", sourceLabel: "Agility", baseValue: "44500", growthRate: "44.5" },
    { statisticKey: "chakra", sourceLabel: "Chakra", baseValue: "44000", growthRate: "44" },
    { statisticKey: "hp", sourceLabel: "HP", baseValue: "440000", growthRate: "44" },
  ];

  it("stores the four printed stats as four separately queryable rows", async () => {
    const { id, slug } = await upsertNinja(db, { name: "T6 card", formationKey: "support", typeKey: "genjutsu", ratingKey: "SSR", baseStats: stats });
    const read = (await detail(slug))!;
    expect(read.baseStats.map((s) => [s.sourceLabel, s.baseValue, s.growthRate])).toEqual([
      ["Force", "22500", "22.5"],
      ["Agility", "44500", "44.5"],
      ["Chakra", "44000", "44"],
      ["HP", "440000", "44"],
    ]);
    expect(await db.ninjaBaseStat.count({ where: { ninjaId: id } })).toBe(4);
    const byChakra = await db.ninjaBaseStat.findMany({ where: { statistic: { key: "chakra" }, baseValue: { gte: 44000 }, ninjaId: id } });
    expect(byChakra).toHaveLength(1);
    expect(read.type?.name).toBe("Genjutsu");
  });

  it("Support → Chakra is the primary stat, and Force is still there", async () => {
    const read = (await detail("t6-card"))!;
    expect(read.primaryStat).toEqual({ key: "chakra", name: "Chakra" });
    expect(read.baseStats.filter((s) => s.isPrimary).map((s) => s.statisticKey)).toEqual(["chakra"]);
    expect(read.baseStats.find((s) => s.statisticKey === "force")?.baseValue).toBe("22500");
    const center = await upsertNinja(db, { name: "T6 center", formationKey: "center", baseStats: stats });
    expect((await detail(center.slug))!.primaryStat?.key).toBe("force");
  });

  it("keeps decimal precision and never mixes value, growth rate and percentages", async () => {
    const { id, slug } = await upsertNinja(db, {
      name: "T6 decimals",
      baseStats: [{ statisticKey: "force", sourceLabel: "Force", baseValue: "0.3", growthRate: "22.55" }],
    });
    const row = await db.ninjaBaseStat.findFirstOrThrow({ where: { ninjaId: id } });
    expect(row.baseValue.toString()).toBe("0.3"); // not 0.30000000000000004
    expect(row.growthRate?.toString()).toBe("22.55");
    expect(row.baseValue.plus("0.1").plus("0.2").toString()).toBe("0.6");
    // Growth rate is its own column: it is not stored as an effect, a percentage or a set bonus.
    expect(await db.effect.count({ where: { ability: { ninjaId: id } } })).toBe(0);
    expect((await detail(slug))!.baseStats[0]).toMatchObject({ baseValue: "0.3", growthRate: "22.55" });
    // A flat stat and a percentage stat keep different units in the dictionary.
    const units = await db.statistic.findMany({ where: { key: { in: ["force", "attack"] } }, orderBy: { key: "asc" } });
    expect(units.map((u) => [u.key, u.defaultValueType])).toEqual([["attack", "PERCENT"], ["force", "FLAT"]]);
    await expect(upsertNinja(db, { name: "T6 nan", baseStats: [{ statisticKey: "force", sourceLabel: "Force", baseValue: "22,5" }] })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("7. optional features", () => {
  it("an old ninja with no awakening, nature, talent or stats reads back empty — nothing is invented", async () => {
    const { slug } = await upsertNinja(db, { name: "T7 Old Ninja", release: { year: 2012, month: 11 } });
    const read = (await detail(slug))!;
    expect(read).toMatchObject({ abilities: [], talentGroups: [], natures: [], baseStats: [], rating: null, type: null, formation: null, role: null, primaryStat: null, clientCombatClass: null });
  });

  it("natures are optional, and only real natures can be attached", async () => {
    const nature = await vocabulary.nature(db, { key: "t7-nature", name: "T7 Nature" });
    const { id, slug } = await upsertNinja(db, { name: "T7 with nature", natureKeys: ["t7-nature"] });
    expect((await detail(slug))!.natures).toEqual([{ key: "t7-nature", name: "T7 Nature" }]);
    await expect(upsertNinja(db, { name: "T7 with nature", natureKeys: ["nope"] })).rejects.toBeInstanceOf(UnknownReferenceError);
    expect(nature.id).toBeTruthy();
    const role = await db.conditionType.findUniqueOrThrow({ where: { key: "role" } });
    const notNature = await db.conditionValue.create({ data: { conditionTypeId: role.id, key: "t7-not-a-nature", name: "x" } });
    expect(await dbRejects(() => db.ninjaNature.create({ data: { ninjaId: id, natureId: notNature.id } }))).toBe(TRIGGER_REJECTION);
  });
});

describe("8. talent exclusivity", () => {
  let groupId = "";
  let options: { id: string; name: string }[] = [];
  let userA = "";
  let userB = "";

  beforeAll(async () => {
    const { id } = await upsertNinja(db, {
      name: "T8 two talents",
      talentGroups: [{ selectionMode: "ONE_OF", reviewStatus: "CONFIRMED", options: [{ name: "Talent A" }, { name: "Talent B" }, { name: "Talent C" }] }],
    });
    const group = await db.talentGroup.findFirstOrThrow({ where: { ninjaId: id }, include: { options: { orderBy: { sortOrder: "asc" } } } });
    groupId = group.id;
    options = group.options;
    userA = (await db.user.create({ data: { email: "t8-a@example.test", passwordHash: "x" } })).id;
    userB = (await db.user.create({ data: { email: "t8-b@example.test", passwordHash: "x" } })).id;
  });

  it("all options stay available and none is active by default", async () => {
    const group = (await detail("t8-two-talents", userA))!.talentGroups[0]!;
    expect(group.options.map((o) => o.name)).toEqual(["Talent A", "Talent B", "Talent C"]);
    expect(group.selectedOptionIds).toEqual([]);
    expect((await detail("t8-two-talents"))!.talentGroups[0]!.selectedOptionIds).toEqual([]);
  });

  it("a user holds at most one option of the group; choosing again replaces the pick", async () => {
    await setTalentSelection(db, userA, groupId, [options[0]!.id]);
    await setTalentSelection(db, userA, groupId, [options[1]!.id]);
    expect(await db.userTalentSelection.count({ where: { userId: userA } })).toBe(1);
    expect((await detail("t8-two-talents", userA))!.talentGroups[0]!.selectedOptionIds).toEqual([options[1]!.id]);
    await expect(setTalentSelection(db, userA, groupId, [options[0]!.id, options[1]!.id])).rejects.toBeInstanceOf(ValidationError);
    await expect(setTalentSelection(db, userA, groupId, ["not-an-option"])).rejects.toBeInstanceOf(ValidationError);
    expect(await db.userTalentSelection.count({ where: { userId: userA } })).toBe(1); // failed attempts changed nothing
  });

  it("the database itself refuses a second pick in the same group", async () => {
    expect(await dbRejects(() => db.userTalentSelection.create({ data: { userId: userA, optionId: options[2]!.id } }))).toBe(TRIGGER_REJECTION);
  });

  it("a pick belongs to one user: it is not the ninja's canonical default", async () => {
    expect((await detail("t8-two-talents", userB))!.talentGroups[0]!.selectedOptionIds).toEqual([]);
    await setTalentSelection(db, userB, groupId, [options[2]!.id]);
    expect((await detail("t8-two-talents", userA))!.talentGroups[0]!.selectedOptionIds).toEqual([options[1]!.id]);
    expect((await detail("t8-two-talents", userB))!.talentGroups[0]!.selectedOptionIds).toEqual([options[2]!.id]);
    expect(await db.talentOption.count({ where: { groupId, isDefault: true } })).toBe(0);
    await setTalentSelection(db, userA, groupId, []);
    expect((await detail("t8-two-talents", userA))!.talentGroups[0]!.selectedOptionIds).toEqual([]);
  });

  it("a re-import keeps options (and therefore picks) and supports any number of options", async () => {
    await upsertNinja(db, { name: "T8 two talents", talentGroups: [{ options: [{ name: "Talent A" }, { name: "Talent B" }, { name: "Talent C" }] }] });
    expect((await detail("t8-two-talents", userB))!.talentGroups[0]!.selectedOptionIds).toEqual([options[2]!.id]);
    const one = await upsertNinja(db, { name: "T8 one talent", talentGroups: [{ options: [{ name: "Only" }] }] });
    expect((await detail(one.slug))!.talentGroups[0]!).toMatchObject({ reviewStatus: "NEEDS_REVIEW", selectedOptionIds: [] });
  });
});

describe("transactions", () => {
  it("a failing child rolls the whole ninja back — no partial record, no orphans", async () => {
    const abilities = await db.ability.count();
    await expect(
      upsertNinja(db, {
        name: "T9 partial",
        abilities: [
          { typeKey: "skill", name: "Fine" },
          { typeKey: "skill", name: "Broken", effects: [{ statisticKey: "does-not-exist", value: 5 }] },
        ],
      }),
    ).rejects.toBeInstanceOf(UnknownReferenceError);
    expect(await db.ninja.count({ where: { slug: "t9-partial" } })).toBe(0);
    expect(await db.ability.count()).toBe(abilities);
  });
});

describe("18. bounded, non-N+1 list reads", () => {
  it("always paginates and uses the same number of queries for 5 rows as for 60", async () => {
    for (let i = 0; i < 60; i++) {
      await upsertNinja(db, { name: `T18 ninja ${String(i).padStart(2, "0")}`, status: "PUBLISHED", ratingKey: "SSR", formationKey: "support", roleKey: "supporters", release: { year: 2000 + (i % 20), month: (i % 12) + 1 } });
    }
    const counting = new PrismaClient({ datasourceUrl: TEST_DB_URL, log: [{ emit: "event", level: "query" }] });
    let queries = 0;
    counting.$on("query", () => queries++);
    try {
      const measure = async (pageSize: number) => {
        queries = 0;
        const page = await listNinjas(counting, { nameContains: "T18 ", pageSize });
        return { queries, page };
      };
      const small = await measure(5);
      const large = await measure(60);
      expect(small.page.items).toHaveLength(5);
      expect(large.page.items).toHaveLength(60);
      expect(large.queries).toBe(small.queries);
      expect(large.queries).toBeLessThanOrEqual(8);

      const capped = await listNinjas(counting, { pageSize: 100000 });
      expect(capped.pageSize).toBe(MAX_PAGE_SIZE);
      expect(capped.items.length).toBeLessThanOrEqual(MAX_PAGE_SIZE);
      const second = await listNinjas(counting, { nameContains: "T18 ", pageSize: 25, page: 3 });
      expect(second).toMatchObject({ total: 60, pageCount: 3, page: 3 });
      expect(second.items).toHaveLength(10);
    } finally {
      await counting.$disconnect();
    }
  });

  it("combines filters with AND across filters and OR inside one", async () => {
    await upsertNinja(db, { name: "T18f a", status: "PUBLISHED", ratingKey: "SSR", clientCombatClass: "TANK", release: { year: 2024, month: 6 } });
    await upsertNinja(db, { name: "T18f b", status: "PUBLISHED", ratingKey: "SR", clientCombatClass: "DPS", release: { year: 2025, month: 1 } });
    await upsertNinja(db, { name: "T18f c", status: "PUBLISHED", ratingKey: "S", release: { year: 2026, month: 2 } });
    const names = async (filter: Parameters<typeof listNinjas>[1]) => (await listNinjas(db, { nameContains: "T18f ", ...filter })).items.map((n) => n.name);
    expect(await names({ ratingKeys: ["SSR", "SR"] })).toEqual(["T18f b", "T18f a"]);
    expect(await names({ ratingKeys: ["SSR", "SR"], combatClasses: ["TANK"] })).toEqual(["T18f a"]);
    expect(await names({ combatClasses: ["UNASSIGNED"] })).toEqual(["T18f c"]);
    expect(await names({ releasedFrom: { year: 2025, month: 1 }, releasedTo: { year: 2025, month: 12 } })).toEqual(["T18f b"]);
    // Drafts are never listed to readers.
    await upsertNinja(db, { name: "T18f draft", ratingKey: "SSR" });
    expect(await names({})).not.toContain("T18f draft");
  });
});
