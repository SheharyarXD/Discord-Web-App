import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getNinjaDetail, upsertNinja } from "../src/game/ninjas";
import { dbRejects, TRIGGER_REJECTION } from "./helpers";

/**
 * 17. Upgrade path: build a database with ONLY the Milestone 1 migration, fill it the way
 * Milestone 1 data looked, then apply the Milestone 2 migration on top and check that every
 * original record survived and the new constraints are in force.
 */
const ROOT = path.resolve(__dirname, "..");
const WORK = path.resolve(__dirname, ".tmp/upgrade");
const URL = `file:${path.join(WORK, "upgrade.db").replace(/\\/g, "/")}`;
const run = (command: string) => execSync(command, { cwd: ROOT, stdio: "pipe", env: { ...process.env, DATABASE_URL: URL } }).toString();

let db: PrismaClient;
let appliedOnUpgrade = "";

beforeAll(() => {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(path.join(WORK, "m1/migrations"), { recursive: true });
  const migrations = path.join(ROOT, "prisma/migrations");
  const init = readdirSync(migrations).find((d) => d.endsWith("_init"))!;
  cpSync(path.join(migrations, init), path.join(WORK, "m1/migrations", init), { recursive: true });
  cpSync(path.join(migrations, "migration_lock.toml"), path.join(WORK, "m1/migrations/migration_lock.toml"));
  cpSync(path.join(ROOT, "prisma/schema.prisma"), path.join(WORK, "m1/schema.prisma"));

  // 1. A Milestone 1 database: only the init migration exists next to this schema copy.
  run(`npx prisma migrate deploy --schema "${path.join(WORK, "m1/schema.prisma")}"`);
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(WORK, { recursive: true, force: true });
});

describe("17. upgrading a Milestone 1 database", () => {
  it("starts as a real M1 database (no M2 tables yet) and accepts M1-shaped rows", async () => {
    const m1 = new PrismaClient({ datasourceUrl: URL });
    try {
      const tables = (await m1.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name);
      expect(tables).toContain("Ninja");
      expect(tables).not.toContain("StatusEffect");
      expect(tables).not.toContain("SourceRecord");
      const now = "2026-10-06T12:00:00.000+00:00";
      const sql = [
        `INSERT INTO "User" ("id","email","passwordHash","role","updatedAt") VALUES ('u1','m1-admin@example.test','hash','ADMIN','${now}')`,
        `INSERT INTO "Session" ("id","tokenHash","userId","expiresAt") VALUES ('s1','tok','u1','2030-01-01T00:00:00.000+00:00')`,
        `INSERT INTO "NinjaRole" ("id","key","name","updatedAt") VALUES ('r1','m1-role','M1 Role','${now}')`,
        `INSERT INTO "Statistic" ("id","key","name","defaultValueType","updatedAt") VALUES ('st1','m1-stat','M1 Stat','PERCENT','${now}')`,
        `INSERT INTO "AbilityType" ("id","key","name") VALUES ('at1','skill','Habilidad')`,
        `INSERT INTO "EffectTarget" ("id","key","name") VALUES ('et1','ally','Aliado')`,
        `INSERT INTO "ConditionType" ("id","key","name") VALUES ('ct1','nature','Naturaleza')`,
        `INSERT INTO "ConditionValue" ("id","conditionTypeId","key","name") VALUES ('cv1','ct1','m1-nature','M1 Nature')`,
        `INSERT INTO "Ninja" ("id","slug","name","description","roleId","status","metadata","updatedAt") VALUES ('n1','m1-ninja','M1 Ninja','M1 description','r1','PUBLISHED','{"k":1}','${now}')`,
        `INSERT INTO "Ability" ("id","ninjaId","abilityTypeId","name","description","sortOrder","updatedAt") VALUES ('a1','n1','at1','M1 Ability','text',2,'${now}')`,
        `INSERT INTO "Effect" ("id","statisticId","value","valueType","targetId","durationTurns","chancePercent","description","abilityId","updatedAt") VALUES ('e1','st1',12.5,'PERCENT','et1',2,37.5,'M1 effect','a1','${now}')`,
        `INSERT INTO "Condition" ("id","effectId","conditionTypeId","conditionValueId","operator","numericValue","note","alternativeGroup") VALUES ('c1','e1','ct1','cv1','REQUIRES',30.25,'note',1)`,
        `INSERT INTO "TalentGroup" ("id","ninjaId","selectionMode","updatedAt") VALUES ('g1','n1','ONE_OF','${now}')`,
        `INSERT INTO "TalentOption" ("id","groupId","name","isDefault","sortOrder") VALUES ('o1','g1','M1 Talent A',1,0)`,
        `INSERT INTO "TalentOption" ("id","groupId","name","isDefault","sortOrder") VALUES ('o2','g1','M1 Talent B',0,1)`,
        `INSERT INTO "EquipmentSet" ("id","slug","name","updatedAt") VALUES ('es1','m1-set','M1 Set','${now}')`,
        `INSERT INTO "EquipmentSetBonus" ("id","setId","requiredPieces") VALUES ('eb1','es1',4)`,
        `INSERT INTO "Effect" ("id","value","valueType","equipmentSetBonusId","updatedAt") VALUES ('e2',300,'FLAT','eb1','${now}')`,
        `INSERT INTO "Equipment" ("id","slug","name","setId","status","updatedAt") VALUES ('eq1','m1-item','M1 Item','es1','PUBLISHED','${now}')`,
        `INSERT INTO "JewelrySet" ("id","slug","name","updatedAt") VALUES ('js1','m1-jset','M1 JSet','${now}')`,
        `INSERT INTO "Jewelry" ("id","slug","name","setId","updatedAt") VALUES ('j1','m1-ring','M1 Ring','js1','${now}')`,
        `INSERT INTO "JewelrySetBonus" ("id","setId","requirementKind") VALUES ('jb1','js1','SPECIFIC_ITEMS')`,
        `INSERT INTO "JewelrySetBonusItem" ("bonusId","jewelryId") VALUES ('jb1','j1')`,
        `INSERT INTO "GemType" ("id","key","name") VALUES ('gt1','m1-gem-type','M1 Gem Type')`,
        `INSERT INTO "Gem" ("id","slug","name","gemTypeId","level","updatedAt") VALUES ('gm1','m1-gem','M1 Gem','gt1',5,'${now}')`,
        `INSERT INTO "Effect" ("id","description","gemId","updatedAt") VALUES ('e3','M1 gem effect','gm1','${now}')`,
      ];
      for (const statement of sql) await m1.$executeRawUnsafe(statement);
    } finally {
      await m1.$disconnect();
    }
  });

  it("applies the Milestone 2 migration on top without a reset", () => {
    appliedOnUpgrade = run("npx prisma migrate deploy");
    expect(appliedOnUpgrade).toMatch(/m2_core_game_data/);
    expect(appliedOnUpgrade).not.toMatch(/_init/); // only the new migration ran
    expect(run("npx prisma migrate status")).toMatch(/up to date/i);
    db = new PrismaClient({ datasourceUrl: URL });
  }, 120_000);

  it("preserves every Milestone 1 record and value", async () => {
    const ninja = await db.ninja.findUniqueOrThrow({
      where: { slug: "m1-ninja" },
      include: { role: true, abilities: { include: { effects: { include: { conditions: true, statistic: true, target: true } } } }, talentGroups: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
    });
    expect(ninja).toMatchObject({ id: "n1", name: "M1 Ninja", description: "M1 description", status: "PUBLISHED", metadata: { k: 1 }, role: { key: "m1-role" } });
    const effect = ninja.abilities[0]!.effects[0]!;
    expect(ninja.abilities[0]).toMatchObject({ id: "a1", name: "M1 Ability", sortOrder: 2 });
    expect([effect.value?.toString(), effect.chancePercent?.toString(), effect.durationTurns, effect.valueType, effect.statistic?.key, effect.target?.key]).toEqual(["12.5", "37.5", 2, "PERCENT", "m1-stat", "ally"]);
    expect(effect.conditions[0]).toMatchObject({ id: "c1", conditionValueId: "cv1", operator: "REQUIRES", alternativeGroup: 1, note: "note" });
    expect(effect.conditions[0]!.numericValue?.toString()).toBe("30.25");
    expect(ninja.talentGroups[0]!.options.map((o) => [o.name, o.isDefault])).toEqual([["M1 Talent A", true], ["M1 Talent B", false]]);

    expect(await db.user.findUniqueOrThrow({ where: { email: "m1-admin@example.test" }, include: { sessions: true } })).toMatchObject({ role: "ADMIN", sessions: [{ tokenHash: "tok" }] });
    const set = await db.equipmentSet.findUniqueOrThrow({ where: { slug: "m1-set" }, include: { bonuses: { include: { effects: true } }, items: true } });
    expect(set.bonuses.map((b) => [b.requiredPieces, b.effects[0]!.value?.toString()])).toEqual([[4, "300"]]);
    expect(set.items.map((i) => i.slug)).toEqual(["m1-item"]);
    const jset = await db.jewelrySet.findUniqueOrThrow({ where: { slug: "m1-jset" }, include: { bonuses: { include: { requiredItems: true } }, items: true } });
    expect(jset.bonuses[0]).toMatchObject({ requirementKind: "SPECIFIC_ITEMS", requiredPieces: null, requiredItems: [{ jewelryId: "j1" }] });
    expect(await db.gem.findUniqueOrThrow({ where: { slug: "m1-gem" }, include: { effects: true, gemType: true } })).toMatchObject({ level: 5, gemType: { key: "m1-gem-type" }, effects: [{ description: "M1 gem effect" }] });
    expect(await db.effect.count()).toBe(3);
  });

  it("gives old rows safe defaults for the new columns", async () => {
    const ninja = await db.ninja.findUniqueOrThrow({ where: { slug: "m1-ninja" } });
    expect(ninja).toMatchObject({ releaseYear: null, releaseMonth: null, releaseOrder: null, formationId: null, ratingId: null, ninjaTypeId: null, clientCombatClass: null, translationStatus: "MISSING", reviewStatus: "NEEDS_REVIEW" });
    expect(await db.effect.findUniqueOrThrow({ where: { id: "e1" } })).toMatchObject({ statusEffectId: null, magnitudeOverride: null, structuredStatus: "STRUCTURED", conditionText: null });
    expect(await db.condition.findUniqueOrThrow({ where: { id: "c1" } })).toMatchObject({ scope: "ACTIVATION", ninjaId: null });
    expect(await db.equipmentSet.findUniqueOrThrow({ where: { slug: "m1-set" } })).toMatchObject({ tierStacking: "UNKNOWN" });
    expect(await db.ninjaRole.findUniqueOrThrow({ where: { key: "m1-role" } })).toMatchObject({ mappingStatus: "UNMAPPED", mappedFormationId: null });
    // The M1 "default talent" flag survives as data but is no longer a selection.
    const detail = (await getNinjaDetail(db, "m1-ninja"))!;
    expect(detail.talentGroups[0]!.selectedOptionIds).toEqual([]);
    expect(detail.abilities[0]!.effects[0]!).toMatchObject({ value: 12.5, chancePercent: 37.5, status: null });
    expect(detail.abilities[0]!.effects[0]!.conditions[0]).toMatchObject({ typeKey: "nature", valueKey: "m1-nature", scope: "ACTIVATION" });
  });

  it("leaves foreign keys, indexes and triggers valid", async () => {
    expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]);
    expect(await db.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check")).toEqual([{ integrity_check: "ok" }]);
    const objects = await db.$queryRawUnsafe<{ type: string; name: string }[]>("SELECT type, name FROM sqlite_master WHERE type IN ('index','trigger')");
    const names = new Set(objects.map((o) => o.name));
    for (const index of ["Ninja_releaseYear_releaseMonth_releaseOrder_idx", "Ninja_ratingId_idx", "Ninja_formationId_idx", "Ninja_clientCombatClass_idx", "Ninja_slug_key", "NinjaBaseStat_statisticId_baseValue_idx", "Effect_statisticId_valueType_value_idx", "Effect_statusEffectId_idx", "Condition_conditionTypeId_conditionValueId_idx", "Equipment_setId_idx", "Jewelry_setId_idx", "EquipmentSetBonus_setId_requiredPieces_key", "SourceRecord_key_key"]) {
      expect(names.has(index), index).toBe(true);
    }
    expect(objects.filter((o) => o.type === "trigger")).toHaveLength(30);
    // Constraints bite on the upgraded database, and the new services work on the old rows.
    expect(await dbRejects(() => db.ninja.update({ where: { slug: "m1-ninja" }, data: { clientCombatClass: "BOTH" } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.effect.update({ where: { id: "e1" }, data: { gemId: "gm1" } }))).toBe(TRIGGER_REJECTION);
    const upgraded = await upsertNinja(db, { name: "M1 Ninja", slug: "m1-ninja", release: { year: 2020, month: 4 }, clientCombatClass: "TANK" });
    expect(upgraded).toMatchObject({ id: "n1", created: false });
    expect(await db.ability.count({ where: { ninjaId: "n1" } })).toBe(1); // untouched children stay
  });
});
