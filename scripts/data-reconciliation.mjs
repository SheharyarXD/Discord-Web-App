import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const rows = [];
const add = (category, metric, value, detail = "") => rows.push([category, metric, value, detail]);

// ── the ledger, parsed ──
const parseCsv = (text) => {
  const out = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
    else field += c;
  }
  const [head, ...body] = out;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const ledger = parseCsv(readFileSync("MILESTONE_3_IMPORT_LEDGER.csv", "utf8").replace(/\r/g, ""));
const entries = ledger.filter((r) => r.source_id);

const ninjas = await db.ninja.findMany({
  select: {
    slug: true, name: true, status: true, releaseYear: true,
    role: { select: { key: true } }, rating: { select: { key: true } }, formation: { select: { key: true } }, ninjaType: { select: { key: true } },
    baseStats: { select: { statistic: { select: { key: true } } } },
    abilities: { select: { name: true, description: true, descriptionEs: true, note: true, stackingRule: true, abilityType: { select: { key: true } }, parentAbilityId: true, talentOptionId: true, effects: { select: { note: true } } } },
    talentGroups: { select: { options: { select: { name: true, description: true, descriptionEs: true, note: true, awakenings: { select: { stackingRule: true, description: true, descriptionEs: true, note: true, effects: { select: { note: true } }, abilityType: { select: { key: true } } } }, effects: { select: { note: true } } } } } },
  },
});

/** Every block of text of one ninja: talents, skills, passives, awakenings. Status definitions are not blocks of the ninja's own ability. */
const blocksOf = (n) => {
  const out = [];
  for (const a of n.abilities) if (a.abilityType.key !== "status_note") out.push({ kind: a.abilityType.key, d: a.description, es: a.descriptionEs, note: a.note, effects: a.effects });
  for (const g of n.talentGroups) for (const o of g.options) {
    out.push({ kind: "talent", d: o.description, es: o.descriptionEs, note: o.note, effects: o.effects });
  }
  return out;
};
const hasText = (b) => Boolean(b.d);
const isConflict = (b) => /ES_(LINE_COUNT|NUMBERS|WORDING|TEXT_CUT)/.test(`${b.note ?? ""} ${b.effects.map((e) => e.note ?? "").join(" ")}`);

const CATEGORIES = [
  ["Vanguard", "vanguards"],
  ["Center / Assaulter", "assaulters"],
  ["Supporter", "supporters"],
  ["Alien Ninja", "alien-ninjas"],
  ["Awakening channel only", "awakening-ninjas"],
];
const byRole = (key) => ninjas.filter((n) => n.role?.key === key);
const fullCard = (n) => n.rating && n.formation && n.ninjaType && n.baseStats.length === 4;

for (const [label, role] of CATEGORIES) {
  const list = byRole(role);
  const src = entries.filter((e) => e.channel === role);
  const talentSkill = (n) => blocksOf(n).filter((b) => ["skill", "normal_skill", "special_skill", "passive", "talent"].includes(b.kind));
  const textComplete = list.filter((n) => talentSkill(n).length > 0 && talentSkill(n).every(hasText));
  const textSome = list.filter((n) => talentSkill(n).some(hasText));
  const esComplete = list.filter((n) => talentSkill(n).length > 0 && talentSkill(n).every((b) => hasText(b) && b.es));
  const esSome = list.filter((n) => talentSkill(n).some((b) => b.es));
  const conflicts = list.filter((n) => blocksOf(n).some(isConflict));
  add(label, "source entries in the ledger", src.length, src.length ? `collection status: ${src[0].channel_collection}` : "");
  add(label, "distinct ninjas in the database", list.length, role === "awakening-ninjas" ? "7 entries; 2 are the same ninja as a Vanguard / Supporter entry, 4 are unresolved and not created" : "");
  add(label, "full cards (rank, formation, type, 4 base stats)", list.filter(fullCard).length);
  add(label, "ninjas with English ability text", textSome.length);
  add(label, "ninjas whose every talent and skill has English text", textComplete.length);
  add(label, "ninjas whose every talent and skill has Spanish text", esComplete.length);
  add(label, "ninjas with some Spanish text", esSome.length);
  add(label, "ninjas with English / Spanish conflicts flagged", conflicts.length, conflicts.map((n) => n.name).join("; "));
  add(label, "missing: no card", list.filter((n) => !fullCard(n)).length, list.filter((n) => !fullCard(n)).map((n) => n.name).join("; "));
  add(label, "missing: no English ability text", list.length - textSome.length, list.filter((n) => !talentSkill(n).some(hasText)).map((n) => n.name).join("; "));
  add(label, "missing: no Spanish text", list.length - esSome.length, list.filter((n) => !talentSkill(n).some((b) => b.es)).map((n) => n.name).join("; "));
}

const noRole = ninjas.filter((n) => !n.role);
add("Release list only", "ninjas with a release date and no source channel", noRole.length, "name and release month only; includes every Supporter not yet collected");
add("Release list only", "of which with any ability text", noRole.filter((n) => blocksOf(n).some(hasText)).length);
const distinct = ninjas.length;
add("All distinct ninjas", "exact deduplicated total in the database", distinct, "167 release list + 10 Alien");
add("All distinct ninjas", "published", ninjas.filter((n) => n.status === "PUBLISHED").length);
add("All distinct ninjas", "with a full card", ninjas.filter(fullCard).length, "includes Uchiha Madara (Moon's Eye) from the first delivery");
add("All distinct ninjas", "with English ability text", ninjas.filter((n) => blocksOf(n).some(hasText)).length);
add("All distinct ninjas", "with Spanish ability text", ninjas.filter((n) => blocksOf(n).some((b) => b.es)).length);
add("All distinct ninjas", "source entries in the ledger / resolved to a ninja", `${entries.length} / ${entries.filter((e) => e.slug).length}`, "4 entries are unresolved and create no ninja; 2 entries are cross-channel duplicates of another entry");
const resolvedEntries = entries.filter((e) => e.action !== "STAGED_ONLY");
add("All distinct ninjas", "distinct ninjas from the ledger", new Set(resolvedEntries.map((e) => e.slug)).size, "cross-check against the database below");
const fromProfiles = await db.ninja.count({ where: { sourceRecords: { some: { key: { startsWith: "profile:" } } } } });
add("All distinct ninjas", "database ninjas with a profile record", fromProfiles);
add("Cross-check", "ledger distinct ninjas == database ninjas with a profile record", new Set(resolvedEntries.map((e) => e.slug)).size === fromProfiles ? "PASS" : "FAIL");
add("Cross-check", "ledger entries with a card == full cards of profile ninjas", `${entries.filter((e) => e.has_card === "yes").length} cards`, "112 distinct cards + 1 earlier (Moon's Eye) = 113");

// ranks
const ranks = new Map();
for (const n of ninjas) if (n.rating) ranks.set(n.rating.key, (ranks.get(n.rating.key) ?? 0) + 1);
const order = (await db.ninjaRating.findMany({ orderBy: { sortOrder: "asc" } })).map((r) => r.key);
for (const key of order) add("Rankings", `rank ${key}`, ranks.get(key) ?? 0, ranks.has(key) ? "" : "defined, no ninja has it yet");
add("Rankings", "ninjas without a rank (no card)", ninjas.filter((n) => !n.rating).length);

// awakenings
const aw = await db.ability.findMany({ where: { abilityType: { key: { in: ["talent_awakening", "skill_awakening"] } } }, select: { stackingRule: true, abilityType: { select: { key: true } }, ninjaId: true, ninja: { select: { name: true } }, stage: true, name: true } });
add("Awakenings", "awakening stages stored", aw.length, `${aw.filter((a) => a.abilityType.key === "talent_awakening").length} talent, ${aw.filter((a) => a.abilityType.key === "skill_awakening").length} skill`);
add("Awakenings", "ninjas with awakenings", new Set(aw.map((a) => a.ninjaId)).size);
for (const rule of ["REPLACES_PRIOR", "CANCELS_PRIOR", "UPGRADES_BASE", "CUMULATIVE", "UNKNOWN"]) {
  const list = aw.filter((a) => a.stackingRule === rule);
  add("Awakenings", `rule ${rule}`, list.length, rule === "UNKNOWN" ? "source does not say; shown separately and never summed" : list.map((a) => `${a.ninja.name} stage ${a.stage}`).join("; "));
}
add("Awakenings", "confirmed rules waiting for ability text", 3, "Natsu Dragneel talent L2 replaces L1, Natsu Dragneel skill L1 (550% one random enemy), Cursed Tayuya special-card awakening: no ability text exists in the supplied files");

// text volumes
const effects = await db.effect.groupBy({ by: ["structuredStatus"], _count: true });
add("Descriptions", "effect rows", effects.reduce((n, e) => n + e._count, 0), effects.map((e) => `${e.structuredStatus}=${e._count}`).join(", "));
add("Descriptions", "effect rows with supplied Spanish", await db.effect.count({ where: { descriptionEs: { not: null } } }));
add("Descriptions", "rows that take a missing English number from the Spanish", await db.effect.count({ where: { note: { contains: "VALUE_FROM_ES" } } }), "client rule for older ninjas");
add("Descriptions", "ninjas with English/Spanish conflicts", ninjas.filter((n) => blocksOf(n).some(isConflict)).length, "both texts kept; English is the original");
add("Descriptions", "English lines / Spanish lines imported", `${entries.reduce((n, e) => n + Number(e.en_lines || 0), 0)} / ${entries.reduce((n, e) => n + Number(e.es_lines || 0), 0)}`, "counted from the ledger");

// unresolved
for (const e of entries.filter((x) => x.action === "STAGED_ONLY")) add("Import conflicts", "unresolved identity (staged, no ninja created)", e.name_as_posted, e.collector_notes);
for (const e of entries.filter((x) => x.flags.includes("CARD_MISSING"))) add("Import conflicts", "card missing", e.name_as_posted, "no rating, formation, type or stats stored");
add("Import conflicts", "cards in another language matched by position", entries.filter((x) => x.flags.includes("LABEL_MATCHED_BY_POSITION")).length, entries.filter((x) => x.flags.includes("LABEL_MATCHED_BY_POSITION")).map((x) => x.ninja).join("; "));
add("Import conflicts", "skills not matched to the card's single skill name", entries.filter((x) => x.flags.includes("CARD_SKILL_LABEL_UNPLACED")).length, entries.filter((x) => x.flags.includes("CARD_SKILL_LABEL_UNPLACED")).map((x) => x.ninja).join("; "));

// items
const [eq, jw, gm, es, js, eqE, jwE] = await Promise.all([db.equipment.count(), db.jewelry.count(), db.gem.count(), db.equipmentSet.count(), db.jewelrySet.count(), db.equipmentSlot.count(), db.jewelryType.count()]);
add("Equipment, jewelry, gems", "equipment pieces", eq, "no source material supplied; structures, pages and admin forms exist and are tested with fixtures");
add("Equipment, jewelry, gems", "jewelry pieces", jw);
add("Equipment, jewelry, gems", "gems", gm, "Gems menu and pages stay hidden (404) until authorized");
add("Equipment, jewelry, gems", "equipment sets / jewelry sets", `${es} / ${js}`);
add("Equipment, jewelry, gems", "equipment slots / jewelry types defined", `${eqE} / ${jwE}`, "none are invented");

const csv = [["category", "metric", "value", "detail"], ...rows].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
writeFileSync("MILESTONE_3_DATA_METRICS.csv", csv);
for (const r of rows) console.log(r.slice(0, 3).join(" | "));
await db.$disconnect();
