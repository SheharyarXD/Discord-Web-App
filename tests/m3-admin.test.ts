import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAbilityParser, type Lexicon } from "../src/domain/ability-text";
import { saveAbilityText } from "../src/game/ability-editor";
import { gameApi } from "../src/game/api";
import { ValidationError } from "../src/game/db";
import { getNinjaDetail, upsertNinja } from "../src/game/ninjas";
import { createUser, deleteUser, listUsers, resetPassword, updateUser, UserRuleError } from "../src/game/users";
import { REFERENCE_DIR, seedTestVocabulary, testDb } from "./helpers";

const db = testDb();
const parser = createAbilityParser(JSON.parse(readFileSync(path.join(REFERENCE_DIR, "lexicon.json"), "utf8")) as Lexicon);
const P = "t3a-";
const mail = (n: string) => `${P}${n}@t3.test`;
const PASSWORD = "correct-horse-battery";

beforeAll(async () => {
  await seedTestVocabulary(db);
  for (const [key, name] of [["force", "Force"], ["agility", "Agility"]] as const) await db.statistic.upsert({ where: { key }, update: {}, create: { key, name } });
  for (const [key, name] of [["control-rate", "Control rate"], ["damage-rate", "Damage rate"], ["avoid-injury", "Avoid injury"]] as const) {
    await db.statistic.upsert({ where: { key }, update: {}, create: { key, name, category: "combat", defaultValueType: "PERCENT" } });
  }
  await db.statusEffect.upsert({ where: { key: "shatter-storm" }, update: {}, create: { key: "shatter-storm", name: "Shatter Storm" } });
  await upsertNinja(db, { name: "T3A Editable", slug: `${P}editable`, status: "PUBLISHED" });
});
afterAll(async () => {
  await db.ninja.deleteMany({ where: { slug: { startsWith: P } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@t3.test" } } });
  await db.$disconnect();
});

describe("accounts", () => {
  it("creates an account with a hashed password and never returns the hash", async () => {
    const u = await createUser(db, { email: " Alice@T3.test ".replace("Alice", `${P}alice`), name: "Alice", password: PASSWORD });
    expect(u).toMatchObject({ email: mail("alice"), name: "Alice", role: "USER", isActive: true });
    expect(Object.keys(u)).not.toContain("passwordHash");
    const stored = await db.user.findUniqueOrThrow({ where: { email: mail("alice") } });
    expect(stored.passwordHash).not.toContain(PASSWORD);
    expect(await bcrypt.compare(PASSWORD, stored.passwordHash)).toBe(true);
  });
  it("rejects a short password, a bad email and a duplicate", async () => {
    await expect(createUser(db, { email: mail("short"), password: "123" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createUser(db, { email: "not-an-email", password: PASSWORD })).rejects.toBeInstanceOf(ValidationError);
    await expect(createUser(db, { email: mail("alice"), password: PASSWORD })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(await db.user.count({ where: { email: mail("short") } })).toBe(0);
  });
  it("lists accounts without password data", async () => {
    const rows = await listUsers(db);
    expect(rows.some((r) => r.email === mail("alice"))).toBe(true);
    expect(rows.every((r) => !("passwordHash" in r))).toBe(true);
  });
  it("changing a role or deactivating ends that user's sessions", async () => {
    const alice = (await db.user.findUniqueOrThrow({ where: { email: mail("alice") } }))!;
    const bob = await createUser(db, { email: mail("bob"), password: PASSWORD, role: "ADMIN" });
    await db.session.create({ data: { tokenHash: `${P}tok-1`, userId: alice.id, expiresAt: new Date(Date.now() + 1e7) } });
    await updateUser(db, bob.id, alice.id, { isActive: false });
    expect(await db.session.count({ where: { userId: alice.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: alice.id } })).isActive).toBe(false);
    await updateUser(db, bob.id, alice.id, { isActive: true, name: "Alice B" });
    expect((await db.user.findUniqueOrThrow({ where: { id: alice.id } })).name).toBe("Alice B");
  });
  it("an administrator cannot demote, deactivate or delete themselves", async () => {
    const bob = (await db.user.findUniqueOrThrow({ where: { email: mail("bob") } }))!;
    await expect(updateUser(db, bob.id, bob.id, { role: "USER" })).rejects.toMatchObject({ code: "SELF" });
    await expect(updateUser(db, bob.id, bob.id, { isActive: false })).rejects.toMatchObject({ code: "SELF" });
    await expect(deleteUser(db, bob.id, bob.id)).rejects.toMatchObject({ code: "SELF" });
    expect((await db.user.findUniqueOrThrow({ where: { id: bob.id } })).role).toBe("ADMIN");
  });
  it("the last active administrator can never be removed by anyone", async () => {
    // Make bob the only active admin, then try to remove him as someone else.
    const others = await db.user.findMany({ where: { role: "ADMIN", isActive: true, email: { not: mail("bob") } } });
    const saved = others.map((u) => u.id);
    await db.user.updateMany({ where: { id: { in: saved } }, data: { isActive: false } });
    try {
      const bob = (await db.user.findUniqueOrThrow({ where: { email: mail("bob") } }))!;
      const alice = (await db.user.findUniqueOrThrow({ where: { email: mail("alice") } }))!;
      await expect(updateUser(db, alice.id, bob.id, { role: "USER" })).rejects.toMatchObject({ code: "LAST_ADMIN" });
      await expect(updateUser(db, alice.id, bob.id, { isActive: false })).rejects.toMatchObject({ code: "LAST_ADMIN" });
      await expect(deleteUser(db, alice.id, bob.id)).rejects.toMatchObject({ code: "LAST_ADMIN" });
      expect((await db.user.findUniqueOrThrow({ where: { id: bob.id } })).isActive).toBe(true);
    } finally {
      await db.user.updateMany({ where: { id: { in: saved } }, data: { isActive: true } });
    }
  });
  it("resetting a password replaces the hash and ends the sessions", async () => {
    const alice = (await db.user.findUniqueOrThrow({ where: { email: mail("alice") } }))!;
    await db.session.create({ data: { tokenHash: `${P}tok-2`, userId: alice.id, expiresAt: new Date(Date.now() + 1e7) } });
    await resetPassword(db, alice.id, "another-long-password");
    const after = await db.user.findUniqueOrThrow({ where: { id: alice.id } });
    expect(await bcrypt.compare("another-long-password", after.passwordHash)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, after.passwordHash)).toBe(false);
    expect(await db.session.count({ where: { userId: alice.id } })).toBe(0);
    await expect(resetPassword(db, alice.id, "short")).rejects.toBeInstanceOf(ValidationError);
  });
  it("deletes another account and reports an unknown one", async () => {
    const bob = (await db.user.findUniqueOrThrow({ where: { email: mail("bob") } }))!;
    const carol = await createUser(db, { email: mail("carol"), password: PASSWORD });
    await deleteUser(db, bob.id, carol.id);
    expect(await db.user.count({ where: { id: carol.id } })).toBe(0);
    await expect(deleteUser(db, bob.id, "missing")).rejects.toBeInstanceOf(UserRuleError);
  });
  it("only an administrator reaches these operations through the game API", async () => {
    const admin = (await db.user.findUniqueOrThrow({ where: { email: mail("bob") } }))!;
    const api = gameApi(db, { id: admin.id, role: "ADMIN" });
    expect((await api.listUsers()).length).toBeGreaterThan(0);
    await expect(api.updateUser(admin.id, { role: "USER" })).rejects.toMatchObject({ code: "SELF" });
  });
});

describe("ability editor", () => {
  const slug = `${P}editable`;
  it("stores a skill from pasted English and Spanish lines the way the importer does", async () => {
    const saved = await saveAbilityText(
      db,
      {
        ninjaSlug: slug, kind: "skill", name: "Test Skill", nameEs: "Habilidad de prueba",
        linesEn: ["Attacks enemies with 300% growth rate.", "Makes 2 random allies enter (20%) shatter storm state for 2 rounds."],
        linesEs: ["Ataca a los enemigos con una tasa de crecimiento del 300%.", "Hace que 2 aliados aleatorios entren en tormenta destructora (20%) durante 2 rondas."],
      },
      parser,
    );
    expect(saved.effectRows).toBe(2);
    const skill = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.abilities.find((a) => a.name === "Test Skill")!;
    expect(skill).toMatchObject({ nameEs: "Habilidad de prueba", translationStatus: "SOURCE_PROVIDED", description: expect.stringContaining("300% growth rate") });
    expect(skill.effects[0]).toMatchObject({ kind: "ATTACK", rateValue: 300, rateKind: "GROWTH", chancePercent: null, sourceText: "Attacks enemies with 300% growth rate.", descriptionEs: expect.stringContaining("300%") });
    // (20%) is the strength of this usage, never a chance.
    expect(skill.effects[1]).toMatchObject({ kind: "STATUS", chancePercent: null, targetCount: 2, targetSelector: "RANDOM" });
    expect(skill.effects[1]!.status!.magnitudeOverride).toBe(20);
  });
  it("editing replaces the effects instead of adding a second ability", async () => {
    const before = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.abilities.find((a) => a.name === "Test Skill")!;
    await saveAbilityText(db, { ninjaSlug: slug, kind: "skill", name: "Test Skill", existingId: before.id, linesEn: ["Increases self force by 10%."] }, parser);
    const abilities = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.abilities.filter((a) => a.name === "Test Skill");
    expect(abilities).toHaveLength(1);
    expect(abilities[0]!.id).toBe(before.id);
    expect(abilities[0]!.effects.map((e) => [e.statisticName, e.value])).toEqual([["Force", 10]]);
    expect(abilities[0]!.translationStatus).toBe("MISSING");
  });
  it("keeps what it cannot structure as text and flags it", async () => {
    await saveAbilityText(db, { ninjaSlug: slug, kind: "passive", name: "Odd Passive", linesEn: ["Does something nobody has described yet."] }, parser);
    const odd = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.abilities.find((a) => a.name === "Odd Passive")!;
    expect(odd.effects[0]).toMatchObject({ kind: "TEXT", structuredStatus: "TEXT_ONLY", sourceText: "Does something nobody has described yet." });
    expect(odd.reviewStatus).toBe("PARTIALLY_CONFIRMED");
  });
  it("flags English and Spanish lines that disagree and does not pair lines of different counts", async () => {
    await saveAbilityText(db, { ninjaSlug: slug, kind: "skill", name: "Mismatch", linesEn: ["Increases self force by 10%."], linesEs: ["Aumenta la fuerza propia en 25%."] }, parser);
    const m = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.abilities.find((a) => a.name === "Mismatch")!;
    expect(m.note).toContain("ES_NUMBERS_DIFFER");
    await saveAbilityText(db, { ninjaSlug: slug, kind: "skill", name: "Count", linesEn: ["Increases self force by 10%."], linesEs: ["a", "b"] }, parser);
    const c = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.abilities.find((a) => a.name === "Count")!;
    expect(c.note).toContain("ES_LINE_COUNT_DIFFERS");
    expect(c.effects.every((e) => e.descriptionEs === null)).toBe(true);
  });
  it("a talent and its awakenings: awakening 2 replaces awakening 1 (client rule), awakening 1 stays UNKNOWN against the base", async () => {
    const talent = await saveAbilityText(db, { ninjaSlug: slug, kind: "talent", name: "Test Talent", linesEn: ["Increases self agility by 10%."] }, parser);
    await saveAbilityText(db, { ninjaSlug: slug, kind: "talent_awakening", name: "Awakening 1", stage: 1, parentId: talent.id, linesEn: ["Increases self force by 20%."] }, parser);
    await saveAbilityText(db, { ninjaSlug: slug, kind: "talent_awakening", name: "Awakening 2", stage: 2, parentId: talent.id, linesEn: ["Increases self force by 30%."] }, parser);
    const option = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.talentGroups[0]!.options.find((o) => o.name === "Test Talent")!;
    const [first, second] = option.awakenings;
    expect([first!.stage, first!.stackingRule, first!.supersedesId]).toEqual([1, "UNKNOWN", null]);
    expect([second!.stage, second!.stackingRule, second!.supersedesId]).toEqual([2, "REPLACES_PRIOR", first!.id]);
    expect(second!.ruleSourceText).toMatch(/^Client decision/);
    // An unnumbered awakening is never given a rule it was not given.
    await saveAbilityText(db, { ninjaSlug: slug, kind: "talent_awakening", name: "Unnumbered", parentId: talent.id, linesEn: ["Increases self force by 5%."] }, parser);
    const again = (await getNinjaDetail(db, slug, { includeUnpublished: true }))!.talentGroups[0]!.options.find((o) => o.name === "Test Talent")!;
    expect(again.awakenings.find((x) => x.name === "Unnumbered")!.stackingRule).toBe("UNKNOWN");
    expect(option.effects.map((e) => e.statisticName)).toEqual(["Agility"]);
  });
  it("an awakening needs its parent, and unknown ninjas are rejected", async () => {
    await expect(saveAbilityText(db, { ninjaSlug: slug, kind: "talent_awakening", name: "Orphan", linesEn: [] }, parser)).rejects.toThrow(/parent of the awakening/);
    await expect(saveAbilityText(db, { ninjaSlug: "no-such-ninja", kind: "skill", name: "x", linesEn: [] }, parser)).rejects.toThrow(/Unknown ninja/);
  });
});
