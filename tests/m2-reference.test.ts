import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveAwakenings } from "../src/domain/awakenings";
import { resolveEffectUsage } from "../src/domain/effects";
import { getNinjaDetail, listNinjas } from "../src/game/ninjas";
import { analyzeReleaseList, loadReferenceData, readReferenceFile, type ReferenceInventory, type ReleaseFile, type StagedEvidenceFile } from "../src/game/reference-loader";
import { findStatusEffectsByTerm, getStatusEffect, listStatusEffects } from "../src/game/status-effects";
import { IS_PG, HANDOFF_DIR, REFERENCE_DIR, testDb } from "./helpers";

const db = testDb();
let first: ReferenceInventory;
let second: ReferenceInventory;
const release = readReferenceFile<ReleaseFile>(REFERENCE_DIR, "release-order.json");

beforeAll(async () => {
  first = await loadReferenceData(db, REFERENCE_DIR);
  second = await loadReferenceData(db, REFERENCE_DIR);
}, 180_000);
afterAll(() => db.$disconnect());

/** Ninjas that came from the release list, whatever other test files created. */
const fromReleaseList = { sourceRecords: { some: { key: { startsWith: "release:" } } } };

describe("staged release list", () => {
  const analysis = analyzeReleaseList(release);

  it("has one valid, distinct entry per line and reports its own gaps", () => {
    expect(analysis.entries).toHaveLength(167);
    expect(analysis.invalid).toEqual([]);
    expect(analysis.duplicateSlugs).toEqual([]);
    expect(new Set(analysis.entries.map((e) => e.slug)).size).toBe(167);
    expect([analysis.first, analysis.last]).toEqual(["2012-11", "2026-09"]);
    expect(analysis.gapMonths).toEqual([]);
    expect(analysis.sharedMonths).toEqual([]);
    expect(analysis.neverFullyLegible).toEqual([]);
    // The one join between captures that no shared line confirms is reported, not hidden.
    expect(analysis.uncheckedBoundaries).toHaveLength(1);
    expect(analysis.uncheckedBoundaries[0]!.afterOrder).toBe(85);
  });

  it("is in ascending source order with consecutive months", () => {
    const periods = analysis.entries.map((e) => e.year * 12 + e.month);
    expect(periods.every((p, i) => i === 0 || p === periods[i - 1]! + 1)).toBe(true);
    expect(analysis.entries[0]).toMatchObject({ name: "Cursed Seal Sasuke", year: 2012, month: 11, order: 1 });
    expect(analysis.entries.at(-1)).toMatchObject({ name: "Sasuke (Taka)", year: 2026, month: 9, order: 167 });
  });

  it("every capture it cites is a real supplied file", () => {
    for (const capture of release.captures) {
      expect(existsSync(path.join(HANDOFF_DIR, "03_REFERENCE_IMAGES", capture.asset)), capture.asset).toBe(true);
    }
  });

  it("flags a duplicated name instead of inserting it twice", () => {
    const withDuplicate = analyzeReleaseList({ captures: [], entries: [[2020, 1, "Same Name"], [2021, 2, "Same Name"], [2021, 2, "Other"]] });
    expect(withDuplicate.duplicateSlugs).toEqual([{ slug: "same-name", names: ["Same Name", "Same Name"] }]);
    expect(withDuplicate.sharedMonths).toEqual(["2021-02"]);
    expect(withDuplicate.gapMonths).toHaveLength(12);
  });
});

describe("loading the reference data", () => {
  it("inserts each release exactly once; overlapping screenshots add evidence, not ninjas", async () => {
    expect(first.release).toMatchObject({ staged: 167, ninjasCreated: 167, ninjasUpdated: 0, releaseChanged: [], skippedDuplicates: [] });
    expect(await db.ninja.count({ where: fromReleaseList })).toBe(167);
    // Kurotsuchi (March 2022) is fully legible in two captures: one ninja, two evidence rows.
    const kurotsuchi = await db.ninja.findUniqueOrThrow({ where: { slug: "kurotsuchi" }, include: { sourceRecords: true } });
    expect([kurotsuchi.releaseYear, kurotsuchi.releaseMonth, kurotsuchi.releaseOrder]).toEqual([2022, 3, 113]);
    const releaseRecords = kurotsuchi.sourceRecords.filter((r) => !r.key.startsWith("profile:"));
    expect(releaseRecords).toHaveLength(2);
    expect(releaseRecords.every((r) => r.sourceText === "Kurotsuchi (March 2022)" && r.reviewStatus === "CONFIRMED")).toBe(true);
  });

  it("is idempotent: a second run creates nothing", async () => {
    expect(second.release).toMatchObject({ ninjasCreated: 0, ninjasUpdated: 167 });
    expect(second.totals).toEqual(first.totals);
    expect(second.glossary).toEqual(first.glossary);
  });

  it("keeps same-character variants apart", async () => {
    const madaras = await db.ninja.findMany({ where: { ...fromReleaseList, name: { contains: "Madara" } }, orderBy: { releaseOrder: "asc" } });
    expect(madaras.map((n) => [n.name, n.releaseYear, n.releaseMonth])).toEqual([
      ["Uchiha Madara", 2014, 1],
      ["Reanimated Madara", 2014, 2],
      ["Six Paths Madara", 2014, 3],
      ["Three Eyed Madara", 2014, 9],
      ["Madara & Obito", 2016, 5],
      ["Hashirama-Madara", 2023, 12],
      ["Legend Madara", 2025, 4],
      ["Uchiha Madara (Moon's Eye)", 2026, 3],
    ]);
    for (const pair of [["uchiha-obito-golden", "uchiha-obito"], ["uzumaki-kushina", "uzumaki-kushina-summer"], ["7th-hokage", "7th-hokage-shadow"], ["might-guy", "might-gai-gate-of-death"]]) {
      expect(await db.ninja.count({ where: { slug: { in: pair } } }), pair.join(" / ")).toBe(2);
    }
  });

  it("lists them newest first", async () => {
    const page = await listNinjas(db, { releasedFrom: { year: 2026, month: 5 }, releasedTo: { year: 2026, month: 9 }, nameContains: "(" });
    expect(page.items.map((n) => n.name)).toEqual(["Sasuke (Taka)", "Orochimaru (Akatsuki)", "Tsunade-Sakura (Summer)", "Hinata (Soccer Star)", "Naruto (6-tails mode)"]);
  });

  it("a ninja without a card is sparse: no rating, type, class or stats are invented", async () => {
    const ninja = (await getNinjaDetail(db, "sasuke-taka"))!;
    expect(ninja).toMatchObject({
      name: "Sasuke (Taka)", release: { year: 2026, month: 9 }, releaseOrder: 167, rating: null, type: null, clientCombatClass: null, baseStats: [],
    });
    // The approved Assaulter = Center rule still gives it its primary attribute (Force) without a card.
    // Since the Supporter package arrived every ninja of the release list has a profile; only Might Guy and Sasuke (Taka) still lack a card.
    expect(first.profiles!.releaseOnly).toHaveLength(0);
    const noCard = await db.ninja.findMany({ where: { baseStats: { none: {} } }, select: { name: true }, orderBy: { name: "asc" } });
    expect(noCard.map((n) => n.name)).toEqual(["Might Guy", "Sasuke (Taka)"]);
    const sparse = await db.ninja.count({ where: { ...fromReleaseList, ratingId: null, formationId: null, roleId: null, ninjaTypeId: null, clientCombatClass: null, abilities: { none: {} }, baseStats: { none: {} } } });
    expect(sparse).toBe(0);
  });

  it("stores exactly what the Madara (Moon's Eye) card prints", async () => {
    const madara = (await getNinjaDetail(db, "uchiha-madara-moon-s-eye"))!;
    expect(madara).toMatchObject({
      release: { year: 2026, month: 3 },
      rating: { key: "SSR" },
      type: { name: "Genjutsu" },
      formation: { key: "support", nameEs: "Apoyo", origin: "DIRECT" },
      role: { key: "supporters", mappingStatus: "PROPOSED" },
      primaryStat: { key: "chakra" },
      clientCombatClass: null, // the client has not classified it; never derived from the numbers
      description: "Fate is merely an excuse for the weak. The strong create their own path!",
    });
    expect(madara.baseStats.map((s) => [s.sourceLabel, s.baseValue, s.growthRate])).toEqual([
      ["Force", "22500", "22.5"],
      ["Chakra", "44000", "44"],
      ["Agility", "44500", "44.5"],
      ["HP", "440000", "44"],
    ]);
    // Its ability text arrived with the Supporter package: the same record now carries the talent, the skill and the talent awakening, with text.
    const skill = madara.abilities.find((a) => a.type.key === "skill")!;
    expect([skill.name, skill.effects.length > 0, skill.description?.startsWith("Attacks")]).toEqual(["Truth-Seeking Pierce", true, true]);
    expect(madara.talentGroups).toHaveLength(1);
    expect(madara.talentGroups[0]!.options.map((o) => [o.name, o.effects.length > 0, o.awakenings.map((w) => w.name)])).toEqual([["Infinite Tsukuyomi", true, ["Limbo · Border Jail"]]]);
    expect(madara.sources.length).toBeGreaterThanOrEqual(4);
    // "Source: Other" on the card is deliberately not a ninja attribute.
    expect(Object.keys(await db.ninja.findUniqueOrThrow({ where: { slug: madara.slug } })).filter((k) => /acquisition|source$/i.test(k))).toEqual([]);
  });

  it("does not turn evidence with an unknown owner into game records", async () => {
    const staged = readReferenceFile<StagedEvidenceFile>(REFERENCE_DIR, "staged-evidence.json");
    const usage = staged.items.find((i) => i.kind === "effect_usage")!;
    expect(usage).toMatchObject({ ownerName: null, usageOverridePercent: 20, defaultStatModifierPercent: 15, applicationChancePercent: null, durationRounds: 2, targetOriginal: "ally assaulters" });
    const records = await db.sourceRecord.findMany({ where: { key: { startsWith: usage.key } } });
    expect(records).toHaveLength(2); // the capture and its duplicate
    expect(records.every((r) => r.ninjaId === null && r.effectId === null && r.reviewStatus === "NEEDS_REVIEW")).toBe(true);
    // The staged usage created no effect. The Shatter Storm usages that exist all come from the ability text of a named ninja.
    const storms = await db.effect.findMany({ where: { statusEffect: { key: "shatter-storm" } }, include: { ability: true, talentOption: true } });
    expect(storms.every((e) => /shatter storm/i.test(e.sourceText ?? "") && (e.ability !== null || e.talentOption !== null))).toBe(true);
    // No effect row is tied to the staged usage record itself (asserted above); the same wording may appear in a named ninja's own text.
    const fragment = await db.sourceRecord.findUniqueOrThrow({ where: { key: "staged:fragment:madara-moons-eye-fury" }, include: { ninja: true } });
    expect(fragment.ninja?.slug).toBe("uchiha-madara-moon-s-eye");
    // Its Supporter profile (skill, talent awakening, status text) arrived later; the card-only fragment still belongs to it.
    expect(await db.ability.count({ where: { ninja: { slug: "uchiha-madara-moon-s-eye" } } })).toBeGreaterThanOrEqual(1);
  });

  it("the duplicate capture is registered as a duplicate, not as a second source of truth", async () => {
    const duplicate = await db.sourceAsset.findFirstOrThrow({ where: { path: { endsWith: "image(20261012-010611).png" } }, include: { duplicateOf: true } });
    expect(duplicate.duplicateOf?.path.endsWith("image(20261012-010554).png")).toBe(true);
    expect(first.assets).toEqual({ registered: 20, screenshots: 19, duplicates: 1 });
    expect(await db.sourceAsset.count({ where: { category: "SCREENSHOT", reviewed: true, capturedAt: null } })).toBeGreaterThanOrEqual(19);
  });

  it("holds no equipment, jewelry or gem records, because no such source was supplied", () => {
    expect(first.equipment).toEqual({ sets: expect.any(Number), pieces: expect.any(Number) });
    expect(first.totals.gems).toBeGreaterThanOrEqual(0);
    // The loader itself creates none: totals do not move between runs and it has no item input file.
    expect(existsSync(path.join(REFERENCE_DIR, "equipment.json"))).toBe(false);
    expect(existsSync(path.join(REFERENCE_DIR, "jewelry.json"))).toBe(false);
  });
});

describe("the loaded status guide", () => {
  /** Statuses that ability texts name and the guide does not define. */
  const fromAbilityTexts = new Set(readReferenceFile<{ statuses: { key: string; new?: boolean }[] }>(REFERENCE_DIR, "lexicon.json").statuses.filter((s) => s.new).map((s) => s.key));
  const loaded = async () => (await listStatusEffects(db)).filter((s) => !/^t\d*-/.test(s.key) && !fromAbilityTexts.has(s.key));

  it("contains the 46 statuses and 3 terms of the guide", async () => {
    const all = await loaded();
    expect(all.filter((s) => s.kind === "STATUS")).toHaveLength(46);
    expect(all.filter((s) => s.kind === "TERM").map((s) => s.name)).toEqual(["Penetration or Pierce damage", "DoT (damage over time)", "Physical or strategy defense shield"]);
    expect(first.glossary.partiallyConfirmed).toEqual(["Sticky acid", "Crit resistance reduction", "Wind Escape/Shield"]);
  });

  it("classifies by the guide's own headings", async () => {
    const names = async (filter: Parameters<typeof listStatusEffects>[1]) =>
      (await listStatusEffects(db, { kind: "STATUS", ...filter })).filter((s) => !/^t\d*-/.test(s.key)).map((s) => s.name);
    expect(await names({ categoryKeys: ["dot"], cleansability: "CLEANSABLE" })).toEqual(["Poison", "Ignite", "Power loss", "Orochi poison", "Vein damage", "Bleed", "Split", "Unification", "Safeguard", "Burst", "Scorching flame", "Sticky acid"]);
    expect(await names({ categoryKeys: ["dot"], cleansability: "UNCLEANSABLE" })).toEqual(["Incinerate (or Burn)"]);
    expect(await names({ categoryKeys: ["cc"] })).toEqual(["Blind", "Imprison", "Freeze", "Wind Bound", "Seal", "Charm", "Poisonous Wind", "Curse Fixation"]);
    expect(await names({ polarity: "DEBUFF", cleansability: "CLEANSABLE" })).toEqual(["Painful Will"]);
    expect(await names({ polarity: "DEBUFF", cleansability: "UNCLEANSABLE" })).toHaveLength(11);
    expect(await names({ polarity: "BUFF", cleansability: "UNCLEANSABLE" })).toHaveLength(11);
    expect(await names({ polarity: "BUFF", cleansability: "CLEANSABLE" })).toEqual(["Super dodge", "Fury Shield", "CC-free State", "Death Seed immunity buff"]);
  });

  it("Shatter Storm / Breaking Wind defaults to 15% and resolves 20% for an overriding usage", async () => {
    const storm = (await getStatusEffect(db, "shatter-storm"))!;
    expect(storm).toMatchObject({ name: "Shatter Storm/Breaking Wind", polarity: "BUFF", cleansability: "UNCLEANSABLE", overrideDocumented: true, description: "Increases attack and defenses by 15% (unless other is stated)" });
    expect(storm.aliases).toEqual(["Breaking Wind", "Shatter Storm"]);
    expect(storm.modifiers.map((m) => [m.statLabel, m.direction, m.magnitude])).toEqual([["attack", "INCREASE", 15], ["defenses", "INCREASE", 15]]);
    expect((await findStatusEffectsByTerm(db, "breaking wind")).map((s) => s.key)).toEqual(["shatter-storm"]);
    const staged = resolveEffectUsage(storm, { magnitudeOverride: 20, durationTurns: 2 });
    expect(staged.modifiers.map((m) => m.effectiveMagnitude)).toEqual([20, 20]);
    expect(staged.chancePercent).toBeNull();
    expect(resolveEffectUsage(storm, { magnitudeOverride: null }).modifiers.map((m) => m.effectiveMagnitude)).toEqual([15, 15]);
  });

  it("keeps contradictions and exceptions as written", async () => {
    const curse = (await getStatusEffect(db, "curse-fixation"))!;
    expect(curse.categories.map((c) => c.key).sort()).toEqual(["cc", "stat_modifier"]);
    expect(await db.sourceRecord.count({ where: { statusEffect: { key: "curse-fixation" } } })).toBe(2); // listed under two headings
    expect((await findStatusEffectsByTerm(db, "Shielding state")).map((s) => s.key).sort()).toEqual(["amenotejikara", "shielding-state"]);
    expect((await getStatusEffect(db, "s-super-dodge"))!.cleansabilityNote).toContain("can be cleansed");
    expect((await getStatusEffect(db, "sticky-acid"))!.modifiers).toEqual([]); // exception kept as text, not simulated
    expect((await getStatusEffect(db, "strong-state"))!.modifiers.map((m) => m.magnitude)).toEqual([null, null]); // no number in the guide
    const partial = await db.sourceRecord.findFirstOrThrow({ where: { statusEffect: { key: "crit-resistance-reduction" } } });
    expect(partial).toMatchObject({ reviewStatus: "PARTIALLY_CONFIRMED", sourceText: "Crit resistance reduction: as implied (20%, u… other is stated)" });
  });

  it("is honest about translation: source English kept, Spanish marked missing", async () => {
    const all = await loaded();
    expect(all.every((s) => s.translationStatus === "MISSING" && s.descriptionEs === null)).toBe(true);
    const formations = await db.formation.findMany({ orderBy: { sortOrder: "asc" } });
    expect(formations.map((f) => [f.name, f.nameEs, f.translationStatus, f.maxPerTeam])).toEqual([["Support", "Apoyo", "VERIFIED", 3], ["Center", "Centro", "VERIFIED", 2], ["Vanguard", "Vanguardia", "VERIFIED", 1], ["Assaulter", null, "MISSING", null]]);
  });

  it("source-category mappings: Assaulters is approved by the client, the others stay proposals", async () => {
    const roles = await db.ninjaRole.findMany({ where: { key: { in: ["supporters", "assaulters", "vanguards"] } }, include: { mappedFormation: true }, orderBy: { key: "asc" } });
    expect(roles.map((r) => [r.key, r.mappedFormation?.key, r.mappingStatus])).toEqual([["assaulters", "assaulter", "APPROVED"], ["supporters", "support", "PROPOSED"], ["vanguards", "vanguard", "PROPOSED"]]);
    // The card label «Assaulter» is its own row, and the client confirmed it is the same position as Center.
    const assaulter = await db.formation.findUniqueOrThrow({ where: { key: "assaulter" }, include: { equivalentTo: true } });
    expect([assaulter.equivalentTo?.key, assaulter.equivalenceStatus, assaulter.primaryStatisticId, assaulter.maxPerTeam]).toEqual(["center", "APPROVED", null, null]);
  });
});

describe("loaded ninja profiles", () => {
  const fromProfiles = { sourceRecords: { some: { key: { startsWith: "profile:" } } } };

  it("adds the ten Alien ninjas and updates release-list ninjas in place, without duplicating any", async () => {
    expect(first.profiles).toMatchObject({ sourceEntries: 184, distinctNinjas: 177, stagedRecords: 11 });
    expect(first.profiles!.created).toHaveLength(10);
    expect(first.profiles!.created.every((name) => name.startsWith("Alien "))).toBe(true);
    expect(first.profiles!.updated).toHaveLength(167);
    expect(await db.ninja.count({ where: fromReleaseList })).toBe(167);
    expect(await db.ninja.count({ where: fromProfiles })).toBe(177);
    const sasuke = await db.ninja.findUniqueOrThrow({ where: { slug: "cursed-seal-sasuke" } });
    expect([sasuke.name, sasuke.releaseYear, sasuke.releaseMonth, sasuke.releaseOrder, sasuke.status]).toEqual(["Cursed Seal Sasuke", 2012, 11, 1, "PUBLISHED"]);
  });

  it("is idempotent: the second run creates nothing and changes no count", () => {
    expect(second.profiles!.created).toEqual([]);
    expect(second.profiles!.updated).toHaveLength(177);
    expect(second.profiles!.evidenceRecords).toBe(first.profiles!.evidenceRecords);
    expect(second.totals).toEqual(first.totals);
    expect(second.profiles!.ledger).toEqual(first.profiles!.ledger);
  });

  it("creates no ninja for an entry whose identity is unresolved", async () => {
    expect(await db.ninja.count({ where: { slug: { in: ["immortal-madara", "neji-hyuga", "illusion-god-itachi", "nagato-uzumaki"] } } })).toBe(0);
    const staged = await db.sourceRecord.findMany({ where: { key: { startsWith: "profile:awakening:" }, field: { contains: "staged" } } });
    expect(staged).toHaveLength(11);
    expect(staged.every((r) => r.ninjaId === null && r.abilityId === null && r.talentOptionId === null && r.effectId === null && r.reviewStatus === "NEEDS_REVIEW")).toBe(true);
  });

  it("the Alien ninjas are their own collection with no release date", async () => {
    const aliens = await listNinjas(db, { roleKeys: ["alien-ninjas"] });
    expect(aliens.total).toBe(10);
    expect(aliens.items.every((n) => n.release === null && n.rating?.key === "SSS" && n.formation !== null)).toBe(true);
  });

  it("a card's formation is shown as printed, and the approved equivalence gives it Center's rule", async () => {
    const approved = (await getNinjaDetail(db, "variable-sakura"))!;
    expect(approved.formation).toMatchObject({ key: "assaulter", name: "Assaulter", nameEs: null, origin: "DIRECT", equivalence: { status: "APPROVED", toName: "Center", toNameEs: "Centro" } });
    expect(approved.primaryStat).toMatchObject({ key: "force" });
    expect(approved.baseStats.filter((s) => s.isPrimary).map((s) => s.sourceLabel)).toEqual(["Force"]);
    // Taking the approval away takes the rule away again (the data, not the code, carries the decision).
    await db.formation.update({ where: { key: "assaulter" }, data: { equivalenceStatus: "PROPOSED" } });
    try {
      expect((await getNinjaDetail(db, "variable-sakura"))!.primaryStat).toBeNull();
    } finally {
      await db.formation.update({ where: { key: "assaulter" }, data: { equivalenceStatus: "APPROVED" } });
    }
    expect((await getNinjaDetail(db, "angel-konan"))!.primaryStat).toMatchObject({ key: "chakra" });
    expect((await getNinjaDetail(db, "cursed-seal-sasuke"))!.primaryStat).toMatchObject({ key: "force" });
  });

  it("no rating, formation or type exists without a card behind it, and no class is ever assigned", async () => {
    expect(await db.ninja.count({ where: { ...fromProfiles, baseStats: { none: {} }, OR: [{ ratingId: { not: null } }, { formationId: { not: null } }, { ninjaTypeId: { not: null } }] } })).toBe(0);
    expect(await db.ninja.count({ where: { ...fromProfiles, clientCombatClass: { not: null } } })).toBe(0);
    const guy = (await getNinjaDetail(db, "might-guy"))!;
    // No card: no rating, type or statistics. The formation comes only from its channel, whose mapping the client approved.
    expect(guy).toMatchObject({ rating: null, type: null, baseStats: [], formation: { key: "assaulter", origin: "APPROVED_MAPPING" } });
    expect(guy.abilities).toHaveLength(1);
  });

  it("Sai: the usage's own strength is kept apart from its chance and duration", async () => {
    const sai = (await getNinjaDetail(db, "sai-errant-knight"))!;
    const all = sai.talentGroups.flatMap((g) => g.options).flatMap((o) => [...o.effects, ...o.awakenings.flatMap((w) => w.effects)]);
    const storm = all.find((e) => e.status?.definition.key === "shatter-storm")!;
    expect(storm).toMatchObject({ kind: "STATUS", chancePercent: 60, durationTurns: 2, targetCount: 1, targetSelector: "RANDOM", rateValue: null });
    expect(storm.status!.magnitudeOverride).toBe(10);
    expect(storm.status!.resolved.modifiers.map((m) => [m.effectiveMagnitude, m.origin])).toEqual([[10, "OVERRIDE"], [10, "OVERRIDE"]]);
    expect((await getStatusEffect(db, "shatter-storm"))!.modifiers.map((m) => m.magnitude)).toEqual([15, 15]);
  });

  it("Hinata (Soccer Star): once level 2 is unlocked, level 1 is no longer in force", async () => {
    const hinata = (await getNinjaDetail(db, "hinata-soccer-star"))!;
    const [l1, l2] = hinata.talentGroups[0]!.options[0]!.awakenings;
    expect([l2!.stage, l2!.stackingRule, l2!.supersedesId]).toEqual([2, "REPLACES_PRIOR", l1!.id]);
    const refs = [l1!, l2!].map((w) => ({ id: w.id, stage: w.stage, rule: w.stackingRule, supersedesId: w.supersedesId }));
    expect(resolveAwakenings(refs, 2).active).toEqual([l2!.id]);
    expect(resolveAwakenings(refs, 2).superseded).toEqual([{ id: l1!.id, byId: l2!.id, how: "REPLACED" }]);
  });

  it("stores English and supplied Spanish side by side, and invents no Spanish name", async () => {
    const skill = (await getNinjaDetail(db, "cursed-seal-sasuke"))!.abilities[0]!;
    expect(skill.effects[0]).toMatchObject({ sourceLine: 0, kind: "ATTACK", sourceText: "Attacks enemies with 100% growth rate.", descriptionEs: "Ataca a los enemigos con una tasa de crecimiento del 100%.", rateValue: 100, rateKind: "GROWTH", chancePercent: null });
    const konan = (await getNinjaDetail(db, "angel-konan"))!;
    // Spanish for the first 16 Supporters came from the recovery package, line for line next to the English.
    expect(konan.abilities[0]!.effects.every((e) => e.descriptionEs !== null && e.translationStatus === "SOURCE_PROVIDED" && e.sourceText)).toBe(true);
    const guren = (await getNinjaDetail(db, "guren"))!;
    expect(guren.abilities[0]!.effects.every((e) => e.descriptionEs === null && e.translationStatus === "MISSING")).toBe(true);
    expect(await db.ninja.count({ where: { ...fromProfiles, nameEs: { not: null } } })).toBe(0);
  });

  it("statuses that only ability texts name carry no made-up definition", async () => {
    const fromTexts = readReferenceFile<{ statuses: { key: string; new?: boolean }[] }>(REFERENCE_DIR, "lexicon.json").statuses.filter((s) => s.new);
    const rows = await db.statusEffect.findMany({ where: { key: { in: fromTexts.map((s) => s.key) } }, include: { modifiers: true } });
    expect(rows).toHaveLength(fromTexts.length);
    expect(rows.every((s) => s.description === null && s.modifiers.length === 0 && s.polarity === "UNKNOWN" && s.reviewStatus === "NEEDS_REVIEW")).toBe(true);
  });

  it("every stored row satisfies the database rules", async () => {
    if (!IS_PG) expect(await db.$queryRawUnsafe("PRAGMA foreign_key_check")).toEqual([]); // PostgreSQL enforces foreign keys at all times
    expect(await db.effect.count({ where: { rateValue: { not: null }, rateKind: null } })).toBe(0);
    expect(await db.effect.count({ where: { magnitudeOverride: { not: null }, statusEffectId: null } })).toBe(0);
    expect(await db.ability.count({ where: { abilityType: { key: { in: ["talent_awakening", "skill_awakening"] } }, parentAbilityId: null, talentOptionId: null } })).toBe(0);
  });
});
