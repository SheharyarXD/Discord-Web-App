import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * One counting methodology for every Milestone 3 report. Reads the live database only and writes
 * scripts/.audit-figures.json (git-ignored) for the report generators.
 *
 * Definitions
 *  - Awakening stage      = one Ability row of type talent_awakening or skill_awakening (each counted once).
 *  - Stated rule          = an awakening stage whose stackingRule is not UNKNOWN.
 *  - Text block           = a talent option, a skill (skill, normal_skill, special_skill) or an awakening stage.
 *  - Status definition    = an Ability row of type status_note. Optional text: not part of "Spanish complete".
 *  - Spanish block status = COMPLETE (Spanish present, not cut), PARTIAL (Spanish present, flagged ES_TEXT_CUT), MISSING (no Spanish).
 *  - Spanish complete ninja = every text block with English text has COMPLETE Spanish.
 *  - Full card            = rating, formation, type and four base statistics.
 */
const db = new PrismaClient();
const numbers = (s) => (s ?? "").match(/\d+(?:\.\d+)?/g)?.sort().join("|") ?? "";
const ninjas = await db.ninja.findMany({
  orderBy: [{ releaseOrder: "asc" }, { name: "asc" }],
  include: {
    role: true, formation: true, rating: true, ninjaType: true, baseStats: true, aliases: true,
    abilities: { include: { abilityType: true, effects: { select: { structuredStatus: true, note: true, descriptionEs: true } } } },
    talentGroups: { include: { options: { include: { effects: { select: { structuredStatus: true, note: true, descriptionEs: true } } } } } },
  },
});
const AW = ["talent_awakening", "skill_awakening"];
const SKILL = ["skill", "normal_skill", "special_skill"];
const per = [];
for (const n of ninjas) {
  const blocks = [];
  for (const g of n.talentGroups) for (const o of g.options) blocks.push({ kind: "talent", name: o.name, d: o.description, es: o.descriptionEs, note: o.note, eff: o.effects });
  for (const a of n.abilities) {
    const k = a.abilityType.key;
    if (SKILL.includes(k) || AW.includes(k)) blocks.push({ kind: k, name: a.name, d: a.description, es: a.descriptionEs, note: a.note, eff: a.effects, rule: a.stackingRule });
  }
  const statuses = n.abilities.filter((a) => a.abilityType.key === "status_note");
  const withText = blocks.filter((b) => b.d);
  const esState = (b) => (!b.es ? "MISSING" : /ES_TEXT_CUT/.test(`${b.note ?? ""} ${b.eff.map((e) => e.note ?? "").join(" ")}`) || /TRUNCATED IN SOURCE/.test(b.es) ? "PARTIAL" : "COMPLETE");
  const states = withText.map(esState);
  const awak = n.abilities.filter((a) => AW.includes(a.abilityType.key));
  per.push({
    name: n.name, slug: n.slug, role: n.role?.key ?? "", rating: n.rating?.key ?? "", formation: n.formation?.name ?? "", type: n.ninjaType?.name ?? "",
    fullCard: Boolean(n.rating && n.formation && n.ninjaType && n.baseStats.length === 4),
    textBlocks: withText.length, enText: withText.length > 0,
    esComplete: states.filter((s) => s === "COMPLETE").length, esPartial: states.filter((s) => s === "PARTIAL").length, esMissing: states.filter((s) => s === "MISSING").length,
    esNinja: withText.length === 0 ? "NO_ENGLISH" : states.every((s) => s === "COMPLETE") ? "COMPLETE" : states.every((s) => s === "MISSING") ? "MISSING" : states.some((s) => s === "PARTIAL") ? "PARTIAL" : "MISSING_SOME",
    statusDefs: statuses.length, statusDefsWithEs: statuses.filter((s) => s.descriptionEs).length,
    awakeningStages: awak.length, awakeningStated: awak.filter((a) => a.stackingRule !== "UNKNOWN").length,
    effectRows: blocks.reduce((t, b) => t + b.eff.length, 0), aliases: n.aliases.length,
    esLineCountDiffers: withText.filter((b) => b.es && /ES_LINE_COUNT_DIFFERS/.test(b.note ?? "")).map((b) => b.name),
    // a block whose English and Spanish carry different numbers (any reason)
    esNumberMismatch: withText.filter((b) => b.es && numbers(b.d) !== numbers(b.es)).map((b) => b.name),
  });
}
const sum = (f) => per.reduce((t, n) => t + f(n), 0);
const awakRows = await db.ability.findMany({ where: { abilityType: { key: { in: AW } } }, select: { stackingRule: true, stage: true, name: true, abilityType: { select: { key: true } }, ninja: { select: { name: true } } } });
const figures = {
  ninjas: per.length,
  fullCards: per.filter((n) => n.fullCard).length,
  withEnglish: per.filter((n) => n.enText).length,
  esNinja: Object.fromEntries(["COMPLETE", "PARTIAL", "MISSING_SOME", "MISSING", "NO_ENGLISH"].map((k) => [k, per.filter((n) => n.esNinja === k).length])),
  esNinjaNames: Object.fromEntries(["PARTIAL", "MISSING_SOME", "MISSING"].map((k) => [k, per.filter((n) => n.esNinja === k).map((n) => n.name)])),
  textBlocks: sum((n) => n.textBlocks), esBlocks: { complete: sum((n) => n.esComplete), partial: sum((n) => n.esPartial), missing: sum((n) => n.esMissing) },
  statusDefs: { total: sum((n) => n.statusDefs), withSpanish: sum((n) => n.statusDefsWithEs), ninjasMissingSpanish: per.filter((n) => n.statusDefs > n.statusDefsWithEs).map((n) => n.name) },
  awakening: {
    stages: awakRows.length, talent: awakRows.filter((a) => a.abilityType.key === "talent_awakening").length, skill: awakRows.filter((a) => a.abilityType.key === "skill_awakening").length,
    ninjas: per.filter((n) => n.awakeningStages > 0).length, sumOfPerNinja: sum((n) => n.awakeningStages),
    byRule: Object.fromEntries(["UNKNOWN", "REPLACES_PRIOR", "CANCELS_PRIOR", "UPGRADES_BASE", "CUMULATIVE"].map((r) => [r, awakRows.filter((a) => a.stackingRule === r).map((a) => `${a.ninja.name} stage ${a.stage}`)])),
    stated: awakRows.filter((a) => a.stackingRule !== "UNKNOWN").length, statedSumOfPerNinja: sum((n) => n.awakeningStated),
  },
  effectRows: sum((n) => n.effectRows),
  roles: Object.fromEntries([...new Set(per.map((n) => n.role))].map((r) => [r || "none", per.filter((n) => n.role === r).length])),
  roleFullCards: Object.fromEntries([...new Set(per.map((n) => n.role))].map((r) => [r || "none", per.filter((n) => n.role === r && n.fullCard).length])),
  supportFormation: per.filter((n) => n.formation === "Support").length,
  supportFormationNotSupporterRole: per.filter((n) => n.formation === "Support" && n.role !== "supporters").map((n) => `${n.name} (${n.role})`),
  aliases: { total: sum((n) => n.aliases), byStatus: Object.fromEntries((await db.ninjaAlias.groupBy({ by: ["status"], _count: true })).map((g) => [g.status, g._count])) },
  ratings: Object.fromEntries((await db.ninjaRating.findMany({ orderBy: { sortOrder: "asc" } })).map((r) => [r.key, per.filter((n) => n.rating === r.key).length])),
  noRating: per.filter((n) => !n.rating).map((n) => n.name),
  noCard: per.filter((n) => !n.fullCard).map((n) => n.name),
  esLineCountDiffers: per.filter((n) => n.esLineCountDiffers.length).map((n) => `${n.name}: ${n.esLineCountDiffers.join(", ")}`),
  esNumberMismatch: per.filter((n) => n.esNumberMismatch.length).map((n) => `${n.name}: ${n.esNumberMismatch.join(", ")}`),
  items: { equipment: await db.equipment.count(), jewelry: await db.jewelry.count(), gems: await db.gem.count(), equipmentSets: await db.equipmentSet.count(), jewelrySets: await db.jewelrySet.count() },
  effectStatus: Object.fromEntries((await db.effect.groupBy({ by: ["structuredStatus"], _count: true })).map((g) => [g.structuredStatus, g._count])),
  duplicateNames: per.length - new Set(per.map((n) => n.slug)).size,
};
writeFileSync("scripts/.audit-figures.json", JSON.stringify({ figures, per }, null, 1));
console.log(JSON.stringify(figures, null, 1));
await db.$disconnect();
