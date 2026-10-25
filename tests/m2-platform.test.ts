import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FEATURES } from "../src/config/features";
import { MAIN_NAV, visibleNav } from "../src/components/layout/nav-items";
import { localize } from "../src/domain/localize";
import { gameApi } from "../src/game/api";
import { upsertNinja } from "../src/game/ninjas";
import { recordEvidence, registerAsset } from "../src/game/provenance";
import { getStatusEffect, upsertStatusEffect } from "../src/game/status-effects";
import { createTranslator, DEFAULT_LOCALE } from "../src/i18n";
import { ForbiddenError } from "../src/server/auth/permissions";
import { IS_PG, dbRejects, failure, seedTestVocabulary, testDb, TRIGGER_REJECTION } from "./helpers";

const db = testDb();
const ROOT = path.resolve(__dirname, "..");

beforeAll(() => seedTestVocabulary(db));
afterAll(() => db.$disconnect());

describe("14. gems", () => {
  it("the Gems entry is hidden by default while every other section stays", () => {
    expect(FEATURES.gems).toBe(false);
    const user = visibleNav(FEATURES, false).map((i) => i.href);
    expect(user).not.toContain("/gems");
    expect(user).toEqual(["/", "/ninjas", "/equipment", "/jewelry", "/sets", "/effects", "/search"]);
    expect(visibleNav(FEATURES, true).map((i) => i.href)).toEqual([...user, "/admin", "/preview"]);
    expect(MAIN_NAV.some((i) => i.href === "/gems")).toBe(true); // still defined, only switched off
    expect(visibleNav({ gems: true }, false).map((i) => i.href)).toContain("/gems");
  });

  it("the gem schema and its data survive", async () => {
    const type = await db.gemType.create({ data: { key: "t14-type", name: "T14 type" } });
    const gem = await db.gem.create({
      data: { slug: "t14-gem", name: "T14 gem", gemTypeId: type.id, level: 3, effects: { create: [{ description: "t14 placeholder effect" }] } },
      include: { effects: true },
    });
    expect(gem.effects).toHaveLength(1);
    expect(await db.gem.count({ where: { slug: "t14-gem" } })).toBe(1);
  });
});

describe("15. i18n and translation status", () => {
  it("Spanish is the default interface language", () => {
    expect(DEFAULT_LOCALE).toBe("es");
    const t = createTranslator();
    expect(t("nav.effects")).toBe("Efectos");
    expect(t("glossary.cleansability.UNCLEANSABLE")).toBe("No purificable");
    expect(t("ninja.combatClassValue.TANK")).toBe("Tanque");
    expect(t("effects.rounds", { turns: 2 })).toBe("2 rondas");
  });

  it("untranslated content is shown as the original and flagged, never passed off as translated", async () => {
    await upsertStatusEffect(db, { key: "t15-status", name: "T15 Status", description: "Increases speed by 15%" });
    const stored = (await getStatusEffect(db, "t15-status"))!;
    expect(stored).toMatchObject({ description: "Increases speed by 15%", descriptionEs: null, translationStatus: "MISSING" });
    expect(localize(stored.description, stored.descriptionEs, stored.translationStatus)).toEqual({ text: "Increases speed by 15%", isSourceFallback: true, isDraft: false });
    // A Spanish text sitting in the column does not count while its status says MISSING.
    expect(localize("Increases speed by 15%", "Aumenta la velocidad un 15%", "MISSING").isSourceFallback).toBe(true);
  });

  it("a draft translation is shown as a draft; a verified one is shown plainly; the source is kept", async () => {
    await upsertStatusEffect(db, { key: "t15-status", name: "T15 Status", description: "Increases speed by 15%", descriptionEs: "Aumenta la velocidad un 15%", translationStatus: "DRAFT" });
    const draft = (await getStatusEffect(db, "t15-status"))!;
    expect(draft.description).toBe("Increases speed by 15%"); // source wording preserved
    expect(localize(draft.description, draft.descriptionEs, draft.translationStatus)).toEqual({ text: "Aumenta la velocidad un 15%", isSourceFallback: false, isDraft: true });
    expect(localize("x", "y", "VERIFIED")).toEqual({ text: "y", isSourceFallback: false, isDraft: false });
    expect(localize("x", "y", "VERIFIED", "en").text).toBe("x");
  });

  it("a ninja keeps its original name and gets a separate Spanish one", async () => {
    await upsertNinja(db, { name: "T15 Original Name", nameEs: "T15 Nombre", description: "Source text", translationStatus: "DRAFT" });
    const row = await db.ninja.findUniqueOrThrow({ where: { slug: "t15-original-name" } });
    expect([row.name, row.nameEs, row.description, row.descriptionEs, row.translationStatus]).toEqual(["T15 Original Name", "T15 Nombre", "Source text", null, "DRAFT"]);
  });
});

describe("16. authorization", () => {
  const anonymous = null;
  const user = { id: "t16-user", role: "USER" as const };
  const admin = { id: "t16-admin", role: "ADMIN" as const };

  it("anonymous callers reach nothing — neither reads nor writes", async () => {
    const api = gameApi(db, anonymous);
    expect(() => api.listNinjas()).toThrow(ForbiddenError);
    expect(() => api.getNinja("anything")).toThrow(ForbiddenError);
    expect(() => api.listStatusEffects()).toThrow(ForbiddenError);
    expect(() => api.listSets()).toThrow(ForbiddenError);
    expect(() => api.upsertNinja({ name: "T16 anon" })).toThrow(ForbiddenError);
    expect(() => api.selectTalent("g", [])).toThrow(ForbiddenError);
    expect(await db.ninja.count({ where: { slug: "t16-anon" } })).toBe(0);
  });

  it("a regular user can read but cannot change any game record", async () => {
    const api = gameApi(db, user);
    await expect(api.listNinjas({ pageSize: 1 })).resolves.toMatchObject({ pageSize: 1 });
    await expect(api.listStatusEffects()).resolves.toBeInstanceOf(Array);
    const writes: [string, () => unknown][] = [
      ["upsertNinja", () => api.upsertNinja({ name: "T16 user" })],
      ["upsertStatusEffect", () => api.upsertStatusEffect({ name: "T16 status" })],
      ["upsertEquipmentSet", () => api.upsertEquipmentSet({ name: "T16 set" })],
      ["upsertJewelrySet", () => api.upsertJewelrySet({ name: "T16 jewelry" })],
      ["ensureRating", () => api.ensureRating({ key: "T16", name: "T16" })],
      ["ensureFormation", () => api.ensureFormation({ key: "t16", name: "T16" })],
      ["ensureRole", () => api.ensureRole({ key: "t16", name: "T16", mappingStatus: "APPROVED" })],
      ["ensureStatistic", () => api.ensureStatistic({ key: "t16", name: "T16" })],
      ["registerAsset", () => api.registerAsset({ path: "t16", category: "DOCUMENT" })],
      ["recordEvidence", () => api.recordEvidence({ key: "t16", assetPath: "t16", reviewStatus: "CONFIRMED" })],
    ];
    for (const [name, write] of writes) expect(write, name).toThrow(ForbiddenError);
    expect(await db.ninja.count({ where: { slug: "t16-user" } })).toBe(0);
    expect(await db.statusEffect.count({ where: { key: "t16-status" } })).toBe(0);
    expect(await db.ninjaRating.count({ where: { key: "T16" } })).toBe(0);
  });

  it("every mutation of the API is covered by the write guard", () => {
    const api = gameApi(db, user) as unknown as Record<string, (...args: unknown[]) => unknown>;
    const readers = new Set(["listNinjas", "getNinja", "listStatusEffects", "getStatusEffect", "findStatusEffectsByTerm", "listSets", "getEquipmentSet", "getJewelrySet", "selectTalent", "listItems", "listItemFacets", "listNinjaFacets", "listStatistics", "listItemChoices", "getItemDetail", "searchAll"]);
    const mutations = Object.keys(api).filter((k) => !readers.has(k));
    expect(mutations.length).toBeGreaterThanOrEqual(15);
    for (const name of mutations) expect(() => api[name]!({}), name).toThrow(ForbiddenError);
  });

  it("the administrator can write, and reads see drafts", async () => {
    const api = gameApi(db, admin);
    const { slug } = await api.upsertNinja({ name: "T16 admin draft" });
    expect((await api.getNinja(slug))?.status).toBe("DRAFT");
    expect(await gameApi(db, user).getNinja(slug)).toBeNull(); // readers never see drafts
  });

  it("a user can only ever set their OWN talent pick", async () => {
    const a = await db.user.create({ data: { email: "t16-a@example.test", passwordHash: "x" } });
    const b = await db.user.create({ data: { email: "t16-b@example.test", passwordHash: "x" } });
    const { id } = await upsertNinja(db, { name: "T16 talents", status: "PUBLISHED", talentGroups: [{ options: [{ name: "A" }, { name: "B" }] }] });
    const group = await db.talentGroup.findFirstOrThrow({ where: { ninjaId: id }, include: { options: true } });
    const before = await db.ninja.findUniqueOrThrow({ where: { id } });
    await gameApi(db, { id: a.id, role: "USER" }).selectTalent(group.id, [group.options[0]!.id]);
    expect(await db.userTalentSelection.count({ where: { userId: a.id } })).toBe(1);
    expect(await db.userTalentSelection.count({ where: { userId: b.id } })).toBe(0);
    expect((await gameApi(db, { id: b.id, role: "USER" }).getNinja("t16-talents"))!.talentGroups[0]!.selectedOptionIds).toEqual([]);
    // Picking a talent never edits the ninja.
    expect(await db.ninja.findUniqueOrThrow({ where: { id } })).toEqual(before);
  });
});

describe("provenance", () => {
  it("evidence points at one entity at most, and unattached evidence is allowed", async () => {
    await registerAsset(db, { path: "t17/asset.png", category: "SCREENSHOT", reviewed: true });
    const { id } = await upsertNinja(db, { name: "T17 sourced" });
    const status = await db.statusEffect.findFirstOrThrow();
    await recordEvidence(db, { key: "t17:a", assetPath: "t17/asset.png", sourceText: "verbatim", reviewStatus: "CONFIRMED" }, { ninjaId: id });
    await recordEvidence(db, { key: "t17:staged", assetPath: "t17/asset.png", sourceText: "owner unknown", reviewStatus: "NEEDS_REVIEW" });
    await recordEvidence(db, { key: "t17:a", assetPath: "t17/asset.png", sourceText: "verbatim, corrected", reviewStatus: "PARTIALLY_CONFIRMED" }, { ninjaId: id });
    expect(await db.sourceRecord.count({ where: { key: { startsWith: "t17:" } } })).toBe(2);
    expect((await db.sourceRecord.findUniqueOrThrow({ where: { key: "t17:a" } })).sourceText).toBe("verbatim, corrected");
    expect((await db.sourceRecord.findUniqueOrThrow({ where: { key: "t17:staged" } })).ninjaId).toBeNull();
    const asset = await db.sourceAsset.findUniqueOrThrow({ where: { path: "t17/asset.png" } });
    expect(asset.capturedAt).toBeNull(); // a capture date is never assumed
    expect(await dbRejects(() => db.sourceRecord.create({ data: { key: "t17:two", assetId: asset.id, ninjaId: id, statusEffectId: status.id } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.sourceRecord.create({ data: { key: "t17:bad", assetId: asset.id, reviewStatus: "SURE" } }))).toBe(TRIGGER_REJECTION);
    await expect(recordEvidence(db, { key: "t17:x", assetPath: "missing.png", reviewStatus: "CONFIRMED" })).rejects.toThrow(/Unknown source asset/);
  });
});

describe("integrity triggers", () => {
  it.skipIf(!IS_PG)("PostgreSQL: every trigger declared in prisma/postgres/constraints.sql exists after migrating", async () => {
    const declared = [...readFileSync(path.join(ROOT, "prisma/postgres/constraints.sql"), "utf8").matchAll(/CREATE TRIGGER "([^"]+)"/g)].map((m) => m[1]!).sort();
    const present = (await db.$queryRawUnsafe<{ tgname: string }[]>("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname")).map((r) => r.tgname);
    expect(declared.length).toBe(16);
    expect(present).toEqual(declared);
    const sql = readFileSync(path.join(ROOT, "prisma/postgres/migrations/20261026000000_postgres_baseline/migration.sql"), "utf8").replace(/\r\n/g, "\n");
    expect(sql.endsWith(readFileSync(path.join(ROOT, "prisma/postgres/constraints.sql"), "utf8").replace(/\r\n/g, "\n"))).toBe(true);
  });

  it.skipIf(IS_PG)("every trigger declared in prisma/constraints.sql exists after migrating", async () => {
    const declared = [...readFileSync(path.join(ROOT, "prisma/constraints.sql"), "utf8").matchAll(/CREATE TRIGGER "([^"]+)"/g)].map((m) => m[1]!).sort();
    const present = (await db.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")).map((r) => r.name);
    expect(declared.length).toBe(30);
    expect(present).toEqual(declared);
  });

  it("the triggers are what rejects bad rows, with their own message", async () => {
    const raw = (sql: string) => failure(() => db.$executeRawUnsafe(sql));
    const now = "'2026-01-01T00:00:00.000+00:00'";
    expect(await raw(`INSERT INTO "Ninja" ("id","slug","name","releaseYear","releaseMonth","updatedAt") VALUES ('raw1','raw-1','x',2025,13,${now})`)).toMatch(/CHECK Ninja\.releaseMonth/);
    expect(await raw(`INSERT INTO "Ninja" ("id","slug","name","clientCombatClass","updatedAt") VALUES ('raw2','raw-2','x','TANK,DPS',${now})`)).toMatch(/CHECK Ninja\.clientCombatClass: must be TANK, DPS or NULL/);
    expect(await raw(`INSERT INTO "Effect" ("id","description","updatedAt") VALUES ('raw3','no owner',${now})`)).toMatch(/CHECK Effect: exactly one owner/);
    expect(await raw(`INSERT INTO "StatusEffect" ("id","key","name","polarity","updatedAt") VALUES ('raw4','raw-4','x','GOOD',${now})`)).toMatch(/CHECK StatusEffect/);
    expect(await db.ninja.count({ where: { slug: { startsWith: "raw-" } } })).toBe(0);
  });

  it.skipIf(IS_PG)("the migration carries the same trigger statements as the reference file", () => {
    const migrations = path.join(ROOT, "prisma/migrations");
    // The latest migration that rebuilds tables re-creates every trigger, so it is the one that must match.
    const m2 = readdirSync(migrations).find((d) => d.endsWith("_m2_ninja_profiles"))!;
    const sql = readFileSync(path.join(migrations, m2, "migration.sql"), "utf8").replace(/\r\n/g, "\n");
    const reference = readFileSync(path.join(ROOT, "prisma/constraints.sql"), "utf8").replace(/\r\n/g, "\n");
    expect(sql.endsWith(reference)).toBe(true);
  });
});

describe("no Discord integration", () => {
  const SCAN = ["src", "prisma", "data"];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs|json|sql|prisma)$/.test(name)) files.push(full);
    }
  };
  SCAN.forEach((d) => walk(path.join(ROOT, d)));

  it("no code talks to Discord, and no Discord library is installed", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => /discord/i.test(d))).toEqual([]);
    const offenders = files.filter((f) => /discord\.com|discordapp|discord\.js|discord\.gg|gateway\.discord|DISCORD_TOKEN|webhook/i.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("the game services and the loader make no network calls", () => {
    const game = files.filter((f) => f.includes(`${path.sep}src${path.sep}game${path.sep}`) || f.endsWith("ingest-reference.ts"));
    expect(game.length).toBeGreaterThan(8);
    const offenders = game.filter((f) => /\bfetch\(|https?:\/\/|node:https?|node:net|axios|WebSocket/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});
